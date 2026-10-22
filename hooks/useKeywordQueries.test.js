import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { useAddKeyword } from './useKeywordQueries'
import apiService from '@/lib/apiService'
import { queryKeys } from '@/lib/query/keys'

/**
 * Covers the "newly added keyword appears immediately, with a 'Scanning…'
 * placeholder, and is replaced by the real result without an extra
 * round-trip" fix. The backend call itself is mocked — this only exercises
 * useAddKeyword's own cache logic (onMutate/onSuccess/onError), which is
 * what actually determines when/what the table renders.
 */

vi.mock('@/lib/apiService', () => ({
  default: {
    addKeyword: vi.fn(),
    getProjectRankings: vi.fn(),
  },
}))

const PROJECT_ID = 'project-1'

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Wrapper({ client, children }) {
  return React.createElement(QueryClientProvider, { client }, children)
}

function seedExistingKeywords(client, keywords) {
  client.setQueryData(queryKeys.keywords.list(PROJECT_ID), {
    success: true,
    data: [{ keywords, usage: { used: keywords.length, limit: 5, remaining: 5 - keywords.length } }],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAddKeyword — optimistic placeholder', () => {
  test('the placeholder appears in the cache immediately, before the mutation resolves', async () => {
    const client = makeClient()
    seedExistingKeywords(client, [{ keyword: 'existing keyword', current_rank: 5, last_scan_status: 'ok' }])

    let resolveAdd
    apiService.addKeyword.mockImplementation(() => new Promise((resolve) => { resolveAdd = resolve }))

    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), {
      wrapper: (props) => Wrapper({ client, ...props }),
    })

    act(() => {
      result.current.mutate('best software company near me')
    })

    await waitFor(() => {
      const cached = client.getQueryData(queryKeys.keywords.list(PROJECT_ID))
      const kw = cached.data[0].keywords.find((k) => k.keyword === 'best software company near me')
      expect(kw).toBeDefined()
      expect(kw.last_scan_status).toBe('pending')
      // Never a fabricated rank — this is the whole point.
      expect(kw.current_rank).toBeNull()
    })

    // Mutation never resolved yet — placeholder must not have been replaced.
    const cached = client.getQueryData(queryKeys.keywords.list(PROJECT_ID))
    expect(cached.data[0].keywords).toHaveLength(2)

    resolveAdd({ success: true, data: { keyword: { keyword: 'best software company near me', current_rank: 12, last_scan_status: 'ok', status: 'ranked' }, usage: { used: 2, limit: 5, remaining: 3 } } })
  })

  test('on success, the placeholder is replaced in place with the real result — no duplicate row, no extra GET', async () => {
    const client = makeClient()
    seedExistingKeywords(client, [])

    apiService.addKeyword.mockResolvedValue({
      success: true,
      data: {
        keyword: { keyword: 'best software company near me', current_rank: 12, best_rank: 12, last_scan_status: 'ok', status: 'ranked' },
        usage: { used: 1, limit: 5, remaining: 4 },
      },
    })

    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), {
      wrapper: (props) => Wrapper({ client, ...props }),
    })

    await act(async () => {
      await result.current.mutateAsync('best software company near me')
    })

    const cached = client.getQueryData(queryKeys.keywords.list(PROJECT_ID))
    const keywords = cached.data[0].keywords
    expect(keywords).toHaveLength(1)
    expect(keywords[0].last_scan_status).toBe('ok')
    expect(keywords[0].current_rank).toBe(12)
    expect(cached.data[0].usage.used).toBe(1)

    // No follow-up GET — the mutation response was written directly.
    expect(apiService.getProjectRankings).not.toHaveBeenCalled()
  })

  test('a scan_error result still replaces the placeholder (row stays visible, marked scan_error, not dropped)', async () => {
    const client = makeClient()
    seedExistingKeywords(client, [])

    apiService.addKeyword.mockResolvedValue({
      success: true,
      data: {
        keyword: { keyword: 'best software company near me', current_rank: null, last_scan_status: 'error', last_scan_error: 'Ranking check temporarily unavailable.', status: 'scan_error' },
        usage: { used: 1, limit: 5, remaining: 4 },
      },
    })

    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), {
      wrapper: (props) => Wrapper({ client, ...props }),
    })

    await act(async () => {
      await result.current.mutateAsync('best software company near me')
    })

    const cached = client.getQueryData(queryKeys.keywords.list(PROJECT_ID))
    const keywords = cached.data[0].keywords
    expect(keywords).toHaveLength(1)
    expect(keywords[0].last_scan_status).toBe('error')
    expect(keywords[0].status).toBe('scan_error')
  })

  test('on a hard request failure, the placeholder is rolled back — no stuck "Scanning…" row', async () => {
    const client = makeClient()
    seedExistingKeywords(client, [{ keyword: 'existing keyword', current_rank: 5, last_scan_status: 'ok' }])

    apiService.addKeyword.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), {
      wrapper: (props) => Wrapper({ client, ...props }),
    })

    await act(async () => {
      try {
        await result.current.mutateAsync('best software company near me')
      } catch {
        // expected — asserting the rollback below, not the rejection itself
      }
    })

    const cached = client.getQueryData(queryKeys.keywords.list(PROJECT_ID))
    expect(cached.data[0].keywords).toHaveLength(1)
    expect(cached.data[0].keywords[0].keyword).toBe('existing keyword')
  })
})

describe('useAddKeyword — project that has no ranking document yet', () => {
  const emptyKey = () => queryKeys.keywords.list(PROJECT_ID)
  const seedEmpty = (client) => client.setQueryData(emptyKey(), { success: true, data: [] })

  test('adding the first keyword refetches so the new document and keyword appear (nothing to patch in the cache)', async () => {
    const client = makeClient()
    seedEmpty(client)
    const newKw = { keyword: 'first keyword', current_rank: 7, last_scan_status: 'ok', mobile: { status: 'not_ranked' } }
    apiService.addKeyword.mockResolvedValue({ success: true, data: { keyword: newKw, usage: { used: 1, limit: 5, remaining: 4 } } })
    apiService.getProjectRankings.mockResolvedValue({
      success: true,
      data: [{ keywords: [newKw], usage: { used: 1, limit: 5, remaining: 4 }, country: 'IN', location_code: 9040235 }],
    })
    // an active observer, like the Keywords page has
    const observer = new QueryObserver(client, { queryKey: emptyKey(), queryFn: () => apiService.getProjectRankings(PROJECT_ID), staleTime: Infinity })
    const stop = observer.subscribe(() => {})

    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), { wrapper: (p) => Wrapper({ client, ...p }) })
    await act(async () => { await result.current.mutateAsync('first keyword') })

    await waitFor(() => expect(client.getQueryData(emptyKey()).data[0]?.keywords?.[0]?.keyword).toBe('first keyword'))
    expect(apiService.getProjectRankings).toHaveBeenCalled()
    stop()
  })

  test('when a ranking document already exists the result is patched in place without an extra fetch', async () => {
    const client = makeClient()
    seedExistingKeywords(client, [{ keyword: 'existing keyword', current_rank: 5, last_scan_status: 'ok' }])
    apiService.addKeyword.mockResolvedValue({ success: true, data: { keyword: { keyword: 'another', current_rank: 3, last_scan_status: 'ok' }, usage: { used: 2, limit: 5, remaining: 3 } } })
    const { result } = renderHook(() => useAddKeyword(PROJECT_ID), { wrapper: (p) => Wrapper({ client, ...p }) })
    await act(async () => { await result.current.mutateAsync('another') })
    expect(apiService.getProjectRankings).not.toHaveBeenCalled()
    expect(client.getQueryData(queryKeys.keywords.list(PROJECT_ID)).data[0].keywords.map(k => k.keyword)).toContain('another')
  })
})

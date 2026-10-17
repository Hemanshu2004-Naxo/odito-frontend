import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUrlVerification } from './useUrlVerification'
import apiService from '@/lib/apiService'
import socketService from '@/lib/socketService'
import { queryKeys } from '@/lib/query/keys'

// jsdom + createRoot needs this flag or React logs a harmless
// "not configured to support act" warning on every update.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/apiService', () => ({
  default: { verifyUrl: vi.fn() },
}))

vi.mock('@/lib/socketService', () => ({
  default: {
    onVerificationStarted: vi.fn(),
    onVerificationProgress: vi.fn(),
    onVerificationCompleted: vi.fn(),
    onVerificationFailed: vi.fn(),
    offVerificationStarted: vi.fn(),
    offVerificationProgress: vi.fn(),
    offVerificationCompleted: vi.fn(),
    offVerificationFailed: vi.fn(),
    joinProject: vi.fn(),
  },
}))

// No @testing-library/react in this project (confirmed via package.json) —
// this is a minimal hand-rolled renderHook-equivalent: mount the hook inside
// a host component and capture its returned state on every render.
function Harness({ projectId, pageUrl, onState }) {
  const state = useUrlVerification(projectId, pageUrl)
  onState(state)
  return null
}

let container
let root
let queryClient
let latestState

function renderHarness(projectId, pageUrl) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Harness, {
          projectId,
          pageUrl,
          onState: (s) => {
            latestState = s
          },
        })
      )
    )
  })
}

// Grabs the most recently registered callback for a given mocked
// socketService.onVerification* method.
function lastHandler(mockFn) {
  const calls = mockFn.mock.calls
  return calls[calls.length - 1]?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  latestState = undefined
})

afterEach(() => {
  if (root) {
    act(() => {
      root.unmount()
    })
  }
  if (container) container.remove()
  container = null
  root = null
})

describe('useUrlVerification', () => {
  it('calls apiService.verifyUrl exactly once with projectId and pageUrl', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    expect(apiService.verifyUrl).toHaveBeenCalledTimes(1)
    expect(apiService.verifyUrl).toHaveBeenCalledWith('proj-1', 'https://example.com/page')
  })

  it('opens the modal and subscribes to websocket events only after a successful start', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    expect(latestState.modalOpen).toBe(false)

    await act(async () => {
      await latestState.verifyUrl()
    })

    expect(latestState.modalOpen).toBe(true)
    expect(latestState.isVerifying).toBe(true)
    expect(latestState.progress).toMatchObject({ status: 'starting' })
    expect(socketService.onVerificationStarted).toHaveBeenCalledTimes(1)
    expect(socketService.onVerificationProgress).toHaveBeenCalledTimes(1)
    expect(socketService.onVerificationCompleted).toHaveBeenCalledTimes(1)
    expect(socketService.onVerificationFailed).toHaveBeenCalledTimes(1)
    expect(socketService.joinProject).toHaveBeenCalledWith('proj-1')
  })

  it('does not open the modal when the start request is rejected (already running)', async () => {
    const error = new Error('Already running')
    error.status = 409
    apiService.verifyUrl.mockRejectedValue(error)
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    expect(latestState.modalOpen).toBe(false)
    expect(latestState.isVerifying).toBe(false)
    expect(latestState.startError).toBe('A verification for this page is already in progress.')
    expect(socketService.onVerificationStarted).not.toHaveBeenCalled()
  })

  it('maps permission-denied (403) and network/unexpected (no status) errors distinctly', async () => {
    const forbidden = new Error('nope')
    forbidden.status = 403
    apiService.verifyUrl.mockRejectedValueOnce(forbidden)
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })
    expect(latestState.startError).toBe('You do not have permission to verify this page.')

    const networkError = new Error('Failed to fetch')
    apiService.verifyUrl.mockRejectedValueOnce(networkError)
    await act(async () => {
      await latestState.verifyUrl()
    })
    expect(latestState.startError).toBe('Failed to fetch')
  })

  it('updates progress on verification:started and verification:progress for this run', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    const onStarted = lastHandler(socketService.onVerificationStarted)
    act(() => {
      onStarted({ runId: 'run-1', pageUrl: 'https://example.com/page', currentStage: 'Page Scraping', progress: 20 })
    })
    expect(latestState.progress).toMatchObject({ status: 'processing', stage: 'Page Scraping', percentage: 20 })

    const onProgress = lastHandler(socketService.onVerificationProgress)
    act(() => {
      onProgress({ runId: 'run-1', currentStage: 'SEO Scoring', progress: 65 })
    })
    expect(latestState.progress).toMatchObject({ status: 'processing', stage: 'SEO Scoring', percentage: 65 })
  })

  it('ignores events for a different run (another page in the same project room)', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    const onStarted = lastHandler(socketService.onVerificationStarted)
    act(() => {
      onStarted({ runId: 'run-1', pageUrl: 'https://example.com/page', currentStage: 'Page Scraping', progress: 20 })
    })

    const onProgress = lastHandler(socketService.onVerificationProgress)
    act(() => {
      onProgress({ runId: 'some-other-run', currentStage: 'SEO Scoring', progress: 99 })
    })

    // Still reflects the last event that matched THIS run, not the foreign one.
    expect(latestState.progress).toMatchObject({ stage: 'Page Scraping', percentage: 20 })
  })

  it('on completion: closes tracking, unsubscribes, and invalidates only this page\'s issues + verification-result queries', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    const onCompleted = lastHandler(socketService.onVerificationCompleted)
    act(() => {
      onCompleted({ runId: 'run-1' })
    })

    expect(latestState.progress).toMatchObject({ status: 'completed', percentage: 100 })
    expect(latestState.isVerifying).toBe(false)
    expect(socketService.offVerificationStarted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationProgress).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationCompleted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationFailed).toHaveBeenCalledTimes(1)

    expect(invalidateSpy).toHaveBeenCalledTimes(4)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.issues.page('proj-1', 'https://example.com/page'),
    })
    // this page's issue-context (the "Current State" derived from the replaced crawl) — and no other page's, no other project's
    const scoped = invalidateSpy.mock.calls.map((c) => c[0]).find((a) => typeof a.predicate === 'function')
    const q = (queryKey) => ({ queryKey })
    expect(scoped.predicate(q(['issue-context', 'proj-1', 'images_missing_alt_text', 'https://example.com/page']))).toBe(true)
    expect(scoped.predicate(q(['issue-context', 'proj-1', 'title_missing', 'https://example.com/page']))).toBe(true)
    expect(scoped.predicate(q(['issue-context', 'proj-1', 'images_missing_alt_text', 'https://example.com/other']))).toBe(false)
    expect(scoped.predicate(q(['issue-context', 'proj-2', 'images_missing_alt_text', 'https://example.com/page']))).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.verification.latest('proj-1', 'https://example.com/page'),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.verification.projectHistory('proj-1'),
    })
  })

  it('on failure: shows the failure state, unsubscribes, and does NOT invalidate any query', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    const onFailed = lastHandler(socketService.onVerificationFailed)
    act(() => {
      onFailed({ runId: 'run-1', errorMessage: 'Page returned a 500' })
    })

    expect(latestState.progress).toMatchObject({ status: 'failed', errorMessage: 'Page returned a 500' })
    expect(latestState.isVerifying).toBe(false)
    expect(socketService.offVerificationStarted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationFailed).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('closeModal detaches listeners without cancelling the server-side run', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    act(() => {
      latestState.closeModal()
    })

    expect(latestState.modalOpen).toBe(false)
    expect(latestState.isVerifying).toBe(false)
    expect(socketService.offVerificationStarted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationCompleted).toHaveBeenCalledTimes(1)
    // No cancel/abort endpoint exists or was called.
    expect(apiService.verifyUrl).toHaveBeenCalledTimes(1)
  })

  it('unmounting mid-verification detaches all listeners (no leaks)', async () => {
    apiService.verifyUrl.mockResolvedValue({ success: true, data: { runId: 'run-1' } })
    renderHarness('proj-1', 'https://example.com/page')

    await act(async () => {
      await latestState.verifyUrl()
    })

    act(() => {
      root.unmount()
    })
    root = null

    expect(socketService.offVerificationStarted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationProgress).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationCompleted).toHaveBeenCalledTimes(1)
    expect(socketService.offVerificationFailed).toHaveBeenCalledTimes(1)
  })
})

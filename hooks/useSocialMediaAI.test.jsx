import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createQueryClient, publication, installPublicationsApi, statusResponse, ACTIVE_FACEBOOK, EXPIRED, apiError,
} from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({
  getSocialAccountsStatus: vi.fn(),
  getSocialPublications: vi.fn(),
  getMetaConnectUrl: vi.fn(),
  verifySocialAccounts: vi.fn(),
  disconnectSocialAccount: vi.fn(),
  scheduleSocialPublication: vi.fn(),
  updateSocialPublication: vi.fn(),
  cancelSocialPublication: vi.fn(),
  deleteSocialPublication: vi.fn(),
  publishSocialPublication: vi.fn(),
  createSocialPublication: vi.fn(),
  getSocialApprovalSummary: vi.fn(),
  getSocialApprovalSettings: vi.fn(),
  updateSocialApprovalSettings: vi.fn(),
  submitSocialContentForReview: vi.fn(),
  approveSocialContent: vi.fn(),
  requestSocialContentChanges: vi.fn(),
  submitSocialDesignForReview: vi.fn(),
  approveSocialDesign: vi.fn(),
  requestSocialDesignChanges: vi.fn(),
  getSocialBusinessProfile: vi.fn(),
  updateSocialBusinessProfile: vi.fn(),
  getSocialAIStrategy: vi.fn(),
  getSocialAIStrategyStatus: vi.fn(),
  generateSocialAIStrategy: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

import {
  fetchAllPublications, useScheduledPosts, usePublishedPosts, useFailedPosts, useCalendarPosts, useOverviewData,
  useSocialAccounts, useStartMetaConnection, useVerifySocialAccounts, useDisconnectSocialPlatform,
  useReschedulePost, useUnschedulePost, useCancelPost, useDeletePost, useRetryPost, useDuplicatePost,
  publishAttemptError, PUBLICATION_PAGE_SIZE, MAX_PUBLICATION_PAGES,
  useApprovalSummary, useApprovalPosts, useSubmitContentForReview, useApproveContent, useRequestContentChanges, useSubmitDesignForReview,
  useApproveDesign, useRequestDesignChanges, useUpdatePostContent, useApprovalSettings, useUpdateApprovalSettings,
  useSocialBusinessProfile, useUpdateSocialBusinessProfile, socialBusinessProfileKey,
  useSocialAIStrategy, useGenerateSocialAIStrategy, socialAIStrategyKey, socialContentCalendarKey, STRATEGY_POLL_MS,
} from './useSocialMediaAI'

const PID = 'proj-1'

function setup() {
  const queryClient = createQueryClient()
  const spy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, spy, wrapper }
}

const invalidatedKeys = (spy) => spy.mock.calls.map(([arg]) => arg.queryKey)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchAllPublications — the publishing API is paginated (<=50) and sorted by creation only', () => {
  it('follows every page and never asks for more than the backend allows', async () => {
    const store = installPublicationsApi(api, Array.from({ length: 120 }, (_, i) => publication({ id: `p${i}`, createdAt: new Date(2026, 0, 1, 0, i).toISOString() })))
    const result = await fetchAllPublications(PID, { status: 'scheduled' })
    expect(result.publications).toHaveLength(120)
    expect(result.total).toBe(120)
    expect(result.truncated).toBe(false)
    expect(store.calls.map((c) => c.filters.page)).toEqual([1, 2, 3])
    expect(store.calls.every((c) => c.filters.limit === PUBLICATION_PAGE_SIZE && c.projectId === PID && c.filters.status === 'scheduled')).toBe(true)
  })

  it('stops at the safety ceiling and says the list was truncated', async () => {
    installPublicationsApi(api, Array.from({ length: (MAX_PUBLICATION_PAGES + 2) * PUBLICATION_PAGE_SIZE }, (_, i) => publication({ id: `p${i}` })))
    const result = await fetchAllPublications(PID, {})
    expect(result.publications).toHaveLength(MAX_PUBLICATION_PAGES * PUBLICATION_PAGE_SIZE)
    expect(result.truncated).toBe(true)
  })
})

describe('list hooks — real publications mapped for the UI', () => {
  it('useScheduledPosts merges scheduled + publishing rows soonest-first with the real total', async () => {
    installPublicationsApi(api, [
      publication({ id: 'later', status: 'scheduled', scheduledAt: '2099-05-02T10:00:00Z' }),
      publication({ id: 'soon', status: 'scheduled', scheduledAt: '2099-05-01T10:00:00Z' }),
      publication({ id: 'now', status: 'publishing', scheduledAt: '2099-04-30T10:00:00Z' }),
      publication({ id: 'done', status: 'published', publishedAt: '2099-01-01T00:00:00Z' }),
    ])
    const { wrapper } = setup()
    const { result } = renderHook(() => useScheduledPosts(PID), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.posts.map((p) => p.id)).toEqual(['now', 'soon', 'later'])
    expect(result.current.total).toBe(3)
    expect(result.current.posts[0].isPublishing).toBe(true)
  })

  it('usePublishedPosts / useFailedPosts only request their own status', async () => {
    const store = installPublicationsApi(api, [
      publication({ id: 'pub', status: 'published', publishedAt: '2099-01-01T00:00:00Z' }),
      publication({ id: 'bad', status: 'failed', failureCode: 'FACEBOOK_RATE_LIMITED', canRetry: true }),
    ])
    const { wrapper } = setup()
    const published = renderHook(() => usePublishedPosts(PID), { wrapper })
    const failed = renderHook(() => useFailedPosts(PID), { wrapper })
    await waitFor(() => expect(published.result.current.isLoading).toBe(false))
    await waitFor(() => expect(failed.result.current.isLoading).toBe(false))
    expect(published.result.current.posts.map((p) => p.id)).toEqual(['pub'])
    expect(failed.result.current.posts.map((p) => p.id)).toEqual(['bad'])
    expect(failed.result.current.posts[0].canRetry).toBe(true)
    expect(new Set(store.calls.map((c) => c.filters.status))).toEqual(new Set(['published', 'failed']))
  })

  it('surfaces an API failure as isError (no stale data) so the page can show an error state', async () => {
    api.getSocialPublications.mockRejectedValue(apiError('Server exploded', { status: 500 }))
    const { wrapper } = setup()
    const { result } = renderHook(() => useFailedPosts(PID), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.posts).toEqual([])
  })

  it('does not call the API without a project', async () => {
    installPublicationsApi(api, [])
    const { wrapper } = setup()
    renderHook(() => useScheduledPosts(null), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(api.getSocialPublications).not.toHaveBeenCalled()
  })

  it('useCalendarPosts requests the visible window, maps posts and drops drafts/cancelled', async () => {
    const store = installPublicationsApi(api, [
      publication({ id: 'in', scheduledAt: '2099-03-10T09:00:00Z' }),
      publication({ id: 'cancelled', status: 'cancelled', scheduledAt: '2099-03-11T09:00:00Z' }),
      publication({ id: 'out', scheduledAt: '2099-06-10T09:00:00Z' }),
    ])
    const { wrapper } = setup()
    const { result } = renderHook(() => useCalendarPosts(PID, { from: '2099-03-08', to: '2099-03-20' }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.posts.map((p) => p.id)).toEqual(['in'])
    expect(store.calls[0].filters).toMatchObject({ from: '2099-03-08', to: '2099-03-20' })
  })

  it('useCalendarPosts waits until a window is given', async () => {
    installPublicationsApi(api, [])
    const { wrapper } = setup()
    renderHook(() => useCalendarPosts(PID, {}), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(api.getSocialPublications).not.toHaveBeenCalled()
  })

  it('useOverviewData: real scheduled/published totals and only the next 3 SCHEDULED posts as upcoming', async () => {
    installPublicationsApi(api, [
      ...Array.from({ length: 5 }, (_, i) => publication({ id: `s${i}`, status: 'scheduled', scheduledAt: `2099-05-0${i + 1}T10:00:00Z` })),
      publication({ id: 'live', status: 'publishing', scheduledAt: '2099-04-01T10:00:00Z' }),
      ...Array.from({ length: 7 }, (_, i) => publication({ id: `p${i}`, status: 'published', publishedAt: '2099-01-01T00:00:00Z' })),
    ])
    const { wrapper } = setup()
    const { result } = renderHook(() => useOverviewData(PID), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.scheduledCount).toBe(6) // 5 scheduled + 1 publishing
    expect(result.current.publishedCount).toBe(7)
    expect(result.current.upcoming.map((p) => p.id)).toEqual(['s0', 's1', 's2'])
  })
})

describe('useSocialAccounts — view models from the real status', () => {
  it('exposes facebook/instagram state and the accounts that block publishing', async () => {
    api.getSocialAccountsStatus.mockResolvedValue(statusResponse({ facebook: ACTIVE_FACEBOOK, instagram: EXPIRED('acme_ig') }))
    const { wrapper } = setup()
    const { result } = renderHook(() => useSocialAccounts(PID), { wrapper })
    expect(result.current.facebook.state).toBe('loading')
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.facebook.state).toBe('connected')
    expect(result.current.instagram.state).toBe('expired')
    expect(result.current.attention).toEqual([{ platform: 'instagram', reason: 'expired', name: 'acme_ig' }])
    expect(api.getSocialAccountsStatus).toHaveBeenCalledWith(PID)
  })

  it('reports an error state when the status request fails and nothing is cached', async () => {
    api.getSocialAccountsStatus.mockRejectedValue(apiError('down', { status: 500 }))
    const { wrapper } = setup()
    const { result } = renderHook(() => useSocialAccounts(PID), { wrapper })
    await waitFor(() => expect(result.current.facebook.state).toBe('error'))
  })
})

describe('connection mutations', () => {
  it('useStartMetaConnection asks the BACKEND for the OAuth URL (returnTo social-media) and sends the browser there', async () => {
    api.getMetaConnectUrl.mockResolvedValue({ success: true, data: { url: 'https://www.facebook.com/dialog/oauth?state=signed' } })
    const navigate = vi.fn()
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartMetaConnection(PID, { navigate }), { wrapper })
    await act(async () => { await result.current.mutateAsync({ reconnect: true }) })
    expect(api.getMetaConnectUrl).toHaveBeenCalledWith(PID, 'social-media', true)
    expect(navigate).toHaveBeenCalledWith('https://www.facebook.com/dialog/oauth?state=signed')
  })

  it('useStartMetaConnection fails (and does not navigate) when the backend returns no URL', async () => {
    api.getMetaConnectUrl.mockResolvedValue({ success: true, data: {} })
    const navigate = vi.fn()
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartMetaConnection(PID, { navigate }), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow(/Failed to start/) })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('verify calls POST /social/accounts/verify and refreshes social state on success AND on failure', async () => {
    api.verifySocialAccounts.mockResolvedValueOnce({ success: true, data: { accounts: [] } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useVerifySocialAccounts(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync() })
    expect(api.verifySocialAccounts).toHaveBeenCalledWith(PID)
    expect(invalidatedKeys(spy)).toContainEqual(['social'])

    spy.mockClear()
    api.verifySocialAccounts.mockRejectedValueOnce(apiError('Meta down', { status: 500 }))
    await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow('Meta down') })
    expect(invalidatedKeys(spy)).toContainEqual(['social'])
  })

  it('disconnect calls the backend, then REFETCHES (nothing is removed locally)', async () => {
    api.disconnectSocialAccount.mockResolvedValue({ success: true, data: { platform: 'facebook', connected: false } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useDisconnectSocialPlatform(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync('facebook') })
    expect(api.disconnectSocialAccount).toHaveBeenCalledWith(PID, 'facebook')
    expect(invalidatedKeys(spy)).toContainEqual(['social'])
  })

  it('disconnecting an already-disconnected account (404) is a no-op success, still refetched', async () => {
    api.disconnectSocialAccount.mockRejectedValue(apiError('No active connection to disconnect', { code: 'SOCIAL_ACCOUNT_NOT_FOUND', status: 404 }))
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useDisconnectSocialPlatform(PID), { wrapper })
    let value
    await act(async () => { value = await result.current.mutateAsync('instagram') })
    expect(value).toEqual({ alreadyDisconnected: true })
    expect(invalidatedKeys(spy)).toContainEqual(['social'])
  })

  it('any other disconnect failure is surfaced (not swallowed) and the state is still refetched', async () => {
    api.disconnectSocialAccount.mockRejectedValue(apiError('Failed to disconnect this account', { code: 'SOCIAL_DISCONNECT_FAILED', status: 500 }))
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useDisconnectSocialPlatform(PID), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync('facebook')).rejects.toThrow('Failed to disconnect') })
    expect(invalidatedKeys(spy)).toContainEqual(['social'])
  })
})

describe('publication mutations — real endpoints + cache invalidation', () => {
  const publishingKey = ['social', 'publishing', PID]

  it('reschedule -> POST /:id/schedule with the exact instant + timezone, then refetches publishing', async () => {
    api.scheduleSocialPublication.mockResolvedValue({ success: true, data: { publication: {} } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useReschedulePost(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync({ publicationId: 'p1', scheduledAt: '2099-01-01T10:00:00.000Z', timezone: 'Asia/Kolkata' }) })
    expect(api.scheduleSocialPublication).toHaveBeenCalledWith(PID, 'p1', '2099-01-01T10:00:00.000Z', 'Asia/Kolkata')
    expect(invalidatedKeys(spy)).toContainEqual(publishingKey)
  })

  it('a REFUSED mutation (backend 400/409) still refreshes stale state and rethrows the backend error', async () => {
    api.scheduleSocialPublication.mockRejectedValue(apiError('scheduledAt must be in the future.', { code: 'SCHEDULE_IN_PAST', status: 400 }))
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useReschedulePost(PID), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ publicationId: 'p1', scheduledAt: 'x', timezone: 'UTC' })).rejects.toThrow(/in the future/) })
    expect(invalidatedKeys(spy)).toContainEqual(publishingKey)
  })

  it('save-for-later clears the schedule (PATCH scheduledAt:null); cancel and delete hit their endpoints', async () => {
    api.updateSocialPublication.mockResolvedValue({ success: true })
    api.cancelSocialPublication.mockResolvedValue({ success: true })
    api.deleteSocialPublication.mockResolvedValue({ success: true })
    const { wrapper } = setup()
    const unschedule = renderHook(() => useUnschedulePost(PID), { wrapper })
    const cancel = renderHook(() => useCancelPost(PID), { wrapper })
    const del = renderHook(() => useDeletePost(PID), { wrapper })
    await act(async () => { await unschedule.result.current.mutateAsync('p1') })
    await act(async () => { await cancel.result.current.mutateAsync('p2') })
    await act(async () => { await del.result.current.mutateAsync({ publicationId: 'p3' }) })
    expect(api.updateSocialPublication).toHaveBeenCalledWith(PID, 'p1', { scheduledAt: null })
    expect(api.cancelSocialPublication).toHaveBeenCalledWith(PID, 'p2')
    expect(api.deleteSocialPublication).toHaveBeenCalledWith(PID, 'p3', { historyOnly: false })
  })

  it('retry -> POST /:id/publish, refreshes publishing AND connection status (a dead token may expire the account)', async () => {
    api.publishSocialPublication.mockResolvedValue({ success: true, data: { publication: {}, publishError: { code: 'FACEBOOK_TOKEN_INVALID', message: 'Meta denied this request', requiresReconnect: true } } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useRetryPost(PID), { wrapper })
    let res
    await act(async () => { res = await result.current.mutateAsync('p1') })
    expect(api.publishSocialPublication).toHaveBeenCalledWith(PID, 'p1')
    expect(publishAttemptError(res)).toMatchObject({ code: 'FACEBOOK_TOKEN_INVALID', requiresReconnect: true })
    expect(publishAttemptError({ data: { publication: {} } })).toBeNull()
    expect(invalidatedKeys(spy)).toContainEqual(publishingKey)
    expect(invalidatedKeys(spy)).toContainEqual(['social', 'accounts', 'status', PID])
  })

  it('duplicate creates a brand-new DRAFT (no scheduledAt, never publishNow)', async () => {
    api.createSocialPublication.mockResolvedValue({ success: true })
    const { wrapper } = setup()
    const { result } = renderHook(() => useDuplicatePost(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync({ platform: 'instagram', socialAccountId: 'acc-ig', content: 'Copy me', media: [{ url: 'https://x/a.jpg', type: 'image' }] }) })
    const [pid, body] = api.createSocialPublication.mock.calls[0]
    expect(pid).toBe(PID)
    expect(body).toEqual({ platform: 'instagram', socialAccountId: 'acc-ig', content: 'Copy me', media: [{ url: 'https://x/a.jpg', type: 'image' }] })
    expect(body.scheduledAt).toBeUndefined()
    expect(body.publishNow).toBeUndefined()
  })

  it('STALE CACHE: after a mutation the list is refetched and shows the server\'s new state without a reload', async () => {
    const store = installPublicationsApi(api, [publication({ id: 'p1', status: 'scheduled', scheduledAt: '2099-05-01T10:00:00Z' })])
    api.cancelSocialPublication.mockImplementation(async (_pid, id) => { store.rows = store.rows.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)); return { success: true } })
    const { wrapper } = setup()
    const list = renderHook(() => useScheduledPosts(PID), { wrapper })
    const cancel = renderHook(() => useCancelPost(PID), { wrapper })
    await waitFor(() => expect(list.result.current.posts).toHaveLength(1))
    await act(async () => { await cancel.result.current.mutateAsync('p1') })
    await waitFor(() => expect(list.result.current.posts).toHaveLength(0))
    expect(list.result.current.total).toBe(0)
  })
})

describe('approval workflow hooks', () => {
  const publishingKey = ['social', 'publishing', PID]

  it('summary comes from the backend counts endpoint and sits under the publishing key (so every publication mutation refreshes it)', async () => {
    api.getSocialApprovalSummary.mockResolvedValue({ success: true, data: { summary: { contentReview: 4, designReview: 2, awaitingDesignSubmission: 0, readyToSchedule: 1, needsChanges: 1 } } })
    const { wrapper, queryClient } = setup()
    const { result } = renderHook(() => useApprovalSummary(PID), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(expect.objectContaining({ contentReview: 4, designReview: 2 })))
    expect(api.getSocialApprovalSummary).toHaveBeenCalledWith(PID)
    expect(queryClient.getQueryCache().find({ queryKey: [...publishingKey, 'approval-summary'] })).toBeTruthy()
  })

  it('overview data exposes the approval counts as null (never 0) while loading or when the request failed', async () => {
    installPublicationsApi(api, [])
    api.getSocialApprovalSummary.mockRejectedValue(apiError('boom', { status: 500 }))
    const { wrapper } = setup()
    const { result } = renderHook(() => useOverviewData(PID), { wrapper })
    await waitFor(() => expect(result.current.scheduledCount).toBe(0))
    await waitFor(() => expect(api.getSocialApprovalSummary).toHaveBeenCalled())
    expect(result.current.contentReviewCount).toBeNull()
    expect(result.current.designReviewCount).toBeNull()
  })

  it.each([
    ['submit content', useSubmitContentForReview, 'submitSocialContentForReview', 'p1', [PID, 'p1']],
    ['approve content', useApproveContent, 'approveSocialContent', { publicationId: 'p1', version: 3 }, [PID, 'p1', 3]],
    ['request content changes', useRequestContentChanges, 'requestSocialContentChanges', { publicationId: 'p1', version: 3, reason: 'Shorter' }, [PID, 'p1', 3, 'Shorter']],
    ['submit design', useSubmitDesignForReview, 'submitSocialDesignForReview', 'p1', [PID, 'p1']],
    ['approve design', useApproveDesign, 'approveSocialDesign', { publicationId: 'p1', version: 2 }, [PID, 'p1', 2]],
    ['request design changes', useRequestDesignChanges, 'requestSocialDesignChanges', { publicationId: 'p1', version: 2, reason: 'Crop' }, [PID, 'p1', 2, 'Crop']],
  ])('%s calls its endpoint and refreshes every publishing query (lists, calendar, counts)', async (_label, useHook, method, variables, expectedArgs) => {
    api[method].mockResolvedValue({ success: true, data: { publication: {} } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useHook(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync(variables) })
    expect(api[method]).toHaveBeenCalledWith(...expectedArgs)
    expect(invalidatedKeys(spy)).toContainEqual(publishingKey)
  })

  it('a REFUSED action (e.g. VERSION_MISMATCH) still refreshes the lists, so a stale view heals', async () => {
    api.approveSocialContent.mockRejectedValue(apiError('changed since you reviewed it', { status: 409, code: 'VERSION_MISMATCH' }))
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useApproveContent(PID), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ publicationId: 'p1', version: 1 })).rejects.toThrow('changed since') })
    expect(invalidatedKeys(spy)).toContainEqual(publishingKey)
  })

  it('editing a post sends only the changed fields through the existing PATCH', async () => {
    api.updateSocialPublication.mockResolvedValue({ success: true, data: { publication: {} } })
    const { wrapper } = setup()
    const { result } = renderHook(() => useUpdatePostContent(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync({ publicationId: 'p1', content: 'New' }) })
    expect(api.updateSocialPublication).toHaveBeenCalledWith(PID, 'p1', { content: 'New' })
  })

  it('approval posts: managed list + unmanaged DRAFTS, mapped and filtered to reviewable posts only', async () => {
    const store = installPublicationsApi(api, [
      publication({ id: 'u1', status: 'draft', scheduledAt: null }),
      publication({ id: 'live', status: 'scheduled' }),
      publication({ id: 'm1', status: 'draft', scheduledAt: null, approval: { managed: true, state: 'content_review', stage: 'content_review', publishable: false, needsChanges: false, contentVersion: 1, designVersion: 1 } }),
    ])
    const { wrapper } = setup()
    const { result } = renderHook(() => useApprovalPosts(PID), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.posts.map((p) => p.id).sort()).toEqual(['m1', 'u1'])
    expect(store.calls.some((c) => c.filters.approval === 'managed')).toBe(true)
    expect(store.calls.some((c) => c.filters.approval === 'unmanaged' && c.filters.status === 'draft')).toBe(true)
  })

  it('settings: read from and saved to the backend; saving refreshes them', async () => {
    api.getSocialApprovalSettings.mockResolvedValue({ success: true, data: { settings: { contentApprovalRequired: true, designApprovalRequired: false } } })
    api.updateSocialApprovalSettings.mockResolvedValue({ success: true, data: { settings: { contentApprovalRequired: false, designApprovalRequired: false } } })
    const { wrapper, spy } = setup()
    const read = renderHook(() => useApprovalSettings(PID), { wrapper })
    await waitFor(() => expect(read.result.current.data).toEqual({ contentApprovalRequired: true, designApprovalRequired: false }))
    const write = renderHook(() => useUpdateApprovalSettings(PID), { wrapper })
    await act(async () => { await write.result.current.mutateAsync({ contentApprovalRequired: false }) })
    expect(api.updateSocialApprovalSettings).toHaveBeenCalledWith(PID, { contentApprovalRequired: false })
    expect(invalidatedKeys(spy)).toContainEqual(['social', 'approval-settings', PID])
  })
})

describe('social business profile hooks', () => {
  const payload = (name) => ({ success: true, data: { resolvedProfile: { business: { name: { value: name } } }, editableProfile: { goals: [] }, googleStatus: { connected: false } } })

  it('the query is project-scoped, lives under the [social] root, and is disabled without a project', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(payload('Acme'))
    const { wrapper, queryClient } = setup()
    const off = renderHook(() => useSocialBusinessProfile(null), { wrapper })
    expect(off.result.current.fetchStatus).toBe('idle')
    expect(api.getSocialBusinessProfile).not.toHaveBeenCalled()
    const { result } = renderHook(() => useSocialBusinessProfile(PID), { wrapper })
    await waitFor(() => expect(result.current.data.resolvedProfile.business.name.value).toBe('Acme'))
    expect(api.getSocialBusinessProfile).toHaveBeenCalledWith(PID)
    expect(socialBusinessProfileKey(PID)).toEqual(['social', 'business-profile', PID])
    expect(queryClient.getQueryCache().find({ queryKey: socialBusinessProfileKey(PID) })).toBeTruthy()
  })

  it('saving writes the resolved response from the server into the cache AND invalidates the query', async () => {
    api.updateSocialBusinessProfile.mockResolvedValue(payload('Saved name'))
    const { wrapper, spy, queryClient } = setup()
    const { result } = renderHook(() => useUpdateSocialBusinessProfile(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync({ goals: ['x'] }) })
    expect(api.updateSocialBusinessProfile).toHaveBeenCalledWith(PID, { goals: ['x'] })
    expect(queryClient.getQueryData(socialBusinessProfileKey(PID)).resolvedProfile.business.name.value).toBe('Saved name')
    expect(invalidatedKeys(spy)).toContainEqual(socialBusinessProfileKey(PID))
  })

  it('a refused save still invalidates (a stale screen heals) and does not poison the cache', async () => {
    api.updateSocialBusinessProfile.mockRejectedValue(apiError('goals can have at most 10 entries.', { status: 400, code: 'INVALID_PROFILE' }))
    const { wrapper, spy, queryClient } = setup()
    const { result } = renderHook(() => useUpdateSocialBusinessProfile(PID), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ goals: [] })).rejects.toThrow('at most 10') })
    expect(queryClient.getQueryData(socialBusinessProfileKey(PID))).toBeUndefined()
    expect(invalidatedKeys(spy)).toContainEqual(socialBusinessProfileKey(PID))
  })

  it('a Meta/Google connection refresh (the shared [social] invalidation) also refetches the profile', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(payload('Acme'))
    const { wrapper, queryClient } = setup()
    const { result } = renderHook(() => useSocialBusinessProfile(PID), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['social'] }) })
    await waitFor(() => expect(api.getSocialBusinessProfile.mock.calls.length).toBe(2))
  })
})

describe('AI strategy hooks', () => {
  const state = (status) => ({ success: true, data: { status, strategy: null, generation: status === 'generating' ? { id: 'g', version: 1, status: 'generating' } : null, profile: { changed: false } } })
  const statusOnly = (status) => ({ success: true, data: { status, currentVersion: null, generation: null } })

  it('the key is project-scoped under the [social] root; the query is off without a project', async () => {
    expect(socialAIStrategyKey(PID)).toEqual(['social', 'ai-strategy', PID])
    api.getSocialAIStrategy.mockResolvedValue(state('none'))
    const { wrapper } = setup()
    const off = renderHook(() => useSocialAIStrategy(null), { wrapper })
    expect(off.result.current.fetchStatus).toBe('idle')
    expect(api.getSocialAIStrategy).not.toHaveBeenCalled()
    const { result } = renderHook(() => useSocialAIStrategy(PID), { wrapper })
    await waitFor(() => expect(result.current.data.status).toBe('none'))
    expect(api.getSocialAIStrategy).toHaveBeenCalledWith(PID)
  })

  it('does NOT poll unless the server says generating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      api.getSocialAIStrategy.mockResolvedValue(state('ready'))
      const { wrapper } = setup()
      const { result } = renderHook(() => useSocialAIStrategy(PID), { wrapper })
      await waitFor(() => expect(result.current.data).toBeTruthy())
      await act(async () => { await vi.advanceTimersByTimeAsync(STRATEGY_POLL_MS * 3) })
      expect(api.getSocialAIStrategyStatus).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('polls the cheap status endpoint while generating, then refetches the full state once it stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      api.getSocialAIStrategy.mockResolvedValue(state('generating'))
      api.getSocialAIStrategyStatus.mockResolvedValue(statusOnly('generating'))
      const { wrapper } = setup()
      const { result } = renderHook(() => useSocialAIStrategy(PID), { wrapper })
      await waitFor(() => expect(result.current.data?.status).toBe('generating'))
      await waitFor(() => expect(api.getSocialAIStrategyStatus).toHaveBeenCalledWith(PID))
      const fullCalls = api.getSocialAIStrategy.mock.calls.length

      api.getSocialAIStrategyStatus.mockResolvedValue(statusOnly('ready'))
      api.getSocialAIStrategy.mockResolvedValue(state('ready'))
      await act(async () => { await vi.advanceTimersByTimeAsync(STRATEGY_POLL_MS + 500) })
      await waitFor(() => expect(result.current.data.status).toBe('ready'))
      expect(api.getSocialAIStrategy.mock.calls.length).toBeGreaterThan(fullCalls)
    } finally { vi.useRealTimers() }
  })

  it('generate calls the endpoint and refreshes the strategy state - also when the start is refused', async () => {
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating' } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useGenerateSocialAIStrategy(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync() })
    expect(api.generateSocialAIStrategy).toHaveBeenCalledWith(PID)
    expect(invalidatedKeys(spy)).toContainEqual(socialAIStrategyKey(PID))

    api.generateSocialAIStrategy.mockRejectedValue(apiError('not available', { status: 503, code: 'AI_UNAVAILABLE' }))
    spy.mockClear()
    await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow('not available') })
    expect(invalidatedKeys(spy)).toContainEqual(socialAIStrategyKey(PID))
  })

  it('when a strategy generation finishes the calendar state is refreshed too (a cached "no strategy yet" must not outlive it)', async () => {
    api.getSocialAIStrategy.mockResolvedValueOnce({ success: true, data: { status: 'generating', strategy: null, generation: { id: 'g1' } } }).mockResolvedValue({ success: true, data: { status: 'ready', strategy: { id: 's1' }, generation: null } })
    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'ready', currentVersion: 1, generation: null } })
    const { wrapper, spy } = setup()
    renderHook(() => useSocialAIStrategy(PID), { wrapper })
    await waitFor(() => expect(invalidatedKeys(spy)).toContainEqual(socialContentCalendarKey(PID)))
  })

  it('generate passes the wizard options through untouched (planning, expectedVersion, requestId)', async () => {
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating' } })
    const { wrapper } = setup()
    const { result } = renderHook(() => useGenerateSocialAIStrategy(PID), { wrapper })
    const options = { planning: { postsPerWeek: 3, months: 3, platforms: ['facebook'] }, expectedVersion: 2, requestId: 'wiz_abcdefgh' }
    await act(async () => { await result.current.mutateAsync(options) })
    expect(api.generateSocialAIStrategy).toHaveBeenCalledWith(PID, options)
  })

  it('saving the Business Profile also refreshes the AI strategy (so "profile changed" appears without a reload)', async () => {
    api.updateSocialBusinessProfile.mockResolvedValue({ success: true, data: { resolvedProfile: {}, editableProfile: {}, googleStatus: {} } })
    const { wrapper, spy } = setup()
    const { result } = renderHook(() => useUpdateSocialBusinessProfile(PID), { wrapper })
    await act(async () => { await result.current.mutateAsync({ goals: ['x'] }) })
    expect(invalidatedKeys(spy)).toContainEqual(socialBusinessProfileKey(PID))
    expect(invalidatedKeys(spy)).toContainEqual(socialAIStrategyKey(PID))
  })
})

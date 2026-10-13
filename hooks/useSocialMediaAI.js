"use client"

import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import apiService from '@/lib/apiService'
import { useSocialAccountsStatus } from '@/hooks/useDashboardQueries'
import { toAccountViewModels, accountsNeedingAttention } from '@/lib/socialMedia/accountViewModel'
import {
  mapPublicationToPost, mapPublicationToCalendarPost, mapPublicationToApprovalPost, sortByScheduledAsc, sortByReferenceDesc,
} from '@/lib/socialMedia/postMapper'
import { describeApiError } from '@/lib/socialMedia/failureMessages'

/**
 * Data layer for the Social Media AI module (/app/social-media/*).
 *
 * Everything here talks to the EXISTING social_meta backend through the
 * existing apiService methods — no new endpoints, no local copies of server
 * state. Frontend feature -> backend endpoint -> invalidation:
 *
 *  Account status          GET    /social/accounts?projectId            key ['social','accounts','status',pid]
 *  Start OAuth / reconnect GET    /social/meta/start?projectId&returnTo=social-media[&reconnect=true]  -> {url}; the
 *                                 browser goes to Meta, Meta calls the backend callback, which returns to
 *                                 /app/social-media/connect-accounts?meta_connected=1|meta_error=...
 *  Pick the Page           GET    /social/meta/pages · POST /social/meta/pages/:pageId/select   (FacebookPageSelectorDialog)
 *  Switch Page             GET    /social/facebook/accounts · POST /social/facebook/switch      (FacebookPageSelectorDialog)
 *  Check for Instagram     POST   /social/meta/pages/:pageId/instagram/retry                     (useRetryMetaInstagramDiscovery)
 *  Verify connection       POST   /social/accounts/verify {projectId}                            -> invalidate ['social']
 *  Disconnect              DELETE /social/accounts/:platform {projectId}                         -> invalidate ['social']
 *  Post lists / calendar   GET    /social/publishing?projectId&status|from|to&page&limit(<=50)   key ['social','publishing',pid,...]
 *  Reschedule              POST   /social/publishing/:id/schedule {scheduledAt,timezone}         -> invalidate publishing + status
 *  Save for later          PATCH  /social/publishing/:id {scheduledAt:null}  (-> draft)          -> invalidate publishing
 *  Cancel                  POST   /social/publishing/:id/cancel                                  -> invalidate publishing
 *  Delete / Discard        DELETE /social/publishing/:id                                         -> invalidate publishing
 *  Retry                   POST   /social/publishing/:id/publish   (200 + publishError on a Meta failure) -> invalidate publishing + status
 *  Duplicate               POST   /social/publishing {platform,socialAccountId,content,media}    (a new DRAFT) -> invalidate publishing
 *  Approval lists          GET    /social/publishing?approval=managed | approval=unmanaged&status=draft
 *  Approval counts         GET    /social/publishing/approvals/summary                          key ['social','publishing',pid,'approval-summary']
 *  Submit / approve / request changes (content + design)
 *                          POST   /social/publishing/:id/(content|design)/(submit|approve|request-changes)  -> invalidate publishing
 *                                 (which includes the approval summary, so Overview tiles, Calendar, Scheduled Posts and
 *                                 the Approvals page all refetch after every approval action)
 *  Approval settings       GET/PUT /social/publishing/approval-settings                          key ['social','approval-settings',pid]
 *  AI strategy             GET /social/ai-strategy · GET .../status (poll) · POST .../generate (202)  key ['social','ai-strategy',pid]
 *                                 (read-only; the page polls the cheap /status while the server says "generating", then refetches)
 *  AI post (one)           POST /social/ai-content/generate (202) · GET .../status (poll while generating)   key ['social','ai-content',pid]
 *                                 (the result is a real draft SocialPublication in the existing approval workflow, so a
 *                                 finished generation also invalidates the publishing lists + approval counts)
 *  AI design (one post)    POST /social/ai-design/generate (202) · GET .../status?publicationId (poll while generating)   key ['social','ai-design',pid,publicationId]
 *  Creative Studio         GET /social/ai-design/studio?publicationId (poll only while a generation is in flight) · POST .../studio/(generate|regenerate|select)
 *                                 key ['social','studio',pid,publicationId]; every action refetches it AND the publishing lists (the post moves in the approval workflow)
 *  Content calendar plan   GET /social/content-calendar · GET .../status (poll) · POST .../generate (202)   key ['social','content-calendar',pid]
 *                                 (the PLAN made from the strategy + the user's posts/week, platforms and dates; planning only —
 *                                 it never creates a post. A new strategy / profile / catalog change marks it as out of date.)
 *  Business profile        GET/PUT /social/business-profile                                      key ['social','business-profile',pid]
 *                                 (resolved from the existing Google Business Profile / project data + the user's own
 *                                 Social AI fields; saving refetches it, so a save is shown exactly as the server resolved it)
 *  Brand logo              POST/DELETE /social/business-profile/logo                             -> sets the profile cache from the response
 *  Product catalog         GET/POST /social/products · GET/PATCH/DELETE /social/products/:id     keys ['social','products',pid] and
 *                                 ['social','product',pid,productId]; a product edit also refetches the business profile and the
 *                                 AI strategy (both derive from the catalog)
 *  Product images          POST /social/products/:id/images · PUT/PATCH/DELETE .../images/:mediaId · PATCH .../images/reorder
 *                                 (the response is the whole product, written into the caches; media changes do NOT refetch the
 *                                 profile or strategy — images are not part of what the strategy depends on)
 *
 * projectId always comes from the authenticated user's active project
 * (ProjectContext); the backend re-validates ownership on every request.
 */

// ── helpers ──────────────────────────────────────────────────────────────

/** Backend MAX_PAGE_SIZE (socialPublishingService.js) — asking for more is silently clamped to this. */
export const PUBLICATION_PAGE_SIZE = 50
/** Safety ceiling for "fetch everything" lists: 10 pages x 50 = 500 posts. */
export const MAX_PUBLICATION_PAGES = 10

const SOCIAL_KEY = ['social']
const publishingKey = (projectId) => ['social', 'publishing', projectId]

/**
 * The publishing API is paginated (<=50 per page) and can only sort by
 * creation time, so a list that must be ordered by SCHEDULED time (or placed
 * on a calendar) needs every page. Pages are followed up to
 * MAX_PUBLICATION_PAGES; `truncated` tells the UI when there was more.
 */
export async function fetchAllPublications(projectId, filters = {}) {
  const publications = []
  let page = 1
  let total = 0
  let totalPages = 1
  do {
    const res = await apiService.getSocialPublications(projectId, { ...filters, sort: 'newest', page, limit: PUBLICATION_PAGE_SIZE })
    const body = res?.data
    publications.push(...(body?.data || []))
    total = body?.pagination?.total ?? publications.length
    totalPages = body?.pagination?.totalPages ?? 1
    page += 1
  } while (page <= totalPages && page <= MAX_PUBLICATION_PAGES)
  return { publications, total, truncated: totalPages > MAX_PUBLICATION_PAGES }
}

function invalidateConnection(queryClient) {
  // Status, Facebook accounts/overview, Instagram overview, feeds — everything
  // that derives from "which accounts are connected and healthy".
  queryClient.invalidateQueries({ queryKey: SOCIAL_KEY })
}

// ── accounts ─────────────────────────────────────────────────────────────

/** Raw backend status response (same query the rest of the app uses). */
export const useSocialAccountStatus = useSocialAccountsStatus

/**
 * Facebook + Instagram view models derived from the real status response,
 * plus the list of connections that currently block publishing.
 */
export function useSocialAccounts(projectId) {
  const query = useSocialAccountsStatus(projectId)
  const models = useMemo(
    () => toAccountViewModels(query.data?.data, { isLoading: query.isLoading, isError: query.isError }),
    [query.data, query.isLoading, query.isError],
  )
  const attention = useMemo(() => accountsNeedingAttention(models), [models])
  return {
    facebook: models.facebook,
    instagram: models.instagram,
    attention,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}

/**
 * Starts the real Meta OAuth flow: asks the backend for the signed consent
 * URL, then sends the browser there. No OAuth logic lives in the frontend —
 * the state, code exchange, token storage and return redirect are all the
 * backend's. `reconnect:true` forces Meta to re-show the permission dialog.
 */
export function useStartMetaConnection(projectId, { navigate = (url) => window.location.assign(url) } = {}) {
  return useMutation({
    mutationFn: async ({ reconnect = false } = {}) => {
      const res = await apiService.getMetaConnectUrl(projectId, 'social-media', reconnect)
      const url = res?.data?.url
      if (!url) throw new Error('Failed to start the Meta connection.')
      navigate(url)
      return url
    },
  })
}

/** User-triggered live verification with Meta. Never auto-polled. */
export function useVerifySocialAccounts(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.verifySocialAccounts(projectId),
    // settled, not success: a failed verify must still refresh stale state
    onSettled: () => invalidateConnection(queryClient),
  })
}

/**
 * Disconnects a platform. The database stays the source of truth: nothing is
 * removed locally — the status query is refetched. An already-disconnected
 * account (404 SOCIAL_ACCOUNT_NOT_FOUND) is a no-op success, not an error.
 */
export function useDisconnectSocialPlatform(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (platform) => {
      try {
        return await apiService.disconnectSocialAccount(projectId, platform)
      } catch (error) {
        const { code, status } = describeApiError(error)
        if (code === 'SOCIAL_ACCOUNT_NOT_FOUND' || status === 404) return { alreadyDisconnected: true }
        throw error
      }
    },
    onSettled: () => invalidateConnection(queryClient),
  })
}

// ── publications ─────────────────────────────────────────────────────────

/**
 * Every publication matching `filters` (all pages), as raw backend rows.
 * `refetchMs` polls only while the list is non-empty — the scheduler moves
 * posts server-side with nobody on the page.
 */
export function useSocialPublicationList(projectId, filters = {}, { enabled = true, refetchMs = false } = {}) {
  return useQuery({
    queryKey: [...publishingKey(projectId), 'all', filters],
    queryFn: () => fetchAllPublications(projectId, filters),
    enabled: !!projectId && enabled,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (refetchMs && query.state.data?.publications?.length ? refetchMs : false),
  })
}

function useListResult(query, mapRow, sort) {
  const rows = query.data?.publications
  const posts = useMemo(() => (rows ? sort(rows.map(mapRow).filter(Boolean)) : []), [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    posts,
    total: query.data?.total ?? 0,
    truncated: !!query.data?.truncated,
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}

/** Scheduled tab: 'scheduled' + in-flight 'publishing' rows, soonest first. */
export function useScheduledPosts(projectId) {
  const scheduled = useSocialPublicationList(projectId, { status: 'scheduled' }, { refetchMs: 30_000 })
  const publishing = useSocialPublicationList(projectId, { status: 'publishing' }, { refetchMs: 10_000 })

  const scheduledRows = scheduled.data?.publications
  const publishingRows = publishing.data?.publications
  const posts = useMemo(
    () => sortByScheduledAsc([...(scheduledRows || []), ...(publishingRows || [])].map(mapPublicationToPost)),
    [scheduledRows, publishingRows],
  )

  // The scheduler moves posts out of 'scheduled' / 'publishing' (to published, failed, or retry) on the server, with nobody
  // clicking anything. Only these two lists poll, so when a post LEAVES them the Published / Failed lists and the Calendar
  // are refetched too - otherwise "Published" would stay at its old count until a reload or the 5-minute staleTime.
  const queryClient = useQueryClient()
  const loaded = !!scheduledRows && !!publishingRows
  const previousIds = useRef(null)
  useEffect(() => {
    if (!loaded) return
    const ids = new Set(posts.map((p) => p.id))
    const previous = previousIds.current
    previousIds.current = ids
    if (previous && [...previous].some((id) => !ids.has(id))) queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
  }, [loaded, posts, projectId, queryClient])

  return {
    posts,
    total: (scheduled.data?.total ?? 0) + (publishing.data?.total ?? 0),
    truncated: !!(scheduled.data?.truncated || publishing.data?.truncated),
    isLoading: scheduled.isLoading || publishing.isLoading,
    isError: (scheduled.isError && !scheduled.data) || (publishing.isError && !publishing.data),
    error: scheduled.error || publishing.error,
    isFetching: scheduled.isFetching || publishing.isFetching,
    refetch: () => Promise.all([scheduled.refetch(), publishing.refetch()]),
  }
}

/** Published tab: most recently published first. */
export function usePublishedPosts(projectId, { enabled = true } = {}) {
  return useListResult(useSocialPublicationList(projectId, { status: 'published' }, { enabled }), mapPublicationToPost, sortByReferenceDesc)
}

/** Failed tab: most recently scheduled first. */
export function useFailedPosts(projectId, { enabled = true } = {}) {
  return useListResult(useSocialPublicationList(projectId, { status: 'failed' }, { enabled }), mapPublicationToPost, sortByReferenceDesc)
}

/**
 * Calendar window. `from`/`to` are "yyyy-MM-dd" (the backend filters
 * scheduledAt on UTC day boundaries, so callers pad the visible range by a
 * day on each side and the calendar buckets by each post's own timezone).
 * Drafts (no date) and cancelled posts never appear.
 */
export function useCalendarPosts(projectId, { from, to } = {}) {
  const query = useSocialPublicationList(projectId, { from, to }, { enabled: !!from && !!to, refetchMs: 60_000 })
  const rows = query.data?.publications
  const posts = useMemo(() => (rows ? rows.map(mapPublicationToCalendarPost).filter(Boolean) : []), [rows])
  return {
    posts,
    truncated: !!query.data?.truncated,
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}

/** Real total for one status (a single 1-row request — only the pagination total is used). */
export function useSocialPublicationCount(projectId, status, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...publishingKey(projectId), 'count', status],
    queryFn: async () => {
      const res = await apiService.getSocialPublications(projectId, { status, page: 1, limit: 1 })
      return res?.data?.pagination?.total ?? 0
    },
    enabled: !!projectId && enabled,
  })
}

/**
 * Database counts of the approval workflow (never derived from a client-side
 * list). Under the publishing key prefix, so every publication mutation —
 * including every approval action — invalidates it.
 */
export function useApprovalSummary(projectId) {
  return useQuery({
    queryKey: [...publishingKey(projectId), 'approval-summary'],
    queryFn: async () => (await apiService.getSocialApprovalSummary(projectId))?.data?.summary || null,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  })
}

/** Overview counters + the next upcoming posts, all from real publications. */
export function useOverviewData(projectId) {
  const scheduled = useScheduledPosts(projectId)
  const published = useSocialPublicationCount(projectId, 'published')
  const approval = useApprovalSummary(projectId)
  return {
    scheduledCount: scheduled.isLoading || scheduled.isError ? null : scheduled.total,
    publishedCount: published.isLoading || published.isError ? null : published.data,
    // null (shown as "—") while loading or when the counts could not be loaded — never 0 for "unknown"
    contentReviewCount: approval.isLoading || approval.isError ? null : (approval.data?.contentReview ?? null),
    designReviewCount: approval.isLoading || approval.isError ? null : (approval.data?.designReview ?? null),
    approvalLoading: approval.isLoading,
    upcoming: scheduled.posts.filter((p) => p.status === 'scheduled').slice(0, 3),
    isLoading: scheduled.isLoading || published.isLoading,
    isError: scheduled.isError || published.isError,
    refetch: () => Promise.all([scheduled.refetch(), published.refetch()]),
  }
}

// ── publication mutations ────────────────────────────────────────────────
// Every mutation invalidates on SETTLED (not just success): a refused action
// (409/404 because the post changed under us) must refresh stale state too.
// Publishing/retrying can also expire an account (dead token), so those also
// refresh the connection status the other screens read.

function usePublicationMutation(projectId, mutationFn, { alsoConnection = false } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
      if (alsoConnection) queryClient.invalidateQueries({ queryKey: ['social', 'accounts', 'status', projectId] })
    },
  })
}

/** Reschedule (or schedule a draft). The backend validates past dates, timezone and state. */
export function useReschedulePost(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, scheduledAt, timezone }) => apiService.scheduleSocialPublication(projectId, publicationId, scheduledAt, timezone))
}

/** "Save for later": clears the schedule, returning the post to draft. */
export function useUnschedulePost(projectId) {
  return usePublicationMutation(projectId, (publicationId) => apiService.updateSocialPublication(projectId, publicationId, { scheduledAt: null }))
}

export function useCancelPost(projectId) {
  return usePublicationMutation(projectId, (publicationId) => apiService.cancelSocialPublication(projectId, publicationId))
}

export function useDeletePost(projectId) {
  return usePublicationMutation(projectId, (arg) => {
    const { publicationId, historyOnly = false } = typeof arg === 'string' ? { publicationId: arg } : arg
    return apiService.deleteSocialPublication(projectId, publicationId, { historyOnly })
  })
}

/**
 * Retry a failed post. The backend answers HTTP 200 with `publishError` when
 * Meta rejected the attempt — use publishAttemptError() on the result.
 */
export function useRetryPost(projectId) {
  return usePublicationMutation(projectId, (publicationId) => apiService.publishSocialPublication(projectId, publicationId), { alsoConnection: true })
}

/** Duplicate = a brand-new DRAFT with the same platform/account/content/media (never auto-scheduled). */
export function useDuplicatePost(projectId) {
  return usePublicationMutation(projectId, (post) => apiService.createSocialPublication(projectId, {
    platform: post.platform, socialAccountId: post.socialAccountId, content: post.content, media: post.media,
  }))
}

/** The `{ code, message, ... }` of a Meta-rejected attempt in a publish response, else null. */
export function publishAttemptError(response) {
  return response?.data?.publishError || null
}


// ── content approval workflow ────────────────────────────────────────────

/**
 * Everything the Content Approvals page lists: posts already in the workflow
 * plus plain drafts that can be submitted into it. Rows are the backend's own;
 * mapPublicationToApprovalPost adds only presentation + the actions it may offer.
 */
export function useApprovalPosts(projectId) {
  const managed = useSocialPublicationList(projectId, { approval: 'managed' })
  const drafts = useSocialPublicationList(projectId, { approval: 'unmanaged', status: 'draft' })
  const managedRows = managed.data?.publications
  const draftRows = drafts.data?.publications
  const posts = useMemo(
    () => [...(managedRows || []), ...(draftRows || [])].map(mapPublicationToApprovalPost).filter((p) => p.approvalTabs.length > 0),
    [managedRows, draftRows],
  )
  return {
    posts,
    truncated: !!(managed.data?.truncated || drafts.data?.truncated),
    isLoading: managed.isLoading || drafts.isLoading,
    isError: (managed.isError && !managed.data) || (drafts.isError && !drafts.data),
    error: managed.error || drafts.error,
    isFetching: managed.isFetching || drafts.isFetching,
    refetch: () => Promise.all([managed.refetch(), drafts.refetch()]),
  }
}

/** Submit a plain draft into the approval workflow (-> content review, or further if the project doesn't require review). */
export function useSubmitContentForReview(projectId) {
  return usePublicationMutation(projectId, (publicationId) => apiService.submitSocialContentForReview(projectId, publicationId))
}

/** `version` is the content version the reviewer SAW; the backend refuses a stale one (VERSION_MISMATCH). */
export function useApproveContent(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, version }) => apiService.approveSocialContent(projectId, publicationId, version))
}

/** The reason is required and persisted by the backend; the post stays in content review. */
export function useRequestContentChanges(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, version, reason }) => apiService.requestSocialContentChanges(projectId, publicationId, version, reason))
}

export function useSubmitDesignForReview(projectId) {
  return usePublicationMutation(projectId, (publicationId) => apiService.submitSocialDesignForReview(projectId, publicationId))
}

export function useApproveDesign(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, version }) => apiService.approveSocialDesign(projectId, publicationId, version))
}

export function useRequestDesignChanges(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, version, reason }) => apiService.requestSocialDesignChanges(projectId, publicationId, version, reason))
}

/**
 * Edit a post's caption and/or media (the existing PATCH). The BACKEND applies
 * the version safety rule: editing approved content/design bumps its version
 * and sends the post back to review.
 */
export function useUpdatePostContent(projectId) {
  return usePublicationMutation(projectId, ({ publicationId, ...changes }) => apiService.updateSocialPublication(projectId, publicationId, changes))
}

/** Per-project "is content / design approval required" (defaults: both required). */
export function useApprovalSettings(projectId) {
  return useQuery({
    queryKey: ['social', 'approval-settings', projectId],
    queryFn: async () => (await apiService.getSocialApprovalSettings(projectId))?.data?.settings || null,
    enabled: !!projectId,
  })
}

export function useUpdateApprovalSettings(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings) => apiService.updateSocialApprovalSettings(projectId, settings),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['social', 'approval-settings', projectId] }),
  })
}

// ── business profile ─────────────────────────────────────────────────────

export const socialBusinessProfileKey = (projectId) => ['social', 'business-profile', projectId]

/**
 * The Social Media AI business profile for a project: `{ resolvedProfile, editableProfile, googleStatus }`.
 * Server state only — it lives in the React Query cache, never in component state. It sits under the
 * ['social'] root, so a Meta/Google connection refresh (invalidateConnection) refetches it too.
 */
export function useSocialBusinessProfile(projectId) {
  return useQuery({
    queryKey: socialBusinessProfileKey(projectId),
    queryFn: async () => (await apiService.getSocialBusinessProfile(projectId))?.data || null,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  })
}

/**
 * Saves ONLY the user-entered fields (`audience`, `toneOfVoice`, `goals`, `uniqueSellingPoints`, `offers`,
 * `competitors`, `brand`, `prohibitedPhrases`, `contentPillars`, `additionalInstructions`, `overrides`).
 * The response is the freshly re-resolved profile, written straight into the cache; the query is also
 * invalidated so every screen that reads it (Connect Accounts, Settings) refetches from the server.
 * A refused save (validation) is thrown with the backend's own message.
 */
export function useUpdateSocialBusinessProfile(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => apiService.updateSocialBusinessProfile(projectId, fields),
    onSuccess: (res) => {
      if (res?.data) queryClient.setQueryData(socialBusinessProfileKey(projectId), res.data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialBusinessProfileKey(projectId) })
      // an existing AI strategy compares itself to the live profile ("changed since generated"), so refresh it too
      queryClient.invalidateQueries({ queryKey: socialAIStrategyKey(projectId) })
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true }) // ... and so does a calendar
    },
  })
}

/**
 * The user's own brand logo. Both calls return the re-resolved profile (the logo's source becomes "user provided",
 * or falls back to the Google / website logo), written straight into the profile cache. `onProgress(percent)` is
 * optional. The mutation's `isPending` is the upload's loading state; a refused file is thrown with the backend's
 * own message (describeApiError).
 */
export function useUploadSocialBrandLogo(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }) => apiService.uploadSocialBrandLogo(projectId, file, onProgress),
    onSuccess: (res) => { if (res?.data) queryClient.setQueryData(socialBusinessProfileKey(projectId), res.data) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialBusinessProfileKey(projectId) }),
  })
}

export function useDeleteSocialBrandLogo(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.deleteSocialBrandLogo(projectId),
    onSuccess: (res) => { if (res?.data) queryClient.setQueryData(socialBusinessProfileKey(projectId), res.data) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialBusinessProfileKey(projectId) }),
  })
}

// ── product catalog ──────────────────────────────────────────────────────

export const socialProductsKey = (projectId) => ['social', 'products', projectId]
export const socialProductKey = (projectId, productId) => ['social', 'product', projectId, productId]

/** `{ products, total, limit }` for the project (server state only; the list is already in catalog order). */
export function useSocialProducts(projectId) {
  return useQuery({
    queryKey: socialProductsKey(projectId),
    queryFn: async () => (await apiService.listSocialProducts(projectId))?.data || { products: [], total: 0, limit: 100 },
    enabled: !!projectId,
  })
}

/** One product. Seeded from the list cache so opening an editor never flashes empty; refetched from the server behind it. */
export function useSocialProduct(projectId, productId) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: socialProductKey(projectId, productId),
    queryFn: async () => (await apiService.getSocialProduct(projectId, productId))?.data?.product || null,
    enabled: !!projectId && !!productId,
    initialData: () => queryClient.getQueryData(socialProductsKey(projectId))?.products?.find((p) => p.id === productId),
    initialDataUpdatedAt: () => queryClient.getQueryState(socialProductsKey(projectId))?.dataUpdatedAt,
  })
}

/** Puts a product the server just returned into both the list and the detail cache (no refetch needed to show it). */
function writeProduct(queryClient, projectId, product) {
  if (!product?.id) return
  queryClient.setQueryData(socialProductKey(projectId, product.id), product)
  queryClient.setQueryData(socialProductsKey(projectId), (old) => (old ? { ...old, products: old.products.map((p) => (p.id === product.id ? product : p)) } : old))
}

/**
 * A change to a product's own fields (create / edit / delete) changes the resolved business profile (it includes the
 * active products) and may make the AI strategy "based on an older profile", so both refetch. Image changes do NOT
 * (media is not part of what the strategy depends on), which is why image mutations do not call this.
 */
function invalidateCatalogDerived(queryClient, projectId) {
  queryClient.invalidateQueries({ queryKey: socialBusinessProfileKey(projectId) })
  queryClient.invalidateQueries({ queryKey: socialAIStrategyKey(projectId) })
  queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
}

export function useCreateSocialProduct(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => apiService.createSocialProduct(projectId, fields),
    onSuccess: (res) => {
      const product = res?.data?.product
      if (!product) return
      queryClient.setQueryData(socialProductKey(projectId, product.id), product)
      queryClient.setQueryData(socialProductsKey(projectId), (old) => (old ? { ...old, products: [...old.products, product], total: old.total + 1 } : old))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialProductsKey(projectId) })
      invalidateCatalogDerived(queryClient, projectId)
    },
  })
}

/** `{ productId, fields }` */
export function useUpdateSocialProduct(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, fields }) => apiService.updateSocialProduct(projectId, productId, fields),
    onSuccess: (res) => writeProduct(queryClient, projectId, res?.data?.product),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialProductsKey(projectId) })
      invalidateCatalogDerived(queryClient, projectId)
    },
  })
}

/** `productId` */
export function useDeleteSocialProduct(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId) => apiService.deleteSocialProduct(projectId, productId),
    onSuccess: (_res, productId) => {
      queryClient.removeQueries({ queryKey: socialProductKey(projectId, productId) })
      queryClient.setQueryData(socialProductsKey(projectId), (old) => (old ? { ...old, products: old.products.filter((p) => p.id !== productId), total: Math.max(0, old.total - 1) } : old))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialProductsKey(projectId) })
      invalidateCatalogDerived(queryClient, projectId)
    },
  })
}

// Image operations: every response is the whole updated product, written straight into the caches.
const imageMutation = (projectId, queryClient, mutationFn) => ({
  mutationFn,
  onSuccess: (res) => writeProduct(queryClient, projectId, res?.data?.product),
})

/** `{ productId, file, onProgress? }` — `isPending` is the upload's loading state. */
export function useUploadSocialProductImage(projectId) {
  const queryClient = useQueryClient()
  return useMutation(imageMutation(projectId, queryClient, ({ productId, file, onProgress }) => apiService.uploadSocialProductImage(projectId, productId, file, onProgress)))
}

/** `{ productId, mediaId, file, onProgress? }` */
export function useReplaceSocialProductImage(projectId) {
  const queryClient = useQueryClient()
  return useMutation(imageMutation(projectId, queryClient, ({ productId, mediaId, file, onProgress }) => apiService.replaceSocialProductImage(projectId, productId, mediaId, file, onProgress)))
}

/** `{ productId, mediaId }` */
export function useDeleteSocialProductImage(projectId) {
  const queryClient = useQueryClient()
  return useMutation(imageMutation(projectId, queryClient, ({ productId, mediaId }) => apiService.deleteSocialProductImage(projectId, productId, mediaId)))
}

/** `{ productId, mediaId, fields: { altText?, isPrimary?: true } }` */
export function useUpdateSocialProductImage(projectId) {
  const queryClient = useQueryClient()
  return useMutation(imageMutation(projectId, queryClient, ({ productId, mediaId, fields }) => apiService.updateSocialProductImage(projectId, productId, mediaId, fields)))
}

/** `{ productId, mediaIds, primaryMediaId? }` */
export function useReorderSocialProductImages(projectId) {
  const queryClient = useQueryClient()
  return useMutation(imageMutation(projectId, queryClient, ({ productId, mediaIds, primaryMediaId }) => apiService.reorderSocialProductImages(projectId, productId, { mediaIds, primaryMediaId })))
}

// ── AI strategy ──────────────────────────────────────────────────────────

export const socialAIStrategyKey = (projectId) => ['social', 'ai-strategy', projectId]
export const socialContentCalendarKey = (projectId) => ['social', 'content-calendar', projectId]
export const STRATEGY_POLL_MS = 3000

/**
 * The AI strategy state for a project: `{ status, strategy, generation, profile }` straight from the
 * server (none | generating | ready | failed). While the server says "generating" this polls the cheap
 * /status endpoint — never fake progress — and refetches the full state once generation stops.
 */
export function useSocialAIStrategy(projectId) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: socialAIStrategyKey(projectId),
    queryFn: async () => (await apiService.getSocialAIStrategy(projectId))?.data || null,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  })

  const generating = query.data?.status === 'generating'
  const poll = useQuery({
    queryKey: [...socialAIStrategyKey(projectId), 'status'],
    queryFn: async () => (await apiService.getSocialAIStrategyStatus(projectId))?.data || null,
    enabled: !!projectId && generating,
    refetchInterval: generating ? STRATEGY_POLL_MS : false,
    refetchIntervalInBackground: false,
    // each poll is a fresh answer; never serve a cached "generating"
    gcTime: 0,
  })

  const polledStatus = poll.data?.status
  useEffect(() => {
    if (generating && polledStatus && polledStatus !== 'generating') {
      queryClient.invalidateQueries({ queryKey: socialAIStrategyKey(projectId), exact: true })
      // The calendar page asks "is there a strategy?" and may have cached "no" while this one was still being made. A finished strategy changes that answer.
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
    }
  }, [generating, polledStatus, projectId, queryClient])

  return query
}

/** Starts (or re-runs) a generation. The server answers 202; the page then follows its state via useSocialAIStrategy. */
export function useGenerateSocialAIStrategy(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    // `options` = { planning, expectedVersion, requestId } from the wizard; none = the old one-click regeneration
    mutationFn: (options) => (options ? apiService.generateSocialAIStrategy(projectId, options) : apiService.generateSocialAIStrategy(projectId)),
    // settled, not success: a refusal (INSUFFICIENT_PROFILE / AI_UNAVAILABLE) should also refresh what the page knows
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialAIStrategyKey(projectId), exact: true })
      // a new strategy version makes an existing calendar "planned from an older strategy"
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
    },
  })
}

/**
 * What a planning choice means, from the SERVER's calendar planner (no AI, nothing saved): `{ estimatedPosts, basis, platformStates, quota, quotaCheck }`.
 * The wizard shows the count from here and never computes it. A refusal (unsupported value) is the query's error with the server's own message.
 */
export function useStrategyPlanPreview(projectId, choice, { enabled = true } = {}) {
  const { postsPerWeek, months } = choice || {}
  const platforms = (choice?.platforms || []).join(',')
  return useQuery({
    queryKey: [...socialAIStrategyKey(projectId), 'plan-preview', postsPerWeek || null, months || null, platforms],
    queryFn: async () => (await apiService.previewSocialAIStrategyPlan(projectId, { postsPerWeek, months, platforms: choice.platforms }))?.data || null,
    enabled: !!projectId && enabled && !!postsPerWeek && !!months && !!platforms,
    staleTime: 30_000,
    retry: false,
    placeholderData: keepPreviousData,
  })
}

// ── content calendar plan ────────────────────────────────────────────────

export const CALENDAR_POLL_MS = 3000

/**
 * The content calendar PLAN for a project: `{ status, calendar, items, generation, stale, strategy, connectedPlatforms, limits }`
 * straight from the server (none | generating | ready | failed). While the server says "generating" this polls the
 * cheap /status endpoint — never fake progress — and refetches the full state once generation stops.
 */
export function useSocialContentCalendar(projectId) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: socialContentCalendarKey(projectId),
    queryFn: async () => (await apiService.getSocialContentCalendar(projectId))?.data || null,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  })

  const generating = query.data?.status === 'generating'
  const poll = useQuery({
    queryKey: [...socialContentCalendarKey(projectId), 'status'],
    queryFn: async () => (await apiService.getSocialContentCalendarStatus(projectId))?.data || null,
    enabled: !!projectId && generating,
    refetchInterval: generating ? CALENDAR_POLL_MS : false,
    refetchIntervalInBackground: false,
    gcTime: 0,
  })

  const polledStatus = poll.data?.status
  useEffect(() => {
    if (generating && polledStatus && polledStatus !== 'generating') {
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
    }
  }, [generating, polledStatus, projectId, queryClient])

  return query
}

/**
 * Starts a calendar generation from the user's own choices. The server answers 202; the page then follows its state via
 * useSocialContentCalendar. Generating again is how a calendar is regenerated (the server keeps the old version).
 */
export function useGenerateSocialContentCalendar(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (choices) => apiService.generateSocialContentCalendar(projectId, choices),
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true }),
  })
}

export const socialCalendarHistoryKey = (projectId) => [...socialContentCalendarKey(projectId), 'history']

/** The versions of the calendar (current + history) with how much of each was edited / approved / turned into posts. */
export function useSocialCalendarHistory(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: socialCalendarHistoryKey(projectId),
    queryFn: async () => (await apiService.getSocialCalendarHistory(projectId))?.data || null,
    enabled: !!projectId && enabled,
  })
}

/** One version's posts, read-only. */
export function useSocialCalendarVersion(projectId, calendarId) {
  return useQuery({
    queryKey: [...socialCalendarHistoryKey(projectId), calendarId],
    queryFn: async () => (await apiService.getSocialCalendarVersion(projectId, calendarId))?.data || null,
    enabled: !!projectId && !!calendarId,
  })
}

/** Brings an archived version back as the current calendar. Everything that shows the calendar is refetched. */
export function useRestoreSocialCalendarVersion(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (calendarId) => apiService.restoreSocialCalendarVersion(projectId, calendarId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
      queryClient.invalidateQueries({ queryKey: socialCalendarHistoryKey(projectId) })
      queryClient.invalidateQueries({ queryKey: socialCalendarOptionsKey(projectId) })
    },
  })
}

/** Continues an unfinished (partial) calendar: only the missing posts are generated. The server answers 202; the page follows its state. */
export function useResumeSocialContentCalendar(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.resumeSocialContentCalendar(projectId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true }),
  })
}

/** Stops an unfinished calendar and discards what it saved. The last ready calendar stays. */
export function useCancelSocialContentCalendar(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.cancelSocialContentCalendar(projectId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true }),
  })
}

/**
 * What a set of planning choices means, from the SERVER (no AI call): the exact end date, day count and post count, and the
 * weeks that are only partly inside the period. The form shows it before anything is generated. `choices` is
 * { startDate, months, postsPerWeek }; the query is idle until they are all present. A refusal (e.g. the calendar would be
 * too large) arrives as the query's error, with the server's own message.
 */
export function useSocialContentCalendarPreview(projectId, choices, { enabled = true } = {}) {
  const { startDate, months, postsPerWeek } = choices || {}
  return useQuery({
    queryKey: [...socialContentCalendarKey(projectId), 'preview', startDate || null, months || null, postsPerWeek || null],
    queryFn: async () => (await apiService.previewSocialContentCalendar(projectId, { startDate, months, postsPerWeek, platforms: ['facebook'] }))?.data || null,
    enabled: !!projectId && enabled && !!startDate && !!months && !!postsPerWeek,
    staleTime: 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  })
}

// ── one planned post (the item workspace) ─────────────────────────────────

export const socialCalendarOptionsKey = (projectId) => [...socialContentCalendarKey(projectId), 'options']

/** What the item editor may offer: strategy pillars / hooks, the live catalog with product images, formats per platform, connection state. */
export function useSocialCalendarOptions(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: socialCalendarOptionsKey(projectId),
    queryFn: async () => (await apiService.getSocialCalendarOptions(projectId))?.data || null,
    enabled: !!projectId && enabled,
    staleTime: 60_000,
  })
}

/**
 * Writes ONE changed item (the server's answer) into the cached calendar, so the table / grid / modal update at once with no
 * refetch and no flicker. The rest of the cache is left alone.
 */
export function putCalendarItemInCache(queryClient, projectId, item) {
  queryClient.setQueryData(socialContentCalendarKey(projectId), (old) => {
    if (!old?.items) return old
    return { ...old, items: old.items.map((i) => (i.id === item.id ? item : i)) }
  })
}

/** Fields that feed the calendar's own summary (pillar mix, platform counts): changing one makes the summary stale, so only then is the calendar refetched. */
const SUMMARY_FIELDS = ['contentPillar', 'platforms']

/**
 * Saves a person's edit of one item. `variables`: { itemId, expectedRevision, ...changedFields }. The returned item replaces the
 * cached one; the calendar is refetched only when the pillar mix or platform counts changed. A 409 conflict is thrown with the
 * server's current item in `error.details.item` for the caller to offer.
 */
export function useUpdateSocialCalendarItem(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    // `onResponse` runs the moment the answer arrives, BEFORE the cache learns the new revision (see CalendarItemModal)
    mutationFn: async ({ itemId, onResponse, ...body }) => {
      const res = await apiService.updateSocialCalendarItem(projectId, itemId, body)
      onResponse?.(res)
      return res
    },
    onSuccess: (res) => {
      const data = res?.data
      if (data?.item) putCalendarItemInCache(queryClient, projectId, data.item)
      if ((data?.changed || []).some((f) => SUMMARY_FIELDS.includes(f))) queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
    },
    // a stale revision answers with the item as it is NOW: put it in the cache so the editor can say what changed
    onError: (error) => { if (error?.details?.item) putCalendarItemInCache(queryClient, projectId, error.details.item) },
  })
}

/** Adds a manual item to the current calendar (same model); the calendar is refetched for the new row and the summary. */
export function useCreateSocialCalendarItem(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fields) => apiService.createSocialCalendarItem(projectId, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true }),
  })
}

/** Approves (or withdraws approval of) the PLAN of one item. It never touches a publication, so only the item is updated. */
export function useSocialCalendarItemApproval(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, expectedRevision, revoke = false }) => (revoke
      ? apiService.revokeSocialCalendarItemApproval(projectId, itemId, expectedRevision)
      : apiService.approveSocialCalendarItem(projectId, itemId, expectedRevision)),
    onSuccess: (res) => { if (res?.data?.item) putCalendarItemInCache(queryClient, projectId, res.data.item) },
  })
}

/** Re-plans some fields of one item with AI (the server protects fields a person edited unless `overwriteEdited`). */
export function useRegenerateSocialCalendarItem(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, ...body }) => apiService.regenerateSocialCalendarItem(projectId, itemId, body),
    onSuccess: (res) => { if (res?.data?.item) putCalendarItemInCache(queryClient, projectId, res.data.item) },
  })
}

/**
 * Starts the EXISTING post generator for one platform of an approved plan. The answer is written into the single-post
 * generation cache as "generating" (the same cache the AI Strategy page reads), so polling starts at once.
 */
export function useGenerateSocialCalendarItemContent(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, platform, mode, expectedRevision }) => apiService.generateSocialCalendarItemContent(projectId, itemId, platform, { mode, expectedRevision }),
    onSuccess: (res) => {
      if (res?.data?.mode === 'plan') {
        // the draft exists already (the plan's caption, verbatim): show the updated item and refresh what lists posts
        if (res.data.item) putCalendarItemInCache(queryClient, projectId, res.data.item)
        queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
        queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
        return
      }
      const generation = res?.data?.generation
      if (generation) queryClient.setQueryData(socialAIContentKey(projectId), { status: 'generating', generation, publication: null })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialAIContentKey(projectId), exact: true }),
  })
}

/**
 * Keeps the calendar honest when a post that came from a plan item finishes generating: the draft is a real publication now,
 * so the calendar (its status and linked drafts) and the publishing lists are refetched - once per finished generation, even
 * if the item's editor was closed meanwhile. Mount it where the calendar is shown.
 */
export function useCalendarContentGenerationSync(projectId) {
  const queryClient = useQueryClient()
  const content = useSocialAIContent(projectId)
  const status = content.data?.status
  const generation = content.data?.generation
  const handled = useRef(null)
  useEffect(() => {
    if (!generation?.calendarItemId || !generation.id) return
    if ((status === 'ready' || status === 'failed') && handled.current !== generation.id) {
      handled.current = generation.id
      queryClient.invalidateQueries({ queryKey: socialContentCalendarKey(projectId), exact: true })
    }
  }, [status, generation, projectId, queryClient])
  return content
}

// ── AI post (single-post generation) ──────────────────────────────────────

export const socialAIContentKey = (projectId) => ['social', 'ai-content', projectId]
export const CONTENT_POLL_MS = 2500

/**
 * The project's latest single-post generation: `{ status: none|generating|ready|failed, generation, publication }`
 * straight from the server. While - and only while - the server says "generating" it polls the same cheap
 * status endpoint. When a generation finishes, the draft it created is a real publication, so the publishing
 * lists and the approval counts are refetched (the Content Approvals page then shows it).
 */
export function useSocialAIContent(projectId) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: socialAIContentKey(projectId),
    queryFn: async () => (await apiService.getSocialAIContentStatus(projectId))?.data || null,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? CONTENT_POLL_MS : false),
    refetchIntervalInBackground: false,
  })

  const status = query.data?.status
  const generationId = query.data?.generation?.id
  const lastNotified = useRef(null)
  useEffect(() => {
    if (status === 'ready' && generationId && lastNotified.current !== generationId) {
      lastNotified.current = generationId
      queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
    }
  }, [status, generationId, projectId, queryClient])

  return query
}

/**
 * Starts ONE generation (`{ platform, contentPillar, objective }`). The server answers 202 with the generation
 * (new, or the one already running); that is written into the cache as "generating" so polling starts at once.
 * A refusal (400/409/422/429/503) is thrown with the backend's own message and code.
 */
export function useGenerateSocialAIContent(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => apiService.generateSocialAIContent(projectId, request),
    onSuccess: (res) => {
      const generation = res?.data?.generation
      if (generation) queryClient.setQueryData(socialAIContentKey(projectId), { status: 'generating', generation, publication: null })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: socialAIContentKey(projectId), exact: true }),
  })
}

// ── AI design (image) for an approved post ───────────────────────────────

export const socialAIDesignKey = (projectId, publicationId) => ['social', 'ai-design', projectId, publicationId]
export const DESIGN_POLL_MS = 3000

/**
 * The latest design generation of ONE publication: `{ status: none|generating|ready|failed, generation, publication }`
 * straight from the server (publication = the real post: media, design version, approval state). Polls only while the
 * server says "generating". When a generation finishes, the media is on a real publication that moved in the approval
 * workflow, so the publishing lists, the approval counts and Content Approvals are refetched.
 */
export function useSocialAIDesign(projectId, publicationId, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: socialAIDesignKey(projectId, publicationId),
    queryFn: async () => (await apiService.getSocialAIDesignStatus(projectId, publicationId))?.data || null,
    enabled: !!projectId && !!publicationId && enabled,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.status === 'generating' ? DESIGN_POLL_MS : false),
    refetchIntervalInBackground: false,
  })

  const status = query.data?.status
  const generationId = query.data?.generation?.id
  const lastNotified = useRef(null)
  useEffect(() => {
    if ((status === 'ready' || status === 'failed') && generationId && lastNotified.current !== generationId) {
      lastNotified.current = generationId
      queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
    }
  }, [status, generationId, projectId, queryClient])

  return query
}

const DESIGN_FOLLOW_MAX_POLLS = 200 // 200 x 3 s = 10 minutes, well past the server's own 8-minute stale window
const designFollowers = new Set()
/** Test seam: forget every running follower (a test that abandons its timers would otherwise block the next one). */
export const resetDesignFollowers = () => designFollowers.clear()

/**
 * Follows ONE started generation until the server says it is no longer generating, then refetches the publishing lists
 * (the post moved in the approval workflow). It deliberately does not depend on any component staying mounted: the post
 * leaves the "Approved" tab the moment its design is done, and a user who switched tabs while waiting would otherwise
 * never see it arrive. One follower per post, bounded, silent on transient network errors, and it only ever READS.
 */
export function followDesignGeneration(queryClient, projectId, publicationId) {
  const key = `${projectId}:${publicationId}`
  if (designFollowers.has(key)) return
  designFollowers.add(key)
  ;(async () => {
    try {
      for (let i = 0; i < DESIGN_FOLLOW_MAX_POLLS; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, DESIGN_POLL_MS))
        const res = await apiService.getSocialAIDesignStatus(projectId, publicationId).catch(() => null)
        const status = res?.data?.status
        if (status && status !== 'generating') {
          queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
          queryClient.invalidateQueries({ queryKey: socialAIDesignKey(projectId, publicationId), exact: true })
          return
        }
      }
    } finally {
      designFollowers.delete(key)
    }
  })()
}

/** Starts ONE design generation. The 202 is written into the cache as "generating" so polling starts at once. Refusals are thrown with the backend's message and code. */
export function useGenerateSocialAIDesign(projectId, publicationId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => apiService.generateSocialAIDesign(projectId, { publicationId, ...request }),
    onSuccess: (res) => {
      const generation = res?.data?.generation
      if (generation) {
        queryClient.setQueryData(socialAIDesignKey(projectId, publicationId), (prev) => ({ status: 'generating', generation, publication: prev?.publication || null }))
        followDesignGeneration(queryClient, projectId, publicationId)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: socialAIDesignKey(projectId, publicationId), exact: true })
      queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
    },
  })
}

// ── Creative Studio ──────────────────────────────────────────────────────

export const socialStudioKey = (projectId, publicationId) => ['social', 'studio', projectId, publicationId]
export const STUDIO_POLL_MS = 3000

/**
 * Everything Creative Studio shows about ONE post, straight from the server: the real publication content, brand / product / format,
 * the approval gate and the latest three candidates. ONE query, and the only poll in the studio: it runs every STUDIO_POLL_MS only while
 * the server says a generation is in flight, and stops by itself when it finishes, fails or the page unmounts. When a generation stops
 * (an attached design moved the post in the approval workflow) the publishing lists and approval counts are refetched once.
 */
export function useSocialStudio(projectId, publicationId, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: socialStudioKey(projectId, publicationId),
    queryFn: async () => (await apiService.getSocialStudio(projectId, publicationId))?.data || null,
    enabled: !!projectId && !!publicationId && enabled,
    // The studio is the server's live state (generation running, design selected, approval moved on another screen): never trust
    // a cached copy as fresh, whether it came from this session or the persisted cache (lib/queryPersistence.js excludes it too).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.generation?.active ? STUDIO_POLL_MS : false),
    refetchIntervalInBackground: false,
  })

  const active = !!query.data?.generation?.active
  const wasActive = useRef(false)
  useEffect(() => {
    if (wasActive.current && !active) queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
    wasActive.current = active
  }, [active, projectId, queryClient])

  return query
}

/** Writes the 202's generation into the studio cache as "in flight" so the skeletons and the poll start at once. */
function startedStudioGeneration(queryClient, projectId, publicationId, res) {
  const generation = res?.data?.generation
  if (generation) queryClient.setQueryData(socialStudioKey(projectId, publicationId), (prev) => (prev ? { ...prev, generation } : prev))
}

function settleStudio(queryClient, projectId, publicationId) {
  queryClient.invalidateQueries({ queryKey: socialStudioKey(projectId, publicationId), exact: true })
  queryClient.invalidateQueries({ queryKey: publishingKey(projectId) })
}

/** Generate designs / Regenerate all: three new directions for the current caption. Refusals are thrown with the backend's message and code. */
export function useStudioGenerate(projectId, publicationId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => apiService.generateSocialStudioDesigns(projectId, { publicationId, ...request }),
    onSuccess: (res) => startedStudioGeneration(queryClient, projectId, publicationId, res),
    onSettled: () => settleStudio(queryClient, projectId, publicationId),
  })
}

/** Regenerate selected (no instruction) or Apply AI changes (with one): ONE candidate again, in its own creative direction. */
export function useStudioRegenerate(projectId, publicationId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => apiService.regenerateSocialStudioDesign(projectId, { publicationId, ...request }),
    onSuccess: (res) => startedStudioGeneration(queryClient, projectId, publicationId, res),
    onSettled: () => settleStudio(queryClient, projectId, publicationId),
  })
}

/** Select design / Replace design: attaches the chosen candidate to the post (to Design Review). Never approves. */
export function useStudioSelect(projectId, publicationId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request) => apiService.selectSocialStudioDesign(projectId, { publicationId, ...request }),
    onSettled: () => settleStudio(queryClient, projectId, publicationId),
  })
}

"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiService from '@/lib/apiService'
import { queryKeys } from '@/lib/query/keys'
import { staleTimes, gcTimes } from '@/lib/query/stale-times'

// ==================== OVERVIEW QUERIES ====================

export function useProjectOverview(projectId) {
  return useQuery({
    queryKey: queryKeys.projects.overview(projectId),
    queryFn: () => apiService.getProjectOverview(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useIssueCounts(projectId) {
  return useQuery({
    queryKey: queryKeys.issues.counts(projectId),
    queryFn: () => apiService.getIssueCounts(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

// ==================== TECHNICAL CHECKS QUERIES ====================

export function useTechnicalChecks(projectId) {
  return useQuery({
    queryKey: queryKeys.technical.all(projectId),
    queryFn: () => apiService.getTechnicalChecks(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useTechnicalCheckDetail(projectId, checkId) {
  return useQuery({
    queryKey: queryKeys.technical.detail(projectId, checkId),
    queryFn: () => apiService.getTechnicalCheckDetail(projectId, checkId),
    enabled: !!projectId && !!checkId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== ON-PAGE ISSUES QUERIES ====================

export function useOnPageIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.issues.onpage(projectId),
    queryFn: () => apiService.getOnPageIssues(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useIssueUrls(projectId, issueCode) {
  return useQuery({
    queryKey: [...queryKeys.issues.onpage(projectId), issueCode],
    queryFn: () => apiService.getIssueUrls(projectId, issueCode),
    enabled: !!projectId && !!issueCode,
    staleTime: staleTimes.STANDARD,
  })
}

export function usePageIssues(projectId, pageUrl) {
  return useQuery({
    queryKey: queryKeys.issues.page(projectId, pageUrl),
    queryFn: () => apiService.getPageIssues(projectId, pageUrl),
    enabled: !!projectId && !!pageUrl,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== URL VERIFICATION QUERIES (F4-002) ====================

// staleTime: 0 — a fresh run can complete at any time and the result must
// never look stale (mirrors the "never show a stale AI value" rule the
// backend itself enforces on this same field set).
export function useLatestVerification(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.verification.latest(projectId, pageUrl),
    queryFn: () => apiService.getLatestVerification(projectId, pageUrl),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: 0,
    retry: false,
  })
}

// F4-003: history for one page. Cached per-project (not per-page — see
// queryKeys.verification.projectHistory) since the underlying fetch is
// project-wide; `select` filters+keeps the backend's newest-first order for
// just this page. `enabled` is driven by the History panel's own
// expanded/collapsed local state, not by useUrlVerification's progress —
// browsing past runs is independent of whatever just ran this session.
export function useVerificationHistory(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.verification.projectHistory(projectId),
    queryFn: () => apiService.getVerificationHistory(projectId, { limit: 50 }),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: staleTimes.AUDIT_RESULT,
    select: (response) => (response?.data || []).filter((run) => run.pageUrl === pageUrl),
  })
}

// F4-004: single run by id, for the Run Detail Drawer. `enabled` is driven
// by the drawer's own open state — opening fetches only that run; closing
// doesn't touch the history list's own cached query at all.
// staleTime: STATIC — a terminal run's persisted fields never change again
// once finalized, so there's nothing to refetch.
export function useVerificationRun(runId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.verification.run(runId),
    queryFn: () => apiService.getVerificationRun(runId),
    enabled: !!runId && enabled,
    staleTime: staleTimes.STATIC,
    retry: false,
  })
}

// ==================== ACCESSIBILITY QUERIES ====================

export function useAccessibilityIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.issues.accessibility(projectId),
    queryFn: () => apiService.getAccessibilityIssues({ projectId }),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

// ==================== PAGESPEED QUERIES ====================

export function usePageSpeedData(projectId) {
  return useQuery({
    queryKey: queryKeys.pagespeed.data(projectId),
    queryFn: () => apiService.getPageSpeedData(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function usePageSpeedStatus(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['pagespeed', projectId, 'status'],
    queryFn: () => apiService.getPageSpeedStatus(projectId),
    enabled: !!projectId && enabled,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.scan_status
      return status === 'running' ? 4000 : false
    },
  })
}

export function usePageSpeedRescan(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.rescanPageSpeed(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagespeed', projectId, 'status'] })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['pagespeed', projectId, 'status'] })
    },
  })
}


// ==================== PROJECTS QUERIES ====================

export function useProjects(page = 1, limit = 50, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.list({ page, limit }),
    queryFn: () => apiService.getProjects(page, limit),
    staleTime: staleTimes.AUDIT_RESULT,
    gcTime: gcTimes.STANDARD,
    refetchOnWindowFocus: false,
    enabled: !!enabled,
  })
}

/**
 * Trashed (soft-deleted) projects for the Deleted Projects page.
 */
export function useTrashedProjects(page = 1, limit = 10) {
  return useQuery({
    queryKey: queryKeys.projects.trash({ page, limit }),
    queryFn: () => apiService.getTrashedProjects(page, limit),
    staleTime: staleTimes.STANDARD,
    gcTime: gcTimes.STANDARD,
    refetchOnWindowFocus: false,
  })
}

/**
 * Restore a trashed project. On success, invalidates both the active
 * projects list (so the restored project reappears everywhere — dashboard,
 * sidebar, project selector) and the trash list (so it disappears there).
 */
export function useRestoreProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId) => apiService.restoreProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'trash'] })
    },
  })
}

/**
 * Soft-delete (move to Trash) a project via the existing project-delete
 * endpoint — same endpoint used since Project Trash & Restore Phase 1, no
 * new API. Invalidates the active list (the project disappears from it) and
 * the trash list (it appears there).
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId) => apiService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'trash'] })
    },
  })
}

/**
 * Permanently delete a trashed project (Project Trash & Restore, Phase 3).
 * Same cache invalidation as useRestoreProject — the project disappears from
 * both the active list and the trash list, this time for good.
 */
export function usePermanentlyDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId) => apiService.permanentlyDeleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'trash'] })
    },
  })
}

/**
 * Update a project's scrape_frequency ('manual' | 'weekly'). Reuses the
 * existing project update endpoint — no dedicated backend route.
 * Invalidates the projects list/detail so the sidebar and other panels
 * pick up the change on their next refetch.
 */
export function useUpdateScrapeFrequency(projectId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scrape_frequency) => apiService.updateProject(projectId, { scrape_frequency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
    },
  })
}

// ==================== AISO HUB QUERIES ====================

export function useAISOHub(projectId) {
  return useQuery({
    queryKey: queryKeys.aisoHub.data(projectId),
    queryFn:  () => apiService.getAISOHubData(projectId),
    enabled:  !!projectId,
    // Audit-result data (scores/issues), not general/static data — see
    // stale-times.js's own doc comment on AUDIT_RESULT: must be short so a
    // backend recalculation (or re-audit) is fetched fresh rather than
    // served from the 24h-persisted localStorage cache. This hook (and its
    // GEO/AEO siblings below) previously used STANDARD (5 min), which meant
    // a fixed backend calculation could still render as the old, wrong
    // value for up to 5 minutes — or indefinitely, if the tab was never
    // remounted — after the fix shipped.
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useAISOHubIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.aisoHub.issues(projectId),
    queryFn:  () => apiService.getAISOHubIssues(projectId),
    enabled:  !!projectId,
    staleTime: staleTimes.AUDIT_RESULT, // see useAISOHub above
  })
}

export function useAISOHubIssueDetail(projectId, ruleId) {
  return useQuery({
    queryKey: queryKeys.aisoHub.detail(projectId, ruleId),
    queryFn:  () => apiService.getAISOHubIssueDetail(projectId, ruleId),
    enabled:  !!projectId && !!ruleId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== AI PAGES QUERIES ====================

export function usePageAIIssues(projectId, url) {
  return useQuery({
    queryKey: queryKeys.aiPages.issues(projectId, url),
    queryFn:  () => apiService.getPageAIIssues(projectId, url),
    enabled:  !!projectId && !!url,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== GEO HUB QUERIES ====================

export function useGEOHub(projectId) {
  return useQuery({
    queryKey: queryKeys.geoHub.data(projectId),
    queryFn:  () => apiService.getGEOHubData(projectId),
    enabled:  !!projectId,
    staleTime: staleTimes.AUDIT_RESULT, // see useAISOHub's comment above
  })
}

export function useGEOHubIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.geoHub.issues(projectId),
    queryFn:  () => apiService.getGEOHubIssues(projectId),
    enabled:  !!projectId,
    staleTime: staleTimes.AUDIT_RESULT, // see useAISOHub's comment above
  })
}

export function useGEOHubIssueDetail(projectId, ruleId) {
  return useQuery({
    queryKey: queryKeys.geoHub.detail(projectId, ruleId),
    queryFn:  () => apiService.getGEOHubIssueDetail(projectId, ruleId),
    enabled:  !!projectId && !!ruleId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== AEO HUB QUERIES ====================

export function useAEOHub(projectId) {
  return useQuery({
    queryKey: queryKeys.aeoHub.data(projectId),
    queryFn:  () => apiService.getAEOHubData(projectId),
    enabled:  !!projectId,
    staleTime: staleTimes.AUDIT_RESULT, // see useAISOHub's comment above
  })
}

export function useAEOHubIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.aeoHub.issues(projectId),
    queryFn:  () => apiService.getAEOHubIssues(projectId),
    enabled:  !!projectId,
    staleTime: staleTimes.AUDIT_RESULT, // see useAISOHub's comment above
  })
}

export function useAEOHubIssueDetail(projectId, ruleId) {
  return useQuery({
    queryKey: queryKeys.aeoHub.detail(projectId, ruleId),
    queryFn:  () => apiService.getAEOHubIssueDetail(projectId, ruleId),
    enabled:  !!projectId && !!ruleId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== AI SEARCH AUDIT QUERIES ====================

export function useAISearchAuditProject(projectId) {
  return useQuery({
    queryKey: queryKeys.aiAudit.project(projectId),
    queryFn: () => apiService.getProjectById(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STATIC, // Project data rarely changes
  })
}

export function useAISearchAudit(projectId) {
  return useQuery({
    queryKey: queryKeys.aiAudit.summary(projectId),
    queryFn: () => apiService.getAISearchAudit(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAISearchAuditIssues(projectId) {
  return useQuery({
    queryKey: queryKeys.aiAudit.issues(projectId),
    queryFn: () => apiService.getAISearchAuditIssues(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAISearchAuditIssue(projectId, issueId) {
  return useQuery({
    queryKey: queryKeys.aiAudit.issue(projectId, issueId),
    queryFn: () => apiService.getAISearchAuditIssue(projectId, issueId),
    enabled: !!projectId && !!issueId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAISearchAuditIssuePages(projectId, issueId, options = {}) {
  return useQuery({
    queryKey: queryKeys.aiAudit.issuePages(projectId, issueId, options),
    queryFn: () => apiService.getAISearchAuditIssuePages(projectId, issueId, options),
    enabled: !!projectId && !!issueId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAIAccessibility(projectId) {
  return useQuery({
    queryKey: queryKeys.aiAudit.accessibility(projectId),
    queryFn: () => apiService.getAIAccessibility(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== PRE AUDIT QUERIES ====================

export function usePreAudit(projectId) {
  return useQuery({
    queryKey: queryKeys.preAudit.detail(projectId),
    queryFn: () => apiService.getPreAudit(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STATIC,
  })
}

// ==================== AI VIDEO QUERIES ====================

export function useAIVisibilityPages(projectId, params = {}) {
  return useQuery({
    queryKey: queryKeys.aiVideo.pages(projectId, params),
    queryFn: () => apiService.getAIVisibilityPages(projectId, params),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAIVisibilityPage(projectId, url) {
  return useQuery({
    queryKey: queryKeys.aiVideo.page(projectId, url),
    queryFn: () => apiService.getAIVisibilityPage(projectId, url),
    enabled: !!projectId && !!url,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAIVisibilityWorstPages(projectId, limit = 5) {
  return useQuery({
    queryKey: queryKeys.aiVideo.worst(projectId, limit),
    queryFn: () => apiService.getAIVisibilityWorstPages(projectId, limit),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

export function useAIVisibilityEntityGraph(projectId) {
  return useQuery({
    queryKey: queryKeys.aiVideo.graph(projectId),
    queryFn: () => apiService.getAIVisibilityEntityGraph(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== FIX LOGS QUERIES (deprecated — use task hooks) ====================

/**
 * @deprecated Use useActiveTaskUrls instead
 */
export function useFixedUrls(projectId, issueKey) {
  return useQuery({
    queryKey: queryKeys.fixLogs.fixedUrls(projectId, issueKey),
    queryFn: () => apiService.getFixedUrls(projectId, issueKey),
    enabled: !!projectId && !!issueKey,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * @deprecated Use useTasks instead
 */
export function useFixLogs(params = {}) {
  return useQuery({
    queryKey: queryKeys.fixLogs.list(params),
    queryFn: () => apiService.getFixLogs(params),
    enabled: !!params.projectId,
    staleTime: staleTimes.DYNAMIC,
  })
}

// ==================== TASK LIFECYCLE QUERIES ====================

/**
 * Returns all tasks for a specific issue + project, keyed by URL.
 * Used by issue detail page to show task status badges on each URL.
 */
export function useActiveTaskUrls(projectId, issueKey) {
  return useQuery({
    queryKey: queryKeys.tasks.activeUrls(projectId, issueKey),
    queryFn: () => apiService.getActiveTaskUrls(projectId, issueKey),
    enabled: !!projectId && !!issueKey,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * Links an already-existing task to a recommendation (a task created
 * before any AI recommendation existed never gets this backfilled
 * automatically — see taskController.js's linkTaskRecommendation()).
 * Invalidates activeUrls so taskMap picks up the newly-set
 * recommendationId on the very next read.
 */
export function useLinkTaskRecommendation(projectId, issueKey) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, recommendationId }) => apiService.linkTaskRecommendation(taskId, recommendationId),
    onSuccess: () => {
      if (projectId && issueKey) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activeUrls(projectId, issueKey) })
      }
    },
  })
}

/**
 * Fetches one recommendation by id, scoped to the project — the
 * authoritative source for "what will actually be written" in the
 * WordPress apply-fix dialog, keyed off the Task's own persisted
 * recommendationId rather than any local component state.
 */
export function useRecommendationById(projectId, recommendationId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.recommendations.byId(projectId, recommendationId),
    queryFn: () => apiService.getRecommendationById(recommendationId, projectId),
    enabled: !!projectId && !!recommendationId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Paginated task list. Powers the Optimization Center.
 */
export function useTasks(params = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => apiService.getTasks(params),
    enabled: !!params.projectId,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * Task summary counts by status for a project.
 */
export function useTaskSummary(projectId) {
  return useQuery({
    queryKey: queryKeys.tasks.summary(projectId),
    queryFn: () => apiService.getTaskSummary(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * Single task detail — powers the Optimization Center's View Details modal.
 * Returns { ...task, attemptCount, latestAttempt, hasOlderAttempts,
 * historyAvailable }. Only fires when the modal is actually open (pass
 * `enabled: false` while closed) so opening/closing never triggers a fetch
 * by itself and the table's own list query is untouched.
 */
export function useTaskDetail(taskId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => apiService.getTaskById(taskId),
    enabled: !!taskId && enabled,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * Older fixHistory attempts (excludes the latest, already on useTaskDetail).
 * Lazy by design — only enabled once the user asks to see earlier attempts,
 * so a task with a long history never pays for it until requested.
 */
export function useTaskHistory(taskId, { enabled = false, limit, before } = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.history(taskId),
    queryFn: () => apiService.getTaskHistory(taskId, { limit, before }),
    enabled: !!taskId && enabled,
    staleTime: staleTimes.DYNAMIC,
  })
}

/**
 * Delete a task (soft delete). Optimistically removes the row from all cached
 * task lists and refreshes the summary counts.
 *
 * @param {string} projectId - needed for targeted cache invalidation
 */
export function useDeleteTask(projectId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId) => apiService.deleteTask(taskId),

    onMutate: async (taskId) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all(projectId) })

      // Snapshot for rollback
      const previousLists = queryClient.getQueriesData({ queryKey: ['tasks', projectId, 'list'] })
      const previousSummary = queryClient.getQueryData(queryKeys.tasks.summary(projectId))

      // Optimistically remove row from every cached list page
      queryClient.setQueriesData(
        { queryKey: ['tasks', projectId, 'list'] },
        (old) => {
          if (!old?.data?.tasks) return old
          return {
            ...old,
            data: {
              ...old.data,
              tasks: old.data.tasks.filter((t) => t._id !== taskId),
              pagination: old.data.pagination
                ? { ...old.data.pagination, total: Math.max(0, old.data.pagination.total - 1) }
                : old.data.pagination,
            },
          }
        }
      )

      return { previousLists, previousSummary }
    },

    onError: (_err, _taskId, context) => {
      // Roll back optimistic update on error
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      if (context?.previousSummary) {
        queryClient.setQueryData(queryKeys.tasks.summary(projectId), context.previousSummary)
      }
    },

    onSettled: () => {
      // Always resync from server — summary counts + lists
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(projectId) })
    },
  })
}

// ==================== AUDIT HISTORY QUERIES ====================

export function useLatestComparison(projectId) {
  return useQuery({
    queryKey: queryKeys.auditHistory.comparison(projectId),
    queryFn: () => apiService.getLatestComparison(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useAuditHistory(projectId, { enabled = true, page = 1 } = {}) {
  return useQuery({
    queryKey: queryKeys.auditHistory.history(projectId, page),
    queryFn: () => apiService.getAuditHistory(projectId, page),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useProjectTrends(projectId) {
  return useQuery({
    queryKey: queryKeys.auditHistory.trends(projectId),
    queryFn: () => apiService.getProjectTrends(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useAllAuditHistory(projectId) {
  return useQuery({
    queryKey: queryKeys.auditHistory.historyAll(projectId),
    queryFn: () => apiService.getAuditHistory(projectId, 1, 50),
    enabled: !!projectId,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

export function useAuditComparison(projectId, from, to, { enabled = false } = {}) {
  return useQuery({
    queryKey: queryKeys.auditHistory.auditComparison(projectId, from, to),
    queryFn: () => apiService.getAuditComparison(projectId, from, to),
    enabled: !!projectId && !!from && !!to && String(from) !== String(to) && enabled,
    staleTime: staleTimes.AUDIT_RESULT,
  })
}

// ==================== RAW HTML QUERIES ====================

export function usePageRawHtml(projectId, url) {
  return useQuery({
    queryKey: queryKeys.rawHtml.detail(projectId, url),
    queryFn: () => apiService.getPageRawHtml(url, projectId),
    enabled: !!projectId && !!url,
    staleTime: staleTimes.STANDARD,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

// ==================== SUBSCRIPTION QUERIES ====================

/** The authenticated user's current plan, status, and live credits/pages quota. */
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription.mine(),
    queryFn: () => apiService.getSubscription(),
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== CONNECTED ACCOUNTS (GOOGLE) ====================

/**
 * Account-level Google connection status for Settings → Connected
 * Accounts — distinct from any project-scoped Google status query
 * elsewhere in this file; this one rolls up across every project the user
 * has ever connected Google to (see
 * odito_backend/.../googleAccountConnectionService.js).
 */
export function useGoogleAccountStatus() {
  return useQuery({
    queryKey: queryKeys.googleAccount.status(),
    queryFn: () => apiService.getGoogleAccountStatus(),
    staleTime: staleTimes.STANDARD,
  })
}

/** Revokes every Google connection this user has, account-wide. */
export function useDisconnectGoogleAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.disconnectGoogleAccount(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleAccount.status() })
    },
  })
}

// ==================== GOOGLE SERVICES (INDEPENDENT PER-SERVICE ACCOUNTS) ====================

/**
 * Project-scoped status for all four independently-connectable Google
 * services (google_ads/search_console/analytics/business_profile) — the
 * data source for Settings → Google Services. Unlike useGoogleAccountStatus
 * above, this reflects one project at a time and never rolls services
 * together (see getProjectGoogleServiceConnections's own doc comment).
 */
export function useGoogleServiceConnections(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleServices.connections(projectId),
    queryFn: () => apiService.getGoogleServiceConnections(projectId),
    enabled: enabled && !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Invalidates every cached query that could be showing a stale "not
 * connected" (or stale property/site/account list) state for one project,
 * right after a Google OAuth connect/reconnect succeeds for ANY of the four
 * independent services.
 *
 * Why this exists: each status query below is persisted to localStorage
 * (see lib/queryClient.js) and kept "fresh" for staleTimes.STANDARD (5 min).
 * The OAuth redirect can land on Settings → Profile (ConnectedAccountsCard)
 * or on the Google Visibility overview page (app/google-visibility/page.jsx)
 * depending on `returnTo` — but the four SERVICE-SPECIFIC dashboard pages
 * (search-console/analytics/business-profile/google-ads) are usually not
 * mounted at that moment, so nothing is there to `.refetch()`. Marking their
 * queries stale here instead means whichever page the user opens next
 * fetches fresh data on mount, rather than serving a pre-connection cache
 * entry that still looks "fresh" to React Query.
 *
 * The backend redirect doesn't currently say which of the four services was
 * just connected (see oauth.routes.js), so this invalidates all four
 * status/discovery queries unconditionally — cheap: an unmounted query is
 * only marked stale (no network request) until something next observes it;
 * an actively mounted one (e.g. this same overview page) refetches once,
 * immediately, which is exactly the desired "update without a manual
 * refresh" behavior.
 */
export function invalidateGoogleServiceStatusQueries(queryClient, projectId) {
  if (!projectId) return
  queryClient.invalidateQueries({ queryKey: queryKeys.googleServices.connections(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.searchConsole.status(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.searchConsole.sites(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.status(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.properties(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.status(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.accounts(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.googleAds.syncStatus(projectId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.googleAds.accounts(projectId) })
}

/**
 * Starts (or restarts, for "Change Account") the OAuth flow for exactly one
 * Google service. Returns a function the caller invokes on click; redirects
 * the browser on success rather than resolving a value, since the consent
 * URL must be navigated to, not rendered.
 */
export function useConnectGoogleService(projectId, service) {
  return async (returnTo) => {
    const res = await apiService.getGoogleServiceConnectUrl(service, projectId, returnTo)
    if (res?.data?.url) {
      window.location.href = res.data.url
      return
    }
    throw new Error(`Failed to start ${service} connection.`)
  }
}

/** Disconnects exactly one service's Google connection for one project — never any other service, never any other project. */
export function useDisconnectGoogleService(projectId, service) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.disconnectGoogleService(service, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleServices.connections(projectId) })
    },
  })
}

// ==================== BRAND ASSET RESOLVER ====================

/**
 * Platform-wide "best available logo" for a project - Google Business
 * Profile logo -> website logo -> website favicon -> generated initials
 * (see odito_backend/src/services/brandAssetService.js). Long staleTime
 * since branding rarely changes and the backend itself caches the website
 * logo/favicon for 7 days - this hook just avoids re-fetching on every
 * navigation within that window.
 */
export function useProjectBrandAsset(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.brandAsset.detail(projectId),
    queryFn: () => apiService.getProjectBrandAsset(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STATIC,
    gcTime: gcTimes.STATIC,
  })
}

// ==================== BUSINESS PROFILE REVIEWS & RATING ====================

/**
 * Average rating / total review count. Response includes `available: false`
 * with a `reason` when Google restricts review access for this app — the
 * component renders "Unavailable" + tooltip in that case, never a fake 0.
 */
export function useBusinessProfileRating(projectId) {
  return useQuery({
    queryKey: queryKeys.businessProfile.rating(projectId),
    queryFn: () => apiService.getBusinessProfileRating(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Paginated, searchable review list (Reviews Drawer + Reviews page). The
 * optional rating / replied / sort filters are applied server-side.
 */
export function useBusinessProfileReviews(projectId, { page = 1, limit = 20, search = '', rating = '', replied = '', sort = '' } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.reviews(projectId, { page, limit, search, rating, replied, sort }),
    queryFn: () => apiService.getBusinessProfileReviews(projectId, { page, limit, search, rating, replied, sort }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData, // keep prior page visible while the next page loads
  })
}

/**
 * Consolidated review analytics (cards, distributions, trends, response,
 * sentiment) for ONE shared date range - a single request feeds every module.
 * Keyed by project + location + range + timezone so switching range fetches
 * only that range (and returns instantly when it was already loaded); the
 * previous range stays on screen while the next one loads.
 */
export function useBusinessProfileReviewAnalytics(projectId, { locationId = '', range = '90d', tz = '' } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.reviewAnalytics(projectId, locationId, range, tz),
    queryFn: () => apiService.getBusinessProfileReviewAnalytics(projectId, { range, tz }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Posts a reply to a Google review. The cache is only touched with what the
 * backend returns AFTER Google accepted the reply (or, for ALREADY_REPLIED,
 * the reply Google already had) - never optimistically. Every cached review
 * page is patched in place for an instant update, then reviews + rating
 * (responded count) are refetched so filters like "Not responded" stay correct.
 */
export function useReplyToBusinessProfileReview(projectId) {
  const queryClient = useQueryClient()

  const patchCachedReview = (review) => {
    if (!review?.google_review_id) return
    queryClient.setQueriesData({ queryKey: ['business-profile', projectId, 'reviews'] }, (old) => {
      const list = old?.data?.reviews
      if (!Array.isArray(list)) return old
      return {
        ...old,
        data: { ...old.data, reviews: list.map((r) => (r.google_review_id === review.google_review_id ? { ...r, ...review } : r)) },
      }
    })
  }
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'reviews'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.rating(projectId) })
    // response-rate / treatment figures change with every reply
    queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'review-analytics'] })
  }

  return useMutation({
    mutationFn: ({ reviewId, reply }) => apiService.replyToBusinessProfileReview(projectId, reviewId, reply),
    onSuccess: (res) => {
      patchCachedReview(res?.data?.review)
      refresh()
    },
    onError: (error) => {
      if (error?.code === 'ALREADY_REPLIED') {
        patchCachedReview(error.data?.review)
        refresh()
      }
    },
  })
}

/** Triggers a metadata + reviews sync and refreshes both queries above. */
export function useSyncBusinessProfileReviews(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncBusinessProfileReviews(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.rating(projectId) })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'reviews'] })
      // The Insights page reads the same synced reviews - refresh every cached range.
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'review-analytics'] })
    },
  })
}

// ==================== BUSINESS PROFILE DASHBOARD ====================
// Connection/status/accounts/locations/select/sync/data/details/trends/media
// for the dedicated Business Profile page. Mirrors the exact request flow
// google-visibility/page.jsx's Business Profile card already uses directly
// via apiService (status → accounts → locations → select → sync → data),
// just wrapped in query hooks so the new page is fully React Query-driven.

/** Connection + selection + last-sync status for this project. */
export function useBusinessProfileStatus(projectId) {
  return useQuery({
    queryKey: queryKeys.businessProfile.status(projectId),
    queryFn: () => apiService.getBusinessProfileStatus(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/** Accessible Google Business Profile accounts (used by the account/location picker). */
export function useBusinessProfileAccounts(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.accounts(projectId),
    queryFn: () => apiService.getBusinessProfileAccounts(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Locations for a selected account. */
export function useBusinessProfileLocations(projectId, accountId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.locations(projectId, accountId),
    queryFn: () => apiService.getBusinessProfileLocations(projectId, accountId),
    enabled: !!projectId && !!accountId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Persists the chosen account/location and enables the service. */
export function useSelectBusinessProfile(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, locationId }) => apiService.selectBusinessProfile(projectId, accountId, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.status(projectId) })
    },
  })
}

/**
 * Full "Sync Now": performance + metadata + extended details + reviews +
 * media (backend's runReviewsAndMetadataSync now covers all of these in one
 * pass). Invalidates every Business Profile query for this project so the
 * whole page reflects the fresh sync.
 */
export function useSyncBusinessProfile(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncBusinessProfile(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.status(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.data(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.details(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.businessProfile.rating(projectId) })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'reviews'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'review-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'trends'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'media'] })
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'posts'] })
    },
  })
}

/** Latest persisted performance snapshot row (BusinessProfileData). */
export function useBusinessProfileData(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.data(projectId),
    queryFn: () => apiService.getBusinessProfileData(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Extended profile fields: description, categories, hours, coordinates, service area, verification status. */
export function useBusinessProfileDetails(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.details(projectId),
    queryFn: () => apiService.getBusinessProfileDetails(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Day-by-day performance series + range totals, powering both the KPI cards and the trend chart. */
export function useBusinessProfileTrends(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.trends(projectId, range),
    queryFn: () => apiService.getBusinessProfileTrends(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Paginated, optionally category-filtered photos/videos for the Photos gallery. */
export function useBusinessProfileMedia(projectId, { page = 1, limit = 24, category = '' } = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.businessProfile.media(projectId, { page, limit, category }),
    queryFn: () => apiService.getBusinessProfileMedia(projectId, { page, limit, category }),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Paginated, optionally filtered local posts for Google Business Profile.
 */
export function useBusinessProfilePosts(
  projectId,
  { page = 1, limit = 10, topicType = '', state = '', search = '', sort = 'newest' } = {},
  { enabled = true } = {}
) {
  return useQuery({
    queryKey: queryKeys.businessProfile.posts(projectId, { page, limit, topicType, state, search, sort }),
    queryFn: () => apiService.getBusinessProfilePosts(projectId, { page, limit, topicType, state, search, sort }),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Creates and publishes a new local post to Google Business Profile.
 */
export function useCreateBusinessProfilePost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postData) => apiService.createBusinessProfilePost(projectId, postData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'posts'] })
    },
  })
}

/**
 * Edits an existing local post on Google Business Profile.
 */
export function useUpdateBusinessProfilePost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, postData }) => apiService.updateBusinessProfilePost(projectId, postId, postData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'posts'] })
    },
  })
}

/**
 * Deletes a local post from Google Business Profile.
 */
export function useDeleteBusinessProfilePost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId) => apiService.deleteBusinessProfilePost(projectId, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'posts'] })
    },
  })
}

/**
 * Standalone sync for Google Business Profile local posts and insights.
 */
export function useSyncBusinessProfilePosts(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncBusinessProfilePosts(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-profile', projectId, 'posts'] })
    },
  })
}

// ==================== SEARCH CONSOLE DASHBOARD ====================
// Connection/status/sites/select/sync/data/trends for the dedicated Search
// Console page. Structural mirror of the Business Profile block above,
// adapted for Search Console's flat site list (no account->location tiers).

/** Connection + selection + last-sync status for this project. */
export function useSearchConsoleStatus(projectId) {
  return useQuery({
    queryKey: queryKeys.searchConsole.status(projectId),
    queryFn: () => apiService.getSearchConsoleStatus(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/** Accessible Search Console sites for the connected Google account. */
export function useSearchConsoleSites(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.searchConsole.sites(projectId),
    queryFn: () => apiService.getSearchConsoleSites(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

export function useSelectSearchConsoleSite(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (siteUrl) => apiService.selectSearchConsoleSite(projectId, siteUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.searchConsole.status(projectId) })
    },
  })
}

export function useSyncSearchConsole(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncSearchConsole(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.searchConsole.status(projectId) })
      queryClient.invalidateQueries({ queryKey: ['search-console', projectId, 'data'] })
      queryClient.invalidateQueries({ queryKey: ['search-console', projectId, 'trends'] })
      // Prefix-matches every dimension (query/country/device/searchAppearance) -
      // sync refreshes all 4 in one pass server-side, so one invalidation here
      // covers all of them instead of one call per dimension.
      queryClient.invalidateQueries({ queryKey: ['search-console', projectId, 'breakdown'] })
    },
  })
}

/** Page-level performance rows + summary totals (Top Performing Pages table + KPI totals). */
export function useSearchConsoleData(projectId, params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.searchConsole.data(projectId, params),
    queryFn: () => apiService.getSearchConsoleData(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Day-by-day performance series, powering the Search Performance Trends chart. */
export function useSearchConsoleTrends(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.searchConsole.trends(projectId, range),
    queryFn: () => apiService.getSearchConsoleTrends(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Stored dimension breakdown (query/country/device/searchAppearance) - synced alongside page-level data. */
export function useSearchConsoleBreakdown(projectId, dimension, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.searchConsole.breakdown(projectId, dimension),
    queryFn: () => apiService.getSearchConsoleBreakdown(projectId, dimension),
    enabled: !!projectId && !!dimension && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Submitted sitemaps for the selected property (live-fetched, not synced). */
export function useSearchConsoleSitemaps(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.searchConsole.sitemaps(projectId),
    queryFn: () => apiService.getSearchConsoleSitemaps(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** On-demand URL Inspection - not cached as a query since each call inspects a different URL. */
export function useInspectSearchConsoleUrl(projectId) {
  return useMutation({
    mutationFn: (url) => apiService.inspectSearchConsoleUrl(projectId, url),
  })
}

// ==================== GOOGLE ADS - CONNECT FLOW (Phase 7.1) ====================
// Google Ads is a separate OAuth purpose from Business Profile/Search
// Console/Analytics above (its own GoogleConnection row, its own consent
// screen - see oauth.routes.js's "google_ads" branch), so it has no shared
// status endpoint the way those three do. There is no dedicated
// /google-ads/status route either - GET /google-ads/sync-status doubles as
// the connection-status source: it 400s only when there's no connection at
// all (unambiguous - see resolveProjectAndAdsConnection in
// googleAdsController.js, which never sets requireSelectedAccount for this
// route), and 200s with customerId:null when connected-but-unselected. One
// endpoint, one query key, covers "not connected" through "synced" - no new
// backend endpoint needed.

/**
 * Raw sync/connection bookkeeping for this project's Google Ads connection.
 * Pass `refetchInterval` while a sync is in flight to poll as a fallback in
 * case a websocket event is missed (same fallback-poll pattern as
 * useAuditTrigger.js) - omit it otherwise so this behaves like every other
 * status query (STANDARD staleTime, no background polling).
 */
export function useGoogleAdsSyncStatus(projectId, { enabled = true, refetchInterval } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.syncStatus(projectId),
    queryFn: () => apiService.getGoogleAdsSyncStatus(projectId),
    enabled: !!projectId && enabled,
    staleTime: refetchInterval ? staleTimes.REALTIME : staleTimes.STANDARD,
    refetchInterval: refetchInterval || false,
    // A 400 here means "no google_ads connection yet" - an expected,
    // frequent business state (every project starts unconnected), not a
    // transient fetch failure - retrying it is pointless noise.
    retry: (failureCount, error) => error?.status !== 400 && failureCount < 2,
  })
}

/**
 * Derives the Google Ads connect-flow state from useGoogleAdsSyncStatus
 * instead of issuing a second request - `connected` is false specifically
 * when the query failed with HTTP 400 (see the file-level comment above for
 * why that status code is unambiguous for this one endpoint); any other
 * error (403, 429, 500, network) is a real error and is surfaced as such
 * rather than silently reinterpreted as "not connected".
 *
 * Pass `{ poll: true }` while a sync is known to be running (State 4) so
 * this shares the same query-key cache entry with a refetchInterval, as a
 * fallback in case the websocket progress event is missed - same
 * fallback-poll rationale as useAuditTrigger.js.
 */
export function useGoogleAdsConnection(projectId, { poll = false } = {}) {
  const query = useGoogleAdsSyncStatus(projectId, { refetchInterval: poll ? 5000 : undefined })
  const data = query.data?.data
  const isNotConnected = query.isError && query.error?.status === 400
  const isRealError = query.isError && !isNotConnected

  return {
    isLoading: query.isLoading,
    isError: isRealError,
    error: isRealError ? query.error : null,
    connected: !!data && !isNotConnected,
    selected: !!data?.customerId,
    syncing: !!data?.inProgress,
    syncFailed: !!data?.lastSyncFailedAt && (!data?.lastSyncCompletedAt || new Date(data.lastSyncFailedAt) > new Date(data.lastSyncCompletedAt)),
    ready: !!data?.customerId && !data?.inProgress && !!data?.lastSyncCompletedAt,
    data,
    refetch: query.refetch,
  }
}

/** Accessible Google Ads accounts for the connected Google account - only fetch once connected. */
export function useGoogleAdsAccounts(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.accounts(projectId),
    queryFn: () => apiService.getGoogleAdsAccounts(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

export function useSelectGoogleAdsAccount(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, loginCustomerId }) => apiService.selectGoogleAdsAccount(projectId, customerId, loginCustomerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleAds.syncStatus(projectId) })
    },
  })
}

/** Starts the async GOOGLE_ADS_SYNC job (202 + jobId) - progress arrives via socket + poll, not this mutation's response. */
export function useTriggerGoogleAdsSync(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.refreshGoogleAdsSync(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleAds.syncStatus(projectId) })
    },
  })
}

// ==================== GOOGLE ADS DASHBOARD (Phase 7.2) ====================
// Every hook below reads from MongoDB via googleAdsController.js (never
// calls Google directly), backed by data that googleAdsSyncService.js
// already persists. Same shape throughout: useQuery + queryKeys.googleAds.*
// + apiService.getGoogleAds*, enabled only once an account is selected
// (the caller passes `ready` down from useGoogleAdsConnection - every one
// of these 400s server-side without a selected customerId, so there's no
// reason to fire the request before that's true).
//
// staleTimes.DYNAMIC (1 min) throughout: this data only actually changes
// when a sync completes, and useInvalidateGoogleAdsQueries below force-
// invalidates everything the moment that happens - the 1-minute staleTime
// just avoids refetching on every tab focus/remount in between syncs.

/** One request, every account-wide KPI total (spend/clicks/impressions/ctr/avgCpc/conversions/roas/etc). */
export function useGoogleAdsOverview(projectId, dateRange, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.overview(projectId, dateRange),
    queryFn: () => apiService.getGoogleAdsOverview(projectId, dateRange),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Historical trend series (daily/weekly/monthly) backing the Campaign Performance chart and the KPI sparklines. Optional campaignId scopes the series to one campaign (Campaign Detail page) instead of the whole account. */
export function useGoogleAdsTrends(projectId, dateRange, granularity = 'daily', { enabled = true, campaignId = null } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.trends(projectId, dateRange, granularity, campaignId),
    queryFn: () => apiService.getGoogleAdsTrends(projectId, dateRange, granularity, campaignId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Paginated campaign list, each row pre-enriched server-side with its metrics + health + budget health. */
export function useGoogleAdsCampaigns(projectId, { page = 1, limit = 100, status, search, dateRange } = {}, { enabled = true } = {}) {
  const params = { page, limit, status: status || null, search: search || null, dateRange }
  return useQuery({
    queryKey: queryKeys.googleAds.campaigns(projectId, params),
    queryFn: () => apiService.getGoogleAdsCampaigns(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** One campaign's own metadata + a metrics summary for the given range - backs the Campaign Detail page. */
export function useGoogleAdsCampaignDetail(projectId, campaignId, dateRange, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.campaignDetail(projectId, campaignId, dateRange),
    queryFn: () => apiService.getGoogleAdsCampaignDetail(projectId, campaignId, dateRange),
    enabled: !!projectId && !!campaignId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Account-wide health tiles (Budget Pacing / Quality Score / Ad Strength / Conversion Tracking). */
export function useGoogleAdsCampaignHealth(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.campaignHealthSummary(projectId),
    queryFn: () => apiService.getGoogleAdsCampaignHealthSummary(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Top keywords by cost/clicks. startDate/endDate are optional - see GoogleAdsKeyword.getProjectKeywords' doc comment for the interval-overlap semantics. Optional campaignId scopes the list to one campaign (Campaign Detail page). */
export function useGoogleAdsKeywords(projectId, { page = 1, limit = 50, campaignId, search, sortBy = 'cost', sortOrder = -1, startDate, endDate } = {}, { enabled = true } = {}) {
  const params = { page, limit, campaignId: campaignId || null, search: search || null, sortBy, sortOrder, startDate: startDate || null, endDate: endDate || null }
  return useQuery({
    queryKey: queryKeys.googleAds.keywords(projectId, params),
    queryFn: () => apiService.getGoogleAdsKeywords(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Triggers the independent GOOGLE_ADS_KEYWORD_SYNC job - own refresh action, own job type (see Phase 6.4). */
export function useRefreshGoogleAdsKeywords(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.refreshGoogleAdsKeywords(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-ads', projectId, 'keywords'] })
    },
  })
}

/** Recent search queries that triggered ads, with a suggested next action. startDate/endDate optional - same interval-overlap semantics as useGoogleAdsKeywords. Optional campaignId scopes the list to one campaign (Campaign Detail page). */
export function useGoogleAdsSearchTerms(projectId, { page = 1, limit = 25, campaignId, sortBy = 'cost', sortOrder = -1, startDate, endDate } = {}, { enabled = true } = {}) {
  const params = { page, limit, campaignId: campaignId || null, sortBy, sortOrder, startDate: startDate || null, endDate: endDate || null }
  return useQuery({
    queryKey: queryKeys.googleAds.searchTerms(projectId, params),
    queryFn: () => apiService.getGoogleAdsSearchTerms(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Current Optimization Score + its historical trend. */
export function useGoogleAdsOptimizationScore(projectId, dateRange, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.optimizationScore(projectId, dateRange),
    queryFn: () => apiService.getGoogleAdsOptimizationScore(projectId, dateRange),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** AI-suggested optimizations + pending/applied/dismissed status summary. */
export function useGoogleAdsRecommendations(projectId, { page = 1, limit = 25 } = {}, { enabled = true } = {}) {
  const params = { page, limit }
  return useQuery({
    queryKey: queryKeys.googleAds.recommendations(projectId, params),
    queryFn: () => apiService.getGoogleAdsRecommendations(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Triggers the independent GOOGLE_ADS_RECOMMENDATION_SYNC job. */
export function useRefreshGoogleAdsRecommendations(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.refreshGoogleAdsRecommendations(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-ads', projectId, 'recommendations'] })
    },
  })
}

/** Account-wide spend/clicks/impressions/ctr/avgCpc/roas broken down by device. */
export function useGoogleAdsDevices(projectId, dateRange, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.devicePerformance(projectId, dateRange),
    queryFn: () => apiService.getGoogleAdsDevicePerformance(projectId, dateRange),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Top countries/regions/cities by spend. */
export function useGoogleAdsGeo(projectId, { level = 'country', limit = 10 } = {}, { enabled = true } = {}) {
  const params = { level, page: 1, limit }
  return useQuery({
    queryKey: queryKeys.googleAds.geoPerformance(projectId, params),
    queryFn: () => apiService.getGoogleAdsGeoPerformance(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** All 6 audience dimensions (age, gender, household income, affinity, in-market, audience segment) in one response. */
export function useGoogleAdsAudience(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.audiencePerformance(projectId),
    queryFn: () => apiService.getGoogleAdsAudiencePerformance(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Ad performance grouped by format (Responsive Search / Performance Max / Display / Video / Shopping). */
export function useGoogleAdsAds(projectId, { enabled = true } = {}) {
  const params = { groupBy: 'ad_type' }
  return useQuery({
    queryKey: queryKeys.googleAds.adPerformance(projectId, params),
    queryFn: () => apiService.getGoogleAdsAdPerformance(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Individual ads for one campaign (ungrouped) - ad_strength/status/approval per ad plus its own metrics. Backs the Campaign Detail page's Ads section. */
export function useGoogleAdsCampaignAds(projectId, campaignId, { page = 1, limit = 50, sortBy = 'cost', sortOrder = -1 } = {}, { enabled = true } = {}) {
  const params = { page, limit, campaignId, sortBy, sortOrder }
  return useQuery({
    queryKey: queryKeys.googleAds.adPerformance(projectId, params),
    queryFn: () => apiService.getGoogleAdsAdPerformance(projectId, params),
    enabled: !!projectId && !!campaignId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Daily/monthly budget, spend, remaining, utilization, burn rate, per-campaign budget health, active alerts. */
export function useGoogleAdsBudget(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.budgetOverview(projectId),
    queryFn: () => apiService.getGoogleAdsBudgetOverview(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Linear burn-rate-based projected spend for the rest of the current month. */
export function useGoogleAdsBudgetForecast(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.budgetForecast(projectId),
    queryFn: () => apiService.getGoogleAdsBudgetForecast(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Attribution model + top conversion sources + click-vs-view-through split. */
export function useGoogleAdsAttribution(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.attribution(projectId),
    queryFn: () => apiService.getGoogleAdsAttribution(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/** Capability matrix - which widgets have real data behind them for this account yet. */
export function useGoogleAdsCapabilities(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.googleAds.capabilities(projectId),
    queryFn: () => apiService.getGoogleAdsCapabilities(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    gcTime: gcTimes.STANDARD,
  })
}

/** Merged, timestamp-sorted activity feed (syncs, recommendations, budget alerts, campaign changes, optimization events). */
export function useGoogleAdsActivity(projectId, { limit = 8, lookbackDays = 14 } = {}, { enabled = true } = {}) {
  const params = { limit, lookbackDays }
  return useQuery({
    queryKey: queryKeys.googleAds.activity(projectId, params),
    queryFn: () => apiService.getGoogleAdsActivity(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.DYNAMIC,
    gcTime: gcTimes.STANDARD,
  })
}

/**
 * Invalidates every Google Ads dashboard query for this project in one call
 * - the single source of truth Refresh Data / sync-completed handling uses
 * (see page.jsx), so adding a future hook here never means also remembering
 * to add it to a second, separately-maintained invalidation list. Relies on
 * every queryKeys.googleAds.* factory above starting with ['google-ads',
 * projectId, ...] - React Query's partial-key matching invalidates all of
 * them from this one prefix.
 */
export function useInvalidateGoogleAdsQueries(projectId) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['google-ads', projectId] })
}

// ==================== ANALYTICS (GA4) DASHBOARD ====================
// Connection/status/properties/select/sync/trends/breakdowns/pages/events/
// conversions/realtime/health/activity for the dedicated Analytics page.
// Exact structural mirror of the Business Profile block above - same hook
// shapes, same staleTime tiers, same invalidation pattern - so the two
// Google Visibility dashboards are driven by one consistent React Query
// architecture, not two independently-invented ones.

/** Connection + selection + last-sync status for this project. */
export function useAnalyticsStatus(projectId) {
  return useQuery({
    queryKey: queryKeys.analytics.status(projectId),
    queryFn: () => apiService.getAnalyticsStatus(projectId),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
  })
}

/** Accessible GA4 properties (used by the property picker). */
export function useAnalyticsProperties(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.properties(projectId),
    queryFn: () => apiService.getAnalyticsProperties(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Persists the chosen property and enables the service. */
export function useSelectAnalyticsProperty(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (propertyId) => apiService.selectAnalyticsProperty(projectId, propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.status(projectId) })
    },
  })
}

/**
 * Manual "Sync Now" / "Refresh Data". Invalidates every Analytics query for
 * this project (except realtime, which is never cached/never stale by
 * definition) so the whole dashboard reflects the fresh sync - mirrors
 * useSyncBusinessProfile's invalidation list exactly.
 */
export function useSyncAnalytics(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncAnalytics(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.status(projectId) })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'trends'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'breakdowns'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'pages'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'events'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'conversions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId, 'health'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.activity(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.property(projectId) })
    },
  })
}

/** GA4 property facts (name, website, Measurement ID, timezone) - Analytics Header / Property card. */
export function useAnalyticsProperty(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.property(projectId),
    queryFn: () => apiService.getAnalyticsPropertyDetails(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STATIC, // property facts rarely change
  })
}

/** Daily trend series + totals, powering the Hero KPI grid, Traffic Trends chart and Today's Summary. */
export function useAnalyticsTrends(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.trends(projectId, range),
    queryFn: () => apiService.getAnalyticsTrends(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Traffic Sources, Top Channels, Countries, Devices, Browsers and Operating Systems - one batched fetch. */
export function useAnalyticsBreakdowns(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.breakdowns(projectId, range),
    queryFn: () => apiService.getAnalyticsBreakdowns(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Top landing pages - still backed by the legacy per-page AnalyticsData
 * endpoint (GET .../analytics/data), not a Phase 1-3 endpoint; the planned
 * metric expansion (bounce rate, conversions per page) was never built (see
 * Phase 4's Technical Debt Remaining), so only views/users/engagement are
 * available today.
 */
export function useAnalyticsPages(projectId, { limit = 10 } = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.pages(projectId, { limit }),
    queryFn: () => apiService.getAnalyticsData(projectId, { limit, sort: 'pageViews', order: 'desc' }),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Top events by count, with users and period-over-period trend. */
export function useAnalyticsEvents(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.events(projectId, range),
    queryFn: () => apiService.getAnalyticsEventsList(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Conversion events bucketed into named categories. */
export function useAnalyticsConversions(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.conversions(projectId, range),
    queryFn: () => apiService.getAnalyticsConversionsList(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Realtime active-user snapshot. Short staleTime + refetchInterval - this
 * is the one Analytics query that's genuinely always-live, never served
 * from the 10-minute backend cache (see analyticsService.js's
 * getAnalyticsRealtimeData), so the frontend polls it on its own short
 * cadence rather than relying on manual refresh.
 */
export function useAnalyticsRealtime(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.realtime(projectId),
    queryFn: () => apiService.getAnalyticsRealtime(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.REALTIME,
    refetchInterval: enabled ? 30 * 1000 : false,
  })
}

/** Odito-derived Analytics Health score - reuses the Trends endpoint's own cache server-side, no extra Google cost. */
export function useAnalyticsHealth(projectId, range = '30', { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.health(projectId, range),
    queryFn: () => apiService.getAnalyticsHealth(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Recent Analytics Activity - synthesized server-side from connection timestamps. */
export function useAnalyticsActivity(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.analytics.activity(projectId),
    queryFn: () => apiService.getAnalyticsActivity(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Every active plan (Starter today; Pro/Premium will appear here automatically once added). */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.subscription.plans(),
    queryFn: () => apiService.getPlans(),
    staleTime: staleTimes.STATIC,
  })
}

/**
 * Creates a Stripe Checkout Session for a plan. Does not invalidate any
 * query on success — nothing about the user's subscription changes until a
 * payment actually completes (webhook handling, a later phase), so there
 * is nothing to refetch yet.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (plan) => apiService.createCheckoutSession(plan),
  })
}

/**
 * Creates a Stripe Billing Portal session. Same shape as
 * useCreateCheckoutSession() — a one-shot redirect URL, no cache
 * invalidation needed since nothing about the subscription changes here
 * (any change a user makes inside the Portal flows back through the
 * existing webhook handlers, not through this mutation).
 */
export function useCreateBillingPortalSession() {
  return useMutation({
    mutationFn: () => apiService.createBillingPortalSession(),
  })
}

/**
 * Requests a plan change on the user's EXISTING Stripe subscription — the
 * upgrade/downgrade counterpart to useCreateCheckoutSession() (which only
 * ever creates a brand-new subscription). This call itself doesn't change
 * the plan; it only asks Stripe to update the price on the existing
 * subscription. The actual local plan/quota change happens once Stripe's
 * customer.subscription.updated webhook confirms it (see
 * subscriptionWebhookService.js), same as every other subscription-state
 * change in this app. Invalidating on success still refetches
 * useSubscription()'s query — harmless if the webhook hasn't landed yet
 * (it'll just show the same data again), useful the moment it has.
 */
export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (plan) => apiService.changePlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.mine() })
    },
  })
}

/**
 * The authenticated user's most recent Custom Plan request, or `null` if
 * they've never submitted one. Drives the Custom card's status-aware CTA
 * (Request Custom Plan / Request Pending / View Request / request again).
 */
export function useMyCustomPlanRequest() {
  return useQuery({
    queryKey: queryKeys.customPlanRequest.mine(),
    queryFn: () => apiService.getMyCustomPlanRequest(),
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Submits a Custom Plan request. Invalidates the same query above on
 * success so the Custom card immediately reflects the new 'pending' status
 * without a manual refetch.
 */
export function useSubmitCustomPlanRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => apiService.submitCustomPlanRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customPlanRequest.mine() })
    },
  })
}

/**
 * Creates a one-time (mode: 'payment') Stripe Checkout Session for a
 * "Buy More Pages" purchase — NOT a subscription change. Same one-shot
 * redirect-URL shape as useCreateCheckoutSession(); no cache invalidation
 * here either, since pages.limit only actually changes once the webhook
 * confirms payment (BuyPagesModal's caller refetches subscription() on
 * return from Stripe, not here).
 */
export function useCreatePagePurchaseCheckout() {
  return useMutation({
    mutationFn: (params) => apiService.createPagePurchaseCheckout(params),
  })
}

/**
 * Creates a one-time (mode: 'payment') Stripe Checkout Session for a
 * "Buy Credits" purchase — NOT a subscription change. Exact structural
 * mirror of useCreatePagePurchaseCheckout() above, credits substituted for
 * pages.
 */
export function useCreateCreditPurchaseCheckout() {
  return useMutation({
    mutationFn: (params) => apiService.createCreditPurchaseCheckout(params),
  })
}

/**
 * The authenticated user's billing history, newest first. `page` defaults
 * to 1 — no pagination UI exists yet, but the query key already includes
 * `page` so adding pagination controls later is just passing a different
 * value in, no new hook needed.
 */
export function useBillingHistory(page = 1) {
  return useQuery({
    queryKey: queryKeys.subscription.history(page),
    queryFn: () => apiService.getBillingHistory(page),
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== WORDPRESS CONNECTION (Phase 2) ====================
// Connect/status/verify/disconnect for the real WordPress connection layer
// (odito_backend/src/modules/external_integration/) — distinct from the
// mock /app/wordpress dashboard, which has no backend and isn't queried
// through React Query at all.

/** Connection status for this project's WordPress site, if any. */
export function useWordPressStatus(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.status(projectId),
    queryFn: () => apiService.getWordPressStatus(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Invalidates EVERY WordPress query cached for this project — status,
 * pluginStatus, forms, capabilities, and every cached seo-data entry
 * (keyed per pageUrl, so no single specific key could name them all).
 * TanStack Query's invalidateQueries matches by key PREFIX by default, so
 * `['wordpress', projectId]` catches every `['wordpress', projectId, ...]`
 * entry in one call — still scoped to this one project, never global.
 *
 * Bug fix (Phase 3 verification audit): connect/verify/disconnect
 * previously only invalidated `status` (disconnect also invalidated
 * `pluginStatus`) — `capabilities` and `seoData` were left stale, so a
 * disconnect-then-reconnect-to-a-different-site (or a provider change
 * revealed by a fresh verify) could keep showing the PREVIOUS connection's
 * capability/live-data answers until an unrelated cache eviction happened.
 */
function invalidateAllWordPressQueries(queryClient, projectId) {
  queryClient.invalidateQueries({ queryKey: ['wordpress', projectId] })
}

/** Connects a WordPress site (Application Password) to this project. */
export function useConnectWordPress(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials) => apiService.connectWordPress(projectId, credentials),
    onSuccess: () => invalidateAllWordPressQueries(queryClient, projectId),
  })
}

/** Re-verifies the existing connection against the live WordPress site. */
export function useVerifyWordPressConnection(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.verifyWordPressConnection(projectId),
    onSuccess: () => invalidateAllWordPressQueries(queryClient, projectId),
  })
}

/** Removes the stored connection — never modifies anything on the WordPress site itself. */
export function useDisconnectWordPress(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.disconnectWordPress(projectId),
    onSuccess: () => invalidateAllWordPressQueries(queryClient, projectId),
  })
}

// ==================== WORDPRESS PLUGIN (Phase 3A) ====================
// Pairing, plugin connection status, and detected forms — structure only,
// no submission capture (Phase 3B).

/** Generates a one-time pairing token to paste into the WordPress plugin's settings page. */
export function useGenerateWordPressPairingToken(projectId) {
  return useMutation({
    mutationFn: () => apiService.generateWordPressPairingToken(projectId),
  })
}

/** Plugin pairing/heartbeat/sync status for this project. */
export function useWordPressPluginStatus(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.pluginStatus(projectId),
    queryFn: () => apiService.getWordPressPluginStatus(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Forms the plugin has detected and synced for this project. */
export function useWordPressForms(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.forms(projectId),
    queryFn: () => apiService.getWordPressForms(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

// ==================== WORDPRESS SEO PROVIDER + LIVE DATA (Phase 4) ====================
// Read + capability detection only — no write mutation lives here yet
// (single-fix apply is a task-scoped mutation defined inline in
// IssueDetailView.jsx, matching createTaskMutation/markImplementedMutation's
// own placement).

/** Detected SEO provider + per-field read/write capability table for this project's WordPress site. */
export function useWordPressCapabilities(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.capabilities(projectId),
    queryFn: () => apiService.getWordPressCapabilities(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Live (not crawled) SEO field values for one page, read directly from WordPress. */
export function useWordPressSeoData(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.seoData(projectId, pageUrl),
    queryFn: () => apiService.getWordPressSeoData(projectId, pageUrl),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Live SITE-LEVEL schema (Organization sameAs, breadcrumbs) — one
 * site-wide state, not per-page. `data.supported` tells the caller whether
 * to show the sameAs/breadcrumb UI at all (a pre-site-schema Bridge, no
 * Bridge, or a non-Rank-Math provider all resolve `supported:false` with a
 * human `reason`, never a thrown error).
 */
export function useWordPressSiteSchema(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.siteSchema(projectId),
    queryFn: () => apiService.getWordPressSiteSchema(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Does this page URL resolve to a WordPress post/page Odito can act on? Read-only; the same shared
 * resolver an Apply uses, so the dialog can never offer an action the write would refuse.
 */
export function useWordPressPageResolution(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.pageResolution(projectId, pageUrl),
    queryFn: () => apiService.getWordPressPageResolution(projectId, pageUrl),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: staleTimes.DYNAMIC,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/**
 * Whether a page's H1 can be fixed through WordPress (builder adapter decision), what it currently
 * has, and the fingerprint of the page state being reviewed. Read-only. `recommended` is only
 * previewed (validated/normalized) — the write derives its own value from the task's Recommendation.
 * staleTime 0 + no focus refetch: the fingerprint must be as fresh as the review it belongs to.
 */
export function useWordPressH1Context(projectId, pageUrl, recommended, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.wordpress.h1Context(projectId, pageUrl, recommended || null),
    queryFn: () => apiService.getWordPressH1Context(projectId, pageUrl, recommended),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

// ==================== META — FACEBOOK PAGE CONNECTION (Phase 2) ====================
// Mirrors useGoogleAdsAccounts/useSelectGoogleAdsAccount's own "list, then
// select one" shape above — same two-step connect pattern, different
// provider. Inline query keys (no queryKeys.meta.* namespace exists yet;
// following usePageSpeedRescan's own precedent of an inline key for a
// narrowly-scoped feature rather than growing the shared registry for it).

/** Facebook Pages available to whatever Meta account just completed OAuth consent — never includes a token. */
export function useMetaPages(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['meta', 'pages', projectId],
    queryFn: () => apiService.getMetaPages(projectId),
    enabled: !!projectId && enabled,
    staleTime: 0, // the pending connection is single-use and short-lived; never serve a stale list
    retry: false,
  })
}

/**
 * Persists the chosen Page as a real SocialAccount. Deliberately does NOT
 * invalidate/refetch ['meta','pages', projectId] on success — the
 * PendingMetaConnection backing that list is deleted server-side the
 * moment selection succeeds (by design, see selectMetaPage's controller),
 * so refetching it here would only produce a guaranteed, harmless-but-
 * noisy 409 while the success state is still showing.
 *
 * DOES invalidate the real connection-status query (below) — this is what
 * keeps the backend, not transient React state, as the source of truth:
 * a later refresh re-fetches ['social','accounts','status', projectId]
 * from MongoDB rather than trusting whatever this mutation's response said.
 *
 * Also invalidates the Switch Account list and the Facebook overview
 * (prefix match — this reaches every ['social','facebook','overview',
 * projectId, <accountId>] entry regardless of which Page's data is
 * cached). This closes a gap from when the Switch Account feature added
 * those two queries without updating this mutation: connecting a Page
 * while a DIFFERENT Page was already active previously left both caches
 * showing the old Page until something else happened to refetch them.
 */
export function useSelectMetaPage(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pageId) => apiService.selectMetaPage(projectId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts', 'status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'facebook', 'accounts', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'facebook', 'overview', projectId] })
      // The backend automatically runs Instagram discovery for the
      // newly-selected Page as part of this same call (see
      // metaOAuthController.js's selectMetaPage) — Instagram's own
      // overview data is entirely derived from whichever Page is active,
      // so it must be invalidated here too.
      queryClient.invalidateQueries({ queryKey: ['social', 'instagram', 'overview', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'feeds', projectId] })
    },
  })
}

/**
 * Phase 3 — re-runs Facebook -> Instagram discovery on its own, for the
 * "Retry" action after selectMetaPage's own discovery attempt failed.
 * Takes no token of any kind; the backend re-derives the Page token from
 * the already-persisted, encrypted Facebook SocialAccount.
 */
export function useRetryMetaInstagramDiscovery(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pageId) => apiService.retryMetaInstagramDiscovery(projectId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts', 'status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'instagram', 'overview', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'feeds', projectId] })
    },
  })
}

/**
 * Real Facebook/Instagram connection status, sourced from MongoDB — the
 * missing piece whose absence was the actual root cause of "Connected"
 * reverting to "Not Connected" on refresh. Call this on every /app/social
 * page load, not just once right after a successful connect.
 */
export function useSocialAccountsStatus(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'accounts', 'status', projectId],
    queryFn: () => apiService.getSocialAccountsStatus(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Real Facebook Page data — profile, recent posts, and whatever Page
 * Insights metrics Meta actually supports for this Page/API version (live
 * investigation found the classic impressions/new-fans metric names are
 * deprecated; see facebookOverviewService.js's own comment). Never mock
 * data — a metric Meta can't provide comes back null with a reason, not a
 * fake number. Only meaningfully enabled once the Facebook connection
 * status query itself reports connected — no point fetching Page data for
 * a project with no connected Page.
 */
// `activeSocialAccountId` is part of the query key (not a request
// parameter — the backend always derives "active" from MongoDB itself,
// the single source of truth) purely so React Query never serves data for
// the PREVIOUSLY active Page under the NEWLY active Page's identity, and
// so switching accounts naturally lands on a fresh cache entry instead of
// an in-flight/soon-to-be-stale one. Deliberately NOT enabled until
// activeSocialAccountId is known (see useFacebookAccounts below) — this
// serializes the two fetches (accounts list, then overview) instead of
// firing overview once with an unknown key and again moments later with
// the real one, which would otherwise cause an avoidable extra
// request/flicker on first load.
export function useFacebookOverview(projectId, activeSocialAccountId, range = 'month', { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'facebook', 'overview', projectId, activeSocialAccountId, range],
    queryFn: () => apiService.getFacebookOverview(projectId, range),
    enabled: !!projectId && !!activeSocialAccountId && enabled,
    staleTime: staleTimes.STANDARD,
    // Switching Day/Week/Month changes the query key (a real backend
    // refetch, not a client-side slice) — keeps the previous range's KPIs
    // on screen instead of flashing back to the dummy baseline while the
    // new range loads; PlatformChart's own `loading` state (isFetching)
    // still shows a spinner over the chart itself during that gap.
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Real Instagram Business account data — profile/post count, engagements,
 * followers gained, likes, and a real comments-vs-likes chart (see
 * instagramOverviewService.js). No Switch-Account dimension in the query
 * key: Instagram account switching is out of scope (same as the backend),
 * so there is only ever one active Instagram row per project to key on —
 * `projectId` alone is the correct, sufficient cache scope here, unlike
 * Facebook's key which also needs activeSocialAccountId.
 */
/**
 * `activeSocialAccountId` is the ACTIVE FACEBOOK Page's Mongo _id (the
 * same value useFacebookOverview already keys on) — not a separate
 * Instagram-specific id. Instagram has no independent "active account" of
 * its own in this architecture: an Instagram Business Account is only
 * ever discovered/linked through a specific Facebook Page (see the
 * backend's metaInstagramService.js), so which Instagram data this query
 * resolves to is entirely DETERMINED by which Facebook Page is active.
 * Including it here (exactly like useFacebookOverview does) means
 * switching Pages always produces a distinct cache entry for the new
 * Page's Instagram data, instead of silently reusing/showing whatever was
 * cached under the previous Page.
 */
export function useInstagramOverview(projectId, activeSocialAccountId, range = 'month', { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'instagram', 'overview', projectId, activeSocialAccountId, range],
    queryFn: () => apiService.getInstagramOverview(projectId, range),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Switch Account feature — every currently-connected Facebook Page for
 * the project, safe metadata only. Enabled only once the project is known
 * to have at least one connected Page (see the page component).
 */
export function useFacebookAccounts(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'facebook', 'accounts', projectId],
    queryFn: () => apiService.getFacebookAccounts(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/**
 * Switches which already-connected Page is active — NOT an OAuth call.
 * Invalidates the accounts list (so the new active flag shows up), the
 * connection-status query (accountName may have changed), and every
 * Facebook overview cache entry for this project (old key AND new key —
 * a broad prefix invalidation is simplest and correct here since exactly
 * which key is "new" isn't known until this resolves).
 */
export function useSwitchFacebookAccount(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (socialAccountId) => apiService.switchFacebookAccount(projectId, socialAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'facebook', 'accounts', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts', 'status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'facebook', 'overview', projectId] })
      // Which Instagram account this project's Overview resolves to is
      // entirely derived from whichever Facebook Page is active (see
      // instagramOverviewService.js) — a Facebook Page switch can change
      // that just as much as it changes Facebook's own data, so this must
      // be invalidated here too, not just on some separate Instagram-only
      // action (there isn't one).
      queryClient.invalidateQueries({ queryKey: ['social', 'instagram', 'overview', projectId] })
      // Feeds now defaults to the active account(s) too (see
      // socialFeedService.js) — a Page switch changes what it resolves to
      // just as much as Overview.
      queryClient.invalidateQueries({ queryKey: ['social', 'feeds', projectId] })
    },
  })
}

/**
 * Disconnects the project's active Facebook/Instagram connection. Both
 * /app/social and Settings -> Profile call this same mutation and both
 * invalidate the same ['social','accounts','status', projectId] query
 * useSocialAccountsStatus reads — that's the whole mechanism keeping the
 * two pages synchronized without a hard refresh (Section 7's explicit
 * requirement). Also invalidates the Facebook overview query so stale
 * metrics don't linger after a disconnect.
 */
export function useDisconnectSocialAccount(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (platform) => apiService.disconnectSocialAccount(projectId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'accounts', 'status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['social', 'facebook', 'overview', projectId] })
    },
  })
}

// ==================== SOCIAL FEEDS (real Facebook + Instagram posts) =====
// Replaces the frontend-only lib/socialFeedsDummyData.js mock. Reads only
// from MongoDB via GET /api/social/feeds (never calls Meta directly — see
// socialFeedService.js); syncing from Meta is a separate, explicit action
// (useSyncSocialFeeds, the Feeds page Refresh button), matching Phase 14's
// "background sync, not a Meta call on every page load".

/**
 * `filters` may include platform/status/search/from/to/sort/page/limit/
 * allAccounts — all become part of the query key so each distinct filter
 * combination gets its own cache entry, and `placeholderData` keeps the
 * previous page's posts on screen while a new filter/page loads instead
 * of flashing a loading state (same pattern useLeads already uses for the
 * same reason).
 *
 * `activeSocialAccountId` is the active Facebook Page's Mongo _id (the
 * SAME value useFacebookOverview/useInstagramOverview already key on) —
 * appended to the query key ONLY, never sent as a request param (the
 * backend resolves which account(s) to scope to entirely server-side, see
 * socialFeedService.js). Its only job here is cache identity: without it,
 * switching Pages would keep this query's key unchanged (same `filters`
 * object) and Feeds would keep showing the previous Page's posts until
 * something else happened to trigger a refetch.
 */
export function useSocialFeeds(projectId, filters = {}, activeSocialAccountId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'feeds', projectId, filters, activeSocialAccountId],
    queryFn: () => apiService.getSocialFeeds(projectId, filters),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Feeds page Refresh — runs a real backend sync (Meta calls happen
 * server-side only) and invalidates every ['social','feeds', projectId, ...]
 * cache entry regardless of filters, so whatever filter/page the user is
 * currently viewing refetches with the newly-synced posts.
 */
export function useSyncSocialFeeds(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiService.syncSocialFeeds(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feeds', projectId] })
    },
  })
}

// ==================== SOCIAL PUBLISHING (real drafts/scheduling/publishing) ====
// Replaces the frontend-only lib/publishingDummyData.js mock. The backend
// is the sole source of truth — no second client-side data store. Uses
// the SAME connection status useSocialAccountsStatus already reads
// (Phase 16's "useSocialConnectionStatus()" — this repo already has that
// hook, no need for a duplicate under a new name).

// A publication's status can change entirely server-side, with no browser
// action involved at all: socialSchedulerService.js's cron tick claims a
// due 'scheduled' post and moves it through 'publishing' -> 'published'/
// 'failed' on its own schedule, independent of whether anyone has this
// page open. Without this, the Posts tab/Publishing calendar could keep
// showing a stale "Scheduled" badge indefinitely after the real post
// already went out — this app's global default is
// `refetchOnWindowFocus: false` (queryClient.js), so neither tabbing back
// nor anything else would ever pick that change up on its own.
const SOCIAL_PUBLISHING_POLL_MS = 15000
const PENDING_SCHEDULER_STATUSES = new Set(['scheduled', 'publishing'])

/**
 * True only while the currently-cached page of results contains at least
 * one publication the background scheduler could still change on its own
 * (scheduled, or already mid-claim as publishing). A page of only
 * draft/published/failed/cancelled posts has nothing left for a
 * background process to move, so polling stops rather than running
 * forever on an inactive filter/page — same "only poll while something is
 * actually in flight" convention this codebase already uses for batch
 * verification progress.
 */
export function hasPendingSchedulerWork(query) {
  const posts = query.state.data?.data?.data
  return Array.isArray(posts) && posts.some((post) => PENDING_SCHEDULER_STATUSES.has(post.status))
}

/**
 * `filters` may include platform/status/search/from/to/sort/page/limit.
 * The response also carries real `counts` (drafts, scheduledToday) —
 * Pending Approval is deliberately absent, there is no approval workflow
 * (see the backend's socialPublishingService.js). `placeholderData` keeps
 * the previous page/filter's posts on screen while a new one loads, same
 * pattern as useSocialFeeds/useLeads.
 */
export function useSocialPublishing(projectId, filters = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['social', 'publishing', projectId, filters],
    queryFn: () => apiService.getSocialPublications(projectId, filters),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData,
    // Conditional polling (only while something scheduler-owned is
    // actually pending) + a scoped override of this app's global
    // refetchOnWindowFocus:false, so switching back to this tab also
    // picks up whatever the scheduler did while it was in the background.
    refetchInterval: (query) => (hasPendingSchedulerWork(query) ? SOCIAL_PUBLISHING_POLL_MS : false),
    refetchOnWindowFocus: true,
  })
}

function invalidatePublishing(queryClient, projectId) {
  queryClient.invalidateQueries({ queryKey: ['social', 'publishing', projectId] })
}

/** Uploads one image/video for a social post; resolves to { url, type, mimeType, width, height, size }. */
export function useUploadSocialMedia(projectId) {
  return useMutation({
    mutationFn: ({ file, onProgress }) => apiService.uploadSocialMedia(projectId, file, onProgress),
  })
}

/** Creates a draft, a scheduled post, or immediately attempts a real publish (payload.publishNow). */
export function useCreateSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => apiService.createSocialPublication(projectId, payload),
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

export function useUpdateSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ publicationId, updates }) => apiService.updateSocialPublication(projectId, publicationId, updates),
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

// Accepts either a plain publicationId string (the common case — draft/
// scheduled/failed/cancelled, or a published Facebook post, all of which
// use the regular Delete action) or { publicationId, historyOnly } (a
// published Instagram post's explicit "Remove from Odito history" action
// — see DeletePostConfirmDialog.jsx). historyOnly is otherwise ignored by
// the backend for every other case.
export function useDeleteSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (arg) => {
      const { publicationId, historyOnly = false } = typeof arg === 'string' ? { publicationId: arg } : (arg || {})
      return apiService.deleteSocialPublication(projectId, publicationId, { historyOnly })
    },
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

/** A real Meta publish attempt — may come back with the record moved to 'failed' rather than throwing (see apiService/controller). */
export function usePublishSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (publicationId) => apiService.publishSocialPublication(projectId, publicationId),
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

export function useCancelSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (publicationId) => apiService.cancelSocialPublication(projectId, publicationId),
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

export function useScheduleSocialPost(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ publicationId, scheduledAt, timezone }) => apiService.scheduleSocialPublication(projectId, publicationId, scheduledAt, timezone),
    onSuccess: () => invalidatePublishing(queryClient, projectId),
  })
}

// ==================== LEADS (Phase 3B) ====================
// Real backend (odito_backend/src/modules/lead/) — replaces the
// frontend-only mock previously in frontend/lib/leadsDummyData.js. See
// hooks/useLeadRealtimeSync.js for the Socket.IO `lead:created` listener
// (kept separate, matching useGoogleAdsSyncProgress.js's precedent).

/** Paginated, filterable, searchable lead list for the active project. */
export function useLeads(projectId, params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.leads.list({ projectId, ...params }),
    queryFn: () => apiService.getLeads(projectId, params),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
    placeholderData: (previousData) => previousData, // keep prior page visible while the next page/filter loads
  })
}

/** Status-board counts (total/newToday/new/contacted/qualified/follow_up/won/lost). */
export function useLeadStats(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.leads.stats(projectId),
    queryFn: () => apiService.getLeadStats(projectId),
    enabled: !!projectId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

/** Single lead — used by the detail drawer for the freshest copy of whichever lead is open. */
export function useLead(leadId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.leads.detail(leadId),
    queryFn: () => apiService.getLead(leadId),
    enabled: !!leadId && enabled,
    staleTime: staleTimes.STANDARD,
  })
}

export function useCreateLead(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => apiService.createLead(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats(projectId) })
    },
  })
}

export function useUpdateLead(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, updates }) => apiService.updateLead(leadId, updates),
    onSuccess: (_data, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) })
    },
  })
}

export function useDeleteLead(projectId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (leadId) => apiService.deleteLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats(projectId) })
    },
  })
}

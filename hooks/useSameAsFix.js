"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import apiService from "@/lib/apiService"
import { queryKeys } from "@/lib/query/keys"

/**
 * Organization sameAs (profile links): discovery, validation of typed links, the plan for the current selection, and the apply.
 *
 * - Discovery is read-only and cached for a few minutes (the server memoises it too); "Look again" bypasses both.
 * - The plan is never served stale: the fingerprint a person approves must belong to what is on screen (staleTime 0).
 * - Nothing here retries automatically, and the apply is never repeated behind the person's back.
 */

const DISCOVERY_STALE_MS = 5 * 60 * 1000

const unwrap = (response, fallback) => {
  if (!response?.success) throw Object.assign(new Error(response?.message || fallback), { code: response?.code, details: response?.details })
  return response.data
}

export function useSameAsDiscovery(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.sameAs.discovery(projectId, pageUrl),
    queryFn: async () => unwrap(await apiService.discoverSameAs(projectId, pageUrl), "Profile links could not be looked up"),
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: DISCOVERY_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/** "Look again": asks the server to bypass its own memo, then replaces the cached discovery. */
export function useRefreshSameAsDiscovery(projectId, pageUrl) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async () => unwrap(await apiService.discoverSameAs(projectId, pageUrl, { refresh: true }), "Profile links could not be looked up"),
    onSuccess: (data) => { queryClient.setQueryData(queryKeys.sameAs.discovery(projectId, pageUrl), data) },
  })
}

/** Server-side validation of what the person typed (normalised form, platform, per-line errors). Fetches nothing. */
export function useValidateSameAsUrls(projectId, pageUrl) {
  return useMutation({
    retry: false,
    mutationFn: async (urls) => unwrap(await apiService.validateSameAs(projectId, pageUrl, urls), "The link could not be checked"),
  })
}

export const selectionKey = ({ urls = [], removeUrls = [] }) => JSON.stringify([[...urls].sort(), [...removeUrls].sort()])

export function useSameAsPreview(projectId, pageUrl, taskId, selection, { enabled = true } = {}) {
  const urls = selection?.urls || []
  const removeUrls = selection?.removeUrls || []
  return useQuery({
    queryKey: queryKeys.sameAs.preview(projectId, pageUrl, taskId, selectionKey({ urls, removeUrls })),
    queryFn: async () => {
      const response = taskId
        ? await apiService.previewSameAsTaskFix(taskId, { urls, removeUrls })
        : await apiService.previewSameAs(projectId, pageUrl, { urls, removeUrls })
      return unwrap(response, "The change could not be previewed")
    },
    // Even with nothing selected the plan is asked for once a task exists: it carries the ledger record (what was applied before).
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    // No placeholderData on purpose: while a new selection is being planned the PREVIOUS selection's plan (and its fingerprint) must
    // not stay on screen, or the person could approve a plan that is not the one they are looking at.
  })
}

export function useApplySameAsFix(projectId, taskId) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ expectedPlanFingerprint, urls, removeUrls }) => unwrap(await apiService.applyWordPressSchemaFix(taskId, { expectedPlanFingerprint, urls, removeUrls }), "The change could not be applied"),
    onSettled: () => {
      if (!projectId) return
      queryClient.invalidateQueries({ queryKey: queryKeys.sameAs.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.fixPreview(projectId, taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.siteSchema(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(projectId) })
    },
  })
}

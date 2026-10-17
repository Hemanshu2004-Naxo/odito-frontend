"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query/keys"

/**
 * Breadcrumb discovery for the audited page: read-only, cached for a few minutes (the server memoises it too). "Look again" bypasses both.
 * Nothing here writes to WordPress, starts an audit or uses a credit.
 */
const STALE_MS = 5 * 60 * 1000

const unwrap = (response, fallback) => {
  if (!response?.success) throw Object.assign(new Error(response?.message || fallback), { code: response?.code })
  return response.data
}

export function useBreadcrumbDiscovery(projectId, pageUrl, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.breadcrumb.discovery(projectId, pageUrl),
    queryFn: async () => {
      // Imported on first use (apiService reads its environment configuration when imported; IssueRecommendationPanel is rendered by many
      // screens and tests that never look anything up).
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.discoverBreadcrumbs(projectId, pageUrl), "The page's breadcrumbs could not be looked up")
    },
    enabled: !!projectId && !!pageUrl && enabled,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useRefreshBreadcrumbDiscovery(projectId, pageUrl) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const { default: apiService } = await import("@/lib/apiService")
      return unwrap(await apiService.discoverBreadcrumbs(projectId, pageUrl, { refresh: true }), "The page's breadcrumbs could not be looked up")
    },
    onSuccess: (data) => { queryClient.setQueryData(queryKeys.breadcrumb.discovery(projectId, pageUrl), data) },
  })
}

export default useBreadcrumbDiscovery

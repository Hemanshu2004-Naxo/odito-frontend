"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query/keys"

/**
 * Submits the site owner's confirmed breadcrumb hierarchy and returns the regenerated recommendation.
 *
 * - `retry: false` — a rejected hierarchy must never be re-sent automatically, and a slow request must never be
 *   duplicated (the panel also disables submit while pending).
 * - The request is cancelled when the audited page changes or the panel unmounts (AbortController), so a slow
 *   response for the previous page can never land on the new one.
 * - It starts no audit and marks no task implemented/verified; it only refreshes recommendation queries.
 */
export function useRegenerateBreadcrumbHierarchy({ projectId, pageUrl }) {
  const queryClient = useQueryClient()
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [pageUrl])

  return useMutation({
    mutationFn: async ({ items, ruleMetadata }) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      // Imported on first use, not at module load: apiService reads its environment configuration when it is
      // imported, and IssueRecommendationPanel (which imports this hook) is rendered by many screens and tests that
      // never submit a hierarchy.
      const { default: apiService } = await import("@/lib/apiService")
      const response = await apiService.regenerateBreadcrumbHierarchy({ projectId, pageUrl, items, ruleMetadata }, { signal: controller.signal })
      if (!response?.success) throw new Error(response?.message || "Regeneration failed")
      return response
    },
    retry: false,
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.forProject(projectId) })
    },
  })
}

export default useRegenerateBreadcrumbHierarchy

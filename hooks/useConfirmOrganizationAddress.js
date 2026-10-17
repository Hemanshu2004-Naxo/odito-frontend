"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query/keys"

/**
 * Submits the address the site owner confirmed and returns the regenerated Organization recommendation.
 *
 * - `retry: false` — a rejected address is never re-sent automatically, and the panel disables submit while pending, so a slow
 *   request is never duplicated.
 * - The request is cancelled when the audited page changes or the panel unmounts (AbortController), so a slow response for the
 *   previous page can never land on the new one.
 * - It starts no audit, creates no task, and does NOT change the website; it only refreshes recommendation queries.
 */
export function useConfirmOrganizationAddress({ projectId, pageUrl }) {
  const queryClient = useQueryClient()
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [pageUrl])

  return useMutation({
    mutationFn: async ({ address, basisSource, ruleMetadata }) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      // Imported on first use (see useBreadcrumbHierarchy): apiService reads its environment configuration at import time.
      const { default: apiService } = await import("@/lib/apiService")
      const response = await apiService.confirmOrganizationAddress({ projectId, pageUrl, address, basisSource, ruleMetadata }, { signal: controller.signal })
      if (!response?.success) throw new Error(response?.message || "The address could not be confirmed")
      return response
    },
    retry: false,
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.forProject(projectId) })
    },
  })
}

export default useConfirmOrganizationAddress

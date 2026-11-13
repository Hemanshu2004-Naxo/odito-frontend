"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import seoScanService from "@/services/seoScanService"

/**
 * The optional manual refresh (History & data freshness): the SAME coordinator as the automatic collection - one queue, one lock, one
 * worker - limited to one per project per hour and refused while a collection is running. It only queues; it never waits for the provider.
 */
export function useManualRefresh(projectId, page) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () => seoScanService.refresh(projectId, page),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["seo-scan", projectId] })
      qc.invalidateQueries({ queryKey: ["seo-ensure", projectId] })
    },
  })
  const result = m.data?.data ?? (m.error ? (m.error.data ?? { accepted: false, reason: m.error.code ?? "ERROR", retryAt: null }) : null)
  return { refresh: () => m.mutate(), pending: m.isPending, result }
}

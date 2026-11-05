"use client"

import { useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import seoScanService from "@/services/seoScanService"
import { queryKeys } from "@/lib/query/keys"

/**
 * The project's SEO scans: the latest one (polled while it runs, so a browser refresh does not lose progress - the state lives in the
 * database, not in this tab) and the action that starts one. When a scan finishes, ONLY the stored-data queries of this project are
 * invalidated, so the pages re-read what the scan collected; nothing else is touched and nothing here reaches the provider.
 */

export const ACTIVE = ["pending", "queued", "running"]
export const isActive = (scan) => Boolean(scan) && ACTIVE.includes(scan.status)
const POLL_MS = 3000

/** Scans newest first -> { latest, lastSuccessful } (a partially completed scan still collected data). */
export function summarizeScans(scans = []) {
  const latest = scans[0] ?? null
  const lastSuccessful = scans.find((s) => s.status === "completed" || s.status === "partially_completed") ?? null
  return { latest, lastSuccessful }
}

export function useSeoScan(projectId) {
  const qc = useQueryClient()
  const key = ["seo-scan", projectId]
  const wasActive = useRef(false)

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => seoScanService.list(projectId, { signal }),
    enabled: !!projectId,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (isActive(query.state.data?.data?.scans?.[0]) ? POLL_MS : false),
  })
  const { latest, lastSuccessful } = summarizeScans(q.data?.data?.scans)

  useEffect(() => {
    const active = isActive(latest)
    if (wasActive.current && !active && latest) qc.invalidateQueries({ queryKey: queryKeys.domainOverview.all(projectId) })
    wasActive.current = active
  }, [latest, projectId, qc])

  const mutation = useMutation({
    mutationFn: (input) => seoScanService.start(projectId, input),
    // The new (or already running, `deduped`) scan is the newest: re-read the list, which then keeps polling.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const start = useCallback((input) => mutation.mutate(input), [mutation])
  return {
    status: q.isLoading ? "loading" : q.isError ? "error" : "ready",
    latest,
    lastSuccessful,
    running: isActive(latest),
    starting: mutation.isPending,
    startError: mutation.isError ? { message: mutation.error?.message || "The scan could not be started.", code: mutation.error?.code ?? null } : null,
    start,
  }
}

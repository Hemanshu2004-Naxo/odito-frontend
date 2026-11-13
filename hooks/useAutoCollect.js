"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import seoScanService from "@/services/seoScanService"
import { isActive, useSeoScan } from "@/hooks/useSeoScan"

/**
 * Automatic collection for the SEO page on screen. Opening a page asks the server ONCE (per project, page and minute) what the page needs:
 * fresh data -> nothing happens; missing or stale data -> the server queues one coordinated collection (a running one is shared by every
 * page, tab and user) and answers at once. The page keeps showing what is stored; this hook only reports what is going on.
 *
 * Paging, searching, sorting and filtering never come through here: they are database reads of the page's own hooks.
 * Progress and completion come from useSeoScan (socket events + a controlled poll as the fallback), which also refreshes exactly the queries
 * a completed dataset feeds and asks this hook's query to be read again when the scan ends.
 */

export const ENSURE_STALE_MS = 60_000

export function useAutoCollect(projectId, page) {
  const qc = useQueryClient()
  const scans = useSeoScan(projectId)

  const q = useQuery({
    queryKey: ["seo-ensure", projectId, page],
    queryFn: ({ signal }) => seoScanService.ensure(projectId, page, { signal }),
    enabled: Boolean(projectId) && Boolean(page),
    staleTime: ENSURE_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const data = q.data?.data ?? null

  // The server queued (or joined) a collection: read the scan list so its progress shows up at once.
  const enqueuedId = data?.enqueued?.scanId ?? null
  useEffect(() => {
    if (enqueuedId) qc.invalidateQueries({ queryKey: ["seo-scan", projectId] })
  }, [enqueuedId, projectId, qc])

  // The scan the status line talks about: the live one from the scan list, else the one the server just answered with.
  const listed = isActive(scans.latest) ? scans.latest : null
  const answered = isActive(data?.scan) ? data.scan : null
  return {
    status: q.isLoading ? "loading" : q.isError ? "error" : "ready",
    ensure: data,
    scan: listed ?? answered,
  }
}

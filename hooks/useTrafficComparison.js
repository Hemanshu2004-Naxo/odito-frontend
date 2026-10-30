"use client"

import { useCallback, useMemo, useRef } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import domainOverviewService from "@/services/domainOverviewService"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { mapBulkTraffic } from "@/components/dashboard/competitors/mapBulkTraffic"
import { COMPARE_DEBOUNCE_MS } from "@/components/dashboard/competitors/constants"

/**
 * The Compare section's data (API 5, bulk traffic estimation): the project plus the tracked competitors, one request for all of them.
 *
 * Pinning or unpinning changes the tracked list at once (the table follows it immediately), but the REQUEST waits until the list has
 * stopped changing for a second, so five pins in a row are one call. The key is the sorted set of tracked domains, so the same set
 * is the same cache entry (and the same 24-hour server entry) whatever order it was built in. A request that is still running when the
 * set changes again is cancelled. Results are matched to domains by name (the provider answers in its own order).
 *
 * @param {string|undefined} projectId
 * @param {string|null} projectDomain  the project's clean domain (always the first target)
 * @param {string[]} tracked           the tracked competitors, as saved
 */
export function useTrafficComparison(projectId, projectDomain, tracked) {
  const wantedKey = useMemo(() => [...tracked].sort().join(","), [tracked])
  const requestedKey = useDebouncedValue(wantedKey, COMPARE_DEBOUNCE_MS)
  const targets = useMemo(() => (requestedKey ? requestedKey.split(",") : []), [requestedKey])
  const refreshNext = useRef(false)

  const q = useQuery({
    queryKey: queryKeys.domainOverview.trafficComparison(projectId, requestedKey),
    queryFn: ({ signal }) => {
      const refresh = refreshNext.current
      refreshNext.current = false
      return domainOverviewService.getSection(projectId, "bulk-traffic", { refresh, targets }, { signal })
    },
    enabled: !!projectId && !!projectDomain && targets.length > 0,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const envelope = q.data?.data ?? null
  // Rows for what is tracked NOW (so an unpinned domain disappears at once); one the response does not contain yet is "loading".
  const rows = useMemo(() => (projectDomain ? mapBulkTraffic(envelope, [projectDomain, ...tracked]) : []), [envelope, projectDomain, tracked])
  const waiting = wantedKey !== requestedKey || q.isFetching

  const refresh = useCallback(() => {
    refreshNext.current = true
    return q.refetch()
  }, [q])

  return {
    rows: rows.map((r) => ({ ...r, loading: !r.found && waiting && !q.isError })),
    status: tracked.length === 0 ? "idle" : envelope ? "success" : q.isError ? "error" : "loading",
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    isFetching: q.isFetching,
    /** A change to the tracked list is waiting out the debounce. */
    pending: wantedKey !== requestedKey,
    updatedAt: envelope?.fetchedAt ?? null,
    refetch: () => q.refetch(),
    refresh,
  }
}

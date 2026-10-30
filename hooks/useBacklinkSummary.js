"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { BACKLINK_STATUSES, DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"

/**
 * Data layer for the Backlink Overview. There is ONE integration with the backlinks API: the Domain Overview's backend route
 * (`/domain-overview/backlinks`), now taking `status` (live / lost / all) and `dofollow`. The whole page is ONE request:
 *
 *  - The query key holds the request, so each Live / Lost / All × Dofollow combination is cached on its own (and on the server for 24 h):
 *    it is bought the first time it is chosen and read from the cache after that. The default request (live, no filter) is the
 *    dashboard's own key, so opening the page from the dashboard makes no request.
 *  - Changing the controls starts a new request and CANCELS the previous one (React Query's AbortSignal reaches fetch), so an old
 *    answer can never replace a newer one. The previous figures stay on screen, dimmed, until the new ones arrive.
 *
 * The state lives in the URL query string (history.replaceState, read once when the page opens). Nothing retries automatically: every
 * request is billed, so the user decides when to retry.
 */

const parseState = (params) => ({
  status: BACKLINK_STATUSES.includes(params?.get?.("status")) ? params.get("status") : DEFAULT_BACKLINKS_REQUEST.status,
  dofollow: params?.get?.("dofollow") === "1",
})

export function serializeState(state) {
  const p = new URLSearchParams()
  if (state.status !== DEFAULT_BACKLINKS_REQUEST.status) p.set("status", state.status)
  if (state.dofollow) p.set("dofollow", "1")
  return p.toString()
}

export function useBacklinkSummary(projectId) {
  const searchParams = useSearchParams()
  const [state, setStateRaw] = useState(() => parseState(searchParams))
  const refreshNext = useRef(false)

  const update = useCallback((patch) => {
    setStateRaw((prev) => {
      const next = { ...prev, ...patch }
      try {
        const qs = serializeState(next)
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
      } catch { /* the URL is a convenience; the page works without it */ }
      return next
    })
  }, [])

  const request = useMemo(() => ({ status: state.status, dofollow: state.dofollow }), [state])

  const q = useQuery({
    queryKey: queryKeys.domainOverview.backlinks(projectId, request),
    queryFn: ({ signal }) => {
      const refresh = refreshNext.current
      refreshNext.current = false
      return domainOverviewService.getSection(projectId, "backlinks", { refresh, backlinks: request }, { signal })
    },
    enabled: !!projectId,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const envelope = q.data?.data ?? null
  const summary = useMemo(() => mapBacklinkSummary(envelope?.result), [envelope])

  const refresh = useCallback(() => {
    refreshNext.current = true
    return q.refetch()
  }, [q])

  return {
    state,
    update,
    request,
    summary,
    // The figures on screen stay during a refresh or a switch; "loading" is only the very first load.
    status: envelope ? "success" : q.isError ? "error" : "loading",
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    isFetching: q.isFetching,
    /** The figures on screen belong to an earlier request (a newer one is loading). */
    stale: q.isPlaceholderData,
    refetch: () => q.refetch(),
    refresh,
    target: envelope?.target ?? null,
    updatedAt: envelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(envelope?.refreshThrottled),
  }
}

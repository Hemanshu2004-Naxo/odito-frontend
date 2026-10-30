"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { useCompetitorSettings } from "@/hooks/useCompetitorSettings"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { buildCompetitorsRequest, parseUrlState, serializeUrlState, SETTINGS_RESET } from "@/components/dashboard/competitors/urlState"
import { mapCompetitorsPage, mapSelf, selfFromRankOverview } from "@/components/dashboard/competitors/mapCompetitor"

/**
 * Data layer for the Competitors page. There is ONE integration with the competitors API: the Domain Overview's backend route
 * (`/domain-overview/competitors`). Its default view is also the dashboard card's query (same key, same server cache entry).
 *
 *  - The PAGE query's key holds the whole request (page, sort, filter, both toggles) and the signature of the project's exclude list, so
 *    every combination is cached on its own (and on the server for 24 hours). Changing any of them starts a new request and CANCELS the
 *    previous one (React Query's AbortSignal reaches fetch), so an old answer can never replace a newer one. The previous rows stay on
 *    screen, dimmed, until the new ones arrive. Pinning a competitor changes neither the request nor the signature: it never refetches this.
 *  - The project's own row ("You" in the chart, the denominator of the shared-keywords bar) comes from the response when it is on that
 *    page; otherwise from an earlier page of this session; otherwise from the Domain Overview's rank-overview totals (cached 24 h).
 *
 * The state lives in the URL query string (history.replaceState, read once when the page opens). Nothing retries automatically: every
 * request is billed, so the user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

export function useCompetitors(projectId, { projectDomain = null } = {}) {
  const searchParams = useSearchParams()
  const settings = useCompetitorSettings(projectId)
  const [state, setStateRaw] = useState(() => parseUrlState(searchParams))
  const stateRef = useRef(state)
  const refreshNext = useRef(new Set())

  /** Merge a patch. Anything but a page change goes back to page 1. Synchronous: two quick patches never overwrite each other. */
  const update = useCallback((patch) => {
    const next = { ...stateRef.current, ...patch }
    if (!("page" in patch)) next.page = 1
    stateRef.current = next
    setStateRaw(next)
    try {
      const qs = serializeUrlState(next)
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
    } catch { /* the URL is a convenience; the page works without it */ }
  }, [])

  const resetSettings = useCallback(() => update({ ...SETTINGS_RESET }), [update])
  const request = useMemo(() => buildCompetitorsRequest(state), [state])

  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.competitors(projectId, request, settings.signature),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "competitors", { refresh: consume(refreshNext.current, "page"), competitors: request }, { signal }),
    // The exclude list must be known: the server reads the same list, and it is part of the key.
    enabled: !!projectId && settings.settled,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const envelope = pageQ.data?.data ?? null

  // The project's own row: remembered per rank group (its shared keywords differ between "top 100" and "top 10").
  const selfByGroup = useRef(new Map())
  const onPage = useMemo(() => mapSelf(envelope?.result?.self), [envelope])
  useEffect(() => { if (onPage) selfByGroup.current.set(request.max_rank_group, onPage) }, [onPage, request.max_rank_group])
  const remembered = selfByGroup.current.get(request.max_rank_group) ?? null

  // Last resort: the rank-overview totals (exact for both rank groups), normally already cached by the Domain Overview.
  const needFallback = Boolean(envelope) && !onPage && !remembered
  const overviewQ = useQuery({
    queryKey: queryKeys.domainOverview.section(projectId, "rank-overview"),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rank-overview", {}, { signal }),
    enabled: !!projectId && needFallback,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const fallback = selfFromRankOverview(overviewQ.data?.data?.result, envelope?.target ?? projectDomain, request.max_rank_group)

  const self = onPage ?? remembered ?? fallback
  const mapped = useMemo(() => mapCompetitorsPage(envelope, { request, ourTotalKeywords: self?.totalKeywords ?? null }), [envelope, request, self])

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    pageQ.refetch()
  }, [pageQ])

  const status = envelope ? "success" : pageQ.isError ? "error" : "loading"
  return {
    state,
    update,
    resetSettings,
    request,
    settings,
    projectDomain: envelope?.target ?? projectDomain,
    page: {
      status,
      error: pageQ.isError ? { message: describeSectionError(pageQ.error), code: pageQ.error?.code ?? null } : null,
      isFetching: pageQ.isFetching,
      refetch: () => pageQ.refetch(),
      rows: mapped.rows,
      total: mapped.total,
      offset: mapped.offset,
      // The rows on screen belong to an earlier request (a newer one is loading).
      stale: pageQ.isPlaceholderData,
    },
    self,
    target: envelope?.target ?? null,
    market: envelope?.market ?? null,
    updatedAt: envelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(envelope?.refreshThrottled),
    isFetching: pageQ.isFetching,
    refresh,
  }
}

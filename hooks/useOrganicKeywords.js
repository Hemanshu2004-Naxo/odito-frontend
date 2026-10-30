"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { useSavedBrandTerms } from "@/hooks/useSavedBrandTerms"
import { buildKeywordQuery } from "@/components/dashboard/organic-keywords/buildKeywordFilters"
import { defaultPageState, parseUrlState, serializeUrlState } from "@/components/dashboard/organic-keywords/urlState"
import { mapKeywordsPage, mapSummary } from "@/components/dashboard/organic-keywords/mapRankedKeyword"
import { EXPORT_ALL_LIMIT } from "@/components/dashboard/organic-keywords/constants"

/**
 * Data layer for the Organic Keywords page. There is ONE integration with the ranked-keywords API: the Domain Overview's backend route
 * (`/domain-overview/ranked-keywords`), now taking limit / offset / order_by / filters. Two queries feed the page:
 *
 *  - the PAGE: the rows for the current page / sort / filters. Its query key holds all of them, so every combination is cached on its
 *    own (and on the server for 24 hours). Changing any of them starts a new request and the browser CANCELS the previous one (the
 *    query function hands React Query's AbortSignal to fetch), so an older answer can never replace a newer one. The previous rows
 *    stay on screen, dimmed, until the new ones arrive.
 *  - the TOTALS (summary cards, each row's share of traffic): the dashboard's own unfiltered top-5 query — same key, same server cache
 *    entry. It has to be unfiltered because the provider's `metrics` describe only the rows that match the request's filters.
 *
 * The state (filters, sort, page, page size) lives in the URL query string, written with history.replaceState (no navigation, no
 * history entry per keystroke) and read once when the page opens. Nothing retries automatically: every request is billed, so the
 * user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

export function useOrganicKeywords(projectId) {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [state, setStateRaw] = useState(() => parseUrlState(searchParams))
  const stateRef = useRef(state)
  // Requests that must skip the server cache on their NEXT fetch (set by refresh, consumed by that fetch).
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

  const clearFilters = useCallback(() => {
    const d = defaultPageState()
    update({ q: d.q, exclude: d.exclude, position: d.position, volMin: "", volMax: "", kdMin: "", kdMax: "", intents: [], movement: d.movement, url: "", brand: d.brand })
  }, [update])

  // The Brand / Non-brand split uses the brand terms the project saved on the Anchors page; a request that depends on them waits for them.
  const brand = useSavedBrandTerms(projectId)
  const effective = useMemo(() => ({ ...state, brandTerms: brand.terms }), [state, brand.terms])
  const query = useMemo(() => buildKeywordQuery(effective), [effective])
  const { built } = query
  // The key and the request carry exactly what the server is asked; `built` (diagnostics) is not part of either.
  const request = useMemo(() => ({ limit: query.limit, offset: query.offset, order_by: query.order_by, filters: query.filters }), [query])

  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.keywords(projectId, request),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "ranked-keywords", { refresh: consume(refreshNext.current, "page"), query: request }, { signal }),
    // Too many conditions: nothing is sent, the page says so.
    enabled: !!projectId && !built.tooMany && (state.brand === "all" || brand.settled),
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const totalsQ = useQuery({
    queryKey: queryKeys.domainOverview.rankedKeywords(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "ranked-keywords", { refresh: consume(refreshNext.current, "totals") }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const totalsEnvelope = totalsQ.data?.data ?? null
  const summary = useMemo(() => mapSummary(totalsEnvelope?.result?.metrics), [totalsEnvelope])
  const pageEnvelope = pageQ.data?.data ?? null
  const mapped = useMemo(() => mapKeywordsPage(pageEnvelope, { domainTraffic: summary.traffic }), [pageEnvelope, summary.traffic])

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    refreshNext.current.add("totals")
    pageQ.refetch()
    totalsQ.refetch()
  }, [pageQ, totalsQ])

  /**
   * "Export all with the current filters": ONE request for up to 1,000 rows (the same filters and sort, from the first row). Cached like
   * any page, so exporting twice costs nothing the second time. Resolves to { rows, total, truncated }.
   */
  const exportAll = useCallback(async () => {
    if (built.tooMany) throw new Error(built.message)
    const exportRequest = { limit: EXPORT_ALL_LIMIT, offset: 0, order_by: request.order_by, filters: request.filters }
    const res = await queryClient.fetchQuery({
      queryKey: queryKeys.domainOverview.keywords(projectId, exportRequest),
      queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "ranked-keywords", { query: exportRequest }, { signal }),
      staleTime: staleTimes.STANDARD,
      retry: false,
    })
    const out = mapKeywordsPage(res?.data, { domainTraffic: summary.traffic })
    return { rows: out.rows, total: out.total, truncated: out.total !== null && out.total > out.rows.length }
  }, [built, request, queryClient, projectId, summary.traffic])

  const describe = (q, envelope) => ({
    // The previous page's rows stay on screen while a new request is in flight; "loading" is only the very first load.
    status: envelope ? "success" : q.isError ? "error" : "loading",
    data: envelope,
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    isFetching: q.isFetching,
    refetch: () => q.refetch(),
  })

  return {
    state,
    /** The state with the saved brand terms: what the filters and the chips are built from. */
    effective,
    brand: { hasTerms: brand.hasTerms, settled: brand.settled },
    update,
    clearFilters,
    request,
    built,
    page: {
      ...describe(pageQ, pageEnvelope),
      rows: mapped.rows,
      total: mapped.total,
      // The rows on screen belong to an earlier request (a newer one is loading), or no request is being made at all.
      stale: pageQ.isPlaceholderData || built.tooMany,
    },
    totals: { ...describe(totalsQ, totalsEnvelope), summary },
    target: pageEnvelope?.target ?? totalsEnvelope?.target ?? null,
    market: pageEnvelope?.market ?? totalsEnvelope?.market ?? null,
    updatedAt: pageEnvelope?.fetchedAt ?? totalsEnvelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(pageEnvelope?.refreshThrottled || totalsEnvelope?.refreshThrottled),
    isFetching: pageQ.isFetching || totalsQ.isFetching,
    refresh,
    exportAll,
  }
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { buildDomainPagesRequest, describeActiveFilters, EMPTY_FILTERS, nextSort, viewSignature } from "@/components/dashboard/top-pages/buildDomainPagesRequest"
import { defaultPageState, parseUrlState, serializeUrlState } from "@/components/dashboard/top-pages/urlState"
import { mapDomainPage, mapDomainPagesPage } from "@/components/dashboard/top-pages/mapDomainPage"
import { groupUrlVariants } from "@/components/dashboard/top-pages/groupUrlVariants"
import { TABS, lastReachablePage } from "@/components/dashboard/top-pages/constants"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"

/**
 * Data layer for the Top Pages page. ONE integration: the Domain Overview's backend route (sections `domain-pages`, `tp-counts`, `tp-fix-first`).
 * What it holds:
 *
 *  - the PAGE: its query key is the whole request (the tab's filters, sort, page size, offset), so every combination is cached on its own (and on
 *    the server for 24 hours). Changing anything starts a new request and CANCELS the previous one (React Query's AbortSignal reaches fetch); the
 *    previous rows stay on screen, dimmed. A request that would break the 8-condition limit is never sent: the page says so instead.
 *    The SERVER joins each row's estimated traffic (one cached Organic Keywords call); when that join fails the rows come back with no traffic and the
 *    response says so — the table is never held back by it, and "Retry" asks again (the server keeps the table in its cache, so only the traffic is bought).
 *  - the HEADLINE COUNTS and "FIX FIRST": profile-level fixed requests (live links, nothing the user filters changes them), cached 7 days on the
 *    server. "Fix first" is only asked for when there are error pages to list.
 *  - the SUMMARY: the Backlink Overview's own query (same key, same server entry) — only for its broken-backlinks figure.
 *  - on the rows already loaded, in the browser: the opportunity-flag filter and "Merge URL variants". Neither is a request.
 *
 * The state lives in the URL query string (history.replaceState, read once when the page opens). Nothing retries automatically: every request is
 * billed, so the user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

export function useTopPages(projectId, projectDomain) {
  const searchParams = useSearchParams()
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

  const clearFilters = useCallback(() => update({ ...EMPTY_FILTERS, flags: [] }), [update])
  const sortBy = useCallback((columnKey) => update({ sort: nextSort(stateRef.current, columnKey) }), [update])

  const { request, built } = useMemo(() => buildDomainPagesRequest(state), [state])
  const chips = useMemo(() => describeActiveFilters(state), [state])

  // ── the page ──
  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.topPages(projectId, request),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "domain-pages", { refresh: consume(refreshNext.current, "page"), topPages: request }, { signal }),
    enabled: !!projectId && !built.tooMany,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const pageEnvelope = pageQ.data?.data ?? null
  const target = pageEnvelope?.target ?? projectDomain ?? ""
  const first = useMemo(() => mapDomainPagesPage(pageEnvelope, { target }), [pageEnvelope, target])

  // ── the headline counts (profile-level, 7 days) ──
  const countsQ = useQuery({
    queryKey: queryKeys.domainOverview.topPagesCounts(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "tp-counts", { refresh: false }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const counts = countsQ.data?.data?.result ?? null

  // ── "Fix first" (profile-level, 7 days): only when there are error pages with backlinks to list ──
  const fixQ = useQuery({
    queryKey: queryKeys.domainOverview.topPagesFixFirst(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "tp-fix-first", { refresh: false }, { signal }),
    enabled: !!projectId && Boolean(counts) && counts.errors > 0,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const fixRows = useMemo(() => (fixQ.data?.data?.result?.items ?? []).map((i) => mapDomainPage(i, { target })), [fixQ.data, target])

  // ── tab counts: remembered per view (the tab's filters + the user's) once a response for that view has arrived ──
  const [known, setKnown] = useState({})
  const viewSig = useMemo(() => viewSignature(request), [request])
  useEffect(() => {
    if (pageQ.isPlaceholderData || first.total === null) return
    setKnown((prev) => (prev[viewSig] === first.total ? prev : { ...prev, [viewSig]: first.total }))
  }, [first.total, viewSig, pageQ.isPlaceholderData])
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, known[viewSignature(buildDomainPagesRequest({ ...state, tab: t.id }).request)] ?? null])),
    [known, state],
  )

  // ── the summary (shared with the Backlink Overview) ──
  const summaryQ = useQuery({
    queryKey: queryKeys.domainOverview.backlinks(projectId, DEFAULT_BACKLINKS_REQUEST),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "backlinks", { refresh: false }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const summaryEnvelope = summaryQ.data?.data ?? null
  const summary = useMemo(() => mapBacklinkSummary(summaryEnvelope?.result), [summaryEnvelope])

  // The flag filter and "Merge URL variants" work on the rows ON THIS PAGE only: the provider knows neither.
  const flagged = useMemo(() => (state.flags.length ? first.rows.filter((r) => r.flagIds.some((f) => state.flags.includes(f))) : first.rows), [first.rows, state.flags])
  const rows = useMemo(() => (state.merge ? groupUrlVariants(flagged) : flagged), [flagged, state.merge])

  // A page past the end (a hand-edited link, or a change that left fewer pages) moves back to the last page that exists.
  useEffect(() => {
    const window = lastReachablePage(state.pageSize)
    if (state.page > window) { update({ page: window }); return }
    if (!pageEnvelope || pageQ.isPlaceholderData || first.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(first.total / state.pageSize)), window)
    if (state.page > last) update({ page: last })
  }, [pageEnvelope, pageQ.isPlaceholderData, first.total, state.page, state.pageSize, update])

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    pageQ.refetch()
  }, [pageQ])

  const trafficInfo = pageEnvelope?.traffic ?? null
  return {
    state,
    update,
    clearFilters,
    sortBy,
    request,
    built,
    chips,
    page: {
      status: pageEnvelope ? "success" : pageQ.isError ? "error" : "loading",
      error: pageQ.isError ? { message: describeSectionError(pageQ.error), code: pageQ.error?.code ?? null } : null,
      isFetching: pageQ.isFetching,
      refetch: () => pageQ.refetch(),
      rows,
      /** Rows the server sent for this page, before the flag filter and the merge. */
      loadedRows: first.rows,
      total: first.total,
      // The rows on screen belong to an earlier request (a newer one is loading), or no request is being made at all.
      stale: pageQ.isPlaceholderData || built.tooMany,
    },
    traffic: {
      failed: trafficInfo?.status === "failed",
      keywordsTotal: trafficInfo?.keywordsTotal ?? null,
      truncated: Boolean(trafficInfo?.truncated),
      // The server keeps the table in its cache, so this only asks for the traffic again.
      retry: () => pageQ.refetch(),
      retrying: pageQ.isFetching,
    },
    tabCounts,
    counts: {
      status: counts ? "success" : countsQ.isError ? "error" : "loading",
      error: countsQ.isError ? { message: describeSectionError(countsQ.error) } : null,
      refetch: () => countsQ.refetch(),
      data: counts,
    },
    fixFirst: {
      status: fixQ.data?.data ? "success" : fixQ.isError ? "error" : counts && counts.errors === 0 ? "none" : "loading",
      error: fixQ.isError ? { message: describeSectionError(fixQ.error) } : null,
      refetch: () => fixQ.refetch(),
      rows: fixRows,
    },
    summary: {
      status: summaryEnvelope ? "success" : summaryQ.isError ? "error" : "loading",
      error: summaryQ.isError ? { message: describeSectionError(summaryQ.error) } : null,
      refetch: () => summaryQ.refetch(),
      data: summary,
    },
    target,
    updatedAt: pageEnvelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(pageEnvelope?.refreshThrottled),
    isFetching: pageQ.isFetching,
    refresh,
  }
}

export { defaultPageState }

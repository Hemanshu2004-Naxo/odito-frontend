"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { buildBacklinkRequest, describeActiveFilters, EMPTY_FILTERS, nextSort, viewSignature } from "@/components/dashboard/backlinks/buildBacklinkRequest"
import { defaultPageState, parseUrlState, serializeUrlState } from "@/components/dashboard/backlinks/urlState"
import { mapBacklinksPage } from "@/components/dashboard/backlinks/mapBacklink"
import { TABS } from "@/components/dashboard/backlinks/constants"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"

/**
 * Data layer for the Backlinks page. ONE integration: the Domain Overview's backend route, section `backlinks-list`. What it holds:
 *
 *  - the PAGE: its query key is the whole request (tab, group, sort, filters, page size, offset), so every combination is cached on its
 *    own (and on the server for 24 hours). Changing anything starts a new request and CANCELS the previous one (React Query's
 *    AbortSignal reaches fetch), so an old answer can never replace a newer one; the previous rows stay on screen, dimmed.
 *    A request that would break the 8-condition limit is never sent: the page says so instead.
 *  - "LOAD MORE" past the 20,000-row offset window: each further batch is its own query with the previous response's search_after_token
 *    and every other parameter identical; the rows are appended. It resets whenever the request changes.
 *  - TAB COUNTS: the total_count of each tab for the current group and filters, learned only when that tab has been loaded — the other
 *    tabs' counts are never fetched ahead of time.
 *  - the SUMMARY strip: the Backlink Overview's own query (same key, same server entry), not a separate call.
 *
 * The state lives in the URL query string (history.replaceState, read once when the page opens). Nothing retries automatically:
 * every request is billed, so the user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

export function useBacklinks(projectId) {
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

  const clearFilters = useCallback(() => update({ ...EMPTY_FILTERS, itemTypes: [], placements: [], countries: [] }), [update])
  /** A header click (or shift-click) on a sortable column. */
  const sortBy = useCallback((columnKey, { shift = false } = {}) => update({ sort: nextSort(stateRef.current.sort, columnKey, { shift }) }), [update])

  const { request, built, windowExceeded } = useMemo(() => buildBacklinkRequest(state), [state])
  const sig = useMemo(() => JSON.stringify(request), [request])
  const chips = useMemo(() => describeActiveFilters(state), [state])

  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.backlinksList(projectId, request),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "backlinks-list", { refresh: consume(refreshNext.current, "page"), backlinksList: request }, { signal }),
    // Too many conditions: nothing is sent. A page beyond the offset window is reached with "Load more", never with an offset.
    enabled: !!projectId && !built.tooMany && !windowExceeded,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const pageEnvelope = pageQ.data?.data ?? null
  const first = useMemo(() => mapBacklinksPage(pageEnvelope), [pageEnvelope])

  // ── Load more (past the offset window) ──
  const [more, setMore] = useState({ sig: null, tokens: [] })
  const tokens = useMemo(() => (more.sig === sig ? more.tokens : []), [more, sig])
  const moreQs = useQueries({
    queries: tokens.map((token) => {
      const r = buildBacklinkRequest(state, { token }).request
      return {
        queryKey: queryKeys.domainOverview.backlinksList(projectId, r),
        queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "backlinks-list", { backlinksList: r }, { signal }),
        staleTime: staleTimes.STANDARD,
        retry: false,
        refetchOnWindowFocus: false,
      }
    }),
  })
  const morePages = useMemo(() => moreQs.map((q) => mapBacklinksPage(q.data?.data ?? null)), [moreQs])
  const rows = useMemo(() => [...first.rows, ...morePages.flatMap((p) => p.rows)], [first, morePages])
  const lastMore = moreQs.at(-1)
  const nextToken = tokens.length ? (lastMore?.data ? morePages.at(-1).nextToken : null) : first.nextToken
  const loadingMore = moreQs.some((q) => q.isFetching && !q.data)
  const moreError = lastMore?.isError ? { message: describeSectionError(lastMore.error), retry: () => lastMore.refetch() } : null
  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore) return
    setMore({ sig, tokens: [...tokens, nextToken] })
  }, [nextToken, loadingMore, sig, tokens])

  // ── Tab counts: remembered per (status, group, filters) once a response for that view has arrived ──
  const [counts, setCounts] = useState({})
  const viewSig = useMemo(() => viewSignature(request), [request])
  useEffect(() => {
    if (pageQ.isPlaceholderData || first.total === null) return
    setCounts((prev) => (prev[viewSig] === first.total ? prev : { ...prev, [viewSig]: first.total }))
  }, [first.total, viewSig, pageQ.isPlaceholderData])
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, counts[viewSignature(buildBacklinkRequest({ ...state, tab: t.id }).request)] ?? null])),
    [counts, state],
  )

  // ── The summary strip: the Backlink Overview's query, shared ──
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

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    pageQ.refetch()
  }, [pageQ])

  return {
    state,
    update,
    clearFilters,
    sortBy,
    request,
    built,
    chips,
    windowExceeded,
    page: {
      // The previous page's rows stay while a new request is in flight; "loading" is only the very first load.
      status: pageEnvelope ? "success" : pageQ.isError ? "error" : "loading",
      error: pageQ.isError ? { message: describeSectionError(pageQ.error), code: pageQ.error?.code ?? null } : null,
      isFetching: pageQ.isFetching,
      refetch: () => pageQ.refetch(),
      rows,
      /** Rows of the first batch (the numbered page); the rest were appended by Load more. */
      pageRows: first.rows.length,
      total: first.total,
      nextToken,
      loadMore,
      loadingMore,
      moreError,
      // The rows on screen belong to an earlier request (a newer one is loading), or no request is being made at all.
      stale: pageQ.isPlaceholderData || built.tooMany,
    },
    tabCounts,
    summary: {
      status: summaryEnvelope ? "success" : summaryQ.isError ? "error" : "loading",
      error: summaryQ.isError ? { message: describeSectionError(summaryQ.error) } : null,
      refetch: () => summaryQ.refetch(),
      data: summary,
    },
    target: pageEnvelope?.target ?? summaryEnvelope?.target ?? null,
    updatedAt: pageEnvelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(pageEnvelope?.refreshThrottled),
    isFetching: pageQ.isFetching,
    refresh,
  }
}

export { defaultPageState }

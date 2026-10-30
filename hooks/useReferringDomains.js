"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { buildReferringDomainRequest, describeActiveFilters, EMPTY_FILTERS, nextSort, viewSignature } from "@/components/dashboard/referring-domains/buildReferringDomainRequest"
import { defaultPageState, parseUrlState, serializeUrlState } from "@/components/dashboard/referring-domains/urlState"
import { mapNoLiveLinks, mapReferringDomain, mapReferringDomainsPage } from "@/components/dashboard/referring-domains/mapReferringDomain"
import { disavowedPage, missingFrom } from "@/components/dashboard/referring-domains/disavowedPage"
import { TABS, lastReachablePage } from "@/components/dashboard/referring-domains/constants"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"
import { useDomainLists } from "@/hooks/useDomainLists"

/**
 * Data layer for the Referring Domains page. ONE integration: the Domain Overview's backend route (sections `referring-domains`,
 * `rd-rank-buckets`, `rd-toxic-count`). What it holds:
 *
 *  - the PAGE (All / New / Lost / Toxic): its query key is the whole request (status, dofollow, sort, filters, page size, offset), so every
 *    combination is cached on its own (and on the server for 24 hours). Changing anything starts a new request and CANCELS the previous one
 *    (React Query's AbortSignal reaches fetch); the previous rows stay on screen, dimmed. A request that would break the 8-condition limit
 *    is never sent: the page says so instead.
 *  - the DISAVOWED tab: the saved list is the source of truth for which rows appear. Of the saved domains on the current page, the provider is
 *    asked (domain "in" [...]) only about those no loaded row is known for; a saved domain with no live row stays in the list as a row that
 *    says so. Removing or adding a domain therefore never asks the provider again for what is already known.
 *  - the TWO PROFILE-LEVEL CARDS: the rank distribution and the toxic count. Always live links, no filters, no dofollow: nothing on the page
 *    can change them. Cached 7 days on the server.
 *  - the SUMMARY strip: the Backlink Overview's own query (same key, same server entry).
 *  - the saved disavow / reviewed lists (useDomainLists): the flags on every row come from them, not from the provider's answers.
 *
 * The state lives in the URL query string (history.replaceState, read once when the page opens). Nothing retries automatically: every request
 * is billed, so the user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

/** The page size the provider accepts that fits `n` domains in one request. */
const limitFor = (n) => [25, 50, 100].find((s) => s >= n) ?? 100

export function useReferringDomains(projectId) {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [state, setStateRaw] = useState(() => parseUrlState(searchParams))
  const stateRef = useRef(state)
  const refreshNext = useRef(new Set())
  const lists = useDomainLists(projectId)
  const [visitedDisavowed, setVisitedDisavowed] = useState(state.tab === "disavowed")

  /** Merge a patch. Anything but a page change goes back to page 1. Synchronous: two quick patches never overwrite each other. */
  const update = useCallback((patch) => {
    const next = { ...stateRef.current, ...patch }
    if (!("page" in patch)) next.page = 1
    stateRef.current = next
    setStateRaw(next)
    if (next.tab === "disavowed") setVisitedDisavowed(true)
    try {
      const qs = serializeUrlState(next)
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
    } catch { /* the URL is a convenience; the page works without it */ }
  }, [])

  const clearFilters = useCallback(() => update({ ...EMPTY_FILTERS, quality: [] }), [update])
  const sortBy = useCallback((columnKey) => update({ sort: nextSort(stateRef.current.sort, columnKey) }), [update])

  const isDisavowedTab = state.tab === "disavowed"
  const { request, built } = useMemo(() => buildReferringDomainRequest(state), [state])
  const chips = useMemo(() => describeActiveFilters(state), [state])

  // ── the page (every tab but Disavowed) ──
  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.referringDomains(projectId, request),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "referring-domains", { refresh: consume(refreshNext.current, "page"), referringDomains: request }, { signal }),
    enabled: !!projectId && !isDisavowedTab && !built.tooMany,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const pageEnvelope = !isDisavowedTab ? (pageQ.data?.data ?? null) : null
  const settings = useMemo(() => ({ disavowed: lists.disavowedSet, reviewed: lists.reviewedSet }), [lists.disavowedSet, lists.reviewedSet])
  const first = useMemo(() => mapReferringDomainsPage(pageEnvelope?.result, settings), [pageEnvelope, settings])

  // ── the Disavowed tab ──
  const dPage = useMemo(
    () => disavowedPage(lists.disavowed, { search: state.q, page: state.page, pageSize: state.pageSize }),
    [lists.disavowed, state.q, state.page, state.pageSize],
  )
  // What is already known, read from the cache: every loaded LIVE, non-dofollow page (the figures must be the plain ones) and every earlier fill.
  // The cache is not reactive by itself, so a successful referring-domains answer bumps a counter that the memo below depends on.
  const [cacheVersion, bumpCache] = useReducer((n) => n + 1, 0)
  useEffect(() => queryClient.getQueryCache().subscribe((event) => {
    const k = event?.query?.queryKey
    if (event?.type === "updated" && event.action?.type === "success" && k?.[0] === "domain-overview" && k?.[1] === projectId && k?.[2] === "referring-domains") bumpCache()
  }), [queryClient, projectId])
  const { known, unlinked } = useMemo(() => {
    const knownRows = new Map()
    const answeredEmpty = new Set()
    const entries = queryClient.getQueriesData({ queryKey: ["domain-overview", projectId, "referring-domains"] })
    for (const [key, value] of entries) {
      const env = value?.data
      const items = env?.result?.items
      if (!Array.isArray(items) || env?.query?.status !== "live" || env?.query?.dofollow) continue
      for (const item of items) if (!knownRows.has(item.domain)) knownRows.set(item.domain, item)
      if (key[3] === "fill" && Array.isArray(key[4])) {
        const got = new Set(items.map((i) => i.domain))
        for (const d of key[4]) if (!got.has(d)) answeredEmpty.add(d)
      }
    }
    return { known: knownRows, unlinked: answeredEmpty }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cacheVersion` is what says "the cache changed"
  }, [queryClient, projectId, cacheVersion, isDisavowedTab, dPage.slice])
  const missing = useMemo(() => (isDisavowedTab ? missingFrom(dPage.slice, known, unlinked) : []), [isDisavowedTab, dPage.slice, known, unlinked])
  const missingKey = useMemo(() => [...missing].sort(), [missing])
  const fillQ = useQuery({
    queryKey: queryKeys.domainOverview.referringDomainsFill(projectId, missingKey),
    queryFn: ({ signal }) => domainOverviewService.getSection(
      projectId, "referring-domains",
      { referringDomains: { status: "live", dofollow: false, limit: limitFor(missingKey.length), offset: 0, order_by: "rank,desc", filters: ["domain", "in", missingKey] } },
      { signal },
    ),
    enabled: !!projectId && isDisavowedTab && missingKey.length > 0,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const disavowedRows = useMemo(
    () => dPage.slice
      .map((d) => {
        const item = known.get(d)
        if (item) return mapReferringDomain(item, settings)
        if (unlinked.has(d)) return mapNoLiveLinks(d, settings)
        return null
      })
      .filter(Boolean),
    [dPage.slice, known, unlinked, settings],
  )

  // ── the two profile-level cards ──
  const bucketsQ = useQuery({
    queryKey: queryKeys.domainOverview.rdRankBuckets(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rd-rank-buckets", { refresh: false }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const toxicQ = useQuery({
    queryKey: queryKeys.domainOverview.rdToxicCount(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rd-toxic-count", { refresh: false }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // ── tab counts: remembered per (status, dofollow, filters) once a response for that view has arrived ──
  const [counts, setCounts] = useState({})
  const viewSig = useMemo(() => viewSignature(request), [request])
  useEffect(() => {
    if (isDisavowedTab || pageQ.isPlaceholderData || first.total === null) return
    setCounts((prev) => (prev[viewSig] === first.total ? prev : { ...prev, [viewSig]: first.total }))
  }, [first.total, viewSig, pageQ.isPlaceholderData, isDisavowedTab])
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, t.id === "disavowed" ? (visitedDisavowed ? lists.disavowed.length : null) : (counts[viewSignature(buildReferringDomainRequest({ ...state, tab: t.id }).request)] ?? null)])),
    [counts, state, visitedDisavowed, lists.disavowed.length],
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

  // The quality filter has no counterpart at the provider: it narrows only the rows of THIS page.
  const baseRows = isDisavowedTab ? disavowedRows : first.rows
  const rows = useMemo(() => (state.quality.length ? baseRows.filter((r) => r.noLiveLinks || state.quality.includes(r.quality)) : baseRows), [baseRows, state.quality])

  // A page past the end (a hand-edited link, or a change that left fewer domains) moves back to the last page that exists.
  useEffect(() => {
    const window = lastReachablePage(state.pageSize)
    if (state.page > window) { update({ page: window }); return }
    if (isDisavowedTab) { if (state.page > dPage.pageCount) update({ page: dPage.pageCount }); return }
    if (!pageEnvelope || pageQ.isPlaceholderData || first.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(first.total / state.pageSize)), window)
    if (state.page > last) update({ page: last })
  }, [isDisavowedTab, dPage.pageCount, pageEnvelope, pageQ.isPlaceholderData, first.total, state.page, state.pageSize, update])

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    pageQ.refetch()
  }, [pageQ])

  const pageStatus = isDisavowedTab
    ? (fillQ.isError ? "error" : missingKey.length > 0 ? "loading" : "success")
    : (pageEnvelope ? "success" : pageQ.isError ? "error" : "loading")
  const pageError = isDisavowedTab ? fillQ.error : pageQ.error

  return {
    state,
    update,
    clearFilters,
    sortBy,
    request,
    built,
    chips,
    lists,
    isDisavowedTab,
    page: {
      status: pageStatus,
      error: pageStatus === "error" ? { message: describeSectionError(pageError), code: pageError?.code ?? null } : null,
      isFetching: isDisavowedTab ? fillQ.isFetching : pageQ.isFetching,
      refetch: () => (isDisavowedTab ? fillQ.refetch() : pageQ.refetch()),
      rows,
      /** Rows before the quality filter. */
      loadedRows: baseRows,
      total: isDisavowedTab ? dPage.total : first.total,
      // The rows on screen belong to an earlier request (a newer one is loading), or no request is being made at all.
      stale: !isDisavowedTab && (pageQ.isPlaceholderData || built.tooMany),
    },
    tabCounts,
    buckets: {
      status: bucketsQ.data?.data ? "success" : bucketsQ.isError ? "error" : "loading",
      error: bucketsQ.isError ? { message: describeSectionError(bucketsQ.error) } : null,
      refetch: () => bucketsQ.refetch(),
      data: bucketsQ.data?.data?.result?.buckets ?? null,
      fetchedAt: bucketsQ.data?.data?.fetchedAt ?? null,
    },
    toxic: {
      status: toxicQ.data?.data ? "success" : toxicQ.isError ? "error" : "loading",
      error: toxicQ.isError ? { message: describeSectionError(toxicQ.error) } : null,
      refetch: () => toxicQ.refetch(),
      count: toxicQ.data?.data?.result?.count ?? null,
      spamAbove: toxicQ.data?.data?.result?.spamAbove ?? 30,
    },
    summary: {
      status: summaryEnvelope ? "success" : summaryQ.isError ? "error" : "loading",
      error: summaryQ.isError ? { message: describeSectionError(summaryQ.error) } : null,
      refetch: () => summaryQ.refetch(),
      data: summary,
    },
    target: pageEnvelope?.target ?? summaryEnvelope?.target ?? bucketsQ.data?.data?.target ?? null,
    updatedAt: pageEnvelope?.fetchedAt ?? summaryEnvelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(pageEnvelope?.refreshThrottled),
    isFetching: pageQ.isFetching,
    refresh,
  }
}

export { defaultPageState }

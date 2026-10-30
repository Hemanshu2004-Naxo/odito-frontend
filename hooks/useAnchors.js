"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { createClassifier } from "@/lib/anchors/classifyAnchor"
import { evaluateAnchorHealth, summariseAnchorProfile } from "@/lib/anchors/summariseAnchorProfile"
import { PROFILE_LIMIT } from "@/lib/anchors/anchorConfig"
import { buildAnchorRequest, describeActiveFilters, EMPTY_FILTERS, nextSort } from "@/components/dashboard/anchors/buildAnchorRequest"
import { defaultPageState, parseUrlState, serializeUrlState } from "@/components/dashboard/anchors/urlState"
import { mapAnchorsPage } from "@/components/dashboard/anchors/mapAnchor"
import { lastReachablePage } from "@/components/dashboard/anchors/constants"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"
import { useAnchorSettings } from "@/hooks/useAnchorSettings"

/**
 * Data layer for the Anchors page. THREE queries, all through the Domain Overview's backend route:
 *
 *  - the PAGE (`anchors`): the rows for the current status / sort / filters / page. Its query key holds all of them, so every combination
 *    is cached on its own (and on the server for 24 hours). Changing anything starts a new request and CANCELS the previous one (React
 *    Query's AbortSignal reaches fetch), so an old answer can never replace a newer one; the previous rows stay on screen, dimmed.
 *    A request that would break the 8-condition limit is never sent: the page says so instead.
 *  - the PROFILE (`anchor-profile`): ONE fixed request — the top 1,000 live anchors by referring domains — cached for 7 days. It feeds the
 *    summary cards, the donut, the health checks, the top-anchors chart and "Export all anchors". It is NOT refetched when the brand terms
 *    or target keywords change: the rows are classified again here, in the browser.
 *  - the SUMMARY: the Backlink Overview's own query (same key, same server entry) — only for its distinct referring-domain count, the
 *    denominator of "% of all referring domains".
 *
 * The state (status, filters, sort, page) lives in the URL query string (history.replaceState, read once when the page opens). Nothing
 * retries automatically: every request is billed, so the user decides when to retry.
 */

const consume = (set, name) => set.delete(name)

export function useAnchors(projectId, targetDomain) {
  const searchParams = useSearchParams()
  const [state, setStateRaw] = useState(() => parseUrlState(searchParams))
  const stateRef = useRef(state)
  const refreshNext = useRef(new Set())
  const settingsApi = useAnchorSettings(projectId, targetDomain)
  const { settings } = settingsApi

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

  const clearFilters = useCallback(() => update({ ...EMPTY_FILTERS, types: [] }), [update])
  const sortBy = useCallback((columnKey) => update({ sort: nextSort(stateRef.current.sort, columnKey) }), [update])

  const { request, built } = useMemo(() => buildAnchorRequest(state), [state])
  const chips = useMemo(() => describeActiveFilters(state), [state])

  // ── the page ──
  const pageQ = useQuery({
    queryKey: queryKeys.domainOverview.anchors(projectId, request),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "anchors", { refresh: consume(refreshNext.current, "page"), anchors: request }, { signal }),
    enabled: !!projectId && !built.tooMany,
    placeholderData: keepPreviousData,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const pageEnvelope = pageQ.data?.data ?? null
  const page = useMemo(() => mapAnchorsPage(pageEnvelope?.result), [pageEnvelope])

  // ── the profile ──
  const profileQ = useQuery({
    queryKey: queryKeys.domainOverview.anchorProfile(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "anchor-profile", { refresh: consume(refreshNext.current, "profile") }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const profileEnvelope = profileQ.data?.data ?? null
  const profile = useMemo(() => mapAnchorsPage(profileEnvelope?.result), [profileEnvelope])

  // ── the summary (shared with the Backlink Overview): the distinct referring domains ──
  const summaryQ = useQuery({
    queryKey: queryKeys.domainOverview.backlinks(projectId, DEFAULT_BACKLINKS_REQUEST),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "backlinks", { refresh: false }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const totalReferringDomains = useMemo(() => mapBacklinkSummary(summaryQ.data?.data?.result)?.totals?.referringDomains ?? null, [summaryQ.data])

  // ── classification: recomputed when the rows OR the settings change; never a request ──
  const classify = useMemo(() => createClassifier(settings, targetDomain), [settings, targetDomain])
  const rows = useMemo(() => page.rows.map((r) => ({ ...r, type: classify(r.anchor) })), [page.rows, classify])
  const profileRows = useMemo(() => profile.rows.map((r) => ({ ...r, type: classify(r.anchor) })), [profile.rows, classify])
  const summary = useMemo(
    () => (profileEnvelope ? summariseAnchorProfile(profileRows, settings, { targetDomain, totalReferringDomains }) : null),
    [profileEnvelope, profileRows, settings, targetDomain, totalReferringDomains],
  )
  const health = useMemo(() => (summary ? evaluateAnchorHealth(summary) : []), [summary])
  // The type filter has no counterpart at the provider: it narrows only the rows of THIS page.
  const visibleRows = useMemo(() => (state.types.length ? rows.filter((r) => state.types.includes(r.type)) : rows), [rows, state.types])

  // A page past the end (a hand-edited link, or a change that left fewer anchors) moves back to the last page that exists.
  useEffect(() => {
    const window = lastReachablePage(state.pageSize)
    if (state.page > window) { update({ page: window }); return }
    if (!pageEnvelope || pageQ.isPlaceholderData || page.total === null) return
    const last = Math.min(Math.max(1, Math.ceil(page.total / state.pageSize)), window)
    if (state.page > last) update({ page: last })
  }, [pageEnvelope, pageQ.isPlaceholderData, page.total, state.page, state.pageSize, update])

  const refresh = useCallback(() => {
    refreshNext.current.add("page")
    refreshNext.current.add("profile")
    pageQ.refetch()
    profileQ.refetch()
  }, [pageQ, profileQ])

  return {
    state,
    update,
    clearFilters,
    sortBy,
    request,
    built,
    chips,
    settings: settingsApi,
    page: {
      status: pageEnvelope ? "success" : pageQ.isError ? "error" : "loading",
      error: pageQ.isError ? { message: describeSectionError(pageQ.error), code: pageQ.error?.code ?? null } : null,
      isFetching: pageQ.isFetching,
      refetch: () => pageQ.refetch(),
      rows: visibleRows,
      /** Rows the server sent for this page, before the type filter. */
      loadedRows: rows,
      total: page.total,
      // The rows on screen belong to an earlier request (a newer one is loading), or no request is being made at all.
      stale: pageQ.isPlaceholderData || built.tooMany,
    },
    profile: {
      status: profileEnvelope ? "success" : profileQ.isError ? "error" : "loading",
      error: profileQ.isError ? { message: describeSectionError(profileQ.error) } : null,
      refetch: () => profileQ.refetch(),
      rows: profileRows,
      total: profile.total,
      /** The profile holds the top 1,000 anchors: more than that exist. */
      truncated: profile.total !== null && profile.total > PROFILE_LIMIT,
      summary,
      health,
    },
    totalReferringDomains,
    target: pageEnvelope?.target ?? profileEnvelope?.target ?? null,
    updatedAt: pageEnvelope?.fetchedAt ?? profileEnvelope?.fetchedAt ?? null,
    refreshThrottled: Boolean(pageEnvelope?.refreshThrottled),
    isFetching: pageQ.isFetching || profileQ.isFetching,
    refresh,
  }
}

export { defaultPageState }

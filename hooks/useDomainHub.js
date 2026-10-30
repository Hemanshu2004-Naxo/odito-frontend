"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import domainOverviewService from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { defaultBrandMode, normalizeBrandMode, pickBrandTerms, withBrandFilter } from "@/lib/brandFilter"
import { useAnchorSettings } from "@/hooks/useAnchorSettings"
import { buildDomainPagesRequest } from "@/components/dashboard/top-pages/buildDomainPagesRequest"
import { defaultPageState } from "@/components/dashboard/top-pages/urlState"
import { mapDomainPage, mapDomainPagesPage } from "@/components/dashboard/top-pages/mapDomainPage"
import { mapAnchorsPage } from "@/components/dashboard/anchors/mapAnchor"
import { mapBulkTraffic } from "@/components/dashboard/competitors/mapBulkTraffic"
import { mapTopKeywords } from "@/components/dashboard/domain-overview/mapDomainOverview"
import { buildAnchorMix, buildCompetitorRows, buildIssueSources, mapLast30, pickTopPagesCard } from "@/components/dashboard/domain-overview/hubData"
import { buildDashboardIssues } from "@/components/dashboard/domain-overview/dashboardIssues"
import { mapCompetitorsPage } from "@/components/dashboard/competitors/mapCompetitor"
import { mapBacklinkSummary } from "@/components/dashboard/backlinks-overview/mapBacklinkSummary"

/**
 * Everything the Domain Overview "hub" shows BEYOND its five sections (which useDomainOverview loads): the Fix first panel's extra sources,
 * the Top pages card, the last-30-days referring domains, the anchor mix, the Brand / Non-brand top keywords and the competitors card's
 * tracked rows. Every source is its own query and fails on its own; nothing here retries by itself (every call is billed).
 *
 * Re-used, never re-fetched: the Top Pages page's counts / Fix first / table (same keys, same server entries), the Referring Domains page's
 * high-spam count, the backlinks summary. The anchor profile and the comparison are only PEEKED (`peek=1`: the server answers from its cache
 * and never calls the provider), so this page can never buy API 8.
 */

const TOP_KEYWORDS_ORDER = "ranked_serp_element.serp_item.etv,desc"
const TOP_KEYWORDS_LIMIT = 5

const base = { retry: false, refetchOnWindowFocus: false, staleTime: staleTimes.STANDARD }
const describe = (q) => (q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null)

/**
 * @param {string} projectId
 * @param {{ target: string|null, sections: Record<string, any>, vm: any, backlinkSummary?: any, competitorSettings: any }} ctx
 */
export function useDomainHub(projectId, { target, sections, vm, competitorSettings }) {
  const enabled = !!projectId
  const domain = target ?? ""

  // ── the saved anchor settings (brand terms + target keywords): classify the anchor mix, and decide the Brand toggle ──
  const anchorSettings = useAnchorSettings(projectId, domain)
  const savedBrandTerms = useMemo(() => (anchorSettings.saved ? pickBrandTerms(anchorSettings.settings.brandTerms) : []), [anchorSettings.saved, anchorSettings.settings.brandTerms])
  const brandSettled = anchorSettings.status !== "loading"

  // ── Top Pages: the counts, the Fix first list (only when there are error pages) and the OK tab's first page ──
  const countsQ = useQuery({ ...base, queryKey: queryKeys.domainOverview.topPagesCounts(projectId), queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "tp-counts", { refresh: false }, { signal }), enabled })
  const counts = countsQ.data?.data?.result ?? null
  const fixQ = useQuery({
    ...base,
    queryKey: queryKeys.domainOverview.topPagesFixFirst(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "tp-fix-first", { refresh: false }, { signal }),
    enabled: enabled && Boolean(counts) && counts.errors > 0,
  })
  const fixRows = useMemo(() => (fixQ.data?.data?.result?.items ?? []).map((i) => mapDomainPage(i, { target: domain })), [fixQ.data, domain])

  // The Top Pages page's OK tab, first page: the same request, so the same browser and server cache entries.
  const okRequest = useMemo(() => buildDomainPagesRequest({ ...defaultPageState(), tab: "ok" }).request, [])
  const okQ = useQuery({ ...base, queryKey: queryKeys.domainOverview.topPages(projectId, okRequest), queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "domain-pages", { refresh: false, topPages: okRequest }, { signal }), enabled })
  const okPage = useMemo(() => mapDomainPagesPage(okQ.data?.data, { target: domain }), [okQ.data, domain])

  // ── Referring Domains: the high-spam count (the page's own query) and the last-30-days tiles ──
  const toxicQ = useQuery({ ...base, queryKey: queryKeys.domainOverview.rdToxicCount(projectId), queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rd-toxic-count", { refresh: false }, { signal }), enabled })
  const last30Q = useQuery({ ...base, queryKey: queryKeys.domainOverview.rdLast30(projectId), queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rd-last-30", { refresh: false }, { signal }), enabled })
  const last30 = useMemo(() => mapLast30(last30Q.data?.data), [last30Q.data])

  // ── the anchor profile, PEEK ONLY (a miss is a normal answer: the mix and the rule are simply left out) ──
  const peekQ = useQuery({
    ...base,
    staleTime: 60_000,
    queryKey: queryKeys.domainOverview.anchorProfilePeek(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "anchor-profile", { peek: true }, { signal }),
    enabled,
  })
  const peekResult = peekQ.data?.data?.result ?? null
  const totalReferringDomains = sections.backlinks?.data?.result?.referring_domains ?? null
  const anchorMix = useMemo(() => {
    if (!peekResult || !brandSettled) return null
    return buildAnchorMix(mapAnchorsPage(peekResult).rows, anchorSettings.settings, { targetDomain: domain, totalReferringDomains })
  }, [peekResult, brandSettled, anchorSettings.settings, domain, totalReferringDomains])

  // ── Top keywords: the Brand / Non-brand variants of the plain top-5 request ──
  const [brandChoice, setBrandChoice] = useState(null)
  const hasBrandTerms = savedBrandTerms.length > 0
  const brandMode = !hasBrandTerms ? "all" : normalizeBrandMode(brandChoice ?? defaultBrandMode(savedBrandTerms))
  const variant = useMemo(() => withBrandFilter([], savedBrandTerms, brandMode), [savedBrandTerms, brandMode])
  const variantRequest = useMemo(() => ({ limit: TOP_KEYWORDS_LIMIT, offset: 0, order_by: TOP_KEYWORDS_ORDER, filters: variant.filters ?? [] }), [variant])
  const variantQ = useQuery({
    ...base,
    queryKey: queryKeys.domainOverview.topKeywordsVariant(projectId, variantRequest),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "ranked-keywords", { query: variantRequest }, { signal }),
    enabled: enabled && brandMode !== "all" && hasBrandTerms && !variant.tooMany,
  })
  const variantKeywords = useMemo(() => (variantQ.data?.data ? mapTopKeywords(variantQ.data.data.result, variantQ.data.data.target ?? domain) : null), [variantQ.data, domain])

  // ── Competitors: tracked first. A tracked one the list does not contain gets its traffic from the CACHED comparison (peek) ──
  const trackedList = competitorSettings?.tracked
  const tracked = useMemo(() => trackedList ?? [], [trackedList])
  const competitorsPage = useMemo(() => mapCompetitorsPage(sections.competitors?.data), [sections.competitors?.data])
  const listedDomains = useMemo(() => new Set(competitorsPage.rows.map((r) => r.domain)), [competitorsPage])
  const missingTracked = useMemo(() => tracked.filter((t) => !listedDomains.has(t)), [tracked, listedDomains])
  const peekKey = useMemo(() => [...tracked].sort().join(","), [tracked])
  const compareQ = useQuery({
    ...base,
    staleTime: 60_000,
    queryKey: queryKeys.domainOverview.trafficComparisonPeek(projectId, peekKey),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "bulk-traffic", { peek: true, targets: [...tracked].sort() }, { signal }),
    enabled: enabled && sections.competitors?.status === "success" && missingTracked.length > 0,
  })
  const comparison = useMemo(() => (compareQ.data?.data?.result ? mapBulkTraffic(compareQ.data.data, [domain, ...tracked]) : null), [compareQ.data, domain, tracked])
  const competitorRows = useMemo(() => buildCompetitorRows(competitorsPage, tracked, comparison, 5), [competitorsPage, tracked, comparison])

  // ── the Fix first panel ──
  const summary = useMemo(() => mapBacklinkSummary(sections.backlinks?.data?.result), [sections.backlinks?.data])
  const issues = useMemo(() => {
    const stat = (q, s) => (s ? s.status : q.isError ? "error" : q.data ? "success" : "loading")
    // The anchor profile is only peeked: an error is a failure, "not cached" is silent, the answer also waits for the saved settings it is classified with.
    const anchors = peekQ.isError ? { status: "error" }
      : !peekQ.data ? { status: "loading" }
        : !peekResult ? { status: "skipped" }
          : !brandSettled ? { status: "loading" }
            : { status: "success", exactPercent: anchorMix?.exactPercent ?? null }
    const fixFirst = counts && counts.errors > 0 ? { status: fixQ.isError ? "error" : fixQ.data ? "success" : "loading", rows: fixRows } : { status: "success", rows: [] }
    return buildDashboardIssues(buildIssueSources({
      backlinks: { status: sections.backlinks?.status ?? "loading", summary },
      history: { status: sections.history?.status ?? "loading", items: sections.history?.data?.result?.items ?? [] },
      movement: { status: sections.rankOverview?.status ?? "loading", movement: vm.movement },
      counts: { status: stat(countsQ), data: counts },
      fixFirst,
      toxic: { status: stat(toxicQ), count: toxicQ.data?.data?.result?.count ?? null },
      anchors,
    }))
  }, [sections, summary, vm.movement, countsQ, counts, fixQ.isError, fixQ.data, fixRows, toxicQ, peekQ.isError, peekQ.data, peekResult, anchorMix, brandSettled])

  const topPagesCard = useMemo(() => pickTopPagesCard(okPage.rows, fixRows[0] ?? null), [okPage.rows, fixRows])

  return {
    issues: {
      ...issues,
      retry: () => {
        for (const q of [countsQ, fixQ, toxicQ, peekQ]) if (q.isError) q.refetch()
      },
    },
    counts: { data: counts, status: countsQ.data ? "success" : countsQ.isError ? "error" : "loading" },
    topPages: {
      status: okQ.data ? "success" : okQ.isError ? "error" : "loading",
      error: describe(okQ),
      refetch: () => okQ.refetch(),
      ...topPagesCard,
      // The worst error page comes from the Fix first list: still loading while there are errors and no list yet.
      pinnedLoading: Boolean(counts && counts.errors > 0 && !fixQ.data && !fixQ.isError),
      total: okPage.total,
      trafficFailed: okQ.data?.data?.traffic?.status === "failed",
    },
    last30: { status: last30Q.data ? "success" : last30Q.isError ? "error" : "loading", error: describe(last30Q), refetch: () => last30Q.refetch(), data: last30 },
    anchorMix: {
      // "idle" = the profile is not cached (or not readable yet): the card says where to analyse it.
      status: peekQ.isError ? "error" : !peekQ.data ? "loading" : !peekResult ? "uncached" : brandSettled ? "success" : "loading",
      data: anchorMix,
      fetchedAt: peekQ.data?.data?.fetchedAt ?? null,
    },
    brand: {
      hasTerms: hasBrandTerms,
      settled: brandSettled,
      mode: brandMode,
      terms: savedBrandTerms,
      setMode: setBrandChoice,
      tooMany: variant.tooMany,
      keywords: brandMode === "all" ? null : variantKeywords,
      status: brandMode === "all" ? "idle" : variantQ.isError ? "error" : variantQ.data ? "success" : "loading",
      error: describe(variantQ),
      refetch: () => variantQ.refetch(),
    },
    competitors: { ...competitorRows, comparisonPending: compareQ.isFetching },
  }
}

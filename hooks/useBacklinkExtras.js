"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import domainOverviewService from "@/services/domainOverviewService"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { useAnchorSettings } from "@/hooks/useAnchorSettings"
import { mapAnchorsPage } from "@/components/dashboard/anchors/mapAnchor"
import { buildAnchorMix, mapLast30 } from "@/components/dashboard/domain-overview/hubData"

const base = { retry: false, refetchOnWindowFocus: false, staleTime: staleTimes.STANDARD }

/**
 * The two figures of the Backlink overview that are not in the backlinks summary, read through the Domain Overview's own queries (same keys,
 * so a visit to the dashboard first makes these free):
 *  - last30: new / lost linking sites in the last 30 days (the `rd-last-30` section);
 *  - anchors: how many anchors, and the share of linking sites whose link text is just the web address — from the anchor profile, PEEKED
 *    only (the server answers from its cache and never calls the provider). Not cached = `status: "uncached"`, never a guess.
 */
export function useBacklinkExtras(projectId, { domain, totalReferringDomains }) {
  const enabled = !!projectId
  const last30Q = useQuery({ ...base, queryKey: queryKeys.domainOverview.rdLast30(projectId), queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rd-last-30", { refresh: false }, { signal }), enabled })
  const last30 = useMemo(() => mapLast30(last30Q.data?.data), [last30Q.data])

  const settings = useAnchorSettings(projectId, domain ?? "")
  const peekQ = useQuery({
    ...base,
    staleTime: 60_000,
    queryKey: queryKeys.domainOverview.anchorProfilePeek(projectId),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "anchor-profile", { peek: true }, { signal }),
    enabled,
  })
  const peek = peekQ.data?.data?.result ?? null
  const settled = settings.status !== "loading"
  const mix = useMemo(() => {
    if (!peek || !settled) return null
    return buildAnchorMix(mapAnchorsPage(peek).rows, settings.settings, { targetDomain: domain ?? "", totalReferringDomains })
  }, [peek, settled, settings.settings, domain, totalReferringDomains])

  return {
    last30: { status: last30Q.data ? "success" : last30Q.isError ? "error" : "loading", data: last30 },
    anchors: {
      status: peekQ.isError ? "error" : !peekQ.data ? "loading" : !peek ? "uncached" : !settled ? "loading" : "success",
      count: mix?.anchors ?? null,
      nakedPercent: mix ? (mix.segments.find((s) => s.key === "naked_url")?.percent ?? 0) : null,
    },
  }
}

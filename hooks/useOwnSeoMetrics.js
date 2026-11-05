"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import domainOverviewService from "@/services/domainOverviewService"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"

/**
 * YOUR OWN website's headline SEO numbers (traffic, ranking keywords, #1 rankings, referring domains), for comparing with competitors.
 * It reads the same two Domain Overview sections under the same query keys, so a page that already loaded them costs no request, and the
 * server answers from its own cache; nothing here asks the provider to refresh. A number the provider did not give is `null`.
 */
const isNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function useOwnSeoMetrics(projectId) {
  const common = { enabled: !!projectId, staleTime: staleTimes.STANDARD, retry: false, refetchOnWindowFocus: false }
  const rank = useQuery({
    queryKey: queryKeys.domainOverview.section(projectId, "rank-overview"),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "rank-overview", { refresh: false }, { signal }),
    ...common,
  })
  const links = useQuery({
    queryKey: queryKeys.domainOverview.backlinks(projectId, DEFAULT_BACKLINKS_REQUEST),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "backlinks", { refresh: false }, { signal }),
    ...common,
  })

  const organic = rank.data?.data?.result?.organic ?? null
  const backlinks = links.data?.data?.result ?? null
  const metrics = useMemo(() => ({
    organicTraffic: isNum(organic?.etv),
    rankingKeywords: isNum(organic?.count),
    pos1: isNum(organic?.pos_1),
    referringDomains: isNum(backlinks?.referring_domains),
  }), [organic, backlinks])

  return {
    metrics,
    // The project's market ({ location, language }) as the rank section reports it; null until known.
    market: rank.data?.data?.market ?? null,
    // "loading" until the first answer of BOTH sections; "partial" when only one is known (the other metrics stay null: never compared).
    status: rank.isLoading || links.isLoading ? "loading" : rank.isError && links.isError ? "error" : "ready",
    refetch: () => { rank.refetch(); links.refetch() },
  }
}

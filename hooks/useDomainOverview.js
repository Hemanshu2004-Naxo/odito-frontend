"use client"

import { useCallback, useRef } from "react"
import { useQueries } from "@tanstack/react-query"
import domainOverviewService, { DOMAIN_OVERVIEW_SECTIONS, DEFAULT_HISTORY_MONTHS } from "@/services/domainOverviewService"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { describeSectionError } from "@/lib/describeSectionError"
import { DEFAULT_COMPETITORS_REQUEST } from "@/lib/competitorsRequest"
import { DEFAULT_BACKLINKS_REQUEST } from "@/lib/backlinksRequest"
import { useCompetitorSettings } from "@/hooks/useCompetitorSettings"

export { describeSectionError }

/**
 * Data layer for the Domain Overview page: the five sections are five independent queries fired in parallel, so each one loads,
 * fails and retries on its own. Reads hit the backend's MongoDB cache; only a section whose cache is stale (or an explicit
 * refresh) makes the server call the provider. Nothing here retries automatically — a failed section shows its own Retry button.
 */

// camelCase names the rest of the page uses, in the same order as DOMAIN_OVERVIEW_SECTIONS.
const NAMES = ["rankOverview", "history", "rankedKeywords", "competitors", "backlinks"]

/** @typedef {import("@/components/dashboard/domain-overview/types").SectionState} SectionState */

export function useDomainOverview(projectId) {
  // Sections that must skip the server cache on their NEXT fetch (set by refreshAll, consumed by that fetch).
  const refreshNext = useRef(new Set())
  // The project's exclude list changes what the competitors request asks the provider, so the competitors query waits for it and carries
  // its signature in the key. It asks for the Competitors page's DEFAULT view: the same key, so the page opens without a new request.
  const settings = useCompetitorSettings(projectId)

  const keyFor = (section) => {
    if (section === "history") return queryKeys.domainOverview.history(projectId, DEFAULT_HISTORY_MONTHS)
    if (section === "ranked-keywords") return queryKeys.domainOverview.rankedKeywords(projectId)
    if (section === "backlinks") return queryKeys.domainOverview.backlinks(projectId, DEFAULT_BACKLINKS_REQUEST)
    if (section === "competitors") return queryKeys.domainOverview.competitors(projectId, DEFAULT_COMPETITORS_REQUEST, settings.signature)
    return queryKeys.domainOverview.section(projectId, section)
  }

  const results = useQueries({
    queries: DOMAIN_OVERVIEW_SECTIONS.map((section) => ({
      queryKey: keyFor(section),
      queryFn: ({ signal }) => domainOverviewService.getSection(projectId, section, { refresh: refreshNext.current.delete(section) }, { signal }),
      enabled: !!projectId && (section !== "competitors" || settings.settled),
      staleTime: staleTimes.STANDARD,
      retry: false, // every provider call is billed: the user decides when to retry
      refetchOnWindowFocus: false,
    })),
  })

  const sections = {}
  results.forEach((q, i) => {
    const envelope = q.data?.data ?? null
    sections[NAMES[i]] = {
      // Previous data stays on screen during a refresh or a failed refresh; "loading" is only the very first load.
      status: envelope ? "success" : q.isError ? "error" : "loading",
      data: envelope,
      error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
      isFetching: q.isFetching,
      refetch: () => q.refetch(),
    }
  })

  const refreshAll = useCallback(() => {
    DOMAIN_OVERVIEW_SECTIONS.forEach((s) => refreshNext.current.add(s))
    results.forEach((q) => { q.refetch() })
  }, [results])

  // `competitorSettings` is the project's tracked / excluded lists (the competitors card ranks tracked rows first and excludes through it).
  return { sections, refreshAll, isFetching: results.some((q) => q.isFetching), competitorSettings: settings }
}

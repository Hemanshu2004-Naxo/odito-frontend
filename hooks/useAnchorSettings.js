"use client"

import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import anchorSettingsService from "@/services/anchorSettingsService"
import domainOverviewService from "@/services/domainOverviewService"
import { suggestBrandTerms, pickImportKeywords } from "@/lib/anchors/brandTerms"
import { IMPORT_KEYWORDS } from "@/lib/anchors/anchorConfig"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"
import { mapKeywordsPage } from "@/components/dashboard/organic-keywords/mapRankedKeyword"

/**
 * The project's anchor settings: the brand terms and target keywords every anchor is classified with. Saved on the project (one request
 * for both lists). A project that never saved gets SUGGESTED brand terms from its domain and no target keywords; they are what the page
 * classifies with until the user saves their own, and `saved` says which it is.
 *
 * `save` resolves to { ok: true } or { ok: false, message } and never throws; on success the saved lists replace the cached ones, so the
 * page reclassifies at once with no request to the data provider.
 *
 * `loadKeywordCandidates` is the "Import from Organic Keywords" button: the CACHED Organic Keywords pages first (no request at all);
 * only when none is cached, one request for the top 50 keywords by traffic — the same request (and cache entry) the Organic Keywords page
 * makes for its default view.
 */

/** The Organic Keywords page's default request for "the best 50 by traffic": page 1, 50 rows, traffic highest first. */
export const IMPORT_REQUEST = Object.freeze({ limit: IMPORT_KEYWORDS.fetch, offset: 0, order_by: "ranked_serp_element.serp_item.etv,desc" })

export function useAnchorSettings(projectId, targetDomain) {
  const queryClient = useQueryClient()
  const key = queryKeys.anchorSettings.detail(projectId)

  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => anchorSettingsService.get(projectId, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const data = q.data?.data ?? null
  const suggested = useMemo(() => suggestBrandTerms(targetDomain), [targetDomain])
  const saved = Boolean(data?.saved)

  const settings = useMemo(
    () => (saved ? { brandTerms: data.brand_terms, targetKeywords: data.target_keywords } : { brandTerms: suggested, targetKeywords: [] }),
    [saved, data, suggested],
  )

  const save = useCallback(async ({ brandTerms, targetKeywords }) => {
    try {
      const res = await anchorSettingsService.save(projectId, { brandTerms, targetKeywords })
      queryClient.setQueryData(key, res)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err && typeof err.status === "number" && err.message ? err.message : "Couldn't save the settings. Check your connection and try again." }
    }
  }, [projectId, queryClient, key])

  /** @returns {Promise<{ source: "cache"|"api", rows: Array<{ keyword: string, traffic: number|null }> }>} rejects with a plain message. */
  const loadKeywordCandidates = useCallback(async (brandTerms, { signal } = {}) => {
    const toRows = (page) => page.rows.map((r) => ({ keyword: r.keyword, traffic: r.traffic }))
    const cached = queryClient.getQueriesData({ queryKey: ["domain-overview", projectId, "keywords"] })
      .flatMap(([, value]) => (value?.data ? toRows(mapKeywordsPage(value.data)) : []))
    if (cached.length) return { source: "cache", rows: pickImportKeywords(cached, brandTerms) }
    try {
      const res = await queryClient.fetchQuery({
        queryKey: queryKeys.domainOverview.keywords(projectId, { ...IMPORT_REQUEST, filters: [] }),
        queryFn: ({ signal: s }) => domainOverviewService.getSection(projectId, "ranked-keywords", { query: { ...IMPORT_REQUEST } }, { signal: signal ?? s }),
        staleTime: staleTimes.STANDARD,
        retry: false,
      })
      return { source: "api", rows: pickImportKeywords(toRows(mapKeywordsPage(res?.data)), brandTerms) }
    } catch (err) {
      throw new Error(describeSectionError(err))
    }
  }, [projectId, queryClient])

  return {
    settings,
    saved,
    suggestedBrandTerms: suggested,
    limits: data?.limits ?? { brand_terms: 20, target_keywords: 100, term_length: 80 },
    status: q.isError ? "error" : data ? "success" : "loading",
    error: q.isError ? { message: describeSectionError(q.error) } : null,
    save,
    loadKeywordCandidates,
  }
}

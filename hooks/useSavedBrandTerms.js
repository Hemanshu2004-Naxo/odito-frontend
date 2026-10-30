"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import anchorSettingsService from "@/services/anchorSettingsService"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"

/**
 * The brand terms the project SAVED on the Anchors page (Anchor settings). Not the suggestions the Anchors page falls back to when nothing was
 * saved: the Brand / Non-brand split of the keyword lists only exists once the user has said what their brand is.
 * It reads the same query (and so the same cache entry) as useAnchorSettings, so no extra request is made when that page has been open.
 * `settled` is true once the answer (or a failure) is known — a request that depends on the terms waits for it.
 */
export function useSavedBrandTerms(projectId) {
  const q = useQuery({
    queryKey: queryKeys.anchorSettings.detail(projectId),
    queryFn: ({ signal }) => anchorSettingsService.get(projectId, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const data = q.data?.data ?? null
  const terms = useMemo(() => (data?.saved && Array.isArray(data.brand_terms) ? data.brand_terms : []), [data])
  const targetKeywords = useMemo(() => (data?.saved && Array.isArray(data.target_keywords) ? data.target_keywords : []), [data])
  return { terms, targetKeywords, hasTerms: terms.some((t) => typeof t === "string" && t.trim()), saved: Boolean(data?.saved), settled: q.isSuccess || q.isError }
}

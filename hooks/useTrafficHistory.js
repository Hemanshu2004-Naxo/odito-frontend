"use client"

import { useCallback, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import domainOverviewService, { DEFAULT_HISTORY_MONTHS } from "@/services/domainOverviewService"
import { describeSectionError } from "@/lib/describeSectionError"
import { queryKeys } from "@/lib/query/keys"
import { staleTimes } from "@/lib/query/stale-times"

/**
 * Data layer for the Traffic History page. It uses the SAME backend route, server cache and (for the default window) the SAME
 * client query as the Domain Overview's chart — there is one integration with the historical-rank API, not two.
 *
 * Money rule: the provider charges per month of data (~$0.01), so the page never fetches more than the user has asked to see.
 *  - It starts on the default 12 months (shared with the Domain Overview: usually already cached, so no request at all).
 *  - Picking 6 months only SLICES what is already here.
 *  - Picking 24 fetches a 24-month window ONCE; after that, going back to 12 or 6 slices it, and no request is made.
 *  - The window only ever grows (the exception: a failed larger fetch, so the user can fall back to a range that works).
 */

/** @typedef {import("@/components/dashboard/domain-overview/types").SectionState} SectionState */

export function useTrafficHistory(projectId) {
  const [selectedMonths, setSelectedMonths] = useState(DEFAULT_HISTORY_MONTHS)
  const [fetchMonths, setFetchMonths] = useState(DEFAULT_HISTORY_MONTHS)
  const skipServerCacheNext = useRef(false)

  const q = useQuery({
    queryKey: queryKeys.domainOverview.history(projectId, fetchMonths),
    queryFn: ({ signal }) => domainOverviewService.getSection(projectId, "history", { refresh: consume(skipServerCacheNext), months: fetchMonths }, { signal }),
    enabled: !!projectId,
    staleTime: staleTimes.STANDARD,
    retry: false, // every provider call is billed: the user decides when to retry
    refetchOnWindowFocus: false,
    // While a bigger window loads, keep showing the one already here instead of blanking the page.
    placeholderData: keepPreviousData,
  })

  const selectRange = useCallback((months) => {
    setSelectedMonths(months)
    setFetchMonths((current) => (q.isError ? months : Math.max(current, months)))
  }, [q.isError])

  /** Skip the server cache for the window currently shown (the server still refuses to re-buy data fetched within the last minute). */
  const refresh = useCallback(() => {
    skipServerCacheNext.current = true
    q.refetch()
  }, [q])

  const envelope = q.data?.data ?? null
  /** @type {SectionState} */
  const state = {
    status: envelope ? "success" : q.isError ? "error" : "loading",
    data: envelope,
    error: q.isError ? { message: describeSectionError(q.error), code: q.error?.code ?? null } : null,
    isFetching: q.isFetching,
    refetch: () => q.refetch(),
  }

  return {
    state,
    selectedMonths,
    selectRange,
    refresh,
    /** A larger window was just asked for and is still on its way: what is on screen is the smaller one. */
    isLoadingMore: q.isPlaceholderData,
    fetchedMonths: fetchMonths,
  }
}

function consume(ref) {
  const was = ref.current
  ref.current = false
  return was
}

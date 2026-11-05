"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import seoScanService from "@/services/seoScanService"
import { staleTimes } from "@/lib/query/stale-times"

/**
 * Stored history for the history panels. Every query here reads MongoDB through the backend (never the provider), is enabled only while its
 * panel is open, keeps the previous answer on screen while another period loads, and is refreshed (not guessed) when a scan finishes
 * (useSeoScan invalidates these roots). Query roots: dataset-changes | snapshot-comparison | dataset-freshness | keyword-history.
 */

export const HISTORY_ROOTS = ["dataset-changes", "snapshot-comparison", "dataset-freshness", "keyword-history"]

const base = { retry: false, refetchOnWindowFocus: false, staleTime: staleTimes.STANDARD, placeholderData: keepPreviousData }

/** New / lost (and keyword or domain movement) between the newest stored scan of a dataset and an earlier one. */
export function useDatasetChanges(projectId, { dataset, status = null, period = "previous" }, enabled = true) {
  return useQuery({
    ...base,
    queryKey: ["dataset-changes", projectId, dataset, status, period],
    queryFn: ({ signal }) => seoScanService.changes(projectId, { dataset, status, period }, { signal }),
    enabled: Boolean(projectId) && enabled,
  })
}

/** The newest stored snapshot of a summary dataset and an earlier one. */
export function useSnapshotComparison(projectId, { datasetType, part, period = "previous" }, enabled = true) {
  return useQuery({
    ...base,
    queryKey: ["snapshot-comparison", projectId, datasetType, part, period],
    queryFn: ({ signal }) => seoScanService.comparison(projectId, { datasetType, part, period }, { signal }),
    enabled: Boolean(projectId) && enabled,
  })
}

/** Each dataset of a page on its own: fresh / stale / missing, last success, rows, capped, last error. */
export function useDatasetFreshness(projectId, page, enabled = true) {
  return useQuery({
    ...base,
    queryKey: ["dataset-freshness", projectId, page],
    queryFn: ({ signal }) => seoScanService.freshness(projectId, page, { signal }),
    enabled: Boolean(projectId) && Boolean(page) && enabled,
  })
}

/** One keyword's stored positions over time and its best position. */
export function useKeywordHistory(projectId, keyword) {
  return useQuery({
    ...base,
    queryKey: ["keyword-history", projectId, keyword],
    queryFn: ({ signal }) => seoScanService.keywordHistory(projectId, keyword, { signal }),
    enabled: Boolean(projectId) && Boolean(keyword),
  })
}

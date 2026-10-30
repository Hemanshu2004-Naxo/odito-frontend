import { COMPETITORS_PAGE_SIZES, DEFAULT_COMPETITORS_PAGE_SIZE } from "@/lib/competitorsRequest"

export { COMPETITORS_PAGE_SIZES as PAGE_SIZES, DEFAULT_COMPETITORS_PAGE_SIZE as DEFAULT_PAGE_SIZE }

/**
 * Columns the SERVER can sort by (live-checked: the provider rejects `full_domain_metrics.*` — the competitor's whole-site keywords and
 * traffic — as a sort field, so those two columns are not sortable). `shared` descending is "relevance", the provider's default order.
 * `headToHead` sorts by the competitor's traffic on the shared keywords.
 */
export const SORTS = Object.freeze({
  shared: { field: "intersections", dir: "desc", label: "Shared keywords" },
  avgPosition: { field: "avg_position", dir: "asc", label: "Avg. position" },
  headToHead: { field: "competitor_metrics.organic.etv", dir: "desc", label: "Head-to-head" },
})
export const DEFAULT_SORT = "shared"

/** Saved-list caps (the server enforces the same numbers). */
export const MAX_TRACKED = 10
export const MAX_EXCLUDED = 1000

/** Pinning several competitors in a row makes ONE comparison request, this long after the last pin. */
export const COMPARE_DEBOUNCE_MS = 1000

/** The provider's deepest reachable offset (a conservative cap, shared with Organic Keywords). */
export { MAX_OFFSET, lastReachablePage } from "../organic-keywords/constants"

export const MIN_SHARED_MAX_DIGITS = 9

export const EXPORT_NOTE = "Exports the competitors on screen."

/**
 * The ONE request shape the competitors section takes (the Domain Overview's "Top competitors" card and the Competitors page), and the
 * helpers that depend on it. Kept in lib/ because the query cache (keys, persistence) needs them as well as the page.
 */

export const COMPETITORS_PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_COMPETITORS_PAGE_SIZE = 50
/** "Relevance" = most shared keywords first: the provider's own default order. */
export const DEFAULT_COMPETITORS_ORDER = "intersections,desc"

/**
 * The page's default view. The dashboard card asks for exactly this (so the browser and the server each hold ONE copy of the answer);
 * the project's exclude list is not part of it, the server reads that from the project.
 * @type {Readonly<import("@/components/dashboard/competitors/types").CompetitorsRequest>}
 */
export const DEFAULT_COMPETITORS_REQUEST = Object.freeze({
  limit: DEFAULT_COMPETITORS_PAGE_SIZE,
  offset: 0,
  order_by: DEFAULT_COMPETITORS_ORDER,
  filters: Object.freeze([]),
  exclude_top_domains: true,
  max_rank_group: 100,
})

/** @param {Partial<import("@/components/dashboard/competitors/types").CompetitorsRequest>|null|undefined} r */
export function isDefaultCompetitorsRequest(r) {
  if (!r || typeof r !== "object") return false
  const d = DEFAULT_COMPETITORS_REQUEST
  return r.limit === d.limit && r.offset === d.offset && r.order_by === d.order_by && (r.filters?.length ?? 0) === 0
    && r.exclude_top_domains === d.exclude_top_domains && r.max_rank_group === d.max_rank_group
}

/**
 * A short, stable fingerprint of the project's exclude list. It is part of the competitors query key: the server answers a different
 * question when the list changes, so a cached answer for the old list must never be shown for the new one.
 * Order- and case-insensitive; "x0" for an empty list.
 */
export function exclusionSignature(list) {
  const clean = [...new Set((list ?? []).map((d) => String(d).toLowerCase()))].sort()
  if (clean.length === 0) return "x0"
  let h = 5381
  for (const ch of clean.join("\n")) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0
  return `x${clean.length}:${h.toString(36)}`
}

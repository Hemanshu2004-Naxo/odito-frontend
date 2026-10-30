import { normalizeDomain } from "@/lib/normalizeDomain"
import { NO_LIVE_LINKS } from "./constants"

/**
 * The DISAVOWED tab. The saved list (our database) is the source of truth for which rows appear; the data provider only supplies each row's
 * metrics. So:
 *  - the rows are the saved domains, newest first, narrowed by the search box (a plain substring of your own list), one page at a time;
 *  - a saved domain the provider has no live row for (it no longer links) is STILL listed, as a row that says so, with the Remove action;
 *  - a domain's row is asked for only when nobody has fetched it yet (see `missingFrom`), so removing a domain, or marking one OK, never causes a request.
 * Pure: no React, no network.
 */

/** Newest first (the list is kept in the order domains were added), narrowed by `search`. */
export function visibleDisavowed(list, search = "") {
  const needle = String(search ?? "").trim().toLowerCase()
  const newestFirst = [...(Array.isArray(list) ? list : [])].reverse()
  return needle ? newestFirst.filter((d) => d.includes(needle)) : newestFirst
}

/** One page of the visible list: { total, pageCount, slice }. */
export function disavowedPage(list, { search = "", page = 1, pageSize = 50 } = {}) {
  const all = visibleDisavowed(list, search)
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize))
  const p = Math.min(Math.max(1, page), pageCount)
  return { total: all.length, pageCount, page: p, slice: all.slice((p - 1) * pageSize, p * pageSize) }
}

/**
 * Of the slice's domains, the ones that still need asking the provider about: no row is known for them and they have not already been
 * answered with "no live links". At most 100 (the provider's limit for one `in` filter).
 * @param {string[]} slice @param {Map<string, object>} known domain -> mapped payload row @param {Set<string>} unlinked domains answered with no row
 */
export function missingFrom(slice, known, unlinked) {
  return slice.filter((d) => !known.has(d) && !unlinked.has(d)).slice(0, 100)
}

/** The placeholder row for a saved domain with no live links. It has no metrics (all null), only the domain and the explanation. */
export const noLiveLinksRow = (domain) => ({ domain: normalizeDomain(domain) ?? domain, noLiveLinks: true, noLiveLinksText: NO_LIVE_LINKS })

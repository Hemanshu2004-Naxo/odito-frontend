/**
 * Backend competitor payload -> the rows the Competitors page (and the dashboard card) show. The ONLY reader of the payload's field
 * names; components read the clean names below. A missing value stays null — never 0 — so the page shows "—".
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** theirs ÷ ours, only when both are known and ours is positive. */
export const ratio = (theirs, ours) => (num(theirs) !== null && num(ours) !== null && ours > 0 ? theirs / ours : null)

/** Who has more: "us" | "them" | "tie" | null (unknown when either side is). */
export function leader(ours, theirs) {
  if (num(ours) === null || num(theirs) === null) return null
  if (ours === theirs) return "tie"
  return ours > theirs ? "us" : "them"
}

/**
 * @param {import("./types").CompetitorPayload} item
 * @param {{ ourTotalKeywords?: number|null }} [context]  the project's total keywords: the denominator of the "shared" bar
 * @returns {import("./types").CompetitorRow}
 */
export function mapCompetitor(item, { ourTotalKeywords = null } = {}) {
  const shared = num(item?.intersections)
  const ours = item?.project_shared ?? null
  const theirs = item?.competitor_shared ?? null
  const total = item?.total ?? null
  const ourTotal = num(ourTotalKeywords)
  return {
    id: item.domain,
    domain: item.domain,
    sharedKeywords: shared,
    sharedShare: shared !== null && ourTotal !== null && ourTotal > 0 ? Math.min(100, (shared / ourTotal) * 100) : null,
    avgPosition: num(item?.avg_position),
    theirTotalKeywords: num(total?.count),
    theirTotalTraffic: num(total?.etv),
    theirTrafficValue: num(total?.estimated_paid_traffic_cost),
    ourSharedTraffic: num(ours?.etv),
    theirSharedTraffic: num(theirs?.etv),
    ourTop1: num(ours?.pos_1),
    theirTop1: num(theirs?.pos_1),
    ourTop2to3: num(ours?.pos_2_3),
    theirTop2to3: num(theirs?.pos_2_3),
    ourTop4to10: num(ours?.pos_4_10),
    theirTop4to10: num(theirs?.pos_4_10),
    lead: leader(num(ours?.etv), num(theirs?.etv)),
    trafficRatio: ratio(theirs?.etv, ours?.etv),
  }
}

/** The project's own row from the competitors response (or null). */
export function mapSelf(item) {
  if (!item || typeof item.domain !== "string") return null
  return {
    domain: item.domain,
    sharedKeywords: num(item.intersections),
    totalKeywords: num(item.total?.count),
    totalTraffic: num(item.total?.etv),
    trafficValue: num(item.total?.estimated_paid_traffic_cost),
  }
}

/**
 * The project's totals from the Domain Overview's rank-overview section, used when the competitors response does not contain the
 * project's own row (it is one row among thousands: a sorted or filtered page may not include it). For the default rank group (100)
 * the provider's row repeats exactly these totals (live-checked: 4139 / 100,411.9 both ways).
 * @param {{ organic?: { count?: number|null, etv?: number|null, estimated_paid_traffic_cost?: number|null }|null }|null|undefined} rankOverview
 * @returns {import("./types").SelfRow|null}
 */
export function selfFromRankOverview(rankOverview, domain, maxRankGroup = 100) {
  const o = rankOverview?.organic
  if (!o || !domain || num(o.count) === null) return null
  // The keywords the project "shares with itself": all of them for rank group 100, the top-10 ones for "Top 10 only" — both
  // live-checked against the provider's own row (4139 = count; 1510 = pos_1 + pos_2_3 + pos_4_10 = 165 + 308 + 1037).
  // Whole-site traffic and keyword totals do not depend on the rank group.
  const top10 = [o.pos_1, o.pos_2_3, o.pos_4_10]
  const shared = maxRankGroup === 10 ? (top10.every((v) => num(v) !== null) ? top10.reduce((a, b) => a + b, 0) : null) : num(o.count)
  if (shared === null) return null
  return { domain, sharedKeywords: shared, totalKeywords: num(o.count), totalTraffic: num(o.etv), trafficValue: num(o.estimated_paid_traffic_cost) }
}

/**
 * The provider's `total_count` counts the project's own row too whenever that row is in the result set. It is taken out of the list, so
 * the count shown to the user must not include it. The row is in the set when it was seen on this page, or when it cannot have been
 * filtered out: it shares every keyword with itself, so it has the highest `intersections` of all rows and passes any `intersections`
 * filter that anything passes. (An `avg_position` filter could drop it, so then only a seen row is subtracted.)
 *
 * @param {number|null|undefined} totalCount the provider's total_count
 * @param {{ selfSeen: boolean, filters: Array }} ctx
 * @returns {number|null}
 */
export function competitorTotal(totalCount, { selfSeen, filters }) {
  if (num(totalCount) === null) return null
  if (totalCount <= 0) return 0
  const conditions = Array.isArray(filters) && typeof filters[0] === "string" ? [filters] : (filters ?? []).filter((c) => Array.isArray(c))
  const selfCanBeFilteredOut = conditions.some((c) => c[0] === "avg_position")
  return Math.max(0, totalCount - (selfSeen || !selfCanBeFilteredOut ? 1 : 0))
}

/**
 * One response of the competitors section -> { rows, self, total, offset, query }.
 * @param {any} envelope  the backend envelope ({ result, query, ... }) or null
 * @param {{ request?: import("./types").CompetitorsRequest, ourTotalKeywords?: number|null }} [ctx]
 */
export function mapCompetitorsPage(envelope, { request, ourTotalKeywords = null } = {}) {
  const result = envelope?.result
  if (!result) return { rows: [], self: null, total: null, offset: request?.offset ?? 0 }
  const self = mapSelf(result.self)
  // The project's total keywords: from its own row when this page has it, else from what the caller knows.
  const denominator = self?.totalKeywords ?? ourTotalKeywords
  return {
    rows: (result.items ?? []).map((item) => mapCompetitor(item, { ourTotalKeywords: denominator })),
    self,
    total: competitorTotal(result.totalCount, { selfSeen: Boolean(result.self), filters: request?.filters }),
    offset: request?.offset ?? envelope?.query?.offset ?? 0,
  }
}

/** Dashboard card: the first N competitors of the default view, as the card's rows (unchanged shape). */
export function toCardRows(page, n = 5) {
  return page.rows.slice(0, n).map((r) => ({ domain: r.domain, shared: r.sharedKeywords, avgPosition: r.avgPosition, traffic: r.theirTotalTraffic }))
}


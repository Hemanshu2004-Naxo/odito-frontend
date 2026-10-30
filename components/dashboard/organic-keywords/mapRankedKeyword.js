import { isNum, sumKnown } from "@/lib/seoMetrics"
import { mapPositionChange } from "../domain-overview/mapDomainOverview"
import { INTENTS, KD_BANDS, RESULT_TYPE_LABELS, SERP_FEATURES, SERP_FEATURE_ORDER } from "./constants"

/**
 * The ONLY place a ranked-keywords payload (as the backend caches and sends it) becomes what the Organic Keywords page shows.
 * Components never read raw field names. A missing figure is null — never 0 — so the page can show "—".
 */

const httpUrl = (u) => {
  if (typeof u !== "string") return null
  try { return /^https?:$/.test(new URL(u).protocol) ? u : null } catch { return null }
}

/** "2026-09-12 21:43:14 +00:00" -> Date (UTC). null when it cannot be read. */
export function parseProviderTime(s) {
  if (typeof s !== "string") return null
  const d = new Date(s.trim().replace(" ", "T").replace(/\s*\+00:00$/, "Z"))
  return Number.isNaN(d.getTime()) ? null : d
}

/** The difficulty band a KD belongs to (colour + name), or null when KD is unknown. */
export function kdBand(kd) {
  if (!isNum(kd)) return null
  let band = KD_BANDS[0]
  for (const b of KD_BANDS) if (kd >= b.min) band = b
  return band
}

const prettify = (key) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

/** Non-organic result type -> { type, label }; organic (the norm) and unknown-type rows -> null. */
export function resultTypeTag(type) {
  if (!type || type === "organic") return null
  return { type, label: RESULT_TYPE_LABELS[type] ?? prettify(type) }
}

/** The SERP features a keyword's results page has, most meaningful first. "organic" is every page's baseline and is left out. */
export function serpFeatureList(types) {
  const known = new Set(Array.isArray(types) ? types : [])
  const ordered = SERP_FEATURE_ORDER.filter((k) => known.has(k)).map((key) => ({ key, label: SERP_FEATURES[key] }))
  const extra = [...known].filter((k) => k !== "organic" && !(k in SERP_FEATURES)).sort().map((key) => ({ key, label: prettify(key) }))
  return [...ordered, ...extra]
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })

/** Monthly search volume, oldest -> newest: [{ key, year, month, volume, label }]. */
export function mapMonthlySearches(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((m) => Number.isInteger(m?.year) && Number.isInteger(m?.month))
    .map((m) => ({ key: `${m.year}-${m.month}`, year: m.year, month: m.month, volume: isNum(m.search_volume) ? m.search_volume : null, label: MONTH_LABEL.format(new Date(Date.UTC(m.year, m.month - 1, 1))) }))
    .sort((a, b) => a.year - b.year || a.month - b.month)
}

/**
 * @param {import("./types").RankedKeywordItem} item one entry of the payload's `items`
 * @param {{ target?: string|null, domainTraffic?: number|null }} [ctx] target = the project's domain (to build a URL from a path);
 *   domainTraffic = the whole domain's estimated traffic (for each row's share of it)
 * @returns {import("./types").KeywordRow}
 */
export function mapRankedKeyword(item, ctx = {}) {
  const intentValue = typeof item.intent === "string" ? item.intent.toLowerCase() : null
  const intent = INTENTS.find((i) => i.value === intentValue) ?? null
  const traffic = isNum(item.etv) ? item.etv : null
  const path = typeof item.relative_url === "string" && item.relative_url ? item.relative_url : null
  const absoluteUrl = httpUrl(item.url) ?? (ctx.target && path?.startsWith("/") ? `https://${ctx.target}${path}` : null)
  return {
    id: item.keyword,
    keyword: item.keyword,
    googleUrl: httpUrl(item.check_url),
    position: isNum(item.position) ? item.position : null,
    change: mapPositionChange(item),
    resultType: resultTypeTag(item.type),
    volume: isNum(item.search_volume) ? item.search_volume : null,
    monthly: mapMonthlySearches(item.monthly_searches),
    difficulty: isNum(item.keyword_difficulty) ? item.keyword_difficulty : null,
    kdBand: kdBand(item.keyword_difficulty),
    cpc: isNum(item.cpc) ? item.cpc : null,
    competition: typeof item.competition_level === "string" && item.competition_level ? item.competition_level : null,
    lowBid: isNum(item.low_top_of_page_bid) ? item.low_top_of_page_bid : null,
    highBid: isNum(item.high_top_of_page_bid) ? item.high_top_of_page_bid : null,
    intent,
    traffic,
    // Share of the whole domain's traffic. Unknown when either figure is, and when the domain total is 0 (no share of nothing).
    trafficShare: isNum(traffic) && isNum(ctx.domainTraffic) && ctx.domainTraffic > 0 ? (traffic / ctx.domainTraffic) * 100 : null,
    trafficValue: isNum(item.estimated_paid_traffic_cost) ? item.estimated_paid_traffic_cost : null,
    path,
    url: absoluteUrl,
    title: typeof item.title === "string" && item.title ? item.title : null,
    serpFeatures: serpFeatureList(item.serp_features),
    referringDomains: isNum(item.referring_domains) ? item.referring_domains : null,
    backlinks: isNum(item.backlinks) ? item.backlinks : null,
    lastUpdated: parseProviderTime(item.last_updated_time),
    // What the CSV needs that the view does not otherwise keep: the previous position (absolute, as the provider reports it).
    previousPosition: item.rank_changes_known && isNum(item.previous_position) ? item.previous_position : null,
    serpFeatureKeys: Array.isArray(item.serp_features) ? item.serp_features : [],
  }
}

/**
 * The five summary cards from an UNFILTERED response's `metrics` (a filtered response's metrics describe only the matching rows, so
 * they must never feed these). Every figure is null when the provider sent no metrics.
 * @returns {import("./types").Summary}
 */
export function mapSummary(metrics) {
  const m = metrics && typeof metrics === "object" ? metrics : null
  return {
    total: m && isNum(m.count) ? m.count : null,
    top3: m ? sumKnown([m.pos_1, m.pos_2_3]) : null,
    top10: m ? sumKnown([m.pos_1, m.pos_2_3, m.pos_4_10]) : null,
    traffic: m && isNum(m.etv) ? m.etv : null,
    movement: {
      added: m && isNum(m.is_new) ? m.is_new : null,
      up: m && isNum(m.is_up) ? m.is_up : null,
      down: m && isNum(m.is_down) ? m.is_down : null,
    },
  }
}

/**
 * One page response -> { total, rows }. `total` is the number of keywords matching the request's filters (it drives the pagination):
 * null only when the server did not say.
 */
export function mapKeywordsPage(envelope, { domainTraffic = null } = {}) {
  const result = envelope?.result ?? null
  const ctx = { target: envelope?.target ?? null, domainTraffic }
  const items = Array.isArray(result?.items) ? result.items : []
  return {
    total: isNum(result?.totalCount) ? result.totalCount : null,
    rows: items.map((i) => mapRankedKeyword(i, ctx)),
  }
}

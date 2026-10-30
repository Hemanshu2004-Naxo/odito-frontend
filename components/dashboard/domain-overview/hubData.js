import { ANCHOR_TYPES, TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { summariseAnchorProfile } from "@/lib/anchors/summariseAnchorProfile"
import { monthIndex } from "@/lib/seoMetrics"
import { MISSING } from "./format"

/**
 * PURE helpers that turn the extra sources of the Domain Overview "hub" (counts, Fix first rows, high-spam count, the anchor profile peek,
 * the comparison peek, ...) into what the Fix first panel and the new cards display. No React, no network.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)

// ── the traffic pair behind the "traffic drop" rule ───────────────────────────────────────────────────────────────────

/**
 * The newest month of the API 2 series and the calendar month BEFORE it ({ latest, previous }), the same baseline the traffic KPI uses.
 * `previous` is null when the series does not contain that month (a gap is not compared across).
 * @param {Array<{ year: number, month: number, etv: number|null }>} items  in any order
 */
export function latestTwoMonths(items) {
  const series = (Array.isArray(items) ? items : []).filter((i) => Number.isInteger(i?.year) && Number.isInteger(i?.month))
  if (!series.length) return { latest: null, previous: null }
  const latest = series.reduce((a, b) => (monthIndex(b.year, b.month) > monthIndex(a.year, a.month) ? b : a))
  const previous = series.find((i) => monthIndex(i.year, i.month) === monthIndex(latest.year, latest.month) - 1) ?? null
  return { latest, previous }
}

// ── the issue sources ─────────────────────────────────────────────────────────────────────────────────────────────────

const stateOf = (status) => (status === "loading" ? "loading" : status === "error" ? "error" : status === "skipped" ? "skipped" : "ready")

/**
 * The `sources` object buildDashboardIssues() takes. Each input is `{ status: "loading"|"error"|"success"|"skipped", ...data }`:
 *   backlinks  { summary }        mapBacklinkSummary(): broken backlinks, referring domains and the spam score
 *   history    { items }          API 2 months
 *   movement   { movement }       API 1 { new, lost }
 *   counts     { data }           tp-counts { pages, errors, redirects }
 *   fixFirst   { rows }           tp-fix-first rows (mapped), highest backlinks first
 *   toxic      { count }          rd-toxic-count
 *   anchors    { exactPercent }   the anchor profile PEEK ("skipped" when it is not cached)
 */
export function buildIssueSources({ backlinks, history, movement, counts, fixFirst, toxic, anchors } = {}) {
  const sources = {}

  const bl = backlinks ?? { status: "loading" }
  sources.brokenBacklinks = bl.status === "success"
    ? { state: "ready", value: { brokenBacklinks: bl.summary?.totals.brokenBacklinks ?? null, backlinks: bl.summary?.totals.backlinks ?? null } }
    : { state: stateOf(bl.status) }
  sources.spamScore = bl.status === "success" ? { state: "ready", value: { score: bl.summary?.spam.score ?? null } } : { state: stateOf(bl.status) }

  const hs = history ?? { status: "loading" }
  sources.trafficDrop = hs.status === "success" ? { state: "ready", value: latestTwoMonths(hs.items) } : { state: stateOf(hs.status) }

  const mv = movement ?? { status: "loading" }
  sources.keywordsLost = mv.status === "success" ? { state: "ready", value: { new: mv.movement?.new ?? null, lost: mv.movement?.lost ?? null } } : { state: stateOf(mv.status) }

  // Error pages: the count decides; the list only adds "top: /path". A failed list still leaves the count's issue (without the top page).
  const c = counts ?? { status: "loading" }
  if (c.status !== "success") sources.errorPages = { state: stateOf(c.status) }
  else if (!(c.data?.errors > 0)) sources.errorPages = { state: "ready", value: { count: c.data?.errors ?? null, top: null } }
  else {
    const f = fixFirst ?? { status: "loading" }
    if (f.status === "loading") sources.errorPages = { state: "loading" }
    else {
      const first = f.status === "success" ? f.rows?.[0] ?? null : null
      sources.errorPages = { state: "ready", value: { count: c.data.errors, top: first ? { path: first.address ?? first.path, statusCode: first.statusCode, backlinks: first.backlinks } : null } }
    }
  }

  // High-spam domains: the count and the referring-domain total (from the backlinks summary) are both needed.
  const t = toxic ?? { status: "loading" }
  if (t.status === "error" || bl.status === "error") sources.highSpam = { state: "error" }
  else if (t.status === "loading" || bl.status === "loading") sources.highSpam = { state: "loading" }
  else sources.highSpam = { state: "ready", value: { count: t.count ?? null, referringDomains: bl.summary?.totals.referringDomains ?? null } }

  const a = anchors ?? { status: "skipped" }
  sources.anchors = a.status === "success" ? { state: "ready", value: { exactPercent: a.exactPercent ?? null } } : { state: stateOf(a.status) }
  return sources
}

// ── Top pages card ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The card's rows: the best `limit` OK pages by estimated traffic (pages with no traffic figure sort last, then by referring domains), PLUS
 * the worst error page with backlinks pinned at the bottom (marked `pinned`). `trafficKnown` is false when the traffic join gave nothing, so
 * the card can say the order is by referring domains instead.
 * @param {Array} okRows mapped rows of the OK pages (the server joined their traffic)
 * @param {object|null} worstError the Fix-first list's first row (highest backlinks, status >= 400)
 */
export function pickTopPagesCard(okRows, worstError, limit = 4) {
  const rows = (Array.isArray(okRows) ? okRows : []).filter((r) => r && r.statusGroup === "ok")
  const trafficKnown = rows.some((r) => isNum(r.traffic))
  const sorted = [...rows].sort((a, b) => (isNum(b.traffic) ? b.traffic : -1) - (isNum(a.traffic) ? a.traffic : -1) || (b.referringDomains ?? -1) - (a.referringDomains ?? -1))
  const top = sorted.slice(0, limit).map((r) => ({ ...r, pinned: false }))
  const pinned = worstError && worstError.statusCode >= 400 ? [{ ...worstError, pinned: true }] : []
  return { rows: [...top, ...pinned], trafficKnown, hasPinned: pinned.length > 0 }
}

// ── Top competitors ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Rows of the competitors card: (1) the project's TRACKED competitors, in the order they were saved; (2) then the API 4 list (already
 * without the project's excluded domains) until there are `limit` rows in all.
 *  - A tracked competitor that is in the list shows its shared keywords, average position and the head-to-head on shared keywords.
 *  - One that is not (added by hand) has `notInList: true`, no shared keywords / head-to-head, and — when the cached comparison knows it — its
 *    organic traffic.
 * @param {{ rows: Array }} page  mapCompetitorsPage() of the default competitors view
 * @param {string[]} tracked
 * @param {Array<{ domain: string, organicTraffic: number|null, found: boolean }>|null} comparison  mapBulkTraffic() rows (the project's row included) or null
 */
export function buildCompetitorRows(page, tracked, comparison, limit = 5) {
  const listed = new Map((page?.rows ?? []).map((r) => [r.domain, r]))
  const cmp = new Map((comparison ?? []).filter((r) => !r.isProject).map((r) => [r.domain, r]))
  const trackedSet = new Set(tracked ?? [])
  const head = (tracked ?? []).map((domain) => {
    const r = listed.get(domain)
    if (r) return { ...r, tracked: true, notInList: false, organicTraffic: cmp.get(domain)?.organicTraffic ?? null }
    const c = cmp.get(domain)
    return {
      domain, tracked: true, notInList: true, sharedKeywords: null, avgPosition: null, ourSharedTraffic: null, theirSharedTraffic: null, lead: null,
      organicTraffic: c?.found ? c.organicTraffic : null,
    }
  })
  const rest = (page?.rows ?? []).filter((r) => !trackedSet.has(r.domain)).map((r) => ({ ...r, tracked: false, notInList: false, organicTraffic: null }))
  const all = [...head, ...rest]
  return { rows: all.slice(0, limit), hiddenTracked: Math.max(0, head.length - limit) }
}

/** The head-to-head split: our share of (ours + theirs) in percent, or null when either side is unknown or both are 0. */
export function headToHeadShare(ours, theirs) {
  if (!isNum(ours) || !isNum(theirs) || ours + theirs <= 0) return null
  return (ours / (ours + theirs)) * 100
}

// ── Referring domains - last 30 days ──────────────────────────────────────────────────────────────────────────────────

/** The envelope of rd-last-30 -> { since: "Sep 28" label, sinceDate, new, lost } (null parts stay null). */
export function mapLast30(envelope) {
  const r = envelope?.result
  if (!r || typeof r !== "object") return null
  const day = typeof r.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.since) ? new Date(`${r.since}T00:00:00Z`) : null
  const valid = day && !Number.isNaN(day.getTime())
  return {
    since: valid ? day.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }) : null,
    sinceDate: valid ? r.since : null,
    new: isNum(r.new) ? r.new : null,
    lost: isNum(r.lost) ? r.lost : null,
  }
}

// ── Anchor mix ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The anchor profile PEEK -> the stacked bar. `peek` is the backend envelope ({ result: { items }|null }). Anchors are classified with the
 * project's brand terms and target keywords, exactly as the Anchors page does, so the shares match it. Null when nothing is cached.
 * @param {Array} rows mapAnchorsPage(peek.result).rows
 */
export function buildAnchorMix(rows, settings, { targetDomain = "", totalReferringDomains = null } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const summary = summariseAnchorProfile(rows, settings, { targetDomain, totalReferringDomains })
  if (!(summary.totals.referringDomains > 0)) return null
  const segments = TYPE_KEYS
    .map((key) => ({ key, label: ANCHOR_TYPES[key].label, color: ANCHOR_TYPES[key].color, percent: summary.types[key].percentByReferringDomains ?? 0 }))
    .filter((s) => s.percent > 0)
  return { segments, exactPercent: summary.types.exact.percentByReferringDomains, anchors: summary.totals.anchors }
}

export { MISSING }

import { ANCHOR_HEALTH, EMPTY_ANCHOR_LABEL } from "@/lib/anchors/anchorConfig"
import { buildBreakdown, spamBand } from "../backlinks-overview/mapBacklinkSummary"
import { formatCellDate, formatDateTooltip } from "../backlinks/mapBacklink"
import { formatMonthYear } from "../domain-overview/format"
import { parseProviderTime } from "../organic-keywords/mapRankedKeyword"

/**
 * THE one place that turns the backend's anchors payload (the provider's own field names) into the row the Anchors page displays.
 * Components read this row and never a raw API path. A missing figure is null (shown as "—"), never 0.
 * `type` is NOT set here: the type depends on the project's brand terms and keywords, which can change without a new request, so the page
 * classifies the rows (lib/anchors) every time they change.
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const text = (v) => (typeof v === "string" && v ? v : null)

/** "{ date, month, label, tooltip, raw }": "Apr 2025" in the table, the exact date in the tooltip. */
export function dated(raw, now) {
  const date = parseProviderTime(raw)
  return { date, label: date ? formatMonthYear(date) : null, day: formatCellDate(date), tooltip: formatDateTooltip(date, now), raw: text(raw) }
}

/** Referring domains that follow ÷ referring domains, 0–100. null when either is unknown or there are no referring domains. */
export function dofollowPercent(referringDomains, nofollow) {
  if (num(referringDomains) === null || referringDomains <= 0 || num(nofollow) === null) return null
  return Math.min(100, Math.max(0, ((referringDomains - nofollow) / referringDomains) * 100))
}

/** Backlinks ÷ referring domains at or above the ratio in the config: many links from few sites (typically a sitewide or footer link). */
export const isSitewide = (backlinks, referringDomains) => num(backlinks) !== null && num(referringDomains) !== null && referringDomains > 0 && backlinks / referringDomains >= ANCHOR_HEALTH.sitewideRatio

/**
 * @param {import("./types").AnchorPayload} item one entry of the backend's `result.items`
 * @param {{ now?: number }} [ctx]
 * @returns {import("./types").AnchorRow}
 */
export function mapAnchor(item, { now = Date.now() } = {}) {
  const anchor = typeof item?.anchor === "string" && item.anchor.trim() ? item.anchor : null
  const rd = num(item?.referring_domains)
  const pages = num(item?.referring_pages)
  const pagesNofollow = num(item?.referring_pages_nofollow)
  const base = pages ?? num(item?.backlinks)
  return {
    // The anchor text is unique within a response; the empty anchor is one row.
    id: anchor ?? "\u0000empty",
    anchor,
    isEmpty: anchor === null,
    label: anchor ?? EMPTY_ANCHOR_LABEL,
    referringDomains: rd,
    referringDomainsNofollow: num(item?.referring_domains_nofollow),
    backlinks: num(item?.backlinks),
    dofollowPercent: dofollowPercent(rd, item?.referring_domains_nofollow),
    isSitewide: isSitewide(item?.backlinks, rd),
    rank: num(item?.rank),
    spamScore: num(item?.backlinks_spam_score),
    spamBand: spamBand(item?.backlinks_spam_score),
    brokenBacklinks: num(item?.broken_backlinks),
    brokenPages: num(item?.broken_pages),
    firstSeen: dated(item?.first_seen, now),
    lostDate: dated(item?.lost_date, now),
    stats: {
      referringMainDomains: num(item?.referring_main_domains),
      referringPages: pages,
      referringPagesDofollow: pages !== null && pagesNofollow !== null ? Math.max(0, pages - pagesNofollow) : null,
      referringPagesNofollow: pagesNofollow,
      referringIps: num(item?.referring_ips),
      referringSubnets: num(item?.referring_subnets),
    },
    breakdowns: {
      placement: buildBreakdown(item?.referring_links_semantic_locations, { kind: "semantic", base }),
      countries: buildBreakdown(item?.referring_links_countries, { kind: "country", base, topN: 8 }),
      platforms: buildBreakdown(item?.referring_links_platform_types, { kind: "platform", base, singleValued: false }),
      attributes: buildBreakdown(item?.referring_links_attributes, { kind: "attribute", base, singleValued: false }),
    },
  }
}

/** @returns {{ total: number|null, rows: import("./types").AnchorRow[] }} the backend's `result` -> the page. */
export function mapAnchorsPage(result, ctx) {
  if (!result) return { total: null, rows: [] }
  const total = typeof result.totalCount === "number" ? result.totalCount : null
  return { total, rows: Array.isArray(result.items) ? result.items.map((i) => mapAnchor(i, ctx)) : [] }
}


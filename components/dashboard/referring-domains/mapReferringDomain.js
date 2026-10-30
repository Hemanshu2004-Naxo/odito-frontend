import { countryInfo } from "@/lib/countries"
import { buildBreakdown, spamBand, titleCase } from "../backlinks-overview/mapBacklinkSummary"
import { dated } from "../anchors/mapAnchor"
import { QUALITY } from "./constants"
import { describeInsight } from "./insight"

/**
 * THE one place that turns the backend's referring-domain payload (the provider's own field names, plus the values the SERVER computed:
 * `quality`, `dofollow_pct`, `is_sitewide`, `top_country`, `main_placement`) into the row the page displays. Components read this row and
 * never a raw API path. A missing figure is null (shown as "—"), never 0. Nothing is re-derived here that the server already decided.
 *
 * `settings` is the project's own lists — { disavowed: string[]|Set, reviewed: string[]|Set } — which are NOT part of the (shared, cached)
 * provider payload: the flags are computed here, so disavowing a domain changes the screen with no request.
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const toSet = (x) => (x instanceof Set ? x : new Set(Array.isArray(x) ? x : []))

/** "IN" -> { code, name, flag }; null when there is no country at all, or it is unknown (no flag for "unknown"). */
function mapCountry(code) {
  if (code === null || code === undefined || code === "") return null
  const c = countryInfo(code)
  return { code: c.code, name: c.name, flag: c.flag, kind: c.kind }
}

/** "footer" -> { key, label: "Footer" }; "" (the provider could not tell) -> "Not specified". */
function mapPlacement(key) {
  if (key === null || key === undefined) return null
  return { key, label: key === "" ? "Not specified" : titleCase(key) }
}

/**
 * @param {import("./types").DomainPayload} item one entry of the backend's `result.items`
 * @param {{ disavowed?: string[]|Set<string>, reviewed?: string[]|Set<string> }} [settings]
 * @param {{ now?: number }} [ctx]
 * @returns {import("./types").DomainRow}
 */
export function mapReferringDomain(item, settings = {}, { now = Date.now() } = {}) {
  const domain = typeof item?.domain === "string" ? item.domain : ""
  const pages = num(item?.referring_pages)
  const pagesNofollow = num(item?.referring_pages_nofollow)
  const disavowed = toSet(settings.disavowed).has(domain)
  const reviewed = toSet(settings.reviewed).has(domain)
  const quality = typeof item?.quality === "string" && QUALITY[item.quality] ? item.quality : null
  const spam = num(item?.backlinks_spam_score)
  const row = {
    id: domain,
    domain,
    noLiveLinks: false,
    quality,
    qualityInfo: quality ? QUALITY[quality] : null,
    rank: num(item?.rank),
    backlinks: num(item?.backlinks),
    referringPages: pages,
    referringPagesNofollow: pagesNofollow,
    referringPagesDofollow: pages !== null && pagesNofollow !== null ? Math.max(0, pages - pagesNofollow) : null,
    dofollowPct: num(item?.dofollow_pct),
    isSitewide: item?.is_sitewide === true,
    topCountry: mapCountry(item?.top_country),
    mainPlacement: mapPlacement(item?.main_placement),
    spamScore: spam,
    spamBand: spamBand(spam),
    brokenBacklinks: num(item?.broken_backlinks),
    brokenPages: num(item?.broken_pages),
    referringIps: num(item?.referring_ips),
    referringSubnets: num(item?.referring_subnets),
    firstSeen: dated(item?.first_seen, now),
    lostDate: dated(item?.lost_date, now),
    disavowed,
    reviewed,
    // A toxic domain only WARNS until the user has looked at it and marked it OK; a domain already in the disavow list is handled.
    toxicWarning: quality === "toxic" && !reviewed && !disavowed,
    breakdowns: {
      placement: buildBreakdown(item?.referring_links_semantic_locations, { kind: "semantic", base: pages }),
      attributes: buildBreakdown(item?.referring_links_attributes, { kind: "attribute", base: pages, singleValued: false }),
      linkTypes: buildBreakdown(item?.referring_links_types, { kind: "type", base: pages }),
      platforms: buildBreakdown(item?.referring_links_platform_types, { kind: "platform", base: pages, singleValued: false }),
      countries: buildBreakdown(item?.referring_links_countries, { kind: "country", base: pages, topN: 8 }),
    },
    footerLinks: num(item?.referring_links_semantic_locations?.footer),
  }
  return { ...row, insight: describeInsight(row) }
}

/**
 * A saved (disavowed) domain with no live row from the provider: the row says so and keeps its Remove action. Everything else is "—".
 * @returns {import("./types").DomainRow}
 */
export function mapNoLiveLinks(domain, settings = {}) {
  const base = mapReferringDomain({ domain }, settings)
  return { ...base, noLiveLinks: true, insight: null }
}

/** @returns {{ total: number|null, rows: import("./types").DomainRow[] }} the backend's `result` -> the page. */
export function mapReferringDomainsPage(result, settings, ctx) {
  if (!result) return { total: null, rows: [] }
  const total = typeof result.totalCount === "number" ? result.totalCount : null
  return { total, rows: Array.isArray(result.items) ? result.items.map((i) => mapReferringDomain(i, settings, ctx)) : [] }
}

import { buildBreakdown, spamBand, titleCase } from "../backlinks-overview/mapBacklinkSummary"
import { dated } from "../anchors/mapAnchor"
import { FLAGS, FLAG_IDS } from "./constants"

/**
 * THE one place that turns the backend's domain-pages payload (the provider's own field names, plus the values the SERVER computed:
 * `normalized_url`, `status_group`, `dofollow_pct`, `suggested_fix`, `canonical_differs`, and — joined per response — `traffic`, `keywords`, `flags`)
 * into the row the Top Pages page displays. Components read this row and never a raw API path. A missing figure is null (shown as "—"), never 0.
 * Nothing is re-derived here that the server already decided. `traffic` is null when the traffic join failed (a missing figure, not a zero).
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null)

/** "https://www.x.com/a?b=1" -> { protocol, host, path: "/a?b=1" }; null when it is not a URL. */
export function splitUrl(raw) {
  try {
    const u = new URL(raw)
    return { protocol: u.protocol, host: u.hostname.toLowerCase(), path: `${u.pathname}${u.search}` || "/" }
  } catch {
    return null
  }
}

/**
 * How a page's address reads in the table. A page on the project's own bare host shows its PATH ("/specialities/lasik-surgery/"); a page on any
 * other host — "www.", a subdomain, another site — shows host and path, so the homepage found as http / https / www is not three identical "/";
 * an insecure page carries its "http://". The full URL is always in the tooltip.
 */
export function describeAddress(url, target) {
  const parts = splitUrl(url)
  if (!parts) return { label: url, path: url, host: null, secure: null }
  const bare = String(target ?? "").toLowerCase().replace(/^www\./, "")
  const label = parts.host === bare && parts.protocol !== "http:" ? parts.path : `${parts.protocol === "http:" ? "http://" : ""}${parts.host}${parts.path === "/" ? "/" : parts.path}`
  return { label, path: parts.path, host: parts.host, secure: parts.protocol === "https:" }
}

/** "403" -> "403 Blocked"; a group with no code is "Unknown". */
export function statusLabel(code, group) {
  if (code === null || code === undefined) return "Unknown"
  return group === "blocked" ? `${code} Blocked` : String(code)
}

/**
 * @param {import("./types").PagePayload} item one entry of the backend's `result.items`
 * @param {{ target?: string, now?: number }} [ctx] target = the project's domain (for the address)
 * @returns {import("./types").PageRow}
 */
export function mapDomainPage(item, { target = "", now = Date.now() } = {}) {
  const url = typeof item?.url === "string" ? item.url : ""
  const address = describeAddress(url, target)
  const title = text(item?.title)
  const pages = num(item?.referring_pages)
  const group = typeof item?.status_group === "string" && ["ok", "redirect", "error", "blocked", "unknown"].includes(item.status_group) ? item.status_group : "unknown"
  const code = num(item?.status_code)
  const flagIds = (Array.isArray(item?.flags) ? item.flags : []).filter((f) => FLAG_IDS.includes(f))
  const spam = num(item?.backlinks_spam_score)
  const location = text(item?.location)
  return {
    id: url,
    url,
    normalizedUrl: text(item?.normalized_url) ?? url,
    address: address.label,
    path: address.path,
    title,
    heading: title ?? address.label,
    statusCode: code,
    statusGroup: group,
    statusLabel: statusLabel(code, group),
    location,
    locationLabel: location ? describeAddress(location, target).label : null,
    referringDomains: num(item?.referring_domains),
    referringDomainsNofollow: num(item?.referring_domains_nofollow),
    backlinks: num(item?.backlinks),
    brokenBacklinks: num(item?.broken_backlinks),
    dofollowPct: num(item?.dofollow_pct),
    rank: num(item?.rank),
    spamScore: spam,
    spamBand: spamBand(spam),
    traffic: num(item?.traffic),
    keywords: num(item?.keywords),
    flagIds,
    flags: flagIds.map((id) => FLAGS[id]),
    suggestedFix: text(item?.suggested_fix),
    firstSeen: dated(item?.first_seen, now),
    lastCrawled: dated(item?.fetch_time, now),
    stats: {
      referringMainDomains: num(item?.referring_main_domains),
      referringPages: pages,
      referringPagesDofollow: pages !== null && num(item?.referring_pages_nofollow) !== null ? Math.max(0, pages - item.referring_pages_nofollow) : null,
      referringPagesNofollow: num(item?.referring_pages_nofollow),
      referringIps: num(item?.referring_ips),
      referringSubnets: num(item?.referring_subnets),
      brokenPages: num(item?.broken_pages),
    },
    breakdowns: {
      placement: buildBreakdown(item?.referring_links_semantic_locations, { kind: "semantic", base: pages }),
      attributes: buildBreakdown(item?.referring_links_attributes, { kind: "attribute", base: pages, singleValued: false }),
      countries: buildBreakdown(item?.referring_links_countries, { kind: "country", base: pages, topN: 8 }),
      platforms: buildBreakdown(item?.referring_links_platform_types, { kind: "platform", base: pages, singleValued: false }),
    },
    // What was found on the page itself (often empty for redirects and errors: every missing value is null, shown as "—").
    onPage: {
      title,
      h1: Array.isArray(item?.h1) ? item.h1.filter((h) => typeof h === "string" && h) : [],
      canonical: text(item?.canonical),
      canonicalDiffers: item?.canonical_differs === true,
      language: text(item?.language),
      wordsCount: num(item?.words_count),
      internalLinks: num(item?.internal_links_count),
      externalLinks: num(item?.external_links_count),
      images: num(item?.images_count),
      pageSpamScore: num(item?.page_spam_score),
      technologies: Array.isArray(item?.technologies) ? item.technologies : [],
      server: text(item?.server),
      mediaType: text(item?.media_type),
    },
    variants: null,
    variantCount: 1,
    approx: false,
  }
}

/** @returns {{ total: number|null, rows: import("./types").PageRow[], traffic: object|null }} the backend's response `data` -> the page. */
export function mapDomainPagesPage(envelope, ctx) {
  const result = envelope?.result
  if (!result) return { total: null, rows: [], traffic: null }
  return {
    total: typeof result.totalCount === "number" ? result.totalCount : null,
    rows: Array.isArray(result.items) ? result.items.map((i) => mapDomainPage(i, ctx)) : [],
    traffic: envelope.traffic ?? null,
  }
}

export { titleCase }

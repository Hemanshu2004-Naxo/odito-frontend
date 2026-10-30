import { countryInfo } from "@/lib/countries"
import { formatRelativeDate } from "@/lib/businessProfileReviews"
import { suggestFix } from "@/lib/suggestFix"
import { parseProviderTime } from "../organic-keywords/mapRankedKeyword"
import { spamBand, titleCase } from "../backlinks-overview/mapBacklinkSummary"
import { PLACEMENTS, ITEM_TYPES } from "./constants"

/**
 * THE one place a backlink from the backend (the provider's own field names) becomes the row the Backlinks page displays. Components
 * read these clean names and never a raw API path. A missing value is null — shown as "—" — never 0 or "".
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null)

/** "https://www.example.com/a/" -> "www.example.com/a" (no protocol, no lone trailing slash). Full URLs stay in tooltips and links. */
export function displayUrl(url) {
  const t = text(url)
  if (!t) return null
  const s = t.replace(/^https?:\/\//i, "")
  return s.endsWith("/") && s.indexOf("/") === s.length - 1 ? s.slice(0, -1) : s
}

/** The target as a path on the audited site: "/specialities/retina-diseases/" (query kept). "/" for the home page. */
export function relativePath(url) {
  const t = text(url)
  if (!t) return null
  try {
    const u = new URL(t)
    return `${u.pathname || "/"}${u.search}` || "/"
  } catch {
    return t
  }
}

/** "Oct 5, 2026" — UTC, so the day can never slip in another timezone. */
export function formatCellDate(date) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null
}

/** "Oct 5, 2026, 11:29 AM UTC · 3 weeks ago" for a tooltip. */
export function formatDateTooltip(date, now = Date.now()) {
  if (!date) return null
  const full = date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })
  const rel = formatRelativeDate(date.toISOString(), now)
  return `${full} UTC${rel ? ` · ${rel}` : ""}`
}

const dated = (s, now) => {
  const date = parseProviderTime(s)
  return { date, label: formatCellDate(date), tooltip: formatDateTooltip(date, now), raw: text(s) }
}

/**
 * @param {import("./types").BacklinkPayload} item
 * @param {{ now?: number }} [ctx]
 * @returns {import("./types").BacklinkRow}
 */
export function mapBacklink(item, { now = Date.now() } = {}) {
  const attributes = Array.isArray(item.attributes) ? item.attributes : []
  const anchor = text(item.anchor)
  const isImage = item.item_type === "image"
  const country = text(item.domain_from_country) ? countryInfo(item.domain_from_country) : null
  const placement = text(item.semantic_location)
  const first = dated(item.first_seen, now)
  const last = dated(item.last_seen, now)
  const prev = dated(item.prev_seen, now)
  const status = num(item.url_to_status_code)
  const spam = num(item.backlink_spam_score)
  const isBroken = item.is_broken === true
  return {
    id: [item.url_from, item.url_to, item.anchor, item.first_seen].join("|"),
    sourceUrl: text(item.url_from),
    sourceUrlDisplay: displayUrl(item.url_from),
    sourceTitle: text(item.page_from_title),
    sourceDomain: text(item.domain_from),
    sourceCountry: country && country.kind === "country" ? country : null,
    sourceCountryCode: text(item.domain_from_country),
    anchor,
    anchorKind: isImage ? "image" : anchor ? "text" : "empty",
    imageAlt: text(item.alt),
    imageUrl: text(item.image_url),
    itemType: text(item.item_type),
    itemTypeLabel: item.item_type && item.item_type !== "anchor" ? (ITEM_TYPES.find((o) => o.value === item.item_type)?.label ?? titleCase(item.item_type)) : null,
    targetUrl: text(item.url_to),
    targetPath: relativePath(item.url_to),
    targetRedirect: text(item.url_to_redirect_target),
    targetRedirectDisplay: displayUrl(item.url_to_redirect_target),
    targetStatus: status,
    targetSpam: num(item.url_to_spam_score),
    isDofollow: typeof item.dofollow === "boolean" ? item.dofollow : null,
    attributes,
    isUgc: attributes.includes("ugc"),
    isSponsored: attributes.includes("sponsored"),
    placementKey: placement,
    placement: placement ? (PLACEMENTS.find((o) => o.value === placement)?.label ?? titleCase(placement)) : null,
    domainRank: num(item.domain_from_rank),
    pageRank: num(item.page_from_rank),
    linkRank: num(item.rank),
    spamScore: spam,
    spamBand: spamBand(spam),
    firstSeen: first, lastSeen: last, prevSeen: prev,
    isNew: item.is_new === true,
    isLost: item.is_lost === true,
    isBroken,
    original: typeof item.original === "boolean" ? item.original : null,
    linksCount: num(item.links_count),
    // Not trimmed: the spaces around the anchor are part of the sentence.
    context: { before: typeof item.text_pre === "string" && item.text_pre.trim() ? item.text_pre : null, anchor, after: typeof item.text_post === "string" && item.text_post.trim() ? item.text_post : null },
    source: {
      language: text(item.page_from_language),
      country: country && country.kind === "country" ? country : null,
      platformTypes: (Array.isArray(item.domain_from_platform_type) ? item.domain_from_platform_type : []).filter((t) => typeof t === "string" && t).map((t) => titleCase(t)),
      ip: text(item.domain_from_ip),
      externalLinks: num(item.page_from_external_links),
      internalLinks: num(item.page_from_internal_links),
    },
    isIndirect: item.is_indirect_link === true,
    indirectPath: Array.isArray(item.indirect_link_path) ? item.indirect_link_path : [],
    suggestedFix: isBroken ? suggestFix(status) : null,
    // The label of the status badges, in the order they are shown.
    badges: [
      ...(item.is_new === true ? [{ key: "new", label: "NEW" }] : []),
      ...(item.is_lost === true ? [{ key: "lost", label: "LOST" }] : []),
      ...(isBroken ? [{ key: "broken", label: status === null ? "BROKEN" : `BROKEN ${status}` }] : []),
    ],
  }
}

/**
 * One response of the backlinks-list section -> { rows, total, nextToken }. Ids are made unique (the same page can link twice).
 * @param {any} envelope the backend envelope ({ result, ... }) or null
 */
export function mapBacklinksPage(envelope, ctx) {
  const result = envelope?.result
  if (!result) return { rows: [], total: null, nextToken: null }
  const seen = new Map()
  const rows = (result.items ?? []).map((item) => {
    const row = mapBacklink(item, ctx)
    const n = seen.get(row.id) ?? 0
    seen.set(row.id, n + 1)
    return n ? { ...row, id: `${row.id}#${n}` } : row
  })
  return { rows, total: typeof result.totalCount === "number" ? result.totalCount : null, nextToken: result.nextToken ?? null }
}

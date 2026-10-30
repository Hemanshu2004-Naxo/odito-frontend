import { countryInfo, WORLDWIDE_CODE } from "@/lib/countries"
import { parseProviderTime } from "../organic-keywords/mapRankedKeyword"
import { formatMonthYear } from "../domain-overview/format"
import { formatDate } from "../referring-domains/format"
import { ATTRIBUTE_INFO, FOOTER_KEY, LINKS, LINK_TYPE_LABELS, OTHERS_KEY, PROFILE_HEALTH, RANK_MAX, SPAM_BANDS, TOP_N } from "./constants"

/**
 * THE one place that turns the backend's backlinks payload (API 6, the provider's own field names) into what the Backlink Overview
 * displays: calculated values, breakdowns as sorted { key, label, count, percent } arrays, and the profile-health verdicts.
 * Components read this view model and never a raw API path. A missing figure is null (shown as "—"), never 0.
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)
/** a ÷ b × 100, or null when either is unknown or b is 0. */
const percentOf = (a, b) => (num(a) !== null && num(b) !== null && b > 0 ? (a / b) * 100 : null)
const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10)

// ── labels ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "message-boards" -> "Message Boards"; "organization" -> "Organization". */
export function titleCase(key) {
  return String(key).split(/[\s_-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

/** The generic labelling: an empty key (or "unknown") is "Unknown" — except for semantic locations, where it is "Not specified". */
function genericLabel(key, unknownLabel) {
  if (key === "" || key === null || key === undefined || String(key).toLowerCase() === "unknown") return unknownLabel
  return titleCase(key)
}

/** A ccTLD (".in") names a country; a generic one (".com") does not. Used for tooltips only: the label stays ".in". */
function tldDescription(key) {
  const info = /^[a-z]{2}$/i.test(key) ? countryInfo(key) : null
  return info && info.kind === "country" && info.name !== info.code ? `${info.name} country-code domain` : null
}

/**
 * kind -> how one key is shown. `label` is the text, `flag` an optional emoji, `description` the tooltip's explanation.
 * @param {"country"|"tld"|"semantic"|"platform"|"type"|"attribute"} kind
 */
function describeKey(kind, key) {
  switch (kind) {
    case "country": {
      const c = countryInfo(key)
      return { label: c.name, flag: c.flag, description: c.kind === "country" ? `Country code ${c.code}` : c.kind === "worldwide" ? "Links not tied to one country" : c.kind === "unknown" ? "Country could not be determined" : null }
    }
    case "tld": return { label: key ? `.${key}` : "Unknown", description: key ? tldDescription(key) : "Top-level domain could not be determined" }
    case "semantic": return { label: genericLabel(key, "Not specified"), description: key === "" ? "The provider could not tell where on the page the link sits" : null }
    case "type": return { label: LINK_TYPE_LABELS[key] ?? genericLabel(key, "Unknown"), description: null }
    case "attribute": return { label: ATTRIBUTE_INFO[key]?.label ?? genericLabel(key, "Unknown"), description: ATTRIBUTE_INFO[key]?.text ?? null, highlight: Boolean(ATTRIBUTE_INFO[key]?.highlight) }
    default: return { label: genericLabel(key, "Unknown"), description: key === "" || String(key).toLowerCase() === "unknown" ? "Site type could not be determined" : null }
  }
}

/**
 * A { key: count } breakdown -> { entries, base, isEmpty }.
 *  - entries are sorted by count (highest first; ties by key) as { key, label, count, percent, flag?, description?, highlight?, isOthers? }.
 *  - percent = count ÷ `base`, where base is the number of referring links the breakdown covers (live-checked: the single-valued
 *    breakdowns add up to `referring_pages` exactly). The multi-valued ones (attributes, site types) can add up to more than that.
 *  - topN: only the first N entries are kept and the rest become one "Others" entry. For a single-valued breakdown that is
 *    base − (the kept ones), which also covers the keys the provider did not list at all; for a multi-valued one, the listed rest.
 * An absent breakdown (the provider omits some, e.g. attributes for lost links) and an empty one are both `isEmpty`.
 *
 * COUNTRIES are different: an unknown country ("") says nothing about WHERE the links are, so it is taken out of the entries and the shares
 * of the known countries are calculated among the KNOWN links only (count ÷ (links − unknown)); "WW" (worldwide) is known. The unknown part
 * is returned on its own as `unknown: { key: "", label, count, percent }` (its percent is of ALL links), so a reader can still say how much
 * is untracked. `isEmpty` is true when no country is known.
 *
 * @param {Record<string, number>|null|undefined} obj
 * @param {{ kind: "country"|"tld"|"semantic"|"platform"|"type"|"attribute", base: number|null, topN?: number, singleValued?: boolean }} opts
 */
export function buildBreakdown(obj, { kind, base, topN = null, singleValued = true }) {
  const all = obj && typeof obj === "object" ? Object.entries(obj).filter(([, v]) => num(v) !== null) : []
  if (all.length === 0) return { entries: [], base: num(base), isEmpty: true }
  const allListed = all.reduce((sum, [, v]) => sum + v, 0)
  // The denominator: the known number of links, or — when the provider gave none — what was listed.
  const total = num(base) !== null && base > 0 ? base : allListed
  // Countries: the unknown ("") is set aside; every share below is of the KNOWN links.
  const unknownCount = kind === "country" ? (obj[""] ?? 0) : 0
  const raw = kind === "country" ? all.filter(([key]) => key !== "") : all
  const unknown = kind === "country" && unknownCount > 0
    ? { key: "", count: unknownCount, percent: percentOf(unknownCount, total), ...describeKey("country", "") }
    : null
  if (raw.length === 0) return { entries: [], base: total, isEmpty: true, ...(kind === "country" ? { unknown, knownBase: 0 } : {}) }
  raw.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
  const listed = raw.reduce((sum, [, v]) => sum + v, 0)
  const denominator = Math.max(total - unknownCount, 0) || listed
  const entry = ([key, count]) => ({ key, count, percent: percentOf(count, denominator), ...describeKey(kind, key) })

  let shown = raw
  let others = null
  if (topN !== null && raw.length > topN) {
    shown = raw.slice(0, topN)
    const keptSum = shown.reduce((sum, [, v]) => sum + v, 0)
    const rest = singleValued && denominator > keptSum ? denominator - keptSum : listed - keptSum
    if (rest > 0) others = { key: OTHERS_KEY, label: "Others", count: rest, percent: percentOf(rest, denominator), description: `${raw.length - topN} more, plus any not listed`, isOthers: true }
  }
  return {
    entries: [...shown.map(entry), ...(others ? [others] : [])],
    base: kind === "country" ? total : denominator,
    isEmpty: false,
    ...(kind === "country" ? { unknown, knownBase: denominator } : {}),
  }
}

/**
 * The sentence under a country breakdown that says how much is untracked, or null when nothing is. Shares above it are of the KNOWN links.
 * @param {import("./types").Breakdown|null|undefined} breakdown
 */
export function describeUnknownCountries(breakdown) {
  const u = breakdown?.unknown
  if (!u || u.percent === null || u.percent === undefined) return null
  return `Unknown: ${u.percent.toFixed(1)}% of links — the country could not be determined. The shares above are of the links with a known country.`
}

// ── profile age ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * first_seen -> "Since Mar 2019" (cards) and "Since Mar 2019 (7 yrs)" (full), plus the exact date for a tooltip.
 * Whole months since the first sighting: 12+ show years, fewer show months, under one month "<1 mo".
 */
export function describeProfileAge(firstSeen, now = new Date()) {
  const d = parseProviderTime(firstSeen)
  if (!d) return { date: null, short: null, label: null, tooltip: null, months: null }
  const months = Math.max(0, (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth()) - (now.getUTCDate() < d.getUTCDate() ? 1 : 0))
  const years = Math.floor(months / 12)
  const span = months >= 12 ? `${years} ${years === 1 ? "yr" : "yrs"}` : months >= 1 ? `${months} ${months === 1 ? "mo" : "mos"}` : "<1 mo"
  const short = `Since ${formatMonthYear(d)}`
  return { date: d, short, label: `${short} (${span})`, tooltip: `First seen ${formatDate(d.toISOString())}`, months }
}

// ── spam + health ─────────────────────────────────────────────────────────────────────────────────────────────────

/** 0–10 Low, 11–30 Medium, 31+ High; null when the score is unknown. */
export function spamBand(score) {
  if (num(score) === null) return null
  if (score <= PROFILE_HEALTH.spam.low) return SPAM_BANDS.low
  if (score <= PROFILE_HEALTH.spam.medium) return SPAM_BANDS.medium
  return SPAM_BANDS.high
}

const fmtInt = (n) => n.toLocaleString("en-US")
const fmtPct = (p) => `${p.toFixed(1)}%`

/**
 * The automatic checks. level: "red" | "amber" | "green" | "unknown" (not enough data to judge — never a guess). `href` where there
 * is somewhere to go. Thresholds come from PROFILE_HEALTH.
 * @returns {Array<{ id: string, level: string, message: string, href: string|null }>}
 */
export function evaluateHealth(m) {
  const t = PROFILE_HEALTH
  const out = []
  const unknown = (id, message) => out.push({ id, level: "unknown", message, href: null })

  if (m.totals.brokenBacklinks === null) unknown("broken-backlinks", "Broken backlinks are not available.")
  else if (m.totals.brokenBacklinks > 0) out.push({ id: "broken-backlinks", level: "red", message: `${fmtInt(m.totals.brokenBacklinks)} backlinks point to broken URLs — fix with redirects.`, href: LINKS.brokenBacklinks })
  else out.push({ id: "broken-backlinks", level: "green", message: "No backlinks point to broken URLs.", href: null })

  if (m.totals.brokenPages === null) unknown("broken-pages", "Broken pages are not available.")
  else if (m.totals.brokenPages > 0) out.push({ id: "broken-pages", level: "red", message: `${fmtInt(m.totals.brokenPages)} of your pages with links return errors.`, href: LINKS.brokenPages })
  else out.push({ id: "broken-pages", level: "green", message: "None of your pages with links return errors.", href: null })

  const band = m.spam.band
  if (!band) unknown("spam", "Spam score is not available.")
  else out.push({ id: "spam", level: band.key === "high" ? "red" : band.key === "medium" ? "amber" : "green", message: `Spam score ${m.spam.score}/100.`, href: null })

  const df = m.derived.dofollowDomainsPercent
  if (df === null) unknown("dofollow", "Dofollow share is not available.")
  else if (df < t.dofollowMinPercent) out.push({ id: "dofollow", level: "amber", message: "Most linking domains are nofollow.", href: null })
  else out.push({ id: "dofollow", level: "green", message: `${fmtPct(df)} of linking domains are dofollow.`, href: null })

  const sub = m.derived.subnetDiversity
  if (sub === null) unknown("subnets", "Network diversity is not available.")
  else if (sub < t.subnetDiversityMinPercent) out.push({ id: "subnets", level: "amber", message: "Many links come from the same networks.", href: null })
  else out.push({ id: "subnets", level: "green", message: `Links come from a diverse set of networks (${fmtPct(sub)}).`, href: null })

  const footer = m.breakdowns.semanticLocations.entries.find((e) => e.key === FOOTER_KEY)
  const footerPercent = m.breakdowns.semanticLocations.isEmpty ? null : footer ? footer.percent : 0
  if (footerPercent === null) unknown("footer", "Link placement is not available.")
  else if (footerPercent > t.footerMaxPercent) out.push({ id: "footer", level: "amber", message: `${fmtPct(footerPercent)} of links are footer links.`, href: null })
  else out.push({ id: "footer", level: "green", message: `${fmtPct(footerPercent)} of links are footer links.`, href: null })
  return out
}

// ── the view model ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {import("./types").BacklinkSummaryPayload|null|undefined} result  the backend's `result` for the backlinks section
 * @param {{ now?: Date }} [ctx]  for a stable profile age in tests
 * @returns {import("./types").BacklinkSummary|null}
 */
export function mapBacklinkSummary(result, { now = new Date() } = {}) {
  if (!result || typeof result !== "object") return null
  const totals = {
    backlinks: num(result.backlinks),
    referringDomains: num(result.referring_domains),
    referringDomainsNofollow: num(result.referring_domains_nofollow),
    referringMainDomains: num(result.referring_main_domains),
    referringPages: num(result.referring_pages),
    referringPagesNofollow: num(result.referring_pages_nofollow),
    referringIps: num(result.referring_ips),
    referringSubnets: num(result.referring_subnets),
    brokenBacklinks: num(result.broken_backlinks),
    brokenPages: num(result.broken_pages),
    crawledPages: num(result.crawled_pages),
    internalLinks: num(result.internal_links_count),
    externalLinks: num(result.external_links_count),
  }
  const sub = (a, b) => (num(a) !== null && num(b) !== null ? Math.max(0, a - b) : null)
  const dofollowDomains = sub(totals.referringDomains, totals.referringDomainsNofollow)
  const dofollowPages = sub(totals.referringPages, totals.referringPagesNofollow)
  const derived = {
    dofollowDomains,
    dofollowDomainsPercent: percentOf(dofollowDomains, totals.referringDomains),
    nofollowDomains: num(totals.referringDomainsNofollow),
    dofollowPages,
    dofollowPagesPercent: percentOf(dofollowPages, totals.referringPages),
    nofollowPages: num(totals.referringPagesNofollow),
    backlinksPerDomain: num(totals.backlinks) !== null && num(totals.referringDomains) !== null && totals.referringDomains > 0 ? round1(totals.backlinks / totals.referringDomains) : null,
    subnetDiversity: percentOf(totals.referringSubnets, totals.referringDomains),
    brokenBacklinksPercent: percentOf(totals.brokenBacklinks, totals.backlinks),
  }

  // The breakdowns count referring links; `referring_pages` is how many there are (live-checked), so it is the base for every share.
  const base = totals.referringPages
  const breakdowns = {
    attributes: buildBreakdown(result.referring_links_attributes, { kind: "attribute", base, singleValued: false }),
    countries: buildBreakdown(result.referring_links_countries, { kind: "country", base, topN: TOP_N }),
    tlds: buildBreakdown(result.referring_links_tld, { kind: "tld", base, topN: TOP_N }),
    platformTypes: buildBreakdown(result.referring_links_platform_types, { kind: "platform", base, singleValued: false }),
    semanticLocations: buildBreakdown(result.referring_links_semantic_locations, { kind: "semantic", base }),
    linkTypes: buildBreakdown(result.referring_links_types, { kind: "type", base }),
  }

  const info = result.info ?? {}
  const hostCountry = typeof info.country === "string" && info.country ? countryInfo(info.country) : null
  const score = num(result.backlinks_spam_score)
  const summary = {
    rank: num(result.rank),
    rankMax: RANK_MAX,
    rankPercent: num(result.rank) === null ? null : Math.min(100, Math.max(0, (result.rank / RANK_MAX) * 100)),
    spam: { score, band: spamBand(score), siteScore: num(info.target_spam_score) },
    age: describeProfileAge(result.first_seen, now),
    lostDate: parseProviderTime(result.lost_date),
    hasBacklinks: totals.backlinks === null ? null : totals.backlinks > 0,
    totals,
    derived,
    breakdowns,
    site: {
      cms: typeof info.cms === "string" && info.cms ? titleCase(info.cms) : null,
      server: typeof info.server === "string" && info.server ? info.server : null,
      ipAddress: typeof info.ip_address === "string" && info.ip_address ? info.ip_address : null,
      country: hostCountry && hostCountry.code !== WORLDWIDE_CODE ? hostCountry : null,
      platformTypes: (Array.isArray(info.platform_type) ? info.platform_type : []).filter((t) => typeof t === "string" && t).map((t) => titleCase(t)),
    },
  }
  return { ...summary, health: evaluateHealth(summary) }
}

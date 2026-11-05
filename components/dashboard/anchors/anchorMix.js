import { ANCHOR_HEALTH, ANCHOR_TYPES, EMPTY_ANCHOR_LABEL } from "@/lib/anchors/anchorConfig"
import { formatCompact, formatExact } from "../domain-overview/format"

/**
 * PURE rules for the redesigned Anchors page: the "Your anchor mix" rows (each type's share against a typical range, with a verdict), the
 * advice sentence under them, the spammy-anchor banner, the anchor cloud and the detail panel's verdict. Everything reads the classified
 * profile (useAnchors().profile); a share that is not known gives no row and no advice rather than a guess.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const pct1 = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`

/**
 * The share of linking sites each type usually has in a natural profile. A RULE OF THUMB, not a Google number — the page says so.
 * Order = the table's order before it is sorted by size.
 */
export const TYPICAL_RANGES = Object.freeze({
  branded: [20, 40],
  naked_url: [15, 30],
  other: [20, 40],
  partial: [5, 15],
  exact: [1, 5],
  generic: [3, 10],
  empty: [2, 8],
})

/** How this page names the types (the catch-all "Other" reads better as the phrases it usually is). */
export const MIX_LABELS = Object.freeze({ other: "Phrases", exact: "Keyword match", partial: "Partial match" })
export const mixLabel = (key) => MIX_LABELS[key] ?? ANCHOR_TYPES[key]?.label ?? key

/** "too_low" | "ok" | "too_high" for a share against its range. */
export function verdictFor(key, percent) {
  const range = TYPICAL_RANGES[key]
  if (!range || !isNum(percent)) return null
  if (percent < range[0]) return "too_low"
  if (percent > range[1]) return "too_high"
  return "ok"
}
export const VERDICT_LABEL = Object.freeze({ too_low: "Too low", ok: "In range", too_high: "Too high" })

/** The example under each type's name: from the project's own data where there is one. */
function exampleFor(key, { domain, brand, keyword, topOther }) {
  switch (key) {
    case "naked_url": return domain ? `e.g. ${domain}` : "A plain web address"
    case "branded": return brand ? `e.g. ${brand}` : "Your brand name"
    case "exact": return keyword ? `Exact service words, e.g. ${keyword}` : "Exactly one of your target keywords"
    case "partial": return keyword ? `Contains a keyword, e.g. best ${keyword}` : "Contains one of your target keywords"
    case "generic": return "e.g. click here, website"
    case "empty": return "Image links with no alt text"
    default: return topOther ? `e.g. ${topOther.length > 40 ? `${topOther.slice(0, 39)}…` : topOther}` : "Any other words"
  }
}

/**
 * The mix: one row per type that is known, biggest share first — { key, label, example, color, percent, range, verdict }.
 * @param {any} summary  summariseAnchorProfile() result
 * @param {{ domain?: string|null, brandTerms?: string[], targetKeywords?: string[] }} ctx
 */
export function buildMixRows(summary, { domain = null, brandTerms = [], targetKeywords = [] } = {}) {
  if (!summary || !(summary.totals?.referringDomains > 0)) return []
  const topOther = summary.classified?.filter((c) => c.type === "other" && c.row.anchor).sort((a, b) => b.rd - a.rd)[0]?.row.anchor ?? null
  const ctx = { domain, brand: brandTerms[0] ?? null, keyword: targetKeywords[0] ?? null, topOther }
  return Object.keys(TYPICAL_RANGES)
    .map((key) => {
      const percent = summary.types[key]?.percentByReferringDomains ?? null
      return { key, label: mixLabel(key), example: exampleFor(key, ctx), color: ANCHOR_TYPES[key].color, percent, range: TYPICAL_RANGES[key], verdict: verdictFor(key, percent) }
    })
    .filter((r) => isNum(r.percent))
    .sort((a, b) => b.percent - a.percent)
}

/**
 * The advice under the mix: the type furthest above its range, then what to ask for when brand links are short, then the spam caveat.
 * Null when every type is in range.
 */
export function buildMixAdvice(rows, { brand = null, spam = null } = {}) {
  const off = rows.filter((r) => r.verdict && r.verdict !== "ok")
  if (!off.length) return null
  const distance = (r) => (r.verdict === "too_high" ? r.percent - r.range[1] : r.range[0] - r.percent)
  const high = off.filter((r) => r.verdict === "too_high").sort((a, b) => distance(b) - distance(a))[0]
  const parts = []
  if (high) parts.push(`${high.label} anchors are ${pct1(high.percent)} of your mix, above the typical ${high.range[0]}–${high.range[1]}%.`)
  else {
    const low = off.sort((a, b) => distance(b) - distance(a))[0]
    parts.push(`${low.label} anchors are only ${pct1(low.percent)} of your mix, below the typical ${low.range[0]}–${low.range[1]}%.`)
  }
  if (spam && spam.count > 0) parts.push("Part of this comes from spammy sites; once those are disavowed your real mix will look different.")
  const branded = rows.find((r) => r.key === "branded")
  if (branded?.verdict === "too_low") parts.push(`Ask partners and directories to link with “${brand || "your brand name"}”.`)
  return parts.join(" ")
}

/** Anchors whose spam score is above the health check's own threshold. */
export const isSpamRow = (row) => isNum(row?.spamScore) && row.spamScore > ANCHOR_HEALTH.spam.score

/** The banner: how many spammy anchors, and how many linking sites use them. Null when there are none. */
export function buildSpamSummary(rows) {
  const spam = (rows ?? []).filter(isSpamRow)
  if (!spam.length) return null
  const sites = spam.reduce((s, r) => s + (isNum(r.referringDomains) ? r.referringDomains : 0), 0)
  const top = [...spam].sort((a, b) => (b.referringDomains ?? 0) - (a.referringDomains ?? 0))[0]
  return {
    count: spam.length,
    sites,
    title: `${formatExact(spam.length)} spammy anchor${spam.length === 1 ? "" : "s"} from ${formatCompact(sites)} linking site${sites === 1 ? "" : "s"}`,
    example: top?.anchor ?? null,
  }
}

/** The cloud's text size for an anchor, 14–30px, on a log scale of its linking sites against the biggest. */
export function cloudSize(referringDomains, max) {
  if (!isNum(referringDomains) || !isNum(max) || max <= 1) return 16
  const t = Math.log(Math.max(1, referringDomains)) / Math.log(max)
  return Math.round(14 + Math.min(1, Math.max(0, t)) * 16)
}

/** Cloud entries: by linking sites, filtered by the search text and the chosen type (or "spam"), cut to `limit`. */
export function buildCloud(rows, { query = "", type = null, limit = 14 } = {}) {
  const q = query.trim().toLowerCase()
  const matches = (rows ?? [])
    .filter((r) => (type === "spam" ? isSpamRow(r) : type ? r.type === type : true))
    .filter((r) => !q || (r.anchor ?? EMPTY_ANCHOR_LABEL).toLowerCase().includes(q))
    .sort((a, b) => (b.referringDomains ?? -1) - (a.referringDomains ?? -1))
  const max = matches[0]?.referringDomains ?? 1
  return { total: matches.length, items: matches.slice(0, limit).map((r) => ({ row: r, size: cloudSize(r.referringDomains, max), spam: isSpamRow(r) })) }
}

/** The detail panel's verdict box for one anchor: { tone, title, text, action }. */
export function anchorVerdict(row) {
  if (isSpamRow(row)) {
    return { tone: "bad", title: "Spam: disavow", text: "Real sites rarely link with words like this. These links usually come from paid or spam networks. Add the sites to your disavow file so Google ignores them.", action: "disavow" }
  }
  switch (row?.type) {
    case "branded": return { tone: "good", title: "Good: brand link", text: "Links with your brand name are the most natural kind. More of these is always welcome.", action: "backlinks" }
    case "naked_url": return { tone: "neutral", title: "Normal: web address", text: "Linking with a plain web address is common and natural, as long as it is not most of your profile.", action: "backlinks" }
    case "exact": return { tone: "warn", title: "Watch: exact keyword", text: "A few exact-keyword anchors help; too many look manipulative. Keep them a small share of your links.", action: "backlinks" }
    case "partial": return { tone: "good", title: "Good: describes your page", text: "Phrases that include a keyword describe the page naturally and pass relevance.", action: "backlinks" }
    case "generic": return { tone: "neutral", title: "Fine in small numbers", text: "Words like “click here” say nothing about your page. Harmless, but they add little.", action: "backlinks" }
    case "empty": return { tone: "neutral", title: "Image link", text: "The image's alt text acts as the anchor. Empty alt text passes little meaning.", action: "backlinks" }
    default: return { tone: "neutral", title: "Normal phrase", text: "A descriptive phrase about your site. Natural profiles have many of these.", action: "backlinks" }
  }
}

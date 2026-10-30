import { ANCHOR_HEALTH, EMPTY_ANCHOR_LABEL, TYPE_KEYS } from "./anchorConfig"
import { createClassifier } from "./classifyAnchor"

/**
 * summariseAnchorProfile: the numbers behind the summary cards, the distribution donut and the health checks. PURE — it classifies the
 * rows itself, so a change of brand terms or target keywords is a recalculation of this function, never a request.
 *
 * Shares are of REFERRING DOMAINS (or of backlinks, where it says so):
 *  - a type's share = the referring domains of its anchors ÷ the referring domains of all anchors. These add up to 100%.
 *    (A site that links with two different anchors counts under both, so this is a share of anchor–domain pairs.)
 *  - one anchor's share = its referring domains ÷ `totalReferringDomains` (the profile's distinct referring domains, when the caller
 *    knows them) — "how many of all my linking sites use this anchor". Without it, the sum above is used.
 *
 * @param {Array<{ anchor: string|null, referringDomains: number|null, backlinks: number|null, spamScore?: number|null }>} rows
 * @param {{ brandTerms?: string[], targetKeywords?: string[] }} settings
 * @param {{ targetDomain?: string, totalReferringDomains?: number|null }} [options]
 */
export function summariseAnchorProfile(rows, settings, { targetDomain = "", totalReferringDomains = null } = {}) {
  const classify = createClassifier(settings, targetDomain)
  const types = Object.fromEntries(TYPE_KEYS.map((key) => [key, { key, anchors: 0, backlinks: 0, referringDomains: 0, percentByReferringDomains: null, percentByBacklinks: null }]))
  const totals = { anchors: 0, backlinks: 0, referringDomains: 0 }
  const classified = []
  for (const row of rows ?? []) {
    const type = classify(row.anchor)
    const rd = Number.isFinite(row.referringDomains) ? row.referringDomains : 0
    const bl = Number.isFinite(row.backlinks) ? row.backlinks : 0
    types[type].anchors += 1
    types[type].backlinks += bl
    types[type].referringDomains += rd
    totals.anchors += 1
    totals.backlinks += bl
    totals.referringDomains += rd
    classified.push({ row, type, rd, bl })
  }
  for (const t of Object.values(types)) {
    t.percentByReferringDomains = totals.referringDomains > 0 ? (t.referringDomains / totals.referringDomains) * 100 : null
    t.percentByBacklinks = totals.backlinks > 0 ? (t.backlinks / totals.backlinks) * 100 : null
  }

  const denominator = Number.isFinite(totalReferringDomains) && totalReferringDomains > 0 ? totalReferringDomains : totals.referringDomains
  const shareOf = (rd) => (denominator > 0 ? Math.min(100, (rd / denominator) * 100) : null)

  let top = null
  for (const c of classified) if (!top || c.rd > top.rd || (c.rd === top.rd && c.bl > top.bl)) top = c
  const topAnchor = top && top.rd > 0 ? { anchor: top.row.anchor, label: top.row.anchor ?? EMPTY_ANCHOR_LABEL, type: top.type, referringDomains: top.rd, percent: shareOf(top.rd) } : null

  return { types, totals, denominator, topAnchor, classified: classified.map((c) => ({ ...c, share: shareOf(c.rd) })) }
}

const quote = (anchor) => `“${anchor.length > 60 ? `${anchor.slice(0, 59)}…` : anchor}”`

/**
 * The profile-health checks, in the order they are listed. Only the ones that fire are returned; with none firing the list is one green
 * "looks natural" line. Thresholds come from ANCHOR_HEALTH. `summary` is the result of summariseAnchorProfile.
 * @returns {Array<{ id: string, status: "ok"|"warn"|"bad", message: string, anchors?: string[] }>}
 */
export function evaluateAnchorHealth(summary, thresholds = ANCHOR_HEALTH) {
  const checks = []
  if (!summary || summary.totals.anchors === 0) return checks
  const { types, totals, classified } = summary

  const exact = types.exact.percentByReferringDomains
  if (exact !== null && exact > thresholds.exactMaxPercent) {
    checks.push({ id: "exact", status: "warn", message: "High share of exact-match anchors can look manipulative." })
  }

  const brandedAndNaked = (types.branded.percentByReferringDomains ?? 0) + (types.naked_url.percentByReferringDomains ?? 0)
  if (totals.referringDomains > 0 && brandedAndNaked < thresholds.brandedPlusNakedMinPercent) {
    checks.push({ id: "brand", status: "warn", message: "Few branded anchors — natural profiles are usually brand-heavy." })
  }

  const repeated = classified
    .filter((c) => c.type !== "branded" && c.type !== "empty" && c.row.anchor && c.share !== null && c.share > thresholds.repeatedAnchorMaxPercent)
    .sort((a, b) => b.share - a.share)
  if (repeated.length) {
    const more = repeated.length > 1 ? ` (+${repeated.length - 1} more)` : ""
    checks.push({ id: "repeated", status: "warn", message: `${quote(repeated[0].row.anchor)} is heavily repeated${more}.`, anchors: repeated.map((c) => c.row.anchor) })
  }

  const spamBacklinks = classified.filter((c) => Number.isFinite(c.row.spamScore) && c.row.spamScore > thresholds.spam.score).reduce((s, c) => s + c.bl, 0)
  if (totals.backlinks > 0 && (spamBacklinks / totals.backlinks) * 100 > thresholds.spam.maxBacklinksPercent) {
    checks.push({ id: "spam", status: "bad", message: "Spammy anchors detected." })
  }

  const sitewide = classified.filter((c) => c.row.referringDomains === thresholds.sitewide.maxReferringDomains && c.bl >= thresholds.sitewide.minBacklinks)
  if (sitewide.length) {
    checks.push({ id: "sitewide", status: "warn", message: `${sitewide.length} anchor${sitewide.length === 1 ? " comes" : "s come"} from a single site with many links (sitewide/footer links).`, anchors: sitewide.map((c) => c.row.anchor ?? EMPTY_ANCHOR_LABEL) })
  }

  return checks.length ? checks : [{ id: "natural", status: "ok", message: "Anchor profile looks natural." }]
}

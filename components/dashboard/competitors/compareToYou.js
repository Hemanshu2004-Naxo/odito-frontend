/**
 * Pure rules for "how does each competitor you added compare with YOU". No I/O. Every number comes from data the page already holds:
 * the competitor's saved enrichment and your own Domain Overview numbers. A number that is not known is `null` and is never compared:
 * an unknown is not a zero, so it can never make a competitor look ahead or behind.
 */

/** The metrics compared, in the order they are shown. For all of them MORE is better. */
export const COMPARE_METRICS = Object.freeze([
  { key: "organicTraffic", short: "Traffic", label: "Organic traffic", unit: "visits / month" },
  { key: "rankingKeywords", short: "Keywords", label: "Ranking keywords", unit: "keywords" },
  { key: "pos1", short: "#1 rankings", label: "#1 rankings", unit: "keywords" },
  { key: "referringDomains", short: "Links", label: "Referring domains", unit: "websites linking" },
])

const isNum = (v) => typeof v === "number" && Number.isFinite(v)

/**
 * One metric: you vs them.
 * `lead` is who is ahead: "them" (the competitor beats you), "you", "level", or "unknown" (either side is not known).
 * `ratio` is how many times larger the leader is (null when it cannot be said, e.g. the other side is 0); `diff` is the absolute gap.
 */
export function compareMetric(you, them) {
  if (!isNum(you) || !isNum(them)) return { lead: "unknown", ratio: null, diff: null, you: isNum(you) ? you : null, them: isNum(them) ? them : null }
  if (you === them) return { lead: "level", ratio: 1, diff: 0, you, them }
  const themLeads = them > you
  const big = Math.max(you, them); const small = Math.min(you, them)
  return { lead: themLeads ? "them" : "you", ratio: small > 0 ? big / small : null, diff: big - small, you, them }
}

/**
 * The verdict for one competitor, from its saved metrics ({ organicTraffic, rankingKeywords, pos1, referringDomains }) and yours.
 * `verdict`: "ahead" (they lead you on more of the known metrics), "behind" (you lead on more), "level" (equal), "unknown" (nothing comparable).
 * `themLeads` / `youLead` / `known` count the metrics. Organic traffic decides a tie, because it is the figure that matters most.
 */
export function compareToYou(yours, theirs) {
  const rows = COMPARE_METRICS.map((m) => ({ ...m, ...compareMetric(yours?.[m.key], theirs?.[m.key]) }))
  const known = rows.filter((r) => r.lead !== "unknown")
  const themLeads = known.filter((r) => r.lead === "them").length
  const youLead = known.filter((r) => r.lead === "you").length
  let verdict = "unknown"
  if (known.length > 0) {
    if (themLeads > youLead) verdict = "ahead"
    else if (youLead > themLeads) verdict = "behind"
    else {
      const traffic = rows[0]
      verdict = traffic.lead === "them" ? "ahead" : traffic.lead === "you" ? "behind" : "level"
    }
  }
  return { verdict, rows, themLeads, youLead, known: known.length }
}

/** "8.9x" / "1.3x" / "12x": how many times larger. Null when it cannot be said. */
export function formatRatio(ratio) {
  if (!isNum(ratio)) return null
  if (ratio >= 100) return `${Math.round(ratio)}x`
  if (ratio >= 10) return `${ratio.toFixed(0)}x`
  return `${ratio.toFixed(1).replace(/\.0$/, "")}x`
}

/** Sorting key: the competitors that are furthest ahead of you first, unknowns last. */
export function leadScore(result) {
  if (!result || result.verdict === "unknown") return -Infinity
  // Whole numbers: how many metrics they lead on minus how many you lead on. Fractions only break ties: who leads on traffic, then by how much.
  const traffic = result.rows[0]
  const gap = isNum(traffic.ratio) ? Math.min(0.4, Math.log10(Math.max(1, traffic.ratio)) / 10) : 0.4
  const tie = traffic.lead === "them" ? 0.5 + gap / 2 : traffic.lead === "you" ? -(0.5 + gap / 2) : 0
  return result.themLeads - result.youLead + tie
}

export function sortByLead(items, resultOf) {
  return [...items].sort((a, b) => leadScore(resultOf(b)) - leadScore(resultOf(a)))
}

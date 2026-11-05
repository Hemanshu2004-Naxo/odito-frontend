import { isNum, sumKnown } from "@/lib/seoMetrics"
import { formatCompact, formatExact } from "../domain-overview/format"

/**
 * PURE helpers behind the redesigned Traffic page: the four metrics the cards switch between, the ranking groups of the "where keywords
 * ranked" bars, and the plain-language notes (the story box, the note under each chart, which table rows are big falls). Every sentence is
 * built from the months on screen; when a figure is missing the sentence leaves that part out rather than guess.
 */

/** The metrics the summary cards switch the main chart between. `color` is the card's accent and the chart's series colour. */
export const METRICS = Object.freeze([
  { key: "traffic", label: "Organic traffic", chartTitle: "Estimated organic traffic per month", short: "Traffic", color: "#059669", money: false },
  { key: "keywords", label: "Organic keywords", chartTitle: "Ranking keywords per month", short: "Keywords", color: "#6366f1", money: false },
  { key: "value", label: "Traffic value", chartTitle: "Estimated traffic value per month", short: "Traffic value", color: "#8b5cf6", money: true },
  { key: "top10", label: "Top 10 keywords", chartTitle: "Top 10 keywords per month", short: "Top 10 keywords", color: "#0d9488", money: false },
])
export const metricOf = (key) => METRICS.find((m) => m.key === key) ?? METRICS[0]

/** "Where keywords ranked": four groups instead of six buckets, page 1 split into the top 3 and 4–10. Stacked bottom -> top. */
export const RANK_GROUPS = Object.freeze([
  { key: "g3", label: "Top 3", buckets: ["top1", "top3"], color: "#059669" },
  { key: "g10", label: "4–10", buckets: ["top10"], color: "#22b8cf" },
  { key: "g20", label: "11–20", buckets: ["top20"], color: "#6c7ff2" },
  { key: "g100", label: "21–100", buckets: ["top50", "top100"], color: "var(--muted-foreground)", opacity: 0.22 },
])

/** Movement colours of the reference: dark / light green above the line, crimson / pink below it. */
export const MOVEMENT_SERIES = Object.freeze([
  { key: "new", label: "New", color: "#0f8a5f" },
  { key: "up", label: "Improved", color: "#34d399" },
  { key: "down", label: "Declined", color: "#be123c" },
  { key: "lost", label: "Lost", color: "#f4a3b4" },
])

/** A month's count in one ranking group (null when none of its buckets is known). */
export const groupCount = (row, group) => sumKnown(group.buckets.map((b) => row.buckets?.[b] ?? null))

/** One datum per month for the stacked "where keywords ranked" bars. A month with no bucket data is a gap. */
export function buildRankGroups(range) {
  return (range ?? []).map((r) => {
    const d = { key: r.key, label: r.label, shortLabel: shortMonth(r), longLabel: r.longLabel }
    for (const g of RANK_GROUPS) d[g.key] = r.bucketTotal === null ? null : (groupCount(r, g) ?? 0)
    return d
  })
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
/** "Oct" — the small x-axis label of the two lower charts. */
export const shortMonth = (r) => MONTHS[(r?.month ?? 1) - 1]
const longMonth = (r, withYear) => `${LONG[r.month - 1]}${withYear ? ` ${r.year}` : ""}`

/** Rows whose traffic fell at least this much from the month before are tinted in the table. */
export const BIG_FALL_PERCENT = -20
export const isBigFall = (row) => isNum(row?.mom?.traffic?.percent) && row.mom.traffic.percent <= BIG_FALL_PERCENT

const pct0 = (v) => `${Math.round(Math.abs(v))}%`
const MINUS = "−"

/** "Nov–Dec 2025" / "Mar 2026" / "Dec 2025–Jan 2026": the run of months around the peak that sit within 3% of it. */
function peakSpan(range, peakIndex) {
  const peak = range[peakIndex].traffic
  const near = (r) => isNum(r?.traffic) && r.traffic >= peak * 0.97
  let a = peakIndex
  let b = peakIndex
  while (a > 0 && near(range[a - 1]) && range[a - 1].index === range[a].index - 1) a -= 1
  while (b < range.length - 1 && near(range[b + 1]) && range[b + 1].index === range[b].index + 1) b += 1
  const first = range[a]
  const last = range[b]
  if (a === b) return `${MONTHS[first.month - 1]} ${first.year}`
  if (first.year === last.year) return `${MONTHS[first.month - 1]}–${MONTHS[last.month - 1]} ${last.year}`
  return `${MONTHS[first.month - 1]} ${first.year}–${MONTHS[last.month - 1]} ${last.year}`
}

/**
 * The story box: where traffic peaked and how far it is from there now, the big falls (and whether page-1 keywords slipped in those
 * months), and how the top-10 count moved. Returned as parts so the key figures can be bold: [{ text, strong? }]. Null with too little data.
 */
export function buildTrafficStory(range) {
  const rows = (range ?? []).filter((r) => isNum(r.traffic))
  if (rows.length < 2) return null
  const parts = []
  const add = (text, strong = false) => parts.push({ text, strong })

  const peakIndex = range.reduce((best, r, i) => (isNum(r.traffic) && (best === -1 || r.traffic > range[best].traffic) ? i : best), -1)
  const peak = range[peakIndex]
  const latest = rows[rows.length - 1]
  const span = peakSpan(range, peakIndex)
  if (latest.key === peak.key) {
    add("Traffic is at its highest in this range: ")
    add(`${formatCompact(peak.traffic)} a month in ${span}`, true)
    add(".")
  } else {
    const down = peak.traffic > 0 ? (1 - latest.traffic / peak.traffic) * 100 : null
    add("Traffic peaked at ")
    add(`${formatCompact(peak.traffic)} a month in ${span}`, true)
    if (down === null || down < 5) add(" and is close to that level now.")
    else add(` and has dropped ${pct0(down)} since.`)
  }

  const withYear = range.length > 13
  const falls = range.filter(isBigFall).sort((a, b) => a.mom.traffic.percent - b.mom.traffic.percent).slice(0, 2).sort((a, b) => a.index - b.index)
  if (falls.length) {
    const slipped = falls.every((r) => isNum(r.mom.top10?.percent) && r.mom.top10.percent < 0)
    add(falls.length === 2 ? " Two big falls: " : " The biggest fall: ")
    falls.forEach((r, i) => {
      if (i) add(" and ")
      add(`${longMonth(r, withYear)} (${MINUS}${pct0(r.mom.traffic.percent)})`, true)
    })
    add(slipped ? `, ${falls.length === 2 ? "both " : ""}when page-1 keywords slipped.` : ".")
  }

  const t10 = range.filter((r) => isNum(r.top10))
  if (t10.length >= 2) {
    const a = t10[0].top10
    const b = t10[t10.length - 1].top10
    if (b < a) {
      add(` Top-10 keywords went from ${formatExact(a)} to ${formatExact(b)}`)
      add(latest.traffic < (rows[0].traffic ?? 0) ? ", so getting those back is the fastest way to recover traffic." : ".")
    } else if (b > a) add(` Top-10 keywords grew from ${formatExact(a)} to ${formatExact(b)}.`)
  }
  return parts
}

/** Under the ranking bars: which group changed most in number, and what happened to page 1 (top 3 + 4–10). */
export function describeRankGroups(range) {
  const rows = (range ?? []).filter((r) => r.bucketTotal !== null)
  if (rows.length < 2) return null
  const first = rows[0]
  const last = rows[rows.length - 1]
  const deltas = RANK_GROUPS.map((g) => ({ g, d: (groupCount(last, g) ?? 0) - (groupCount(first, g) ?? 0) }))
  const biggest = deltas.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a))
  if (biggest.d === 0) return "The mix of positions barely changed over this range."
  const name = biggest.g.key === "g3" ? "the top 3" : `positions ${biggest.g.label}`
  const head = `Keywords in ${name} ${biggest.d < 0 ? "shrank" : "grew"} most in number`
  const p1 = (r) => (groupCount(r, RANK_GROUPS[0]) ?? 0) + (groupCount(r, RANK_GROUPS[1]) ?? 0)
  const a = p1(first)
  const b = p1(last)
  if (b < a && biggest.g.key !== "g3" && biggest.g.key !== "g10") return `${head}, but page-1 keywords (green and aqua) fell from ${formatExact(a)} to ${formatExact(b)}, and those bring most of the traffic.`
  if (b > a) return `${head}, and page-1 keywords (green and aqua) grew from ${formatExact(a)} to ${formatExact(b)}.`
  return `${head}.`
}

/** Under the movement bars: "In 10 of 12 months, more keywords dropped (declined + lost) than gained." */
export function describeMovement(range) {
  const rows = (range ?? []).filter((r) => [r.movement.new, r.movement.up, r.movement.down, r.movement.lost].every(isNum))
  if (!rows.length) return null
  const dropped = rows.filter((r) => r.movement.down + r.movement.lost > r.movement.new + r.movement.up).length
  const gained = rows.filter((r) => r.movement.new + r.movement.up > r.movement.down + r.movement.lost).length
  if (dropped >= gained) return `In ${dropped} of ${rows.length} months, more keywords dropped (declined + lost) than gained.`
  return `In ${gained} of ${rows.length} months, more keywords were gained (new + improved) than dropped.`
}

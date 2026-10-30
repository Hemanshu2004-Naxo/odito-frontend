import { isNum, bucketValues, sumKnown, top10Count, percentChange, changeDirection, monthIndex, POSITION_BUCKETS } from "@/lib/seoMetrics"
import { formatMonthLabel } from "../domain-overview/format"

/**
 * THE one place that turns the history response into what the page shows. It sorts the months ONCE (the provider sends newest
 * first), computes every month-over-month change and bucket total, slices the selected range, and derives the summary cards.
 * Components receive this and never read a raw API path. Anything the provider did not send is null — never 0.
 *
 * @param {import("./types").HistoryEnvelope|null|undefined} envelope  `data` of the history response
 * @param {{ months?: number }} [opts]  the selected range (6 | 12 | 24); the response may cover more (it is sliced, not refetched)
 * @returns {import("./types").TrafficHistoryViewModel}
 */

export const RANGE_OPTIONS = Object.freeze([6, 12, 24])
export const DEFAULT_RANGE = 12

const longMonth = (year, month) => new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

const mom = (current, previous) => {
  const percent = percentChange(current, previous)
  return { percent, direction: changeDirection(percent) }
}

/** One month, with its buckets and (if the previous calendar month is present) its changes. */
function toRow(item, previous) {
  const bucketList = bucketValues(item)
  const traffic = item.etv ?? null
  const keywords = item.count ?? null
  const value = item.estimated_paid_traffic_cost ?? null
  const top10 = top10Count(item)
  return {
    key: `${item.year}-${String(item.month).padStart(2, "0")}`,
    year: item.year,
    month: item.month,
    index: monthIndex(item.year, item.month),
    label: formatMonthLabel(item.year, item.month),
    longLabel: longMonth(item.year, item.month),
    traffic,
    keywords,
    value,
    top10,
    bucketList,
    buckets: Object.fromEntries(bucketList.map((b) => [b.key, b.value])),
    bucketTotal: sumKnown(bucketList.map((b) => b.value)),
    paidTraffic: item.paid?.etv ?? null,
    paidKeywords: item.paid?.count ?? null,
    paidValue: item.paid?.estimated_paid_traffic_cost ?? null,
    movement: { new: item.is_new ?? null, up: item.is_up ?? null, down: item.is_down ?? null, lost: item.is_lost ?? null },
    // A change needs the month right before it; a gap in the series gives no change rather than a change over two months.
    mom: previous
      ? { traffic: mom(traffic, previous.traffic), keywords: mom(keywords, previous.keywords), value: mom(value, previous.value), top10: mom(top10, previous.top10) }
      : { traffic: mom(null, null), keywords: mom(null, null), value: mom(null, null), top10: mom(null, null) },
  }
}

/** The highest known value of a metric in the range, and the month it happened in. */
function peakOf(rows, key) {
  let best = null
  for (const r of rows) if (isNum(r[key]) && (best === null || r[key] > best[key])) best = r
  return best ? { value: best[key], label: best.label } : { value: null, label: null }
}

/** The latest month vs the FIRST month of the range, plus the range's peak. */
function summaryMetric(rows, key) {
  const first = rows[0]
  const last = rows[rows.length - 1]
  const percent = first && last ? percentChange(last[key], first[key]) : null
  return {
    latest: last ? last[key] : null,
    change: { percent, direction: changeDirection(percent), basis: first ? `vs ${first.label}` : null },
    peak: peakOf(rows, key),
  }
}

export function mapTrafficHistory(envelope, { months = DEFAULT_RANGE } = {}) {
  // Sort once, oldest -> newest. If the provider ever repeats a month, the later entry wins.
  const byMonth = new Map()
  for (const item of envelope?.result?.items ?? []) byMonth.set(monthIndex(item.year, item.month), item)
  const sorted = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([, item]) => item)

  const all = []
  sorted.forEach((item, i) => {
    const prevItem = sorted[i - 1]
    const adjacent = prevItem && monthIndex(prevItem.year, prevItem.month) === monthIndex(item.year, item.month) - 1
    all.push(toRow(item, adjacent ? all[i - 1] : null))
  })

  // "The last N months" = the latest month and the N before it (12 -> 13 monthly points: Oct 25 … Oct 26).
  const latest = all[all.length - 1]
  const range = latest ? all.filter((r) => r.index >= latest.index - months) : []

  const drops = range.filter((r) => isNum(r.mom.traffic.percent) && r.mom.traffic.percent < 0)
  const worst = drops.reduce((w, r) => (w === null || r.mom.traffic.percent < w.mom.traffic.percent ? r : w), null)

  return {
    range,
    tableRows: [...range].reverse(),
    hasEnoughHistory: range.length >= 2,
    // Paid is hidden entirely unless some month in the range actually has paid traffic.
    hasPaid: range.some((r) => isNum(r.paidTraffic) && r.paidTraffic > 0),
    summary: {
      traffic: summaryMetric(range, "traffic"),
      keywords: summaryMetric(range, "keywords"),
      value: summaryMetric(range, "value"),
      top10: summaryMetric(range, "top10"),
    },
    biggestDrop: worst ? { key: worst.key, label: worst.label, percent: worst.mom.traffic.percent } : null,
    availableMonths: range.length,
  }
}

// ── chart helpers (pure, so the toggles are testable without a browser) ────────────────────────────────────────────────

/** Bucket keys shown by the distribution chart, in stacking order (#1 at the bottom). "Top 20 only" drops #21–50 and #51–100. */
export function distributionBuckets(top20Only) {
  return POSITION_BUCKETS.filter((b) => !top20Only || ["top1", "top3", "top10", "top20"].includes(b.key))
}

/**
 * One datum per month for the stacked distribution chart. `percent` = each bucket's share of THAT MONTH'S TOTAL across all six
 * buckets (so "Top 20 only" shows true shares of the whole, not a re-scaled 100%). A month with no bucket data is a gap (nulls).
 */
export function buildDistribution(range, { percent = false, top20Only = false } = {}) {
  const buckets = distributionBuckets(top20Only)
  return range.map((r) => {
    const datum = { key: r.key, label: r.label, longLabel: r.longLabel, total: r.bucketTotal }
    for (const b of buckets) {
      const count = r.buckets[b.key]
      // No bucket data at all that month = a gap; a single missing bucket among known ones counts as none ranking there.
      datum[b.key] = r.bucketTotal === null
        ? null
        : percent ? (r.bucketTotal > 0 ? ((count ?? 0) / r.bucketTotal) * 100 : null) : (count ?? 0)
      datum[`${b.key}__count`] = count
    }
    return datum
  })
}

/**
 * New / Improved above zero, Declined / Lost below it (negative), for the diverging movement chart. The positive originals stay
 * available for the tooltip.
 */
export function buildMovement(range) {
  return range.map((r) => ({
    key: r.key, label: r.label, longLabel: r.longLabel,
    new: r.movement.new, up: r.movement.up,
    down: isNum(r.movement.down) ? -r.movement.down : null,
    lost: isNum(r.movement.lost) ? -r.movement.lost : null,
  }))
}

// ── table sorting ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Column key -> how to read it from a MonthRow. */
export const SORT_ACCESSORS = {
  month: (r) => r.index,
  traffic: (r) => r.traffic,
  trafficChange: (r) => r.mom.traffic.percent,
  keywords: (r) => r.keywords,
  keywordsChange: (r) => r.mom.keywords.percent,
  value: (r) => r.value,
  top1: (r) => r.buckets.top1,
  top3: (r) => r.buckets.top3,
  top10: (r) => r.buckets.top10,
  top20: (r) => r.buckets.top20,
  new: (r) => r.movement.new,
  up: (r) => r.movement.up,
  down: (r) => r.movement.down,
  lost: (r) => r.movement.lost,
}

/** Sorted copy of the rows. Unknown values (null) go last in BOTH directions, so a gap never looks like the biggest or smallest. */
export function sortRows(rows, key, direction = "desc") {
  const read = SORT_ACCESSORS[key] ?? SORT_ACCESSORS.month
  const sign = direction === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = read(a)
    const y = read(b)
    const xn = !isNum(x)
    const yn = !isNum(y)
    if (xn || yn) return xn === yn ? b.index - a.index : xn ? 1 : -1
    return x === y ? b.index - a.index : (x - y) * sign
  })
}

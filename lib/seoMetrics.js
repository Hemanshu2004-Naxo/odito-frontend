/**
 * SEO-metric helpers shared by the Domain Overview and Traffic History pages, so the two can never disagree about what a
 * "position bucket" is or how a percentage change is rounded. Pure: no React, no formatting (display formatting lives with the page).
 */

export const isNum = (v) => typeof v === "number" && Number.isFinite(v)

/** Sum of the figures that exist; null when none do (so "no data" is never shown as a zero). */
export function sumKnown(values) {
  const known = values.filter(isNum)
  return known.length ? known.reduce((a, b) => a + b, 0) : null
}

/**
 * The six ranking buckets, in rank order, and the DataForSEO fields each one adds up.
 * The one grouping every chart, card and table uses.
 */
export const POSITION_BUCKETS = Object.freeze([
  { key: "top1", label: "#1", fields: ["pos_1"] },
  { key: "top3", label: "#2–3", fields: ["pos_2_3"] },
  { key: "top10", label: "#4–10", fields: ["pos_4_10"] },
  { key: "top20", label: "#11–20", fields: ["pos_11_20"] },
  { key: "top50", label: "#21–50", fields: ["pos_21_30", "pos_31_40", "pos_41_50"] },
  { key: "top100", label: "#51–100", fields: ["pos_51_60", "pos_61_70", "pos_71_80", "pos_81_90", "pos_91_100"] },
])

/** Keywords per bucket for one month's organic metrics: [{ key, label, value }]. A bucket with no data is null, not 0. */
export function bucketValues(metrics) {
  return POSITION_BUCKETS.map((b) => ({ key: b.key, label: b.label, value: metrics ? sumKnown(b.fields.map((f) => metrics[f])) : null }))
}

/** Keywords ranking in the top 10: #1 + #2–3 + #4–10. */
export function top10Count(metrics) {
  return metrics ? sumKnown([metrics.pos_1, metrics.pos_2_3, metrics.pos_4_10]) : null
}

/**
 * (current − previous) / previous × 100, one decimal. null when either figure is unknown or the previous is 0
 * (a change from nothing has no percentage).
 */
export function percentChange(current, previous) {
  if (!isNum(current) || !isNum(previous) || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** 'up' | 'down' | 'flat' for a percentage from percentChange(); null when unknown. */
export function changeDirection(percent) {
  if (!isNum(percent)) return null
  return percent > 0 ? "up" : percent < 0 ? "down" : "flat"
}

/** A comparable number for a calendar month (2026, 10 -> 24316): months can be subtracted, gaps in a series can be detected. */
export const monthIndex = (year, month) => year * 12 + (month - 1)

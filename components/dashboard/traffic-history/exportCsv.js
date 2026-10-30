import { csvCell } from "../referring-domains/exportCsv"

/**
 * CSV of the monthly table for the selected range, in the order and with the sort the table currently shows. Plain numbers (not
 * "100.4K"): the exact figures, so the file is usable in a spreadsheet. Missing stays an empty cell, never 0. Changes are percentages
 * (one decimal) versus the previous calendar month; the first month of the data has none.
 */

const round = (v, digits = 0) => (typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(digits)) : null)

export const CSV_COLUMNS = [
  ["Month", (r) => r.key],
  ["Est. traffic", (r) => round(r.traffic)],
  ["Traffic change %", (r) => r.mom.traffic.percent],
  ["Keywords", (r) => r.keywords],
  ["Keywords change %", (r) => r.mom.keywords.percent],
  ["Traffic value (USD)", (r) => round(r.value, 2)],
  ["#1", (r) => r.buckets.top1],
  ["#2–3", (r) => r.buckets.top3],
  ["#4–10", (r) => r.buckets.top10],
  ["#11–20", (r) => r.buckets.top20],
  ["New", (r) => r.movement.new],
  ["Up", (r) => r.movement.up],
  ["Down", (r) => r.movement.down],
  ["Lost", (r) => r.movement.lost],
]

export function buildTrafficHistoryCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const r of rows || []) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(","))
  return lines.join("\r\n")
}

export function trafficHistoryCsvFileName(domain, months) {
  const safe = String(domain || "domain").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80)
  return `traffic-history_${safe}_${months}-months.csv`
}

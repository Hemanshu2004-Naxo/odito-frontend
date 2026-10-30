import { csvCell, downloadCsv } from "../referring-domains/exportCsv"

export { downloadCsv }

/**
 * CSV of the competitors on screen (the current page). Built in the browser from rows already loaded: it makes no request. A missing
 * value is an empty cell, never 0. Provider text is formula-guarded by csvCell.
 */

const whole = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null)
const one = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

/** [header, value(row, ctx)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["Domain", (r) => r.domain],
  ["Tracked", (r, ctx) => (ctx.tracked.has(r.domain) ? "yes" : "no")],
  ["Shared keywords", (r) => whole(r.sharedKeywords)],
  ["Shared keywords (% of your keywords)", (r) => one(r.sharedShare)],
  ["Their avg. position", (r) => one(r.avgPosition)],
  ["Their total keywords", (r) => whole(r.theirTotalKeywords)],
  ["Their total traffic", (r) => whole(r.theirTotalTraffic)],
  ["Their traffic value (USD)", (r) => whole(r.theirTrafficValue)],
  ["Your traffic on shared keywords", (r) => whole(r.ourSharedTraffic)],
  ["Their traffic on shared keywords", (r) => whole(r.theirSharedTraffic)],
  ["Your #1 rankings", (r) => whole(r.ourTop1)],
  ["Their #1 rankings", (r) => whole(r.theirTop1)],
  ["Your #2-3 rankings", (r) => whole(r.ourTop2to3)],
  ["Their #2-3 rankings", (r) => whole(r.theirTop2to3)],
  ["Your #4-10 rankings", (r) => whole(r.ourTop4to10)],
  ["Their #4-10 rankings", (r) => whole(r.theirTop4to10)],
])

/** @param {import("./types").CompetitorRow[]} rows @param {{ tracked?: Set<string> }} [ctx] */
export function buildCompetitorsCsv(rows, { tracked = new Set() } = {}) {
  const ctx = { tracked }
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const r of rows || []) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r, ctx))).join(","))
  return lines.join("\r\n")
}

/** competitors_asgeyehospital.com_2026-10-27.csv */
export function competitorsCsvFileName(domain, now = new Date()) {
  const safe = String(domain || "domain").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80)
  return `competitors_${safe}_${now.toISOString().slice(0, 10)}.csv`
}

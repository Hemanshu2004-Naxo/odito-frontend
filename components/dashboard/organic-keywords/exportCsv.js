import { csvCell, downloadCsv } from "../referring-domains/exportCsv"

export { downloadCsv }

/**
 * CSV of the keywords on screen (current page) or of the one "export all" response. Built in the browser from rows already loaded
 * (the page export makes no request). A missing value is an empty cell, never 0. Provider text is formula-guarded by csvCell.
 */

const whole = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null)
const money = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)

/** [header, value(row)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["Keyword", (r) => r.keyword],
  ["Position", (r) => r.position],
  // The provider reports the previous rank as an ABSOLUTE rank (counting every element on the results page), unlike Position.
  ["Previous position (absolute)", (r) => r.previousPosition],
  ["Volume", (r) => r.volume],
  ["KD", (r) => r.difficulty],
  ["CPC (USD)", (r) => money(r.cpc)],
  ["Intent", (r) => r.intent?.label ?? null],
  ["Traffic", (r) => whole(r.traffic)],
  ["Traffic value (USD)", (r) => whole(r.trafficValue)],
  ["URL", (r) => r.url],
  ["SERP features", (r) => (r.serpFeatures.length ? r.serpFeatures.map((f) => f.label).join("; ") : null)],
])

/** @param {import("./types").KeywordRow[]} rows */
export function buildKeywordsCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const r of rows || []) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(","))
  return lines.join("\r\n")
}

/** organic-keywords_asgeyehospital.com_page_2026-10-27.csv */
export function keywordsCsvFileName(domain, scope, now = new Date()) {
  const safe = String(domain || "domain").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80)
  return `organic-keywords_${safe}_${scope}_${now.toISOString().slice(0, 10)}.csv`
}

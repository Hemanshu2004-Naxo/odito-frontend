import { csvCell, downloadCsv } from "../referring-domains/exportCsv"
import { EXPORT } from "./constants"

export { downloadCsv }

/**
 * "Export current page": a CSV of the rows already on screen, built in the browser — no request. It has EXACTLY the columns (and header)
 * of the server's "Export with current filters" (odito_backend/.../csv/backlinksCsv.js), so the two files are interchangeable. A missing
 * value is an empty cell, never 0; provider text is formula-guarded by csvCell.
 */

const yn = (v) => (v === true ? "yes" : v === false ? "no" : null)

/** [header, value(row)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["Source URL", (r) => r.sourceUrl],
  ["Source title", (r) => r.sourceTitle],
  ["Source domain", (r) => r.sourceDomain],
  ["Domain rank", (r) => r.domainRank],
  ["Page rank", (r) => r.pageRank],
  ["Anchor", (r) => r.anchor ?? r.imageAlt],
  ["Item type", (r) => r.itemType],
  ["Target URL", (r) => r.targetUrl],
  ["Target status", (r) => r.targetStatus],
  ["Redirect target", (r) => r.targetRedirect],
  ["Dofollow", (r) => yn(r.isDofollow)],
  ["Attributes", (r) => (r.attributes.length ? r.attributes.join("; ") : null)],
  ["Placement", (r) => r.placementKey],
  ["Spam score", (r) => r.spamScore],
  ["Country", (r) => r.sourceCountryCode],
  ["First seen", (r) => r.firstSeen.raw],
  ["Last seen", (r) => r.lastSeen.raw],
  ["New", (r) => yn(r.isNew)],
  ["Lost", (r) => yn(r.isLost)],
  ["Broken", (r) => yn(r.isBroken)],
])

/** @param {import("./types").BacklinkRow[]} rows */
export function buildBacklinksCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const r of rows || []) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(r))).join(","))
  return lines.join("\r\n")
}

/** backlinks_asgeyehospital.com_broken_page_2026-10-27.csv */
export function backlinksCsvFileName(domain, tab, scope, now = new Date()) {
  const safe = String(domain || "domain").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 80)
  return `backlinks_${safe}_${tab}_${scope}_${now.toISOString().slice(0, 10)}.csv`
}

/**
 * What the server export will fetch and what it will roughly cost, for the confirmation BEFORE it starts. Rows are capped; each call
 * returns up to one batch. The rates are an estimate (EXPORT.cost) — the provider's invoice is the truth.
 * @param {number|null} total  how many links match the current tab and filters
 */
export function estimateExport(total) {
  const rows = typeof total === "number" && total > 0 ? Math.min(total, EXPORT.maxRows) : 0
  const batches = Math.ceil(rows / EXPORT.batch)
  const cost = batches * EXPORT.cost.perCall + rows * EXPORT.cost.perRow
  return { rows, batches, cost, capped: typeof total === "number" && total > EXPORT.maxRows }
}

export const formatCostEstimate = (cost) => (cost < 0.01 ? "under $0.01" : `about $${cost.toFixed(2)}`)

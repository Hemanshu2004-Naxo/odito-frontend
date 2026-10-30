import { MISSING } from "./format"

/**
 * CSV helpers shared by every dashboard page (csvCell and downloadCsv are imported from here by the others), and the Referring Domains
 * page's own "Export current page" / "Export selected": built in the browser from the rows on screen — no request. It has EXACTLY the columns
 * (and header) of the server's "Export with current filters" (odito_backend/.../csv/referringDomainsCsv.js): the two files are interchangeable.
 * A missing value is an empty cell, never 0; provider text is formula-guarded by csvCell.
 */

/** One CSV cell. Quotes when needed, and neutralises spreadsheet formulas (=, +, -, @) in provider-supplied text. */
export function csvCell(value) {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Saves text as a CSV file (with a BOM so Excel reads UTF-8). */
export function downloadCsv(fileName, csv) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const pct = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)
const QUALITY_LABEL = { high: "High", medium: "Medium", low: "Low", toxic: "Toxic" }

/** [header, value(row)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["Domain", (r) => r.domain],
  ["Quality", (r) => QUALITY_LABEL[r.quality] ?? null],
  ["Rank", (r) => r.rank],
  ["Backlinks", (r) => r.backlinks],
  ["Referring pages", (r) => r.referringPages],
  ["Dofollow %", (r) => pct(r.dofollowPct)],
  ["Spam score", (r) => r.spamScore],
  ["Placement", (r) => r.mainPlacement?.key || null],
  ["Top country", (r) => r.topCountry?.code || null],
  ["Broken backlinks", (r) => r.brokenBacklinks],
  ["First seen", (r) => r.firstSeen?.raw ?? null],
  ["Lost date", (r) => r.lostDate?.raw ?? null],
  ["Disavowed", (r) => (r.disavowed ? "yes" : "no")],
])

/** @param {import("./types").DomainRow[]} rows */
export function buildReferringDomainsCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(","))
  return lines.join("\r\n")
}

/** referring-domains_<domain>_<scope>_<YYYY-MM-DD>.csv — scope: "page", "selected" or the tab. */
export function referringDomainsCsvFileName(domain, scope, date = new Date()) {
  const safe = String(domain || "domain").replace(/[^a-z0-9.-]/gi, "-")
  return `referring-domains_${safe}_${scope}_${date.toISOString().slice(0, 10)}.csv`
}

export { MISSING }

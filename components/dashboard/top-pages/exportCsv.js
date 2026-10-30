import { csvCell, downloadCsv } from "../referring-domains/exportCsv"

export { downloadCsv }

/**
 * The Top Pages "Export current page": a CSV of the rows on screen (the merged rows too, when "Merge URL variants" is on), built in the browser —
 * no request. It has EXACTLY the columns (and header) of the server's "Export with current filters" (odito_backend/.../csv/topPagesCsv.js): the two
 * files are interchangeable. A missing value is an empty cell, never 0 — a page whose traffic could not be joined has an EMPTY traffic cell. A merged
 * row is written with its representative URL, its summed counts and its worst status.
 */

const pct = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

/** The flag names the files use (the server writes the same words). */
const FLAG_FILE_LABEL = Object.freeze({
  wasted_links: "Links point to a broken page",
  redirected_links: "Links pass through a redirect",
  links_no_traffic: "Strong links but no rankings",
  traffic_few_links: "Ranks well with few links",
})

/** [header, value(row)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["URL", (r) => r.url],
  ["Normalised URL", (r) => r.normalizedUrl],
  ["Status", (r) => r.statusCode],
  ["Redirect target", (r) => r.location],
  ["Title", (r) => r.title],
  ["Referring domains", (r) => r.referringDomains],
  ["Backlinks", (r) => r.backlinks],
  ["Broken backlinks", (r) => r.brokenBacklinks],
  ["Dofollow %", (r) => pct(r.dofollowPct)],
  ["Rank", (r) => r.rank],
  ["Est. traffic", (r) => r.traffic],
  ["Keywords", (r) => r.keywords],
  ["Flags", (r) => (r.flagIds.length ? r.flagIds.map((f) => FLAG_FILE_LABEL[f] ?? f).join("; ") : null)],
  ["Suggested fix", (r) => r.suggestedFix],
  ["First seen", (r) => r.firstSeen?.raw ?? null],
  ["Last crawled", (r) => r.lastCrawled?.raw ?? null],
])

/** @param {import("./types").PageRow[]} rows */
export function buildTopPagesCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(","))
  return lines.join("\r\n")
}

/** top-pages_<domain>_<scope>_<YYYY-MM-DD>.csv */
export function topPagesCsvFileName(domain, scope, date = new Date()) {
  const safe = String(domain || "domain").replace(/[^a-z0-9.-]/gi, "-")
  return `top-pages_${safe}_${scope}_${date.toISOString().slice(0, 10)}.csv`
}

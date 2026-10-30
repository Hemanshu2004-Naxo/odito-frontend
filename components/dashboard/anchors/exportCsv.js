import { ANCHOR_TYPES, EMPTY_ANCHOR_LABEL } from "@/lib/anchors/anchorConfig"
import { csvCell, downloadCsv } from "../referring-domains/exportCsv"

export { downloadCsv }

/**
 * The Anchors page's CSV: "Export current page" (the rows on screen) and "Export all anchors (up to 1,000)" (the cached profile) share
 * these columns and this header. Built in the browser — no request. A missing value is an empty cell, never 0; the anchor text is
 * formula-guarded by csvCell. The empty anchor is written as "(empty / image link)" so it is not a blank first column.
 */

const pct = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

/** [header, value(row)] — the order is the file's column order. */
export const CSV_COLUMNS = Object.freeze([
  ["Anchor", (r) => r.anchor ?? EMPTY_ANCHOR_LABEL],
  ["Type", (r) => (r.type ? ANCHOR_TYPES[r.type]?.label : null)],
  ["Referring domains", (r) => r.referringDomains],
  ["Backlinks", (r) => r.backlinks],
  ["Dofollow %", (r) => pct(r.dofollowPercent)],
  ["Rank", (r) => r.rank],
  ["Spam score", (r) => r.spamScore],
  ["Broken backlinks", (r) => r.brokenBacklinks],
  ["First seen", (r) => r.firstSeen?.raw ?? null],
])

/** @param {import("./types").AnchorRow[]} rows rows with `type` set */
export function buildAnchorsCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")]
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, value]) => csvCell(value(row))).join(","))
  return lines.join("\r\n")
}

/** anchors_<domain>_<scope>_<YYYY-MM-DD>.csv — scope: "page" or "all" (plus the status when it is not Live). */
export function anchorsCsvFileName(domain, scope, status = "live", date = new Date()) {
  const day = date.toISOString().slice(0, 10)
  const safe = String(domain || "domain").replace(/[^a-z0-9.-]/gi, "-")
  return `anchors_${safe}_${status !== "live" ? `${status}_` : ""}${scope}_${day}.csv`
}

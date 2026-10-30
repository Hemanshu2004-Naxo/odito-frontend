import { downloadStreamedExport } from "../backlinks/exportStream"

/**
 * The browser's side of the Referring Domains page's "Export with current filters". The SERVER does the work (batches of 1,000, up to 10,000
 * rows) and streams the CSV; the protocol — progress, cancel, nothing saved unless the whole file arrived — is the one the Backlinks page uses.
 */

/** The query string of the export: the page's own request without paging (the server pages by itself). */
export function referringDomainsExportQuery(request, maxRows) {
  const p = new URLSearchParams()
  if (request.status && request.status !== "live") p.set("status", request.status)
  if (request.dofollow) p.set("dofollow", "1")
  if (request.order_by && request.order_by !== "rank,desc") p.set("order_by", request.order_by)
  if (Array.isArray(request.filters) && request.filters.length) p.set("filters", JSON.stringify(request.filters))
  if (maxRows) p.set("max_rows", String(maxRows))
  return p.toString()
}

/**
 * @param {string} projectId
 * @param {{ request: import("./types").ReferringDomainsRequest, maxRows: number }} params
 * @param {{ signal?: AbortSignal, onStart?: Function, onProgress?: Function }} [hooks]
 */
export const downloadReferringDomainsExport = (projectId, { request, maxRows }, hooks) => (
  downloadStreamedExport(projectId, "referring-domains-export", referringDomainsExportQuery(request, maxRows), hooks)
)

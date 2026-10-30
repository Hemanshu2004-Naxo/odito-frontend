import { downloadStreamedExport } from "../backlinks/exportStream"

/**
 * The browser's side of the Top Pages page's "Export with current filters". The SERVER does the work (batches of 1,000, up to 10,000 rows, with the
 * same traffic join as the table) and streams the CSV; the protocol — progress, cancel, nothing saved unless the whole file arrived — is the one the
 * Backlinks and Referring Domains pages use.
 */

/** The query string of the export: the page's own request without paging (the server pages by itself). The tab's filters are part of `filters`. */
export function topPagesExportQuery(request, maxRows) {
  const p = new URLSearchParams()
  if (request.order_by && request.order_by !== "page_summary.referring_domains,desc") p.set("order_by", request.order_by)
  if (Array.isArray(request.filters) && request.filters.length) p.set("filters", JSON.stringify(request.filters))
  if (maxRows) p.set("max_rows", String(maxRows))
  return p.toString()
}

/**
 * @param {string} projectId
 * @param {{ request: import("./types").DomainPagesRequest, maxRows: number }} params
 * @param {{ signal?: AbortSignal, onStart?: Function, onProgress?: Function }} [hooks]
 */
export const downloadTopPagesExport = (projectId, { request, maxRows }, hooks) => (
  downloadStreamedExport(projectId, "top-pages-export", topPagesExportQuery(request, maxRows), hooks)
)

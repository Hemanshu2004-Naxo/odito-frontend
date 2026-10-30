/**
 * The browser's side of "Export with current filters". The SERVER does the work (batches of 1,000 following each search_after_token,
 * up to a cap) and streams the CSV; this reads the stream, reports progress, and can cancel — aborting the request tells the server to
 * stop fetching (stop buying). Nothing is saved or downloaded unless the whole file arrived.
 */

/**
 * Counts CSV records in streamed text. A newline inside a quoted cell is not a record end, so quotes are tracked across chunks
 * (an escaped quote "" toggles twice and so changes nothing). `state` carries { inQuote, lines } from chunk to chunk.
 */
export function countCsvLines(chunk, state = { inQuote: false, lines: 0 }) {
  let { inQuote, lines } = state
  for (let i = 0; i < chunk.length; i += 1) {
    const ch = chunk.charCodeAt(i)
    if (ch === 34) inQuote = !inQuote
    else if (ch === 10 && !inQuote) lines += 1
  }
  return { inQuote, lines }
}

export class ExportError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message)
    this.name = "ExportError"
    this.code = code
    this.status = status
  }
}

/** The query string of the export: the page's own request without paging (the server pages by itself). */
export function exportQuery(request, maxRows) {
  const p = new URLSearchParams()
  if (request.status && request.status !== "live") p.set("status", request.status)
  if (request.mode && request.mode !== "as_is") p.set("mode", request.mode)
  for (const rule of request.order_by ?? []) p.append("order_by", rule)
  if (Array.isArray(request.filters) && request.filters.length) p.set("filters", JSON.stringify(request.filters))
  if (maxRows) p.set("max_rows", String(maxRows))
  return p.toString()
}

/**
 * Streams a server-built CSV export (the same protocol for every page that has one): GET /projects/:id/<endpoint>?<qs>, the row count in the
 * X-Export-Rows header, progress counted while the body arrives, nothing saved unless the whole file arrived, cancellable.
 * @param {string} projectId
 * @param {string} endpoint e.g. "backlinks-export"
 * @param {string} qs the query string, without "?"
 * @param {{ signal?: AbortSignal, onStart?: (info: { rows: number, batches: number }) => void, onProgress?: (done: number) => void }} [hooks]
 * @returns {Promise<{ blob: Blob, rows: number, expected: number }>} rejects with ExportError (or an AbortError when cancelled)
 */
export async function downloadStreamedExport(projectId, endpoint, qs, { signal, onStart, onProgress } = {}) {
  // Loaded here, not at the top: the API client needs the app's environment, which a unit test of the helpers above does not have.
  const { default: apiService } = await import("@/lib/apiService")
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null
  const res = await fetch(`${apiService.baseURL}/projects/${encodeURIComponent(projectId)}/${endpoint}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
  if (!res.ok) {
    let body = null
    try { body = await res.json() } catch { /* not JSON */ }
    throw new ExportError(body?.message || "The export could not be started. Please try again.", { code: body?.code ?? null, status: res.status })
  }
  const expected = Number(res.headers.get("X-Export-Rows"))
  const batches = Number(res.headers.get("X-Export-Batches"))
  onStart?.({ rows: Number.isFinite(expected) ? expected : 0, batches: Number.isFinite(batches) ? batches : 0 })

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true })
  const chunks = []
  let state = { inQuote: false, lines: 0 }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      state = countCsvLines(decoder.decode(value, { stream: true }), state)
      onProgress?.(Math.max(0, state.lines - 1)) // the first line is the header
    }
  } catch (err) {
    if (err?.name === "AbortError") throw err
    throw new ExportError("The export was interrupted before it finished, so nothing was saved. Please try again.", { code: "EXPORT_INTERRUPTED" })
  }
  const rows = Math.max(0, state.lines - 1)
  return { blob: new Blob(chunks, { type: "text/csv;charset=utf-8" }), rows, expected: Number.isFinite(expected) ? expected : rows }
}

/**
 * @param {string} projectId
 * @param {{ request: object, maxRows: number }} params
 * @param {{ signal?: AbortSignal, onStart?: (info: { rows: number, batches: number }) => void, onProgress?: (done: number) => void }} [hooks]
 */
export const downloadBacklinksExport = (projectId, { request, maxRows }, hooks) => downloadStreamedExport(projectId, "backlinks-export", exportQuery(request, maxRows), hooks)

/** Saves a downloaded blob as a file (the server already put the BOM at the start of the CSV). */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

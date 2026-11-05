/**
 * Pure helpers for "before vs now" comparisons of STORED data. The rule everywhere: a figure Odito does not have is unavailable (null), never
 * zero, and a change is only computed when BOTH sides are known. A real zero stays a zero.
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** @returns {{ current: number|null, previous: number|null, abs: number|null, pct: number|null, known: boolean }} */
export function metricDelta(current, previous) {
  const c = num(current)
  const p = num(previous)
  if (c === null || p === null) return { current: c, previous: p, abs: null, pct: null, known: false }
  // A percentage of zero is meaningless (it would be infinite): the absolute change is shown instead.
  return { current: c, previous: p, abs: c - p, pct: p === 0 ? null : ((c - p) / Math.abs(p)) * 100, known: true }
}

/** Value at a dotted path ("organic.etv") of a stored payload; null when any step is missing. */
export function valueAt(data, path) {
  let v = data
  for (const step of path.split(".")) {
    if (v === null || v === undefined || typeof v !== "object") return null
    v = v[step]
  }
  return num(v)
}

/**
 * Two lists of stored rows keyed by `key`: which rows are new, which are gone, and how the metrics of the common ones moved.
 * @param {object[]} latest
 * @param {object[]} previous
 * @param {{ key: string, metrics: { id: string, get: (row: object) => number|null }[] }} spec
 */
export function compareKeyedRows(latest = [], previous = [], { key, metrics }) {
  const before = new Map(previous.map((r) => [r?.[key] ?? "", r]))
  const now = new Map(latest.map((r) => [r?.[key] ?? "", r]))
  const added = latest.filter((r) => !before.has(r?.[key] ?? ""))
  const removed = previous.filter((r) => !now.has(r?.[key] ?? ""))
  const changed = []
  for (const [k, row] of now) {
    const old = before.get(k)
    if (!old) continue
    const deltas = Object.fromEntries(metrics.map((m) => [m.id, metricDelta(m.get(row), m.get(old))]))
    if (Object.values(deltas).some((d) => d.known && d.abs !== 0)) changed.push({ key: k, row, deltas })
  }
  return { added, removed, changed }
}

/** "+1,234" / "-56" / "0"; "—" when unknown. */
export function formatSigned(n, { digits = 0 } = {}) {
  if (num(n) === null) return "—"
  const s = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: digits })
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s
}

export function formatNumber(n, { digits = 0 } = {}) {
  return num(n) === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits })
}

export function formatPercent(n) {
  if (num(n) === null) return "—"
  return `${n > 0 ? "+" : ""}${n.toFixed(Math.abs(n) < 10 ? 1 : 0)}%`
}

export function formatDay(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
}

/** "just now" / "45 min ago" / "5 h ago" / "5 days ago". */
export function timeAgo(date, now = Date.now()) {
  const ms = Math.max(0, now - new Date(date).getTime())
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

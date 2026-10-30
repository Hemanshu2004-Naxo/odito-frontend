/**
 * Presentation helpers shared across the dashboard pages (the Domain Overview, Backlink Overview and others import them from here).
 * Missing values render as "—", never as 0.
 */

export const MISSING = "—"

const isNum = (v) => typeof v === "number" && Number.isFinite(v)

export function formatNumber(v, { maximumFractionDigits = 0 } = {}) {
  return isNum(v) ? new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(v) : MISSING
}

/**
 * A provider-supplied date (first seen, lost date) as a calendar date in UTC. DataForSEO reports these in UTC, so converting
 * to the browser's timezone would move late-evening timestamps onto the next day for viewers east of UTC. Use this only for
 * provider dates; Odito's own timestamps go through formatDateTime, which is deliberately local.
 */
export function formatDate(iso) {
  if (!iso) return MISSING
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? MISSING : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
}

/** Odito's own timestamps (when data was fetched): shown in the viewer's local time. Not for provider dates — see formatDate. */
export function formatDateTime(iso) {
  if (!iso) return MISSING
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? MISSING
    : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

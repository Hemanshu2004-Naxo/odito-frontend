import { MISSING } from "../referring-domains/format"

/**
 * Number formatting for the Domain Overview page. Large numbers are compact ("100.4K", "2.6M") with the exact value in a tooltip;
 * a missing value is always "—" (never 0, NaN or undefined). The locale is fixed to en-US so the K / M suffixes read the same for everyone.
 */

export { MISSING }

const isNum = (v) => typeof v === "number" && Number.isFinite(v)

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

/** 100,412 -> "100.4K", 2,561,095 -> "2.6M", 850 -> "850". */
export function formatCompact(v) {
  if (!isNum(v)) return MISSING
  return compact.format(Math.abs(v) < 1000 ? Math.round(v) : v)
}

/** The exact figure for a tooltip: 100,412. Traffic is an estimate, so it is rounded to a whole number. */
export function formatExact(v) {
  return isNum(v) ? exact.format(Math.round(v)) : MISSING
}

/** 24,520.3 -> "$24.5K"; 950.4 -> "$950". */
export function formatUsdCompact(v) {
  if (!isNum(v)) return MISSING
  return Math.abs(v) < 1000 ? usdWhole.format(v) : usdCompact.format(v)
}

export function formatUsdExact(v) {
  return isNum(v) ? usdWhole.format(Math.round(v)) : MISSING
}

/** One decimal place: 61.43 -> "61.4%". */
export function formatPercent1(v) {
  return isNum(v) ? `${v.toFixed(1)}%` : MISSING
}

/** A provider date -> "Mar 2019" (UTC, so the month can never slip in another timezone). "—" when it cannot be read. */
export function formatMonthYear(date) {
  const d = date instanceof Date ? date : null
  if (!d || Number.isNaN(d.getTime())) return MISSING
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
}

/** A ratio, one decimal: 1.4 -> "1.4×". */
export function formatRatio(v) {
  return isNum(v) ? `${v.toFixed(1)}×` : MISSING
}

/** An average position, one decimal: 12.79 -> "12.8". */
export function formatDecimal1(v) {
  return isNum(v) ? v.toFixed(1) : MISSING
}

/** (2025, 10) -> "Oct 25". UTC so the label can never slip a month in another timezone. */
export function formatMonthLabel(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return MISSING
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
}

/** A small favicon for a competitor, from Google's public favicon service. The image is decorative and falls back to a letter. */
export function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

/** "asgeyehospital.com" from a project URL, for showing the domain before any section has answered. */
export function domainFromUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase()
    return host.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

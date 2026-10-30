import { MISSING } from "../domain-overview/format"

/**
 * Formatting that is specific to this page. Counts and traffic reuse ../domain-overview/format (formatCompact / formatExact, "—" when
 * missing). Money here is per-click, so it keeps cents: "$0.17".
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 0.1700000017 -> "$0.17"; null -> "—". */
export const formatCpc = (v) => (isNum(v) ? usd.format(v) : MISSING)

/** "$0.06 – $0.42"; "—" when neither bid is known; a single known bid is shown on its own. */
export function formatBidRange(low, high) {
  if (!isNum(low) && !isNum(high)) return MISSING
  if (isNum(low) && isNum(high)) return `${usd.format(low)} – ${usd.format(high)}`
  return usd.format(isNum(low) ? low : high)
}

/** A share of the whole domain's traffic: 0.34 -> "0.3%", 12.04 -> "12.0%", 0.02 -> "<0.1%", 0 -> "0%". */
export function formatShare(percent) {
  if (!isNum(percent)) return MISSING
  if (percent === 0) return "0%"
  if (percent < 0.1) return "<0.1%"
  return `${percent.toFixed(1)}%`
}

/** "MEDIUM" -> "Medium". */
export const formatCompetition = (level) => (typeof level === "string" && level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : MISSING)

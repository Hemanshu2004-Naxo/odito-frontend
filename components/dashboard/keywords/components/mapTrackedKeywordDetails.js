import { isNum } from "@/lib/seoMetrics"
import { INTENTS } from "../../organic-keywords/constants"
import { kdBand, mapMonthlySearches, serpFeatureList } from "../../organic-keywords/mapRankedKeyword"

/**
 * The ONLY place the tracked-keyword details payload (GET /seo/keywords/:projectId/:keywordId/details) becomes what the expanded row
 * shows. Components never read raw field names. A figure the server did not have is null - never 0 - so the row can show "—", and a
 * rank is always one of four states that are never mixed up: ranked / not_ranked / scan_error / not_collected.
 */

/** How many of the provider's monthly figures the chart shows (it sends up to ~19; the Organic Keywords chart shows the last 12 too). */
export const VOLUME_MONTHS = 12

const date = (s) => {
  if (typeof s !== "string") return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Positive = moved up (a lower number is a better position). null when either side is unknown: no history is not "no change". */
export function positionDelta(current, earlier) {
  return isNum(current) && isNum(earlier) ? earlier - current : null
}

const DEVICE_STATES = new Set(["ranked", "not_ranked", "scan_error", "not_collected"])

function mapDevice(d) {
  const status = DEVICE_STATES.has(d?.status) ? d.status : "not_collected"
  const position = isNum(d?.position) ? d.position : null
  return {
    status,
    position,
    previous: isNum(d?.previousPosition) ? d.previousPosition : null,
    best: isNum(d?.bestPosition) ? d.bestPosition : null,
    benchmark: isNum(d?.benchmarkPosition) ? d.benchmarkPosition : null,
    prevWeek: isNum(d?.prevWeekPosition) ? d.prevWeekPosition : null,
    prevMonth: isNum(d?.prevMonthPosition) ? d.prevMonthPosition : null,
    url: typeof d?.rankingUrl === "string" ? d.rankingUrl : null,
    urls: (Array.isArray(d?.rankingUrls) ? d.rankingUrls : []).filter((u) => isNum(u?.rank) && typeof u?.url === "string").map((u) => ({ rank: u.rank, url: u.url, type: u.type === "homepage" ? "homepage" : "internal_page" })),
    depth: isNum(d?.trackedDepth) ? d.trackedDepth : null,
    error: typeof d?.scanError === "string" ? d.scanError : null,
    scanCount: isNum(d?.scanCount) ? d.scanCount : 0,
    lastScannedAt: date(d?.lastScannedAt),
    sinceLastScan: positionDelta(position, isNum(d?.previousPosition) ? d.previousPosition : null),
    sinceWeek: positionDelta(position, isNum(d?.prevWeekPosition) ? d.prevWeekPosition : null),
    sinceMonth: positionDelta(position, isNum(d?.prevMonthPosition) ? d.prevMonthPosition : null),
  }
}

/** [{ at, position }] -> [{ t (ms), position|null, at: Date }], oldest first, unreadable dates dropped. null = "not found in the checked depth". */
function mapSeries(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((p) => ({ at: date(p?.at), position: isNum(p?.position) ? p.position : null }))
    .filter((p) => p.at)
    .map((p) => ({ ...p, t: p.at.getTime() }))
    .sort((a, b) => a.t - b.t)
}

const AVAILABILITY = new Set(["ok", "no_data", "unavailable", "error", "rate_limited", "not_configured"])
const availability = (v) => (AVAILABILITY.has(v) ? v : "unavailable")

/** Last month vs the month before, as a percent; null when either is unknown or the earlier one is 0 (no base to compare to). */
export function volumeChange(months) {
  const known = months.filter((m) => m.volume !== null)
  if (known.length < 2) return null
  const [prev, last] = known.slice(-2)
  if (prev.volume <= 0) return null
  return { from: prev, to: last, percent: ((last.volume - prev.volume) / prev.volume) * 100 }
}

/** @returns {object|null} null when the server sent nothing usable */
export function mapTrackedKeywordDetails(data) {
  if (!data || typeof data !== "object") return null
  const o = data.overview ?? {}
  const intentValue = typeof o.searchIntent === "string" ? o.searchIntent.toLowerCase() : null
  const monthly = mapMonthlySearches(data.history?.volume).slice(-VOLUME_MONTHS)
  const md = data.metadata ?? {}
  const av = md.dataAvailability ?? {}
  const maps = data.rankings?.maps ?? {}
  return {
    keyword: data.keyword,
    volume: isNum(o.searchVolume) ? o.searchVolume : null,
    difficulty: isNum(o.keywordDifficulty) ? o.keywordDifficulty : null,
    kdBand: kdBand(o.keywordDifficulty),
    intent: INTENTS.find((i) => i.value === intentValue) ?? null,
    cpc: isNum(o.cpc) ? o.cpc : null,
    competition: typeof o.competition === "string" && o.competition ? o.competition : null,
    lowBid: isNum(o.lowTopOfPageBid) ? o.lowTopOfPageBid : null,
    highBid: isNum(o.highTopOfPageBid) ? o.highTopOfPageBid : null,
    monthly,
    volumeChange: volumeChange(monthly),
    desktop: mapDevice(data.rankings?.desktop),
    mobile: mapDevice(data.rankings?.mobile),
    maps: {
      position: isNum(maps.position) ? maps.position : null,
      listing: maps.listing && typeof maps.listing === "object" ? maps.listing : null,
    },
    history: { desktop: mapSeries(data.history?.desktop), mobile: mapSeries(data.history?.mobile), windowDays: isNum(data.history?.windowDays) ? data.history.windowDays : null },
    serpFeatures: serpFeatureList(data.serpFeatures),
    googleUrl: typeof data.googleUrl === "string" && /^https?:\/\//.test(data.googleUrl) ? data.googleUrl : null,
    referringDomains: isNum(data.backlinks?.referringDomains) ? data.backlinks.referringDomains : null,
    backlinks: isNum(data.backlinks?.totalBacklinks) ? data.backlinks.totalBacklinks : null,
    lastScannedAt: date(md.lastScannedAt),
    metricsFetchedAt: date(md.metricsFetchedAt),
    market: md.market ?? null,
    availability: {
      keywordMetrics: availability(av.keywordMetrics),
      volumeHistory: availability(av.volumeHistory),
      rankHistory: availability(av.rankHistory),
      backlinks: availability(av.backlinks),
    },
  }
}

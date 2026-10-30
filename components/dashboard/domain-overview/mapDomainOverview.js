import { isNum, sumKnown, POSITION_BUCKETS, percentChange, changeDirection, monthIndex } from "@/lib/seoMetrics"
import { formatMonthLabel } from "./format"
import { mapCompetitorsPage, toCardRows } from "../competitors/mapCompetitor"

const COMPETITORS_CARD_ROWS = 5

/**
 * THE one place that turns the five API sections into what the components display. Components receive this view model and
 * never read a raw API path. Every figure is null when its source is missing — a section that failed or has not loaded yields
 * nulls for its own figures only, so the rest of the page still renders.
 *
 * @param {{ rankOverview?: any, history?: any, rankedKeywords?: any, competitors?: any, backlinks?: any }} sections  SectionState objects
 * @returns {import("./types").DomainOverviewViewModel}
 */

const NO_CHANGE = Object.freeze({ percent: null, direction: null, basis: null })

/**
 * Month-over-month change of a headline figure against the API 2 series. The baseline is the calendar month BEFORE the newest
 * month in the series (so a series that already contains the current month compares against last month). `basis` names the
 * month actually used, so what the percentage is relative to is never guesswork. Unknown, or a baseline of 0, gives no percentage.
 */
function monthOverMonth(current, series, key) {
  if (!isNum(current) || !series.length) return NO_CHANGE
  const newest = series[series.length - 1]
  const base = series.find((i) => monthIndex(i.year, i.month) === monthIndex(newest.year, newest.month) - 1)
  if (!base) return NO_CHANGE
  const basis = `vs ${formatMonthLabel(base.year, base.month)}`
  const percent = percentChange(current, base[key])
  return percent === null ? { percent: null, direction: null, basis } : { percent, direction: changeDirection(percent), basis }
}

/**
 * Movement of one keyword. Measured absolute-to-absolute (position_absolute vs previous_position, which the provider reports as an
 * absolute rank): a positive amount is an improvement. No previous rank AND movement data present = NEW; no movement data = unknown.
 */
export function mapPositionChange(k) {
  if (!k?.rank_changes_known) return { kind: "unknown", amount: null }
  if (k.previous_position === null || k.previous_position === undefined) return { kind: "new", amount: null }
  if (!isNum(k.position_absolute) || !isNum(k.previous_position)) return { kind: "unknown", amount: null }
  const diff = k.previous_position - k.position_absolute
  if (diff > 0) return { kind: "up", amount: diff }
  if (diff < 0) return { kind: "down", amount: -diff }
  return { kind: "same", amount: 0 }
}

/**
 * The "Top keywords" card's rows from one ranked-keywords response (the plain top 5, or its Brand / Non-brand variant).
 * @param {{ items?: any[], totalCount?: number|null }|null|undefined} ranked  the response's `result`
 * @param {string|null} target  the domain, to build each row's full URL
 * @param {number|null} [headlineTotal]  "View all N": the overview's own keyword count (the plain list only); a filtered list uses its own total
 */
export function mapTopKeywords(ranked, target, headlineTotal = null) {
  return {
    totalCount: headlineTotal ?? ranked?.totalCount ?? null,
    rows: (ranked?.items ?? []).map((k) => ({
      keyword: k.keyword,
      position: k.position ?? null,
      change: mapPositionChange(k),
      volume: k.search_volume ?? null,
      difficulty: k.keyword_difficulty ?? null,
      traffic: k.etv ?? null,
      path: k.relative_url ?? null,
      url: target && typeof k.relative_url === "string" && k.relative_url.startsWith("/") ? `https://${target}${k.relative_url}` : null,
    })),
  }
}

export function mapDomainOverview(sections = {}) {
  const organic = sections.rankOverview?.data?.result?.organic ?? null
  const paidRaw = sections.rankOverview?.data?.result?.paid ?? null
  const backlinks = sections.backlinks?.data?.result ?? null

  // API 2 arrives newest first: the chart (and the month-over-month baseline) need oldest -> newest.
  const series = [...(sections.history?.data?.result?.items ?? [])]
    .sort((a, b) => a.year - b.year || a.month - b.month)

  const top10Count = organic ? sumKnown([organic.pos_1, organic.pos_2_3, organic.pos_4_10]) : null
  const total = organic?.count

  const rankedTarget = sections.rankedKeywords?.data?.target ?? null
  const rankedKeywords = sections.rankedKeywords?.data?.result

  const paidTraffic = paidRaw?.etv
  const paidKeywords = paidRaw?.count

  return {
    hasRankingData: Boolean(organic) && ((organic.count ?? 0) > 0 || (organic.etv ?? 0) > 0),

    kpis: {
      traffic: organic?.etv ?? null,
      trafficChange: monthOverMonth(organic?.etv, series, "etv"),
      keywords: organic?.count ?? null,
      keywordsChange: monthOverMonth(organic?.count, series, "count"),
      trafficValue: organic?.estimated_paid_traffic_cost ?? null,
      domainRank: backlinks?.rank ?? null,
      backlinks: backlinks?.backlinks ?? null,
      referringDomains: backlinks?.referring_domains ?? null,
    },

    // Paid is only mentioned when there is some: a muted line under the cards.
    paid: (isNum(paidTraffic) && paidTraffic > 0) || (isNum(paidKeywords) && paidKeywords > 0)
      ? { traffic: paidTraffic ?? 0, keywords: paidKeywords ?? 0 }
      : null,

    trend: series.map((i) => ({ key: `${i.year}-${String(i.month).padStart(2, "0")}`, label: formatMonthLabel(i.year, i.month), etv: i.etv, count: i.count })),

    positions: {
      buckets: POSITION_BUCKETS.map(({ key, label, fields }) => ({ key, label, value: organic ? sumKnown(fields.map((f) => organic[f])) : null })),
      top10: top10Count === null ? null : {
        count: top10Count,
        percent: isNum(total) && total > 0 ? Math.round((top10Count / total) * 1000) / 10 : null,
      },
    },

    movement: {
      new: organic?.is_new ?? null,
      improved: organic?.is_up ?? null,
      declined: organic?.is_down ?? null,
      lost: organic?.is_lost ?? null, // from API 1 on purpose: API 3 reports 0 for lost keywords
    },

    // "View all N keywords": the overview's own keyword count, falling back to API 3's total.
    topKeywords: mapTopKeywords(rankedKeywords, rankedTarget, organic?.count ?? null),

    // The card shows the first 5 of the Competitors page's default view (50 rows; the project's own row is already taken out).
    competitors: toCardRows(mapCompetitorsPage(sections.competitors?.data), COMPETITORS_CARD_ROWS),
  }
}

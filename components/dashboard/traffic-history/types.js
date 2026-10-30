/**
 * Types for the Traffic History page (JSDoc: the codebase is plain JavaScript). Two layers, and ONLY the fields the page uses:
 *
 *  1. The API payload — GET /projects/:id/domain-overview/history[?months=24]: the SAME route, cache entry and parser the Domain
 *     Overview uses (its chart reads etv + count; this page reads the rest). Missing values are null, never 0.
 *  2. The view model — what mapTrafficHistory() returns. Components never read an API path.
 */

// ── 1. API payload ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One month, in the provider's order (newest first). The ORGANIC metrics are flat on the item; `paid` carries the paid ones.
 * @typedef {Object} HistoryMonth
 * @property {number} year
 * @property {number} month                            1–12
 * @property {number|null} etv                         estimated monthly organic traffic
 * @property {number|null} count                       ranking keywords
 * @property {number|null} estimated_paid_traffic_cost USD
 * @property {number|null} pos_1 @property {number|null} pos_2_3 @property {number|null} pos_4_10 @property {number|null} pos_11_20
 * @property {number|null} pos_21_30 @property {number|null} pos_31_40 @property {number|null} pos_41_50
 * @property {number|null} pos_51_60 @property {number|null} pos_61_70 @property {number|null} pos_71_80
 * @property {number|null} pos_81_90 @property {number|null} pos_91_100
 * @property {number|null} is_new @property {number|null} is_up @property {number|null} is_down @property {number|null} is_lost
 * @property {{ etv: number|null, count: number|null, estimated_paid_traffic_cost: number|null }|null} paid
 */

/**
 * The history envelope (`data` of the API response).
 * @typedef {Object} HistoryEnvelope
 * @property {string} target
 * @property {{ location: string, language: string }} market
 * @property {string} fetchedAt                         when the provider was asked (not when this was served)
 * @property {boolean} cached
 * @property {{ date_from: string, date_to: string, months: number }} range   the window this response covers
 * @property {{ items: HistoryMonth[] }} result
 */

// ── 2. The view model ──────────────────────────────────────────────────────────────────────────────────────────────────

/** @typedef {{ percent: number|null, direction: 'up'|'down'|'flat'|null }} Mom   month-over-month, vs the previous calendar month; null = no previous month, or it was 0 */

/**
 * @typedef {Object} MonthRow
 * @property {string} key                      "2025-10"
 * @property {number} year @property {number} month @property {number} index     index = year*12 + month-1
 * @property {string} label                    "Oct 25" (axes)
 * @property {string} longLabel                "October 2025" (tooltips)
 * @property {number|null} traffic @property {number|null} keywords @property {number|null} value   value = estimated traffic value, USD
 * @property {number|null} top10               #1 + #2–3 + #4–10
 * @property {{ key: string, label: string, value: number|null }[]} bucketList   the six buckets, in rank order
 * @property {Record<string, number|null>} buckets   the same, by key (top1 … top100)
 * @property {number|null} bucketTotal         sum of the six buckets that month
 * @property {number|null} paidTraffic @property {number|null} paidKeywords @property {number|null} paidValue
 * @property {{ new: number|null, up: number|null, down: number|null, lost: number|null }} movement
 * @property {{ traffic: Mom, keywords: Mom, value: Mom, top10: Mom }} mom
 */

/** @typedef {{ value: number|null, label: string|null }} Peak   the highest month in the range */
/** @typedef {{ latest: number|null, change: { percent: number|null, direction: string|null, basis: string|null }, peak: Peak }} SummaryMetric */

/**
 * @typedef {Object} TrafficHistoryViewModel
 * @property {MonthRow[]} range                the selected window, oldest -> newest (what the charts plot)
 * @property {MonthRow[]} tableRows            the same, newest first (what the table starts with)
 * @property {boolean} hasEnoughHistory        at least 2 months in the range
 * @property {boolean} hasPaid                 any month in the range has paid traffic > 0
 * @property {{ traffic: SummaryMetric, keywords: SummaryMetric, value: SummaryMetric, top10: SummaryMetric }} summary
 * @property {{ key: string, label: string, percent: number }|null} biggestDrop   the month with the biggest MoM traffic fall
 * @property {number} availableMonths          months of data actually present in the selected range
 */

export {}

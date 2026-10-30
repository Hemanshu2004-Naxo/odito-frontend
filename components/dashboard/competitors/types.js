/**
 * Types for the Competitors page (JSDoc, checked by the editor — the project has no TypeScript).
 *
 * Two layers: the slim PAYLOAD the backend sends (it is the only place DataForSEO's confusing names are translated), and the ROW /
 * view-model the components read. Components never touch payload field names; `mapCompetitor` / `mapBulkTraffic` are the only readers.
 */

/** The request shape of the competitors section (see lib/competitorsRequest.js). `filters` is a flat DataForSEO condition or []. */
/** @typedef {{ limit: number, offset: number, order_by: string, filters: Array, exclude_top_domains: boolean, max_rank_group: number }} CompetitorsRequest */

/** The competitor's numbers on the keywords BOTH sites rank for (or the project's, in `project_shared`). */
/** @typedef {{ etv: number|null, pos_1: number|null, pos_2_3: number|null, pos_4_10: number|null }} SharedMetrics */
/** @typedef {{ count: number|null, etv: number|null, estimated_paid_traffic_cost: number|null }} SiteTotals */

/**
 * One competitor as the backend sends it.
 *  total             the competitor's WHOLE site            (provider: full_domain_metrics.organic)
 *  project_shared    the PROJECT's numbers on shared keywords (provider: metrics.organic)
 *  competitor_shared the COMPETITOR's numbers on them        (provider: competitor_metrics.organic)
 * @typedef {{ domain: string, intersections: number|null, avg_position: number|null, total: SiteTotals|null,
 *   project_shared: SharedMetrics|null, competitor_shared: SharedMetrics|null }} CompetitorPayload
 */

/** @typedef {{ totalCount: number|null, self: CompetitorPayload|null, items: CompetitorPayload[] }} CompetitorsResult */

/**
 * A competitor row, display-ready. Every number is a number or null ("—"), never 0/NaN for "unknown".
 * @typedef {Object} CompetitorRow
 * @property {string} id                       the domain (stable key)
 * @property {string} domain
 * @property {number|null} sharedKeywords      keywords both sites rank for
 * @property {number|null} sharedShare         sharedKeywords as % of the PROJECT's total keywords (0–100), null when unknown
 * @property {number|null} avgPosition         the competitor's average position on the shared keywords
 * @property {number|null} theirTotalKeywords  whole site
 * @property {number|null} theirTotalTraffic   whole site (estimated monthly visits)
 * @property {number|null} theirTrafficValue   whole site (USD per month)
 * @property {number|null} ourSharedTraffic    the project's traffic on the shared keywords
 * @property {number|null} theirSharedTraffic  the competitor's traffic on the shared keywords
 * @property {number|null} ourTop1             the project's #1 rankings on the shared keywords
 * @property {number|null} theirTop1
 * @property {number|null} ourTop2to3
 * @property {number|null} theirTop2to3
 * @property {number|null} ourTop4to10
 * @property {number|null} theirTop4to10
 * @property {"us"|"them"|"tie"|null} lead     who has more traffic on the shared keywords
 * @property {number|null} trafficRatio        theirSharedTraffic ÷ ourSharedTraffic (null unless both are known and ours > 0)
 */

/** The project's own row (kept out of the table, used for "You"). */
/** @typedef {{ domain: string, sharedKeywords: number|null, totalKeywords: number|null, totalTraffic: number|null, trafficValue: number|null }} SelfRow */

/** @typedef {{ sort: "shared"|"avgPosition"|"headToHead", dir: "asc"|"desc", page: number, pageSize: number, hideLarge: boolean, top10: boolean, minShared: string }} PageState */

/** One row of the Compare section. Any metric can be null ("—"). */
/**
 * @typedef {Object} ComparisonRow
 * @property {string} domain
 * @property {boolean} isProject
 * @property {boolean} found          the provider answered for this target
 * @property {boolean} noData         the provider answered with all zeros (it has no data for this domain)
 * @property {number|null} organicTraffic
 * @property {number|null} organicKeywords
 * @property {number|null} localPackTraffic
 * @property {number|null} featuredSnippetTraffic
 * @property {number|null} paidTraffic
 * @property {number|null} paidKeywords
 */
export {}

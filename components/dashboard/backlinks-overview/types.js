/**
 * Types for the Backlink Overview (JSDoc, checked by the editor — the project has no TypeScript).
 * Two layers: the backend PAYLOAD (the provider's own field names; the only reader is mapBacklinkSummary) and the VIEW MODEL the
 * components read.
 */

/** @typedef {Record<string, number>} CountBreakdown   { key: count }; "" = unknown, "WW" = worldwide (countries) */

/**
 * The backend's `result` for the backlinks section. Every count is a number or null; a breakdown is null when the provider omitted it.
 * @typedef {Object} BacklinkSummaryPayload
 * @property {number|null} rank  0–1000
 * @property {string|null} first_seen  "2019-03-19 06:16:01 +00:00"
 * @property {string|null} lost_date
 * @property {number|null} backlinks
 * @property {number|null} backlinks_spam_score  0–100
 * @property {number|null} broken_backlinks
 * @property {number|null} broken_pages
 * @property {number|null} referring_domains
 * @property {number|null} referring_domains_nofollow
 * @property {number|null} referring_main_domains
 * @property {number|null} referring_main_domains_nofollow
 * @property {number|null} referring_pages
 * @property {number|null} referring_pages_nofollow
 * @property {number|null} referring_ips
 * @property {number|null} referring_subnets
 * @property {number|null} crawled_pages
 * @property {number|null} internal_links_count
 * @property {number|null} external_links_count
 * @property {{ cms: string|null, server: string|null, ip_address: string|null, country: string|null, platform_type: string[], target_spam_score: number|null }} info
 * @property {CountBreakdown|null} referring_links_tld
 * @property {CountBreakdown|null} referring_links_types
 * @property {CountBreakdown|null} referring_links_attributes
 * @property {CountBreakdown|null} referring_links_platform_types
 * @property {CountBreakdown|null} referring_links_semantic_locations
 * @property {CountBreakdown|null} referring_links_countries
 */

/**
 * One bar of a breakdown chart.
 * @typedef {Object} BreakdownEntry
 * @property {string} key       the provider's key ("" = unknown), or "__others__"
 * @property {string} label     what is shown ("Unknown", "Worldwide", "Message Boards", ".com", "India")
 * @property {number} count
 * @property {number|null} percent   share of the referring links the breakdown covers (0–100)
 * @property {string} [flag]         a flag emoji (countries)
 * @property {string|null} [description]  tooltip text (what an attribute means, which country a TLD belongs to)
 * @property {boolean} [highlight]   an attribute worth the reader's attention (sponsored, ugc)
 * @property {boolean} [isOthers]
 */
/**
 * @typedef {{ entries: BreakdownEntry[], base: number|null, isEmpty: boolean, unknown?: BreakdownEntry|null, knownBase?: number }} Breakdown
 * Countries only: `unknown` is the part with no known country (its percent is of ALL links), `knownBase` the links the entries' shares are of.
 */

/** @typedef {{ id: string, level: "red"|"amber"|"green"|"unknown", message: string, href: string|null }} HealthCheck */

/**
 * @typedef {Object} BacklinkSummary
 * @property {number|null} rank
 * @property {number} rankMax
 * @property {number|null} rankPercent
 * @property {{ score: number|null, band: { key: "low"|"medium"|"high", label: string }|null, siteScore: number|null }} spam
 * @property {{ date: Date|null, short: string|null, label: string|null, tooltip: string|null, months: number|null }} age
 * @property {Date|null} lostDate
 * @property {boolean|null} hasBacklinks   null when the backlink count is unknown
 * @property {{ backlinks: number|null, referringDomains: number|null, referringDomainsNofollow: number|null, referringMainDomains: number|null,
 *   referringPages: number|null, referringPagesNofollow: number|null, referringIps: number|null, referringSubnets: number|null,
 *   brokenBacklinks: number|null, brokenPages: number|null, crawledPages: number|null, internalLinks: number|null, externalLinks: number|null }} totals
 * @property {{ dofollowDomains: number|null, dofollowDomainsPercent: number|null, nofollowDomains: number|null, dofollowPages: number|null,
 *   dofollowPagesPercent: number|null, nofollowPages: number|null, backlinksPerDomain: number|null, subnetDiversity: number|null,
 *   brokenBacklinksPercent: number|null }} derived
 * @property {{ attributes: Breakdown, countries: Breakdown, tlds: Breakdown, platformTypes: Breakdown, semanticLocations: Breakdown, linkTypes: Breakdown }} breakdowns
 * @property {{ cms: string|null, server: string|null, ipAddress: string|null, country: { code: string, name: string, flag: string }|null, platformTypes: string[] }} site
 * @property {HealthCheck[]} health
 */

/** @typedef {{ status: "live"|"lost"|"all", dofollow: boolean }} BacklinksRequest */
export {}

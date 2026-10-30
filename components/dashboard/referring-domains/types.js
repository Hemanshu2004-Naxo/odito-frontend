/**
 * JSDoc types of the Referring Domains page (the project is plain JavaScript, so these are editor and review aids, not compiled).
 *
 * @typedef {Object} DomainPayload one entry of the backend's `result.items` (the provider's own field names, plus what the server computed)
 * @property {string} domain
 * @property {number|null} rank 0–1000
 * @property {number|null} backlinks
 * @property {number|null} backlinks_spam_score 0–100
 * @property {number|null} broken_backlinks
 * @property {number|null} broken_pages
 * @property {number|null} referring_pages
 * @property {number|null} referring_pages_nofollow
 * @property {number|null} referring_ips
 * @property {number|null} referring_subnets
 * @property {string|null} first_seen "2026-08-19 10:21:08 +00:00"
 * @property {string|null} lost_date
 * @property {"high"|"medium"|"low"|"toxic"|null} quality decided by the server
 * @property {number|null} dofollow_pct 0–100, computed by the server
 * @property {boolean|null} is_sitewide computed by the server
 * @property {string|null} top_country the highest-count key of referring_links_countries ("" = unknown, "WW" = worldwide)
 * @property {string|null} main_placement the highest-count key of referring_links_semantic_locations
 * @property {Record<string, number>|null} referring_links_semantic_locations
 * @property {Record<string, number>|null} referring_links_attributes
 * @property {Record<string, number>|null} referring_links_types
 * @property {Record<string, number>|null} referring_links_platform_types
 * @property {Record<string, number>|null} referring_links_countries
 *
 * @typedef {Object} DomainRow what the table, the expanded row and the CSV read
 * @property {string} id
 * @property {string} domain
 * @property {boolean} noLiveLinks a saved (disavowed) domain the provider has no live row for
 * @property {"high"|"medium"|"low"|"toxic"|null} quality
 * @property {number|null} rank
 * @property {number|null} backlinks
 * @property {number|null} referringPages
 * @property {number|null} dofollowPct
 * @property {boolean} isSitewide
 * @property {{ code: string, name: string, flag: string }|null} topCountry
 * @property {{ key: string, label: string }|null} mainPlacement
 * @property {number|null} spamScore
 * @property {{ key: string, label: string }|null} spamBand
 * @property {number|null} brokenBacklinks
 * @property {import("../anchors/mapAnchor").DatedValue} firstSeen
 * @property {import("../anchors/mapAnchor").DatedValue} lostDate
 * @property {boolean} disavowed in the project's disavow list
 * @property {boolean} reviewed marked "OK / keep"
 * @property {boolean} toxicWarning toxic, and neither reviewed nor already disavowed
 * @property {string|null} insight
 *
 * @typedef {Object} ReferringDomainsRequest what the backend is asked for one page
 * @property {"live"|"lost"} status
 * @property {boolean} dofollow the provider's backlinks_filters ["dofollow", "=", true]
 * @property {number} limit
 * @property {number} offset
 * @property {string} order_by "rank,desc"
 * @property {Array} filters DataForSEO filter conditions (flat for one, joined with "and" for several, [] for none)
 *
 * @typedef {Object} PageState everything the user can change; the URL holds it
 * @property {"all"|"new"|"lost"|"toxic"|"disavowed"} tab
 * @property {string} q @property {string} exclude @property {string} minRank @property {string} maxRank
 * @property {string} maxSpam @property {string} minBacklinks @property {boolean} hasBroken @property {string} since
 * @property {boolean} dofollow
 * @property {string[]} quality quality tiers; applied to the rows already loaded
 * @property {{ field: string, dir: "asc"|"desc" }|null} sort null = rank, strongest first
 * @property {number} page @property {number} pageSize
 */
export {}

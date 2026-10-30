/**
 * JSDoc types of the Anchors page (the project is plain JavaScript, so these are editor and review aids, not compiled).
 *
 * @typedef {Object} AnchorPayload one entry of the backend's `result.items` (the provider's own field names; every number may be null)
 * @property {string|null} anchor the link text; null for links without text (image links)
 * @property {number|null} rank 0–1000
 * @property {number|null} backlinks
 * @property {number|null} referring_domains
 * @property {number|null} referring_domains_nofollow
 * @property {number|null} referring_main_domains
 * @property {number|null} referring_pages
 * @property {number|null} referring_pages_nofollow
 * @property {number|null} referring_ips
 * @property {number|null} referring_subnets
 * @property {number|null} backlinks_spam_score 0–100
 * @property {number|null} broken_backlinks
 * @property {number|null} broken_pages
 * @property {string|null} first_seen "2026-09-11 08:19:48 +00:00"
 * @property {string|null} lost_date
 * @property {Record<string, number>|null} referring_links_semantic_locations "" = unknown
 * @property {Record<string, number>|null} referring_links_countries "" = unknown, "WW" = worldwide
 * @property {Record<string, number>|null} referring_links_platform_types
 * @property {Record<string, number>|null} referring_links_attributes
 *
 * @typedef {Object} DatedValue
 * @property {Date|null} date
 * @property {string|null} label "Apr 2025"
 * @property {string|null} day "Apr 5, 2025"
 * @property {string|null} tooltip the full date, with how long ago
 * @property {string|null} raw the provider's own text (CSV)
 *
 * @typedef {Object} AnchorRow what the table, the chart and the CSV read
 * @property {string} id
 * @property {string|null} anchor
 * @property {boolean} isEmpty
 * @property {string} label the text, or "(empty / image link)"
 * @property {number|null} referringDomains
 * @property {number|null} backlinks
 * @property {number|null} dofollowPercent 0–100
 * @property {boolean} isSitewide
 * @property {number|null} rank
 * @property {number|null} spamScore
 * @property {{ key: string, label: string }|null} spamBand
 * @property {number|null} brokenBacklinks
 * @property {DatedValue} firstSeen
 * @property {string} [type] a key of ANCHOR_TYPES, set by the page from the project's settings
 *
 * @typedef {Object} AnchorsRequest what the backend is asked for one page
 * @property {"live"|"lost"|"all"} status
 * @property {number} limit
 * @property {number} offset
 * @property {string} order_by "referring_domains,desc"
 * @property {Array} filters DataForSEO filter conditions (an array of [field, operator, value])
 *
 * @typedef {Object} PageState everything the user can change; the URL holds it
 * @property {"live"|"lost"|"all"} status
 * @property {string} q contains
 * @property {string} exclude does not contain
 * @property {string} minReferringDomains
 * @property {string} minBacklinks
 * @property {string} maxSpam
 * @property {boolean} hasBroken
 * @property {string} since YYYY-MM-DD
 * @property {string|null} exact one exact anchor (from a click on the chart)
 * @property {boolean} exactEmpty the links without anchor text
 * @property {string[]} types anchor types; applied to the rows already loaded
 * @property {{ field: string, dir: "asc"|"desc" }|null} sort null = the default (referring domains, highest first)
 * @property {number} page
 * @property {number} pageSize
 */
export {}

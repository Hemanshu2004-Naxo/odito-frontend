/**
 * Types for the Backlinks page (JSDoc, checked by the editor — the project has no TypeScript).
 * Two layers: the backend PAYLOAD (the provider's own field names; the only reader is mapBacklink) and the ROW the components read.
 */

/**
 * One backlink as the backend sends it. Counts are numbers or null; text is a string or null; flags are boolean or null.
 * @typedef {Object} BacklinkPayload
 * @property {string|null} domain_from
 * @property {string|null} url_from
 * @property {string|null} page_from_title
 * @property {string|null} page_from_language
 * @property {string|null} domain_from_country
 * @property {string[]} domain_from_platform_type
 * @property {string|null} domain_from_ip
 * @property {string|null} url_to
 * @property {number|null} url_to_status_code
 * @property {string|null} url_to_redirect_target
 * @property {number|null} url_to_spam_score
 * @property {string|null} anchor
 * @property {string|null} item_type        anchor | image | redirect | canonical …
 * @property {string|null} alt
 * @property {string|null} image_url
 * @property {boolean|null} dofollow
 * @property {string[]} attributes
 * @property {string|null} semantic_location
 * @property {string|null} text_pre
 * @property {string|null} text_post
 * @property {number|null} links_count
 * @property {boolean|null} original
 * @property {boolean|null} is_indirect_link
 * @property {string[]} indirect_link_path
 * @property {number|null} rank              the link's own rank (0–1000)
 * @property {number|null} page_from_rank    (0–1000)
 * @property {number|null} domain_from_rank  (0–1000)
 * @property {number|null} backlink_spam_score  (0–100)
 * @property {number|null} page_from_external_links
 * @property {number|null} page_from_internal_links
 * @property {string|null} first_seen
 * @property {string|null} prev_seen
 * @property {string|null} last_seen
 * @property {boolean|null} is_new
 * @property {boolean|null} is_lost
 * @property {boolean|null} is_broken
 */

/** @typedef {{ date: Date|null, label: string|null, tooltip: string|null, raw: string|null }} DatedValue */

/**
 * @typedef {Object} BacklinkRow
 * @property {string} id
 * @property {string|null} sourceUrl
 * @property {string|null} sourceUrlDisplay   without the protocol
 * @property {string|null} sourceTitle
 * @property {string|null} sourceDomain
 * @property {{ code: string, name: string, flag: string }|null} sourceCountry
 * @property {string|null} anchor
 * @property {"text"|"image"|"empty"} anchorKind
 * @property {string|null} imageAlt
 * @property {string|null} imageUrl
 * @property {string|null} itemType
 * @property {string|null} itemTypeLabel      null for an ordinary text link
 * @property {string|null} targetUrl
 * @property {string|null} targetPath         "/specialities/retina-diseases/"
 * @property {string|null} targetRedirect
 * @property {string|null} targetRedirectDisplay
 * @property {number|null} targetStatus
 * @property {number|null} targetSpam
 * @property {boolean|null} isDofollow
 * @property {string[]} attributes
 * @property {boolean} isUgc
 * @property {boolean} isSponsored
 * @property {string|null} placement       "Footer"
 * @property {string|null} placementKey    "footer" (as the provider says it)
 * @property {string|null} sourceCountryCode
 * @property {number|null} domainRank
 * @property {number|null} pageRank
 * @property {number|null} linkRank
 * @property {number|null} spamScore
 * @property {{ key: string, label: string }|null} spamBand
 * @property {DatedValue} firstSeen
 * @property {DatedValue} lastSeen
 * @property {DatedValue} prevSeen
 * @property {boolean} isNew
 * @property {boolean} isLost
 * @property {boolean} isBroken
 * @property {boolean|null} original
 * @property {number|null} linksCount
 * @property {{ before: string|null, anchor: string|null, after: string|null }} context
 * @property {{ language: string|null, country: object|null, platformTypes: string[], ip: string|null, externalLinks: number|null, internalLinks: number|null }} source
 * @property {boolean} isIndirect
 * @property {string[]} indirectPath
 * @property {string|null} suggestedFix        only for a broken link
 * @property {Array<{ key: "new"|"lost"|"broken", label: string }>} badges
 */

/** @typedef {{ tab: string, group: string, q: string, anchor: string, target: string, follow: "all"|"dofollow"|"nofollow", itemTypes: string[], placements: string[],
 *   minRank: string, maxSpam: string, countries: string[], since: string, hideSpammy: boolean, domainFrom: string, exactAnchor: string|null, exactEmpty: boolean,
 *   sort: Array<{ field: string, dir: "asc"|"desc" }>, page: number, pageSize: number }} PageState */

/** What the backend is asked (see buildBacklinkRequest). `filters` is [] or a flat DataForSEO condition or conditions joined with "and". */
/** @typedef {{ status: "live"|"lost", mode: string, limit: number, offset: number, order_by: string[], filters: Array, token?: string }} BacklinksRequest */
export {}

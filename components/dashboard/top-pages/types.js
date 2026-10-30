/**
 * JSDoc types of the Top Pages page (the project is plain JavaScript, so these are editor and review aids, not compiled).
 *
 * @typedef {Object} PagePayload one entry of the backend's `result.items` (the provider's own field names, plus what the server computed and joined)
 * @property {string} url the full URL of the page
 * @property {number|null} status_code
 * @property {string|null} location the redirect target, when there is one
 * @property {string|null} title meta.title (often null for redirects and errors)
 * @property {string|null} canonical
 * @property {boolean|null} canonical_differs the canonical names ANOTHER page (null when it names none)
 * @property {string[]} h1
 * @property {string|null} language
 * @property {number|null} words_count @property {number|null} internal_links_count @property {number|null} external_links_count @property {number|null} images_count
 * @property {number|null} page_spam_score
 * @property {string[]} technologies
 * @property {string|null} server @property {string|null} media_type
 * @property {string|null} fetch_time "2026-08-10 01:32:49 +00:00" — the last crawl
 * @property {number|null} rank 0–1000 @property {number|null} backlinks @property {number|null} backlinks_spam_score @property {number|null} broken_backlinks
 * @property {number|null} referring_domains @property {number|null} referring_domains_nofollow @property {number|null} referring_pages @property {number|null} referring_pages_nofollow
 * @property {string|null} first_seen @property {string|null} lost_date
 * @property {string|null} normalized_url the page's identity across http / www / slash variants (server)
 * @property {"ok"|"redirect"|"error"|"blocked"|"unknown"} status_group (server)
 * @property {number|null} dofollow_pct 0–100, by referring domains (server)
 * @property {string|null} suggested_fix for error and blocked pages (server)
 * @property {number|null} traffic estimated organic traffic joined from Organic Keywords; null when the join failed
 * @property {number|null} keywords how many keywords rank this page; null when the join failed
 * @property {string[]} flags opportunity flags (server)
 *
 * @typedef {Object} PageRow what the table, the expanded row, "Fix first" and the CSV read
 * @property {string} id @property {string} url @property {string} normalizedUrl
 * @property {string} address the path (own host) or host + path (any other host), "http://" when insecure
 * @property {string|null} title @property {string} heading the title, or the address when there is none
 * @property {number|null} statusCode @property {"ok"|"redirect"|"error"|"blocked"|"unknown"} statusGroup @property {string} statusLabel "404", "403 Blocked"
 * @property {string|null} location @property {string|null} locationLabel
 * @property {number|null} referringDomains @property {number|null} backlinks @property {number|null} brokenBacklinks @property {number|null} dofollowPct @property {number|null} rank
 * @property {number|null} traffic @property {number|null} keywords
 * @property {string[]} flagIds @property {Array<{ id: string, label: string, tone: string, message: string }>} flags
 * @property {string|null} suggestedFix
 * @property {import("../anchors/mapAnchor").DatedValue} firstSeen @property {import("../anchors/mapAnchor").DatedValue} lastCrawled
 * @property {PageRow[]|null} variants the spellings merged into this row (null for an ordinary row)
 * @property {number} variantCount @property {boolean} approx the counts are sums over variants
 *
 * @typedef {Object} DomainPagesRequest what the backend is asked for one page (live links only)
 * @property {number} limit @property {number} offset
 * @property {string} order_by "page_summary.referring_domains,desc"
 * @property {Array} filters DataForSEO filter conditions (flat for one, joined with "and" for several)
 *
 * @typedef {Object} PageState everything the user can change; the URL holds it
 * @property {"all"|"errors"|"redirects"|"ok"} tab
 * @property {string} q @property {string} exclude @property {string} minReferringDomains @property {string} minBacklinks
 * @property {boolean} hasBroken @property {string} since
 * @property {string[]} flags opportunity flags; applied to the rows already loaded
 * @property {boolean} merge "Merge URL variants" (the rows already loaded)
 * @property {{ field: string, dir: "asc"|"desc" }|null} sort null = the tab's default
 * @property {number} page @property {number} pageSize
 */
export {}

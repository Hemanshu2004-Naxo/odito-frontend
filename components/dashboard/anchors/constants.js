/** What the Anchors page treats as a rule (names, limits, field names). The classification rules live in lib/anchors/. */

export const STATUSES = Object.freeze([
  Object.freeze({ id: "live", label: "Live", hint: "Links that are still there" }),
  Object.freeze({ id: "lost", label: "Lost", hint: "Links that have disappeared" }),
  Object.freeze({ id: "all", label: "All", hint: "Live and lost links together" }),
])
export const DEFAULT_STATUS = "live"

export const PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_PAGE_SIZE = 50
/** The provider answers pages by offset while offset + limit <= 20,000. The last offset a page can start at is MAX_OFFSET. */
export const MAX_OFFSET = 19999
export const lastReachablePage = (pageSize) => Math.floor(MAX_OFFSET / pageSize) + 1

/** The provider's limit on filter conditions (the backend refuses more, and so does the page, before asking). */
export const MAX_CONDITIONS = 8
export const MAX_TEXT_LENGTH = 100
export const SEARCH_DEBOUNCE_MS = 400
export const TOO_MANY_MESSAGE = `Max ${MAX_CONDITIONS} filters — remove one to add another`

/** The provider's own field names (the request body and the filters use them). */
export const FIELD = Object.freeze({
  anchor: "anchor",
  referringDomains: "referring_domains",
  backlinks: "backlinks",
  spam: "backlinks_spam_score",
  broken: "broken_backlinks",
  firstSeen: "first_seen",
})

/** The sortable columns: table column key -> the provider's sort field. One rule at a time. */
export const SORT_COLUMNS = Object.freeze({
  referringDomains: "referring_domains",
  backlinks: "backlinks",
  rank: "rank",
  spam: "backlinks_spam_score",
  broken: "broken_backlinks",
  firstSeen: "first_seen",
})
export const SORT_FIELDS = Object.freeze(Object.values(SORT_COLUMNS))
/** Referring domains first: how many DIFFERENT sites use an anchor matters more than how many links (one site can make 200). */
export const DEFAULT_SORT = Object.freeze({ field: "referring_domains", dir: "desc" })

/** Backlinks ÷ referring domains at or above this gets the "sitewide" chip (re-exported from the config so the table reads one place). */
export { ANCHOR_HEALTH as HEALTH } from "@/lib/anchors/anchorConfig"

/** Where "View these backlinks" goes. */
export const BACKLINKS_PATH = "/app/backlinks/list"

export const SETTINGS_BANNER = "Add your brand terms and target keywords for accurate anchor types."
export const TYPE_FILTER_HINT = "Type filter applies to the rows on this page."
export const PROFILE_NOTE = "Based on the top 1,000 anchors by referring domains."
export const SHARE_NOTE = "Shares are of referring domains. A site that links with two different anchors counts under both."

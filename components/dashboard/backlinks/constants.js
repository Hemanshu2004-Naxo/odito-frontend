/**
 * Everything the Backlinks page agrees with the backend on: the tabs, group-by modes, field names, limits and options. One place, so the
 * request builder, the URL state, the table and the tests cannot drift apart.
 * (The backend re-checks every value against its own whitelist — see odito_backend/.../backlinksListQuery.js and config.js.)
 */

/** DataForSEO field names used in filters and sorting. */
export const FIELD = Object.freeze({
  sourceUrl: "url_from",
  anchor: "anchor",
  targetUrl: "url_to",
  domainFrom: "domain_from",
  dofollow: "dofollow",
  itemType: "item_type",
  placement: "semantic_location",
  domainRank: "domain_from_rank",
  spam: "backlink_spam_score",
  country: "domain_from_country",
  firstSeen: "first_seen",
  isNew: "is_new",
  isBroken: "is_broken",
})

/**
 * The tabs. Each is a backlinks_status_type plus (for New and Broken) one filter of its own — that filter counts towards the
 * 8-condition limit. `defaultSort` is what the tab sorts by until the user chooses.
 */
export const TABS = Object.freeze([
  { id: "all", label: "All", status: "live", filter: null },
  { id: "new", label: "New", status: "live", filter: [FIELD.isNew, "=", true] },
  { id: "lost", label: "Lost", status: "lost", filter: null },
  { id: "broken", label: "Broken", status: "live", filter: [FIELD.isBroken, "=", true], defaultSort: [{ field: "domain_from_rank", dir: "desc" }] },
])
export const DEFAULT_TAB = "all"

/** Group by -> the provider's `mode`. */
export const GROUPS = Object.freeze([
  { id: "all", label: "All links", mode: "as_is" },
  { id: "domain", label: "One per domain", mode: "one_per_domain" },
  { id: "anchor", label: "One per anchor", mode: "one_per_anchor" },
])
export const DEFAULT_GROUP = "all"

export const PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_PAGE_SIZE = 50

/** The provider lets `offset` work only while offset + limit stays within this; beyond it, "Load more" follows the response's token. */
export const OFFSET_WINDOW = 20000
export const lastNumberedPage = (pageSize) => Math.floor(OFFSET_WINDOW / pageSize)

export const MAX_CONDITIONS = 8
export const MAX_SORT_RULES = 3
export const MAX_TEXT_LENGTH = 100
export const SEARCH_DEBOUNCE_MS = 400

/** The link's own rank, descending: what the list is sorted by until the user picks a column (it is not a column of its own). */
export const DEFAULT_ORDER = "rank,desc"

/** Sortable columns -> their provider field and the direction a first click sorts in (the most interesting end first). */
export const SORT_COLUMNS = Object.freeze({
  domainRank: { field: "domain_from_rank", dir: "desc", label: "Domain Rank" },
  pageRank: { field: "page_from_rank", dir: "desc", label: "Page Rank" },
  spam: { field: "backlink_spam_score", dir: "asc", label: "Spam" },
  firstSeen: { field: "first_seen", dir: "desc", label: "First seen" },
  lastSeen: { field: "last_seen", dir: "desc", label: "Last seen" },
})
export const SORT_FIELDS = Object.freeze(Object.values(SORT_COLUMNS).map((c) => c.field))

export const LINK_TYPE_OPTIONS = Object.freeze([
  { value: "all", label: "All" },
  { value: "dofollow", label: "Dofollow" },
  { value: "nofollow", label: "Nofollow" },
])

export const ITEM_TYPES = Object.freeze([
  { value: "anchor", label: "Text" },
  { value: "image", label: "Image" },
  { value: "redirect", label: "Redirect" },
  { value: "canonical", label: "Canonical" },
  { value: "alternate", label: "Alternate" },
  { value: "meta", label: "Meta" },
])

export const PLACEMENTS = Object.freeze([
  { value: "article", label: "Article" },
  { value: "section", label: "Section" },
  { value: "main", label: "Main" },
  { value: "details", label: "Details" },
  { value: "aside", label: "Aside" },
  { value: "header", label: "Header" },
  { value: "footer", label: "Footer" },
  { value: "figure", label: "Figure" },
  { value: "figcaption", label: "Figcaption" },
])

/** "Hide spammy" = a spam score below this. */
export const SPAM_THRESHOLD = 30

/** Spam badge bands (the same as the Backlink Overview): 0–10 Low, 11–30 Medium, 31+ High. */
export const SPAM_BANDS = Object.freeze({ lowMax: 10, mediumMax: 30 })

export const MAX_RANK = 1000

/**
 * "Export with current filters" (done by the server). Rates are the ESTIMATE shown before it starts: each call costs `perCall` plus
 * `perRow` for every row it returns. The server enforces the cap and the batch size; keep these in step with
 * odito_backend/.../domain_overview/config.js BACKLINKS_EXPORT.
 */
export const EXPORT = Object.freeze({ maxRows: 10000, batch: 1000, cost: Object.freeze({ perCall: 0.02, perRow: 0.00002 }) })

export const BROKEN_BANNER = (total) => `${total} backlinks point to URLs that return errors. Fix them with 301 redirects to the closest live page, or fix the server response.`

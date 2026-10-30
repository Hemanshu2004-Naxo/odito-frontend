/**
 * What the Referring Domains page treats as a rule: the tabs, the quality tiers' look, the limits and the provider's field names.
 * The quality tier itself is NOT decided here: the server classifies every row (odito_backend … DOMAIN_QUALITY) and sends `quality`;
 * this file only says how each tier is shown.
 */

export const TABS = Object.freeze([
  Object.freeze({ id: "all", label: "All", hint: "Every referring domain with a live link" }),
  Object.freeze({ id: "new", label: "New", hint: "First seen in the last 30 days" }),
  Object.freeze({ id: "lost", label: "Lost", hint: "Domains whose links have disappeared" }),
  Object.freeze({ id: "toxic", label: "Toxic", hint: "Spam score above 30" }),
  Object.freeze({ id: "disavowed", label: "Disavowed", hint: "The domains you marked to disavow" }),
])
export const DEFAULT_TAB = "all"
export const NEW_WINDOW_DAYS = 30
/** The Toxic tab's server filter: spam score above this (the same figure the Toxic tier uses). */
export const TOXIC_SPAM_ABOVE = 30
export const TOXIC_TAB_HINT = "Server-side filter uses spam score; quality tier is calculated per row."
export const QUALITY_FILTER_HINT = "Quality filter applies to the rows on this page."
export const PROFILE_SCOPE_LABEL = "Whole profile (live links)"

/** Quality tiers: label, the classes of their chip, and what they mean (the rules are the server's). */
export const QUALITY = Object.freeze({
  high: Object.freeze({ key: "high", label: "High", dot: "#16a34a", chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40", description: "A strong site (rank 300 or more) with a low spam score (10 or less)" }),
  medium: Object.freeze({ key: "medium", label: "Medium", dot: "#2563eb", chip: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40", description: "A decent site (rank 150 or more) with a spam score of 30 or less" }),
  low: Object.freeze({ key: "low", label: "Low", dot: "#64748b", chip: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40", description: "Everything else with a known rank and spam score" }),
  toxic: Object.freeze({ key: "toxic", label: "Toxic", dot: "#dc2626", chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40", description: "A spam score above 30, or a low-rank site with 100+ links that are almost all nofollow" }),
})
export const QUALITY_KEYS = Object.freeze(["high", "medium", "low", "toxic"])

export const PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_PAGE_SIZE = 50
/** The provider answers pages by offset while offset + limit <= 20,000. The last offset a page can start at is MAX_OFFSET. */
export const MAX_OFFSET = 19999
export const lastReachablePage = (pageSize) => Math.floor(MAX_OFFSET / pageSize) + 1

/** The provider's limit on filter conditions, counting the tab's own. */
export const MAX_CONDITIONS = 8
export const MAX_TEXT_LENGTH = 100
export const MAX_RANK = 1000
export const SEARCH_DEBOUNCE_MS = 400
export const TOO_MANY_MESSAGE = `Max ${MAX_CONDITIONS} filters — remove one to add another`

/** The provider's own field names (filters and sorts use them). */
export const FIELD = Object.freeze({
  domain: "domain",
  rank: "rank",
  spam: "backlinks_spam_score",
  backlinks: "backlinks",
  broken: "broken_backlinks",
  firstSeen: "first_seen",
})

/** The sortable columns: table column key -> the provider's sort field. One rule at a time. */
export const SORT_COLUMNS = Object.freeze({
  rank: "rank",
  backlinks: "backlinks",
  pages: "referring_pages",
  spam: "backlinks_spam_score",
  broken: "broken_backlinks",
  firstSeen: "first_seen",
})
export const SORT_FIELDS = Object.freeze(Object.values(SORT_COLUMNS))
/** The strongest domains first. */
export const DEFAULT_SORT = Object.freeze({ field: "rank", dir: "desc" })

export const BACKLINKS_PATH = "/app/backlinks/list"
export const NO_LIVE_LINKS = "No live links found"
export const DOWNLOAD_PAGE_NOTE = "Disavowing or marking a domain OK only changes your own lists: nothing is requested from the data provider."

/**
 * What the Top Pages page treats as a rule: the tabs, how a status and a flag LOOK, the limits and the provider's field paths. What a page's status
 * group and flags ARE is decided by the server (odito_backend … pageMetrics.js, PAGE_FLAGS in config.js) and sent with every row; this file only
 * says how each is shown.
 */

export const TABS = Object.freeze([
  Object.freeze({ id: "all", label: "All", hint: "Every page with backlinks" }),
  Object.freeze({ id: "errors", label: "Errors", hint: "Pages that answer with an error (400 and up): links to them are wasted" }),
  Object.freeze({ id: "redirects", label: "Redirects", hint: "Pages that redirect (300–399): links pass through a redirect" }),
  Object.freeze({ id: "ok", label: "OK", hint: "Pages that load normally (200–299)" }),
])
export const DEFAULT_TAB = "all"

export const PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_PAGE_SIZE = 50
/** The provider answers pages by offset while offset + limit <= 20,000. The last offset a page can start at is MAX_OFFSET. */
export const MAX_OFFSET = 19999
export const lastReachablePage = (pageSize) => Math.floor(MAX_OFFSET / pageSize) + 1

/** The provider's limit on filter conditions: the tab's own and the always-on backlinks >= 1 count. */
export const MAX_CONDITIONS = 8
export const MAX_TEXT_LENGTH = 100
export const SEARCH_DEBOUNCE_MS = 400
export const TOO_MANY_MESSAGE = `Max ${MAX_CONDITIONS} filters — remove one to add another`

/** The provider's own field paths (live-checked 2026-10-28). */
export const FIELD = Object.freeze({
  page: "page",
  status: "status_code",
  referringDomains: "page_summary.referring_domains",
  backlinks: "page_summary.backlinks",
  broken: "page_summary.broken_backlinks",
  firstSeen: "page_summary.first_seen",
})

/** The sortable columns: table column key -> the provider's sort path. One rule at a time. */
export const SORT_COLUMNS = Object.freeze({
  referringDomains: "page_summary.referring_domains",
  backlinks: "page_summary.backlinks",
  rank: "page_summary.rank",
  broken: "page_summary.broken_backlinks",
  firstSeen: "page_summary.first_seen",
})
export const SORT_FIELDS = Object.freeze(Object.values(SORT_COLUMNS))
/** The pages most sites link to first — but on the Errors tab the most valuable broken pages (the most backlinks) come first. */
export const DEFAULT_SORT = Object.freeze({ field: "page_summary.referring_domains", dir: "desc" })
export const TAB_SORT = Object.freeze({ errors: Object.freeze({ field: "page_summary.backlinks", dir: "desc" }) })
export const defaultSortFor = (tab) => TAB_SORT[tab] ?? DEFAULT_SORT

/** The base condition every request carries: API 10 also lists pages with no backlink at all. "Min backlinks" replaces it. */
export const BASE_MIN_BACKLINKS = 1

/** The status groups' look. `label` is what the badge says for a group with no code of its own. */
export const STATUS = Object.freeze({
  ok: Object.freeze({ key: "ok", chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40", description: "The page loads normally" }),
  redirect: Object.freeze({ key: "redirect", chip: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40", description: "The page redirects to another URL" }),
  error: Object.freeze({ key: "error", chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40", description: "The page answers with an error" }),
  blocked: Object.freeze({ key: "blocked", chip: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40", description: "The server refuses the crawler (403). The page may load fine for visitors, but links to it can be lost if the crawler of a search engine is refused too" }),
  unknown: Object.freeze({ key: "unknown", chip: "bg-muted text-muted-foreground border-border", description: "The status could not be read" }),
})

/** The opportunity flags (decided by the server): short label, tone and the full explanation. */
export const FLAGS = Object.freeze({
  wasted_links: Object.freeze({ id: "wasted_links", label: "Wasted links", tone: "red", message: "Links point to a broken page" }),
  redirected_links: Object.freeze({ id: "redirected_links", label: "Redirected links", tone: "amber", message: "Links pass through a redirect — ask top sites to update the URL" }),
  links_no_traffic: Object.freeze({ id: "links_no_traffic", label: "No rankings", tone: "amber", message: "Strong links but no rankings — improve content or targeting" }),
  traffic_few_links: Object.freeze({ id: "traffic_few_links", label: "Link opportunity", tone: "blue", message: "Ranks well with few links — good link-building target" }),
})
export const FLAG_IDS = Object.freeze(["wasted_links", "redirected_links", "links_no_traffic", "traffic_few_links"])
export const FLAG_TONE = Object.freeze({
  red: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
})
/** Chips shown in a row before "+N". */
export const MAX_ROW_FLAGS = 2

export const FLAG_FILTER_HINT = "Applies to the rows on this page."
export const MERGE_HINT = "Merges variants shown on this page only."
export const TRAFFIC_HINT = "From the top 1,000 keywords by traffic."
export const PROFILE_SCOPE_LABEL = "Whole profile (live links)"
export const BACKLINKS_PATH = "/app/backlinks/list"
export const KEYWORDS_PATH = "/app/organic-keywords"

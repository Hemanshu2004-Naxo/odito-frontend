/**
 * Everything the Organic Keywords page agrees with the backend on: DataForSEO field paths, the sortable columns, the filter chips and
 * the limits. One place, so the filter builder, the URL state, the table and the tests cannot drift apart.
 * (The backend re-checks every value against its own whitelist — see odito_backend/.../rankedKeywordsQuery.js.)
 */

const ROW = "ranked_serp_element.serp_item"

/** DataForSEO field paths. */
export const FIELD = Object.freeze({
  keyword: "keyword_data.keyword",
  position: `${ROW}.rank_group`,
  traffic: `${ROW}.etv`,
  volume: "keyword_data.keyword_info.search_volume",
  difficulty: "keyword_data.keyword_properties.keyword_difficulty",
  cpc: "keyword_data.keyword_info.cpc",
  intent: "keyword_data.search_intent_info.main_intent",
  url: `${ROW}.relative_url`,
  isNew: `${ROW}.rank_changes.is_new`,
  isUp: `${ROW}.rank_changes.is_up`,
  isDown: `${ROW}.rank_changes.is_down`,
})

export const PAGE_SIZES = Object.freeze([25, 50, 100])
export const DEFAULT_PAGE_SIZE = 50
/** Rows one "export all" request returns (the provider's maximum per request). */
export const EXPORT_ALL_LIMIT = 1000
/** The deepest `offset` the backend accepts (it mirrors the provider's cap), so the last page that can be requested depends on the page size. */
export const MAX_OFFSET = 9999
export const lastReachablePage = (pageSize) => Math.floor(MAX_OFFSET / pageSize) + 1
/** The most filter conditions the provider accepts in one request. */
export const MAX_CONDITIONS = 8
export const SEARCH_DEBOUNCE_MS = 400
export const MAX_TEXT_LENGTH = 100

/**
 * Sortable columns. `dir` is the direction a first click sorts in: numbers where "more" matters start high to low, position and
 * the keyword start low to high.
 */
export const SORTS = Object.freeze({
  traffic: { field: FIELD.traffic, label: "Traffic", dir: "desc" },
  position: { field: FIELD.position, label: "Position", dir: "asc" },
  volume: { field: FIELD.volume, label: "Volume", dir: "desc" },
  difficulty: { field: FIELD.difficulty, label: "KD", dir: "desc" },
  cpc: { field: FIELD.cpc, label: "CPC", dir: "desc" },
  keyword: { field: FIELD.keyword, label: "Keyword", dir: "asc" },
})
export const DEFAULT_SORT = "traffic"
export const DEFAULT_DIR = "desc"

/**
 * Position chips -> the rank_group bounds they mean (inclusive). Every range of the Domain Overview's "Keyword positions" bars has a chip
 * (Top 1, 2–3, 4–10, 11–20, 21–50, 51–100); "Top 3" and "Top 10" are the cumulative ones.
 */
export const POSITION_OPTIONS = Object.freeze([
  { value: "all", label: "All", min: null, max: null },
  { value: "top1", label: "Top 1", min: null, max: 1 },
  { value: "2-3", label: "2–3", min: 2, max: 3 },
  { value: "4-10", label: "4–10", min: 4, max: 10 },
  { value: "top3", label: "Top 3", min: null, max: 3 },
  { value: "top10", label: "Top 10", min: null, max: 10 },
  { value: "11-20", label: "11–20", min: 11, max: 20 },
  { value: "21-50", label: "21–50", min: 21, max: 50 },
  { value: "51-100", label: "51–100", min: 51, max: 100 },
])

export const MOVEMENT_OPTIONS = Object.freeze([
  { value: "all", label: "All", field: null },
  { value: "new", label: "New", field: FIELD.isNew },
  { value: "up", label: "Improved", field: FIELD.isUp },
  { value: "down", label: "Declined", field: FIELD.isDown },
])

/** Search intents as the provider names them; `letter` is the badge. */
export const INTENTS = Object.freeze([
  { value: "informational", letter: "I", label: "Informational", hint: "Looking for information or an answer" },
  { value: "navigational", letter: "N", label: "Navigational", hint: "Looking for a specific site or brand" },
  { value: "commercial", letter: "C", label: "Commercial", hint: "Comparing options before a purchase" },
  { value: "transactional", letter: "T", label: "Transactional", hint: "Ready to buy or take an action" },
])

/**
 * Keyword difficulty bands: 0-29 easy, 30-49 moderate, 50-69 difficult, 70+ hard. `dot` is the colour of the dot beside the number
 * (the band name is always also text in the tooltip, so colour is never the only signal).
 */
export const KD_BANDS = Object.freeze([
  { key: "easy", label: "Easy", min: 0, dot: "bg-emerald-500" },
  { key: "moderate", label: "Moderate", min: 30, dot: "bg-yellow-400" },
  { key: "difficult", label: "Difficult", min: 50, dot: "bg-orange-500" },
  { key: "hard", label: "Hard", min: 70, dot: "bg-red-500" },
])

/** Non-organic result types (rank_changes / serp_item.type) -> a short tag next to the position. "organic" is the norm and shows nothing. */
export const RESULT_TYPE_LABELS = Object.freeze({
  featured_snippet: "Snippet",
  local_pack: "Local pack",
  images: "Images",
  video: "Video",
  people_also_ask: "People also ask",
  knowledge_graph: "Knowledge panel",
  ai_overview: "AI Overview",
  top_stories: "Top stories",
  shopping: "Shopping",
  paid: "Paid",
})

/**
 * SERP features, in the order they are shown (most meaningful first). "organic" is every result's baseline and is never listed.
 * `label` is the tooltip / accessible name.
 */
export const SERP_FEATURES = Object.freeze({
  ai_overview: "AI Overview",
  featured_snippet: "Featured snippet",
  local_pack: "Local pack",
  map: "Map",
  people_also_ask: "People also ask",
  knowledge_graph: "Knowledge panel",
  images: "Images",
  video: "Video",
  short_videos: "Short videos",
  discussions_and_forums: "Discussions & forums",
  google_reviews: "Google reviews",
  third_party_reviews: "Reviews",
  popular_products: "Popular products",
  scholarly_articles: "Scholarly articles",
  jobs: "Jobs",
  perspectives: "Perspectives",
  related_searches: "Related searches",
})
export const SERP_FEATURE_ORDER = Object.freeze(Object.keys(SERP_FEATURES))
export const MAX_SERP_ICONS = 4

/** The UI filter state with nothing applied. */
export const EMPTY_FILTERS = Object.freeze({
  q: "", exclude: "", position: "all", volMin: "", volMax: "", kdMin: "", kdMax: "", intents: Object.freeze([]), movement: "all", url: "", brand: "all",
})

/** The Brand / Non-brand split by the project's saved brand terms (lib/brandFilter.js). */
export const BRAND_OPTIONS = Object.freeze([
  Object.freeze({ value: "all", label: "All" }),
  Object.freeze({ value: "non", label: "Non-brand" }),
  Object.freeze({ value: "only", label: "Brand" }),
])

export const googleSearchUrl = (keyword) => `https://www.google.com/search?q=${encodeURIComponent(keyword)}`

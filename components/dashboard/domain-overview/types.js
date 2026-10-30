/**
 * Types for the Domain Overview page (JSDoc: the codebase is plain JavaScript). Two layers, and ONLY the fields the page uses:
 *
 *  1. API payloads — what GET /projects/:id/domain-overview/:section returns in `data.result`. The backend has already reduced the
 *     DataForSEO response to these fields (a missing value is null, never 0).
 *  2. The view model — what mapDomainOverview() returns and what the components receive. Components never read an API path.
 */

// ── 1. API payloads ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Envelope shared by all five sections.
 * @template T
 * @typedef {Object} SectionEnvelope
 * @property {string} section
 * @property {string} target                 domain without protocol or www
 * @property {{ location: string, language: string }} market
 * @property {string} fetchedAt              ISO time the data was bought from the provider (not when it was served)
 * @property {boolean} cached                served from the server cache
 * @property {boolean} refreshThrottled      a refresh was requested but the data was fetched less than a minute ago
 * @property {number} ttlSeconds
 * @property {T} result
 */

/**
 * @typedef {Object} OrganicMetrics   (API 1 — domain rank overview)
 * @property {number|null} etv   estimated monthly organic traffic
 * @property {number|null} count   ranking keywords
 * @property {number|null} estimated_paid_traffic_cost   USD
 * @property {number|null} pos_1 @property {number|null} pos_2_3 @property {number|null} pos_4_10 @property {number|null} pos_11_20
 * @property {number|null} pos_21_30 @property {number|null} pos_31_40 @property {number|null} pos_41_50
 * @property {number|null} pos_51_60 @property {number|null} pos_61_70 @property {number|null} pos_71_80
 * @property {number|null} pos_81_90 @property {number|null} pos_91_100
 * @property {number|null} is_new @property {number|null} is_up @property {number|null} is_down @property {number|null} is_lost
 */
/** @typedef {{ organic: OrganicMetrics|null, paid: { etv: number|null, count: number|null, estimated_paid_traffic_cost: number|null }|null }} RankOverviewResult */

/** @typedef {{ year: number, month: number, etv: number|null, count: number|null }} HistoryItem */
/** @typedef {{ items: HistoryItem[] }} HistoryResult   in the provider's order: newest first */

/**
 * @typedef {Object} RankedKeyword   (API 3)
 * @property {string} keyword
 * @property {number|null} search_volume
 * @property {number|null} keyword_difficulty
 * @property {number|null} position            rank_group — the position shown
 * @property {number|null} position_absolute   rank_absolute — what movement is measured against
 * @property {number|null} previous_position   previous_rank_absolute; null = not ranking before (when rank_changes_known)
 * @property {boolean} rank_changes_known      false = the provider sent no movement data: claim nothing
 * @property {number|null} etv
 * @property {string|null} relative_url
 */
/** @typedef {{ totalCount: number|null, items: RankedKeyword[] }} RankedKeywordsResult */

/** @typedef {import("../competitors/types").CompetitorPayload} Competitor */
/** @typedef {import("../competitors/types").CompetitorsResult} CompetitorsResult   the project's own row is in `self`, not in `items` */

/** @typedef {{ rank: number|null, backlinks: number|null, referring_domains: number|null, broken_backlinks: number|null, target_spam_score: number|null }} BacklinksResult */

// ── 2. What the hook gives the page ────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SectionState
 * @property {'loading'|'error'|'success'} status    "success" also while a refresh is in flight (old data stays visible)
 * @property {SectionEnvelope<any>|null} data
 * @property {{ message: string, code: string|null }|null} error
 * @property {boolean} isFetching
 * @property {() => void} refetch
 */

// ── 3. The view model ──────────────────────────────────────────────────────────────────────────────────────────────────

/** @typedef {{ percent: number|null, direction: 'up'|'down'|'flat'|null, basis: string|null }} Change   percent is month-over-month; null = unknown */

/**
 * @typedef {Object} DomainOverviewViewModel
 * @property {boolean} hasRankingData   false for a domain DataForSEO has no rankings for (shows the friendly empty state)
 * @property {{ traffic: number|null, trafficChange: Change, keywords: number|null, keywordsChange: Change, trafficValue: number|null,
 *   domainRank: number|null, backlinks: number|null, referringDomains: number|null }} kpis
 * @property {{ traffic: number, keywords: number }|null} paid   only when either is > 0
 * @property {{ key: string, label: string, etv: number|null, count: number|null }[]} trend   oldest -> newest
 * @property {{ buckets: { key: string, label: string, value: number|null }[], top10: { count: number, percent: number|null }|null }} positions
 * @property {{ new: number|null, improved: number|null, declined: number|null, lost: number|null }} movement
 * @property {{ totalCount: number|null, rows: TopKeywordRow[] }} topKeywords
 * @property {CompetitorRow[]} competitors
 */

/** @typedef {{ kind: 'new'|'up'|'down'|'same'|'unknown', amount: number|null }} PositionChange */
/** @typedef {{ keyword: string, position: number|null, change: PositionChange, volume: number|null, difficulty: number|null, traffic: number|null, path: string|null, url: string|null }} TopKeywordRow */
/** @typedef {{ domain: string, shared: number|null, avgPosition: number|null, traffic: number|null }} CompetitorRow */

export {}

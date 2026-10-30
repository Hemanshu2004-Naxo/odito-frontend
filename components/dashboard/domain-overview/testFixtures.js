/**
 * Section payloads for tests, in the exact shape the backend returns (see types.js). The numbers are taken from a real response for
 * asgeyehospital.com (Oct 2026); they are fixtures for the mapping and rendering code, not evidence about the live API.
 */

export const envelope = (section, result, o = {}) => ({
  section,
  target: "asgeyehospital.com",
  market: { location: "India", language: "English" },
  fetchedAt: "2026-10-27T05:42:18.854Z",
  cached: false,
  refreshThrottled: false,
  ttlSeconds: 86400,
  result,
  ...o,
})

export const organic = (o = {}) => ({
  etv: 100411.929526025, count: 4139, estimated_paid_traffic_cost: 24520.310160559413,
  pos_1: 165, pos_2_3: 308, pos_4_10: 1037, pos_11_20: 1017, pos_21_30: 487, pos_31_40: 371, pos_41_50: 315,
  pos_51_60: 193, pos_61_70: 84, pos_71_80: 61, pos_81_90: 66, pos_91_100: 35,
  is_new: 2788, is_up: 621, is_down: 572, is_lost: 2423,
  ...o,
})

export const rankOverview = (o = {}) => envelope("rank-overview", { organic: organic(), paid: { etv: 0, count: 0, estimated_paid_traffic_cost: 0 }, ...o })

/** Provider order: newest first. */
export const historyItems = () => [
  { year: 2026, month: 10, etv: 100942.3, count: 4166 },
  { year: 2026, month: 9, etv: 62200.06, count: 3571 },
  { year: 2026, month: 8, etv: 76203.98, count: 3278 },
  { year: 2026, month: 7, etv: 110566.79, count: 3758 },
]
export const history = (items = historyItems()) => envelope("history", { items }, { ttlSeconds: 604800 })

export const rankedKeyword = (o = {}) => ({
  keyword: "asg hospital", search_volume: 74000, keyword_difficulty: 0, position: 1, position_absolute: 4, previous_position: null,
  rank_changes_known: true, etv: 23016.8, relative_url: "/", ...o,
})
export const rankedKeywords = (items = [
  rankedKeyword(),
  rankedKeyword({ keyword: "eye hospital near me", search_volume: 246000, keyword_difficulty: 22, position: 4, position_absolute: 5, previous_position: 8, etv: 8130.3, relative_url: "/hospital/kokane-chowk-pimpri-chinchwad/" }),
  rankedKeyword({ keyword: "lasik cost", search_volume: 5400, keyword_difficulty: 31, position: 7, position_absolute: 7, previous_position: 5, etv: 900, relative_url: "/lasik/" }),
  rankedKeyword({ keyword: "asg eye hospital mysore", search_volume: 3600, position: 1, position_absolute: 1, previous_position: 1, etv: 1834, relative_url: "/hospital/mysore/" }),
  rankedKeyword({ keyword: "cataract surgery", search_volume: null, keyword_difficulty: null, position: 12, position_absolute: 12, previous_position: null, rank_changes_known: false, etv: null, relative_url: null }),
]) => envelope("ranked-keywords", { totalCount: 4139, items })

/** A competitors payload in the backend's shape; the rows are REAL (asgeyehospital.com, live check 2026-10-27). */
const shared = (etv, pos_1, pos_2_3, pos_4_10) => ({ etv, pos_1, pos_2_3, pos_4_10 })
export const competitors = (items = [
  { domain: "dragarwal.com", intersections: 2423, avg_position: 12.786628146925299, total: { count: 10222, etv: 328637.028294719, estimated_paid_traffic_cost: 138179.48659965894 }, project_shared: shared(26007.879283742077, 32, 151, 643), competitor_shared: shared(36882.67061826761, 213, 346, 904) },
  { domain: "centreforsight.net", intersections: 2155, avg_position: 14.012529002320186, total: { count: 6595, etv: 122538.52720367993, estimated_paid_traffic_cost: 29243.080406758985 }, project_shared: shared(21158.107568942418, 17, 127, 570), competitor_shared: shared(30991.18839733937, 111, 228, 814) },
  { domain: "aao.org", intersections: 1993, avg_position: 15.08, total: { count: 17403, etv: 262066.76, estimated_paid_traffic_cost: null }, project_shared: shared(18000, 10, 90, 500), competitor_shared: shared(25000, 80, 200, 700) },
], self = { domain: "asgeyehospital.com", intersections: 4139, avg_position: 22.2995892727712, total: { count: 4139, etv: 100411.929526025, estimated_paid_traffic_cost: 24520.310160559413 }, project_shared: shared(100411.929526025, 165, 308, 1037), competitor_shared: shared(100411.929526025, 165, 308, 1037) }) => envelope("competitors", { totalCount: 18778, self, items })

export const backlinks = (o = {}) => envelope("backlinks", { rank: 352, backlinks: 18297, referring_domains: 3949, broken_backlinks: 1628, target_spam_score: 5, ...o })

/** A SectionState the way useDomainOverview builds it. */
export const ok = (data) => ({ status: "success", data, error: null, isFetching: false, refetch: () => {} })
export const loading = () => ({ status: "loading", data: null, error: null, isFetching: true, refetch: () => {} })
export const failed = (message = "The data service is temporarily unavailable. Please try again later.", code = "PROVIDER_UNAVAILABLE", refetch = () => {}) =>
  ({ status: "error", data: null, error: { message, code }, isFetching: false, refetch })

export const allOk = () => ({
  rankOverview: ok(rankOverview()),
  history: ok(history()),
  rankedKeywords: ok(rankedKeywords()),
  competitors: ok(competitors()),
  backlinks: ok(backlinks()),
})

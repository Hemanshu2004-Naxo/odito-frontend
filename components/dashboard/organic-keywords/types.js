/**
 * JSDoc types for the Organic Keywords page (documentation and editor help only; nothing is imported at run time).
 */

/**
 * One entry of the ranked-keywords payload the backend sends (`data.result.items[]`). Missing figures are null.
 * @typedef {object} RankedKeywordItem
 * @property {string} keyword
 * @property {number|null} search_volume
 * @property {number|null} keyword_difficulty
 * @property {number|null} position            rank_group: the position Google's results page shows
 * @property {number|null} position_absolute   rank_absolute: used (with previous_position) to measure movement
 * @property {number|null} previous_position   previous absolute rank; null with rank_changes_known = a NEW keyword
 * @property {boolean} rank_changes_known
 * @property {number|null} etv                 estimated monthly organic traffic
 * @property {string|null} relative_url
 * @property {string|null} type                serp_item.type ("organic", "featured_snippet", ...)
 * @property {boolean|null} is_new
 * @property {boolean|null} is_up
 * @property {boolean|null} is_down
 * @property {string|null} intent              informational | navigational | commercial | transactional
 * @property {number|null} cpc
 * @property {string|null} competition_level
 * @property {number|null} low_top_of_page_bid
 * @property {number|null} high_top_of_page_bid
 * @property {{ year: number, month: number, search_volume: number|null }[]} monthly_searches
 * @property {number|null} estimated_paid_traffic_cost
 * @property {string|null} url
 * @property {string|null} title
 * @property {string[]} serp_features
 * @property {string|null} check_url
 * @property {number|null} referring_domains
 * @property {number|null} backlinks
 * @property {string|null} last_updated_time
 */

/**
 * @typedef {object} KeywordRow  what the table shows (see mapRankedKeyword)
 * @property {string} id
 * @property {string} keyword
 * @property {string|null} googleUrl
 * @property {number|null} position
 * @property {{ kind: "new"|"up"|"down"|"same"|"unknown", amount: number|null }} change
 * @property {{ type: string, label: string }|null} resultType  non-organic result type, else null
 * @property {number|null} volume
 * @property {{ key: string, year: number, month: number, volume: number|null, label: string }[]} monthly  oldest -> newest
 * @property {number|null} difficulty
 * @property {{ key: string, label: string, dot: string }|null} kdBand
 * @property {number|null} cpc
 * @property {string|null} competition
 * @property {number|null} lowBid
 * @property {number|null} highBid
 * @property {{ value: string, letter: string, label: string, hint: string }|null} intent
 * @property {number|null} traffic
 * @property {number|null} trafficShare  percent of the whole domain's traffic
 * @property {number|null} trafficValue
 * @property {string|null} path
 * @property {string|null} url
 * @property {string|null} title
 * @property {{ key: string, label: string }[]} serpFeatures
 * @property {number|null} referringDomains
 * @property {number|null} backlinks
 * @property {Date|null} lastUpdated
 * @property {number|null} previousPosition
 * @property {string[]} serpFeatureKeys
 */

/**
 * @typedef {object} FilterState  the filter inputs, exactly as the user typed them
 * @property {string} q            keyword contains
 * @property {string} exclude      keyword does not contain
 * @property {string} position     "all" | "top3" | "top10" | "11-20" | "21-50" | "51-100"
 * @property {string} volMin
 * @property {string} volMax
 * @property {string} kdMin
 * @property {string} kdMax
 * @property {string[]} intents
 * @property {string} movement     "all" | "new" | "up" | "down"
 * @property {string} url          ranking URL contains
 */

/**
 * @typedef {FilterState & { sort: string, dir: "asc"|"desc", page: number, pageSize: number }} PageState  what the URL holds
 */

/**
 * @typedef {object} Summary  the whole domain, from an unfiltered response
 * @property {number|null} total
 * @property {number|null} top3
 * @property {number|null} top10
 * @property {number|null} traffic
 * @property {{ added: number|null, up: number|null, down: number|null }} movement
 */

export {}

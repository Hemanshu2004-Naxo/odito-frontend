/**
 * Where each clickable number on the Domain Overview goes. Every target is a page that already keeps its view in the URL, so a link is just
 * its address: the page reads the filter from the query string when it opens.
 */

export const ORGANIC_KEYWORDS = "/app/organic-keywords"
export const TRAFFIC_HISTORY = "/app/traffic-history"
export const REFERRING_DOMAINS = "/app/referring-domains"
export const BACKLINKS_LIST = "/app/backlinks/list"
export const ANCHORS = "/app/backlinks/anchors"
export const TOP_PAGES = "/app/backlinks/top-pages"
export const COMPETITORS = "/app/competitors"

/**
 * "Keyword positions" bar -> the Organic Keywords position chip that covers the same range (`pos=`). The keys are the bars' own
 * (lib/seoMetrics POSITION_BUCKETS); the values are the chips' (organic-keywords/constants POSITION_OPTIONS).
 */
export const POSITION_PARAM = Object.freeze({ top1: "top1", top3: "2-3", top10: "4-10", top20: "11-20", top50: "21-50", top100: "51-100" })
export const positionHref = (bucketKey) => (POSITION_PARAM[bucketKey] ? `${ORGANIC_KEYWORDS}?pos=${POSITION_PARAM[bucketKey]}` : ORGANIC_KEYWORDS)

/** Movement card -> Organic Keywords movement filter (`mv=`). Lost keywords have no row to list (they no longer rank). */
export const MOVEMENT_PARAM = Object.freeze({ new: "new", improved: "up", declined: "down" })
export const movementHref = (key) => (MOVEMENT_PARAM[key] ? `${ORGANIC_KEYWORDS}?mv=${MOVEMENT_PARAM[key]}` : null)
export const LOST_HINT = "Lost keywords are no longer ranking, so they can't be listed."

/** Referring Domains' tabs (`tab=`): the high-spam domains are its "Toxic" tab. */
export const referringDomainsHref = (tab) => (tab ? `${REFERRING_DOMAINS}?tab=${tab}` : REFERRING_DOMAINS)

/** The Backlinks page's broken tab (`broken=true`). */
export const BROKEN_BACKLINKS = `${BACKLINKS_LIST}?broken=true`

/** "View all N keywords" for a Brand / Non-brand list: the Organic Keywords page applies the same saved brand terms through `brand=`. */
export const keywordsHref = (brandMode) => (brandMode === "non" || brandMode === "only" ? `${ORGANIC_KEYWORDS}?brand=${brandMode}` : ORGANIC_KEYWORDS)

/** Anchors -> Anchor settings (the dialog lives on the Anchors page). */
export const ANCHOR_SETTINGS_HINT = "Add brand terms in Anchors → Anchor settings"

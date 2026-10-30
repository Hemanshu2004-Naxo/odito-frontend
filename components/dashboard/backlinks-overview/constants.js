/** Everything the Backlink Overview treats as a rule, in one place, so it can be adjusted later without touching the code that uses it. */

/**
 * "Profile health" thresholds. Percentages are 0–100.
 *  spam:  score <= low is Low (green), <= medium is Medium (amber), above is High (red) — the same bands as the Spam Score badge.
 *  dofollowMinPercent: below this share of dofollow referring domains, amber.
 *  subnetDiversityMinPercent: below this (referring subnets ÷ referring domains), amber.
 *  footerMaxPercent: above this share of links in the footer, amber.
 */
export const PROFILE_HEALTH = Object.freeze({
  spam: Object.freeze({ low: 10, medium: 30 }),
  dofollowMinPercent: 50,
  subnetDiversityMinPercent: 30,
  footerMaxPercent: 30,
})

/** Spam score bands: 0–10 Low, 11–30 Medium, 31+ High. Uses PROFILE_HEALTH.spam. */
export const SPAM_BANDS = Object.freeze({
  low: Object.freeze({ key: "low", label: "Low" }),
  medium: Object.freeze({ key: "medium", label: "Medium" }),
  high: Object.freeze({ key: "high", label: "High" }),
})

/** How many bars the Countries and TLDs charts show before the rest are summed into "Others". */
export const TOP_N = 10

/** Where the page's links go until those pages exist (placeholder routes). */
export const LINKS = Object.freeze({
  referringDomains: "/app/referring-domains",
  brokenBacklinks: "/app/backlinks/list?broken=true",
  brokenPages: "/app/backlinks/top-pages?status=error",
})

export const OTHERS_KEY = "__others__"

/** The rank scale: DataForSEO's rank runs 0–1000. */
export const RANK_MAX = 1000

export const RANK_HINT = "DataForSEO rank, based on the quality and quantity of backlinks (like PageRank)."
export const PLACEMENT_HINT = "Links inside article content are usually worth more than footer or sidebar links."

/** What each link attribute means (tooltips on the Link attributes chart). `highlight` ones are drawn in amber. */
export const ATTRIBUTE_INFO = Object.freeze({
  nofollow: { text: "Asks search engines not to pass ranking credit through the link." },
  sponsored: { text: "Marks a paid or sponsored link. Search engines treat it as an ad, not an endorsement.", highlight: true },
  ugc: { label: "UGC", text: "User-generated content: the link was placed by a visitor, for example in a comment or a forum post.", highlight: true },
  noopener: { text: "A security setting for links that open in a new tab. It does not affect rankings." },
  noreferrer: { text: "Hides where the visitor came from. It does not affect rankings." },
  external: { text: "The link leads to a different site." },
})

/** Friendly names for the link types, where Title Case of the key would read badly. */
export const LINK_TYPE_LABELS = Object.freeze({ anchor: "Text Anchor", image: "Image", redirect: "Redirect", meta: "Meta", canonical: "Canonical", alternate: "Alternate", link: "Link" })

/** The semantic-location key the "footer share" check looks at. */
export const FOOTER_KEY = "footer"

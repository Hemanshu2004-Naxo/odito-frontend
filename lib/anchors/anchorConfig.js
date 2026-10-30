/**
 * Everything the Anchors page treats as a rule, in one place, so it can be adjusted without touching the code that uses it:
 * the anchor types and their fixed colours, the generic-anchor list, the profile-health thresholds, and a few sizes.
 */

/**
 * The anchor types. Each has ONE colour, used everywhere on the page (chips, donut, bars). The colours are mid-tones that read on both
 * the light and the dark theme; the amber / red of the health checks are not among them, so a type never looks like a warning.
 */
export const ANCHOR_TYPES = Object.freeze({
  branded: Object.freeze({ key: "branded", label: "Branded", color: "#2563eb", description: "Contains one of your brand terms" }),
  exact: Object.freeze({ key: "exact", label: "Exact match", color: "#ea580c", description: "Is exactly one of your target keywords" }),
  partial: Object.freeze({ key: "partial", label: "Partial match", color: "#ca8a04", description: "Contains a target keyword, or all of its words" }),
  naked_url: Object.freeze({ key: "naked_url", label: "Naked URL", color: "#7c3aed", description: "The link text is a web address or contains your domain" }),
  generic: Object.freeze({ key: "generic", label: "Generic", color: "#0d9488", description: "A phrase such as “click here” or “read more”" }),
  empty: Object.freeze({ key: "empty", label: "Empty / image", color: "#64748b", description: "No link text — usually an image link" }),
  other: Object.freeze({ key: "other", label: "Other", color: "#a8a29e", description: "Anything else" }),
})

/** Display order (donut, legend, filter chips): the types a profile is judged by first, the catch-alls last. */
export const TYPE_KEYS = Object.freeze(["branded", "exact", "partial", "naked_url", "generic", "empty", "other"])

/** What an anchor with no text is called in the table, the chart and the CSV. */
export const EMPTY_ANCHOR_LABEL = "(empty / image link)"

/** Link texts that say nothing about the page. Matched whole (case-insensitive, ignoring spaces and punctuation at the ends). */
export const GENERIC_ANCHORS = Object.freeze([
  "click here", "here", "read more", "learn more", "website", "visit", "visit website", "this site", "link", "source", "more info",
  "continue to external page", "check it out", "view", "see more",
])

/**
 * Profile-health thresholds. Every percentage is 0–100 and is a share of referring domains unless it says otherwise.
 *  exactMaxPercent:        exact-match anchors above this share look manipulative (amber).
 *  brandedPlusNakedMinPercent: branded + naked-URL anchors below this share are unusual for a natural profile (amber).
 *  repeatedAnchorMaxPercent: one non-branded anchor above this share of ALL referring domains is "heavily repeated" (amber).
 *  spam:                   anchors scoring above `score` that carry more than `maxBacklinksPercent` of all backlinks are spammy (red).
 *  sitewide:               an anchor from ONE referring domain with at least `minBacklinks` links is a sitewide / footer link (amber).
 *  sitewideRatio:          backlinks ÷ referring domains at or above this earns the table's "sitewide" chip.
 */
export const ANCHOR_HEALTH = Object.freeze({
  exactMaxPercent: 10,
  brandedPlusNakedMinPercent: 30,
  repeatedAnchorMaxPercent: 15,
  spam: Object.freeze({ score: 30, maxBacklinksPercent: 10 }),
  sitewide: Object.freeze({ minBacklinks: 50, maxReferringDomains: 1 }),
  sitewideRatio: 20,
})

/** Spam badge bands for the table (the same bands as the Backlink Overview): 0–10 green, 11–30 amber, 31+ red. */
export const SPAM_BANDS = Object.freeze({ low: 10, medium: 30 })

/** The profile call asks for this many anchors (the provider's per-request maximum); more than this and the page says so. */
export const PROFILE_LIMIT = 1000
/** Bars in the "Top anchors" chart. */
export const TOP_ANCHORS = 15
/** "Import from Organic Keywords": how many to offer, and how many to fetch when nothing is cached. */
export const IMPORT_KEYWORDS = Object.freeze({ offer: 20, fetch: 50 })

/** Rank scale (DataForSEO's 0–1000). */
export const RANK_MAX = 1000

/**
 * Words a brand name is often built from, used ONLY to suggest brand terms from a domain: "asgeyehospital" is split at these words into
 * "asg", "eye", "hospital". Longer words first so "center" is not read as "cent" + "er".
 */
export const BRAND_SPLIT_WORDS = Object.freeze([
  "hospital", "hospitals", "clinic", "clinics", "centre", "center", "centres", "centers", "dental", "dentist", "health", "healthcare", "medical",
  "care", "eye", "eyes", "vision", "laser", "skin", "hair", "surgery", "institute", "research", "foundation", "solutions", "services", "group",
  "studio", "agency", "digital", "marketing", "hotel", "hotels", "restaurant", "academy", "school", "college", "university", "law", "legal",
  "realty", "estate", "homes", "travel", "tours", "fitness", "yoga", "spa", "salon", "pharmacy", "labs", "lab",
])

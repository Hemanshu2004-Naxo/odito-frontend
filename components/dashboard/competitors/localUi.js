/**
 * Pure rules for the Local Competitors tab (backend: /api/projects/:projectId/local-competitors). Everything shown comes from the live
 * Google result of the search the user ran; none of it is saved, so none of it survives leaving the page.
 */

export const RADII_KM = [1, 3, 5, 10, 15, 25]
export const DEFAULT_RADIUS_KM = 5

/** 850 -> "850 m", 1234 -> "1.2 km". */
export function formatDistance(meters) {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return "—"
  if (meters < 1000) return `${Math.round(meters / 10) * 10 || 10} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

export const RELEVANCE_LABEL = { direct: "Category match", related: "Related", unclassified: "Unclassified" }
export const RELEVANCE_HINT = {
  direct: "Its Google category is one of your business's categories and its name uses your own words.",
  related: "Its Google category or its name matches your business, but not both.",
  unclassified: "Nothing connects it to what your business does. It is only nearby.",
}

export const FILTERS = [
  { key: "all", label: "All" },
  { key: "direct", label: "Category matches" },
  { key: "has_website", label: "Has website" },
  { key: "not_added", label: "Not yet added" },
  { key: "added", label: "Already added" },
]
export const SORTS = [
  { key: "distance", label: "Distance" },
  { key: "relevance", label: "Relevance" },
  { key: "rating", label: "Rating" },
  { key: "reviews", label: "Review count" },
]

/** Filter by one of FILTERS, plus optional minimum rating / review count. Never mutates the list. */
export function applyLocalFilters(results, { filter = "all", minRating = 0, minReviews = 0 } = {}) {
  return results.filter((r) => {
    if (filter === "direct" && r.relevance !== "direct") return false
    if (filter === "has_website" && !r.websiteDomain) return false
    if (filter === "not_added" && r.addedCompetitorId) return false
    if (filter === "added" && !r.addedCompetitorId) return false
    if (minRating > 0 && !(typeof r.rating === "number" && r.rating >= minRating)) return false
    if (minReviews > 0 && !(typeof r.reviewCount === "number" && r.reviewCount >= minReviews)) return false
    return true
  })
}

const REL_ORDER = { direct: 0, related: 1, unclassified: 2 }
/** Sort a copy. Missing ratings / review counts sort LAST in either direction: unknown is never treated as zero. */
export function sortLocal(results, sort = "distance") {
  const list = [...results]
  const cmpNum = (a, b, desc) => {
    const aMissing = typeof a !== "number"; const bMissing = typeof b !== "number"
    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1
    return desc ? b - a : a - b
  }
  if (sort === "rating") return list.sort((a, b) => cmpNum(a.rating, b.rating, true) || a.distanceMeters - b.distanceMeters)
  if (sort === "reviews") return list.sort((a, b) => cmpNum(a.reviewCount, b.reviewCount, true) || a.distanceMeters - b.distanceMeters)
  if (sort === "relevance") return list.sort((a, b) => (REL_ORDER[a.relevance] ?? 3) - (REL_ORDER[b.relevance] ?? 3) || a.distanceMeters - b.distanceMeters)
  return list.sort((a, b) => a.distanceMeters - b.distanceMeters)
}

/**
 * Where each result sits on a square schematic map centred on the business. Distances are to scale: the ring at `radiusKm` touches the
 * edge of the plotted area. Uses each place's own coordinates; a place without them is not plotted.
 * @returns {{ id: string, x: number, y: number }[]}  x, y in 0..100 (percent of the map)
 */
export function projectToMap(center, results, radiusKm, margin = 8) {
  if (!center) return []
  const half = 50 - margin
  const kmPerLat = 110.574
  const kmPerLng = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  return results
    .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
    .map((r) => {
      const dx = ((r.lng - center.lng) * kmPerLng) / radiusKm
      const dy = ((r.lat - center.lat) * kmPerLat) / radiusKm
      return { id: r.placeId, x: 50 + Math.max(-1, Math.min(1, dx)) * half, y: 50 - Math.max(-1, Math.min(1, dy)) * half }
    })
}

/** What to tell the user for each failure the server can answer, and whether a different action can fix it. */
export function describeLocalError(error) {
  const code = error?.code ?? null
  const table = {
    LOCATION_REQUIRED: { title: "Odito doesn't know where your business is", text: "Verify your business location in your project settings, then search again. Odito never guesses a location.", action: "settings" },
    LOCATION_NEEDS_CONFIRMATION: { title: "Confirm your business address", text: "Your business has an address but no saved map position. Odito can look the address up once, which counts as one Google request.", action: "confirm" },
    CATEGORY_REQUIRED: { title: "What kind of business should Odito look for?", text: "Odito could not tell from your project. Enter a category such as “dental clinic”.", action: "category" },
    LOCAL_BUDGET_EXCEEDED: { title: "Daily limit reached", text: "This project used its daily allowance of local searches. Try again tomorrow.", action: null },
    LOCAL_DISABLED: { title: "Local Competitors is switched off", text: "It is turned off on this server.", action: null },
    PLACES_NOT_CONFIGURED: { title: "Local search isn't set up yet", text: "Google Places is not configured on this server.", action: null },
    PLACES_KEY_INVALID: { title: "Local search is unavailable", text: "It could not be reached right now. This is a problem on Odito's side, not with your project.", action: null },
    PLACES_ACCESS_DENIED: { title: "Local search is unavailable", text: "It could not be reached right now. This is a problem on Odito's side, not with your project.", action: null },
    PLACES_BILLING_REQUIRED: { title: "Local search is unavailable", text: "It could not be reached right now. This is a problem on Odito's side, not with your project.", action: null },
    PLACES_RATE_LIMITED: { title: "Google is busy", text: "Please try again in a minute.", action: "retry" },
    PLACES_TIMEOUT: { title: "Google took too long", text: "Please try again.", action: "retry" },
    PLACES_UNAVAILABLE: { title: "Google could not be reached", text: "Please try again.", action: "retry" },
    PLACES_BAD_RESPONSE: { title: "Google gave an unexpected answer", text: "Please try again.", action: "retry" },
    RATE_LIMITED: { title: "Too many searches", text: "Please wait a few minutes and try again.", action: null },
  }
  return table[code] ?? { title: "The search could not be completed", text: error?.message || "Please try again.", action: "retry" }
}

const WARNINGS = {
  RESULT_CAP: "Google returns at most 20 places per search, so there may be more businesses nearby than are listed. Try a smaller radius or a more specific category.",
  SOME_SEARCHES_FAILED: "One of the searches did not complete, so the list may be missing some businesses.",
  BROAD_CATEGORY: "Odito could only tell your general industry, so this search is broad. Add a category (for example “eye hospital”) for a sharper list.",
}
export const warningText = (code) => WARNINGS[code] ?? null

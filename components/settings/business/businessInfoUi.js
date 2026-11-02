/** Pure helpers for Project Settings → Business Information: form <-> server shape, validation (mirrors the server's rules), dirty checks. */

export const EMPTY_LOCATION = Object.freeze({ placeId: "", name: "", address: "", addressLine: "", city: "", state: "", country: "", countryCode: "", postalCode: "", lat: "", lng: "" })

const s = (v) => (v === null || v === undefined ? "" : String(v))

export function identityToForm(identity) {
  const i = identity ?? {}
  return {
    businessName: s(i.businessName), industry: s(i.industry), subIndustry: s(i.subIndustry), businessType: s(i.businessType),
    primaryCategory: s(i.primaryCategory), secondaryCategories: [...(i.secondaryCategories ?? [])], services: [...(i.services ?? [])],
  }
}

export function locationToForm(location) {
  if (!location) return { ...EMPTY_LOCATION }
  return {
    placeId: s(location.placeId), name: s(location.name), address: s(location.address), addressLine: s(location.addressLine), city: s(location.city),
    state: s(location.state), country: s(location.country), countryCode: s(location.countryCode), postalCode: s(location.postalCode),
    lat: location.lat === null || location.lat === undefined ? "" : String(location.lat), lng: location.lng === null || location.lng === undefined ? "" : String(location.lng),
  }
}

/** A picked Google place -> form values. Parts Google did not return stay empty (never guessed). */
export function placeToForm(place) {
  return locationToForm({ ...place, lat: place.location?.lat, lng: place.location?.lng })
}

export const sameForm = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** "19.9975" -> 19.9975; "" / "abc" / "1e500" -> null. Only plain decimal numbers count. */
export function parseCoordinate(text) {
  const t = s(text).trim()
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** @returns {Record<string,string>} field -> message; empty when the location can be saved. */
export function validateLocation(f) {
  const e = {}
  if (!f.address.trim()) e.address = "Enter the business address."
  const lat = parseCoordinate(f.lat); const lng = parseCoordinate(f.lng)
  if (lat === null) e.lat = "Latitude must be a number, for example 19.9975."
  else if (lat < -90 || lat > 90) e.lat = "Latitude must be between -90 and 90."
  if (lng === null) e.lng = "Longitude must be a number, for example 73.7898."
  else if (lng < -180 || lng > 180) e.lng = "Longitude must be between -180 and 180."
  if (lat === 0 && lng === 0) e.lat = "(0, 0) is not a real business location."
  if (f.countryCode.trim() && !/^[A-Za-z]{2}$/.test(f.countryCode.trim())) e.countryCode = "Use two letters, for example IN."
  if (f.address.length > 300) e.address = "The address is too long (300 characters at most)."
  return e
}

export function validateIdentity(f) {
  const e = {}
  if (f.businessName.length > 200) e.businessName = "At most 200 characters."
  if (f.subIndustry.length > 100) e.subIndustry = "At most 100 characters."
  if (f.businessType.length > 200) e.businessType = "At most 200 characters."
  if (f.primaryCategory.length > 100) e.primaryCategory = "At most 100 characters."
  if (f.services.length > 30) e.services = "At most 30 services."
  if (f.secondaryCategories.length > 10) e.secondaryCategories = "At most 10 categories."
  return e
}

/** Form -> the body for PUT business-info (location). `confirmed` is passed in by the caller from the user's own tick box. */
export function locationToBody(f, { confirmed, coordinatesAdjusted }) {
  return {
    confirmed: confirmed === true,
    placeId: f.placeId.trim() || null, name: f.name.trim() || null, address: f.address.trim(), addressLine: f.addressLine.trim() || null,
    city: f.city.trim() || null, state: f.state.trim() || null, country: f.country.trim() || null, countryCode: f.countryCode.trim() || null,
    postalCode: f.postalCode.trim() || null, lat: parseCoordinate(f.lat), lng: parseCoordinate(f.lng), coordinatesAdjusted: Boolean(coordinatesAdjusted),
  }
}

export function identityToBody(f) {
  return {
    businessName: f.businessName.trim() || null, industry: f.industry || null, subIndustry: f.subIndustry.trim() || null, businessType: f.businessType.trim() || null,
    primaryCategory: f.primaryCategory.trim() || null, secondaryCategories: f.secondaryCategories, services: f.services,
  }
}

const STATUS = {
  confirmed: { label: "Location confirmed by you", tone: "success", text: "You confirmed this is where the business is. Local Competitors searches around it." },
  unconfirmed: { label: "Needs your confirmation", tone: "warning", text: "A location was saved when the project was set up, but you have not confirmed it. Check it on the map and confirm it." },
  missing: { label: "No business location", tone: "danger", text: "Odito does not know where your business is, so Local Competitors cannot search yet. Odito never guesses a location." },
}
export const describeStatus = (status) => STATUS[status] ?? STATUS.missing

export function formatWhen(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/** A new Places session token (the server accepts 16-64 letters, digits, "_" and "-"). */
export function newSessionToken() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Display helpers for the Social Media AI business profile
 * (GET /social/business-profile — see odito_backend socialBusinessProfileResolver.js).
 * Nothing here decides a value: the backend resolves every fact and labels it with a
 * `source`; this file only turns those labels into words.
 */

/** Where things are edited. The Brand Kit lives in Settings → Brand kit; business facts stay in Business Profile. */
export const BRAND_KIT_HREF = '/app/social-media/settings?tab=brand-kit'
export const BUSINESS_PROFILE_HREF = '/app/social-media/business-profile'
export const CONNECT_ACCOUNTS_HREF = '/app/social-media/connect-accounts'

const BRAND_KIT_FIELDS = new Set(['audience', 'goals', 'toneOfVoice', 'uniqueSellingPoints', 'offers', 'competitors', 'contentPillars', 'brand'])

/**
 * The button that fixes one strategy gap: where its field is edited and a short verb for it. A gap the AI named in its own words (case
 * studies, a booking page) goes to the business information, where such facts are added.
 */
const GAP_ACTIONS = Object.freeze({
  audience: ['Add your audience', BRAND_KIT_HREF],
  goals: ['Add goals', BRAND_KIT_HREF],
  toneOfVoice: ['Set tone of voice', BRAND_KIT_HREF],
  uniqueSellingPoints: ['Add selling points', BRAND_KIT_HREF],
  offers: ['Add offers', BRAND_KIT_HREF],
  competitors: ['Add competitors', BRAND_KIT_HREF],
  contentPillars: ['Add content pillars', BRAND_KIT_HREF],
  brand: ['Set brand colours', BRAND_KIT_HREF],
  connectedPlatforms: ['Connect accounts', CONNECT_ACCOUNTS_HREF],
  businessModel: ['Choose business type', `${BUSINESS_PROFILE_HREF}#business-type`],
  services: ['Add services', `${BUSINESS_PROFILE_HREF}#offerings`],
  products: ['Add products', `${BUSINESS_PROFILE_HREF}#offerings`],
  description: ['Add a description', `${BUSINESS_PROFILE_HREF}#business-information`],
  category: ['Add a category', `${BUSINESS_PROFILE_HREF}#business-information`],
  location: ['Add your location', `${BUSINESS_PROFILE_HREF}#business-information`],
})

export function gapAction(field) {
  const known = GAP_ACTIONS[field]
  if (known) return { label: known[0], href: known[1] }
  return { label: 'Add details', href: `${BUSINESS_PROFILE_HREF}#business-information` }
}

/** The page where a strategy gap (see GAP_LABELS in aiStrategy.js) is filled in. */
export function gapDestination(field) {
  if (BRAND_KIT_FIELDS.has(field)) return { href: BRAND_KIT_HREF, label: 'Open Settings › Brand kit' }
  if (field === 'connectedPlatforms') return { href: CONNECT_ACCOUNTS_HREF, label: 'Open Connect Accounts' }
  return { href: BUSINESS_PROFILE_HREF, label: 'Open Business profile' }
}

export const SOURCE_LABELS = Object.freeze({
  social_override: 'User provided',
  google_business_profile: 'Google Business Profile',
  verified_business: 'Verified business (setup)',
  seo_project: 'Odito project',
  website_extraction: 'Website',
  unavailable: 'Not available',
})

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || 'Not available'
}

/**
 * The two business models. The choice only decides whether the Services or the Product Catalog experience is
 * offered (and what the AI is told); a service business may still mention products and vice versa.
 */
export const BUSINESS_MODELS = Object.freeze([
  { value: 'service', label: 'Service-based', description: 'Your business primarily provides services to customers.' },
  { value: 'product', label: 'Product-based', description: 'Your business primarily sells physical or digital products.' },
])

export const businessModelLabel = (value) => BUSINESS_MODELS.find((m) => m.value === value)?.label || null

/** A fact's value as one line of text (lists are joined). */
export const factText = (value) => (Array.isArray(value) ? value.join(', ') : value === null || value === undefined ? '' : String(value))

/**
 * When a user override wins, the backend keeps what would be used WITHOUT it as `fact.underlying`
 * ({ value, source }). Returns that as display text, or null when nothing is being overridden.
 */
export function underlyingOf(fact) {
  const u = fact?.underlying
  if (!u || u.value === null || u.value === undefined || u.value === '') return null
  return { text: factText(u.value), source: u.source, label: sourceLabel(u.source) }
}

/** True for a fact that came from somewhere (it can be shown as a value). */
export function hasValue(fact) {
  return !!fact && fact.source !== 'unavailable' && fact.value !== null && fact.value !== undefined && fact.value !== ''
}

export function formatDateTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Text-area lines <-> list. Blank lines are dropped; the backend re-validates and de-duplicates. */
export const linesToList = (text) => (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
export const listToLines = (list) => (Array.isArray(list) ? list.join('\n') : '')

/** "" -> null so clearing a field clears it on the server. */
export const blankToNull = (text) => {
  const t = typeof text === 'string' ? text.trim() : text
  return t === '' || t === undefined ? null : t
}

/** Service area is free text or a short list of places: a comma / newline separated entry becomes a list. */
export function parseServiceArea(text) {
  const t = (text || '').trim()
  if (!t) return null
  if (/[,\n]/.test(t)) {
    const parts = t.split(/[,\n]/).map((p) => p.trim()).filter(Boolean)
    return parts.length ? parts : null
  }
  return t
}

export function serviceAreaToText(value) {
  if (Array.isArray(value)) return value.join(', ')
  return typeof value === 'string' ? value : ''
}

/** Human label for the connection badge on the Google Business Profile card. */
export function googleConnectionLabel(googleStatus) {
  if (!googleStatus) return 'Status unavailable'
  switch (googleStatus.connectionStatus) {
    case 'active': return googleStatus.serviceEnabled && googleStatus.locationSelected ? 'Connected' : 'Connected — no location selected'
    case 'expired': return 'Reconnect required'
    case 'revoked': return 'Disconnected'
    default: return 'Not connected'
  }
}

export const FRESHNESS_LABELS = Object.freeze({ fresh: 'Up to date', stale: 'Needs a sync', unknown: 'Not synced yet' })

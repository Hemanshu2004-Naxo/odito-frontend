import React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Shared helpers for the Social Media AI tests. The REAL hooks, mappers and
 * components run against a real QueryClient; only the network layer
 * (apiService) is replaced, and these fixtures are shaped exactly like the
 * backend's responses (odito_backend social_meta: toApiPublication and the
 * GET /social/accounts status payload) — never like the UI's own models.
 */

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
}

export function renderWithClient(ui, { queryClient = createQueryClient() } = {}) {
  const utils = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return { ...utils, queryClient }
}

/** Radix's DropdownMenu opens via Pointer Events jsdom lacks — render items inline (same convention as PostsTable.test.jsx). */
export function dropdownMenuMock() {
  const Pass = ({ children }) => React.createElement(React.Fragment, null, children)
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: ({ children }) => children,
    DropdownMenuContent: ({ children }) => React.createElement('div', { 'data-testid': 'dropdown-content' }, children),
    DropdownMenuItem: ({ children, onClick, disabled, asChild, className: _className, ...props }) => (asChild
      ? children
      : React.createElement('button', { type: 'button', onClick, disabled, ...props }, children)),
    DropdownMenuSeparator: () => React.createElement('hr'),
  }
}

/** `<a>` stand-in for next/link (no router context needed). */
export function nextLinkMock() {
  return { default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) }
}

let seq = 0

/** A publication exactly as GET /social/publishing returns it (toApiPublication). */
export function publication(overrides = {}) {
  seq += 1
  return {
    id: `pub-${seq}`,
    socialAccountId: 'acc-fb-1',
    platform: 'facebook',
    externalPostId: null,
    content: `Post number ${seq}`,
    media: [],
    status: 'scheduled',
    scheduledAt: '2099-03-10T09:00:00.000Z',
    timezone: 'UTC',
    publishedAt: null,
    failedAt: null,
    failureReason: null,
    failureCode: null,
    attempts: 0,
    nextRetryAt: null,
    outcomeUnknown: false,
    lastError: null,
    lastErrorCode: null,
    requiresReconnect: false,
    canRetry: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

const APPROVAL_STAGE = (state, status) => (state === 'design_approved' ? (status === 'draft' ? 'ready_to_schedule' : status) : state)

/** The `approval` block exactly as the backend's toApiApproval returns it for a post IN the workflow. */
export function approvalBlock(state, overrides = {}, status = 'draft') {
  return {
    managed: true,
    state,
    stage: APPROVAL_STAGE(state, status),
    publishable: state === 'design_approved',
    needsChanges: false,
    contentVersion: 1,
    designVersion: 1,
    submittedAt: '2026-10-01T10:05:00.000Z',
    submittedBy: 'user-1',
    submittedByName: 'Riya Shah',
    designSubmittedAt: null,
    designSubmittedBy: null,
    contentApprovedAt: state === 'content_review' ? null : '2026-10-01T10:10:00.000Z',
    contentApprovedBy: state === 'content_review' ? null : 'user-2',
    contentApprovedByName: state === 'content_review' ? null : 'Sam Lee',
    contentApprovedVersion: state === 'content_review' ? null : 1,
    designApprovedAt: state === 'design_approved' ? '2026-10-01T10:20:00.000Z' : null,
    designApprovedBy: state === 'design_approved' ? 'user-2' : null,
    designApprovedByName: state === 'design_approved' ? 'Sam Lee' : null,
    designApprovedVersion: state === 'design_approved' ? 1 : null,
    changesRequested: null,
    ...overrides,
  }
}

/** A publication that is IN the approval workflow at `state` (see approvalBlock). */
export function managedPublication(state, overrides = {}, approvalOverrides = {}) {
  const status = overrides.status || 'draft'
  return publication({
    status,
    scheduledAt: status === 'scheduled' ? '2099-03-10T09:00:00.000Z' : null,
    ...overrides,
    approval: approvalBlock(state, approvalOverrides, status),
  })
}

/** GET /social/accounts `data` payload pieces. */
export const ACTIVE_FACEBOOK = {
  connected: true, status: 'active', requiresReconnect: false, socialAccountId: 'acc-fb-1', accountId: 'pg_100',
  accountName: 'Acme Studio', connectedAt: '2026-09-01T00:00:00.000Z', lastVerifiedAt: '2026-10-01T09:00:00.000Z',
  picture: 'https://cdn.example.com/fb.jpg', category: 'Marketing agency', accountType: 'page', publishingReady: true,
}
export const ACTIVE_INSTAGRAM = {
  connected: true, status: 'active', requiresReconnect: false, socialAccountId: 'acc-ig-1', accountId: 'ig_200',
  username: 'acme_studio', connectedAt: '2026-09-01T00:00:00.000Z', lastVerifiedAt: null,
  picture: 'https://cdn.example.com/ig.jpg', accountType: 'business', publishingReady: true,
}
export const EXPIRED = (name = 'Acme Studio') => ({
  connected: false, status: 'expired', requiresReconnect: true, reason: 'TOKEN_EXPIRED', accountId: 'pg_100', accountName: name, picture: null, lastVerifiedAt: null,
})
export const NOT_CONNECTED_FB = { connected: false }
export const NOT_CONNECTED_IG = { connected: false, reason: 'NOT_CONNECTED' }

export function statusResponse({ facebook = NOT_CONNECTED_FB, instagram = NOT_CONNECTED_IG } = {}) {
  return { success: true, message: 'Success', data: { facebook, instagram } }
}

/**
 * Installs a fake GET /social/publishing on `api.getSocialPublications` that
 * behaves like the real endpoint: filters by status / from / to, newest-first,
 * clamps `limit` to 50 and returns { data, pagination, counts }. Returns a
 * spy-able `store` whose `rows` the test can mutate to simulate server state.
 */
export function installPublicationsApi(api, initialRows = []) {
  const store = { rows: [...initialRows], calls: [] }
  api.getSocialPublications.mockImplementation(async (projectId, filters = {}) => {
    store.calls.push({ projectId, filters })
    let rows = store.rows
    if (filters.status) rows = rows.filter((r) => r.status === filters.status)
    if (filters.approval === 'managed') rows = rows.filter((r) => r.approval?.managed)
    else if (filters.approval === 'unmanaged') rows = rows.filter((r) => !r.approval?.managed)
    else if (filters.approval) rows = rows.filter((r) => r.approval?.state === filters.approval)
    if (filters.from) rows = rows.filter((r) => r.scheduledAt && r.scheduledAt.slice(0, 10) >= filters.from)
    if (filters.to) rows = rows.filter((r) => r.scheduledAt && r.scheduledAt.slice(0, 10) <= filters.to)
    rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 20))
    const page = Math.max(1, Number(filters.page) || 1)
    const total = rows.length
    return {
      success: true,
      data: {
        data: rows.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        counts: { drafts: 0, scheduledToday: 0 },
      },
    }
  })
  return store
}

/** An error exactly as apiService.handleResponse throws it for a backend error response. */
export function apiError(message, { code, status = 400 } = {}) {
  const error = new Error(message)
  error.status = status
  error.details = code ? { code } : undefined
  return error
}

// ── Social business profile (GET/PUT /social/business-profile) ───────────

/** One resolved business fact exactly as socialBusinessProfileResolver returns it. */
export const fact = (value, source = 'google_business_profile', lastUpdated = '2026-10-08T10:00:00.000Z', detail) => ({
  value, source, lastUpdated: source === 'unavailable' ? null : lastUpdated, ...(detail ? { detail } : {}),
})
const NA = () => fact(null, 'unavailable')

/** The Brand Kit values the resolver returns (the logo is not part of it: `media.logo` is its one resolved home). */
export const EMPTY_RESOLVED_BRAND = {
  primaryColor: null, secondaryColor: null, accentColor: null, fontHeading: null, fontBody: null,
  name: null, description: null, voice: null, personality: [], tagline: null, keyMessages: [], preferredWords: [], additionalInstructions: null,
}

export const EMPTY_EDITABLE_PROFILE = {
  exists: false,
  businessModel: null,
  services: [],
  audience: { primary: null, secondary: [] },
  toneOfVoice: { primary: null, secondary: [] },
  goals: [], uniqueSellingPoints: [], offers: [], competitors: [],
  brand: { ...EMPTY_RESOLVED_BRAND, logo: null },
  prohibitedPhrases: [], contentPillars: [], additionalInstructions: '',
  overrides: {
    businessName: null, description: null, category: null, secondaryCategories: null, phone: null, website: null, address: null,
    city: null, region: null, country: null, postalCode: null, serviceArea: null,
  },
  updatedAt: null,
}

/** A product exactly as GET /social/products returns it (the PUBLIC shape: no storage key, no user ids). */
export function productData(over = {}) {
  const base = {
    id: 'prod-1', name: 'Premium Face Serum', slug: 'premium-face-serum', description: 'Hydrating vitamin C serum.', shortDescription: 'Vitamin C serum',
    category: 'Skincare', subcategory: null, features: ['Vitamin C'], benefits: ['Brighter skin'], price: 999, salePrice: null, currency: 'INR',
    priceDisplay: '₹999', salePriceDisplay: null, productUrl: 'https://shop.example.com/serum', sku: null, status: 'active', tags: [], images: [], primaryImageUrl: null,
    createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  }
  return { ...base, ...over }
}

export function productImage(over = {}) {
  return { mediaId: 'img-1', url: 'https://media.example/storage/social_media/proj-1/a.png', mimeType: 'image/png', width: 400, height: 300, size: 1000, altText: '', isPrimary: true, sortOrder: 0, ...over }
}

/** The list response body: `{ success, data: { products, total, limit } }`. */
export const productList = (products = []) => ({ success: true, data: { products, total: products.length, limit: 100 } })
/** A single-product response body (create / update / image operations). */
export const productResponse = (product, extra = {}) => ({ success: true, data: { product, ...extra } })

/** A GBP-connected, synced project. Pass `google: false` for a project with only Odito/website data. */
export function businessProfileData({ google = true, editable = {}, business = {}, media = {}, googleStatus = {}, meta = {}, brand, services, products } = {}) {
  const g = (v) => fact(v, google ? 'google_business_profile' : 'seo_project')
  const profile = {
    projectId: 'proj-1',
    business: {
      name: g('Acme Dental'), description: google ? fact('Family dentistry in Pune.') : NA(), category: google ? fact('Dentist') : fact('Healthcare', 'seo_project'),
      secondaryCategories: NA(), phone: google ? fact('+91 20 5550100') : NA(), website: g('https://acme-dental.example'),
      language: fact('en', 'seo_project'),
      location: {
        address: google ? fact('1 Main Street') : NA(), city: fact('Pune', 'verified_business'), region: fact('Maharashtra', 'verified_business'),
        postalCode: fact(null, 'unavailable', null, 'not_stored'), country: fact('India', 'verified_business'), countryCode: fact('IN', 'verified_business'),
        latitude: NA(), longitude: NA(),
      },
      businessModel: NA(), serviceArea: NA(), hours: { regular: google ? fact([{ openDay: 'MONDAY' }, { openDay: 'TUESDAY' }]) : NA(), special: NA() },
      mapsUri: NA(), reviewUri: NA(), rating: google ? fact(4.6) : NA(), reviewCount: google ? fact(120) : NA(),
      ...business,
    },
    media: { logo: fact('https://acme.example/logo.png', 'website_extraction', null, 'website_logo'), cover: NA(), photos: NA(), googleUrlsMayExpire: true, ...media },
    social: { facebook: { connected: false }, instagram: { connected: false } },
    strategy: {},
    brand: brand || EMPTY_RESOLVED_BRAND,
    services: services || [],
    products: products || [],
    meta: {
      hasGoogleBusinessProfile: google, googleConnected: google, lastGoogleSyncAt: google ? '2026-10-08T10:00:00.000Z' : null,
      freshness: { status: google ? 'fresh' : 'unknown', staleAfterDays: 7, metadataSyncedAt: null, detailsSyncedAt: null, reviewsSyncedAt: null, connectionLastSyncAt: null },
      catalog: { businessModel: null, serviceCount: 0, productCount: 0 }, sources: {}, ...meta,
    },
  }
  return {
    success: true,
    data: {
      resolvedProfile: profile,
      editableProfile: { ...EMPTY_EDITABLE_PROFILE, ...editable },
      googleStatus: google
        ? { connected: true, connectionStatus: 'active', serviceEnabled: true, locationSelected: true, hasSyncedData: true, dataMatchesSelectedLocation: true, googleEmail: 'owner@example.com', lastSyncAt: '2026-10-08T10:00:00.000Z', ...googleStatus }
        : { connected: false, connectionStatus: 'not_connected', serviceEnabled: false, locationSelected: false, hasSyncedData: false, dataMatchesSelectedLocation: null, googleEmail: null, lastSyncAt: null, ...googleStatus },
    },
  }
}

// ── AI strategy (GET /social/ai-strategy) ────────────────────────────────

/** A validated strategy exactly as the backend stores/returns it (strategyOutputSchema + server-owned fields). */
export function strategyBody(overrides = {}) {
  return {
    summary: 'Build local trust with practical dental education and real patient-facing offers.',
    positioning: { brandPositioning: 'A friendly neighbourhood dental practice.', valueProposition: 'Clear, gentle dental care for local families.', keyDifferentiators: ['Open late on weekdays'] },
    audience: { primaryAudience: 'Young families nearby', secondaryAudiences: ['Retirees'], painPoints: ['Nervous about dental visits'], interests: ['Family health'], motivations: ['Keeping the family healthy'] },
    goals: [{ goal: 'More bookings', priority: 'high', rationale: 'Supplied by the business as the main goal.' }],
    contentPillars: [
      { name: 'Dental tips', description: 'Simple everyday care advice.', purpose: 'Build trust', suggestedPercentage: 60, exampleTopics: ['Brushing basics'] },
      { name: 'Meet the team', description: 'The people behind the practice.', purpose: 'Reduce anxiety', suggestedPercentage: 40, exampleTopics: ['Team introductions'] },
    ],
    contentMix: [
      { type: 'educational', percentage: 50, rationale: 'Trust first.' },
      { type: 'behind_the_scenes', percentage: 30, rationale: 'Humanise the practice.' },
      { type: 'soft_sell', percentage: 20, rationale: 'Gentle conversion.' },
    ],
    platformStrategy: [
      { platform: 'facebook', role: 'Community and offers', contentTypes: ['Photo posts'], postsPerWeek: 3, connected: true },
      { platform: 'instagram', role: 'Visual storytelling', contentTypes: ['Reels'], postsPerWeek: 3, connected: false },
    ],
    toneAndVoice: { primaryTone: 'Warm and professional', secondaryTones: ['Reassuring'], writingGuidelines: ['Plain language'], avoid: ['Jargon'] },
    postingStrategy: { postsPerWeek: 4, recommendedDays: ['tuesday', 'thursday'], recommendedTimeWindows: ['Early evening'] },
    hashtagStrategy: { enabled: true, approach: 'A few local tags.', recommendedCount: 5, categories: ['Local'] },
    ctaStrategy: { preferredCTAs: ['Book a check-up'], objectives: ['Bookings'] },
    brandRules: { visualGuidelines: ['Bright, clean photography'], prohibitedPhrases: ['cheapest'] },
    recommendations: ['Post consistently for 8 weeks before judging results.'],
    assumptions: [],
    ...overrides,
  }
}

export function strategyDoc({ version = 1, strategy = {}, strategyGaps = [], snapshot = {}, planning = null } = {}) {
  return {
    id: `strat-${version}`, version, status: 'ready', generatedAt: '2026-10-09T10:00:00.000Z',
    strategy: strategyBody(strategy), strategyGaps,
    // the planning choice saved with the version; null = a strategy saved before the wizard existed
    planning,
    profileSnapshot: {
      generatedAt: '2026-10-09T09:59:00.000Z',
      data: {
        business: { name: 'Acme Dental', category: 'Dentist', location: { city: 'Pune', region: 'Maharashtra', country: 'India', address: '1 Main St' } },
        audience: { primary: 'Young families', secondary: [] }, toneOfVoice: { primary: 'Warm', secondary: [] }, goals: ['More bookings'], uniqueSellingPoints: ['Open late'],
        connectedPlatforms: { facebook: true, instagram: false }, ...snapshot,
      },
    },
  }
}

/** The whole GET /social/ai-strategy response. `status` none|generating|ready|failed. */
export function strategyResponse({ status = 'none', strategy = null, generation = null, profile = {} } = {}) {
  return {
    success: true,
    data: {
      status, strategy, generation,
      profile: { changed: false, changes: [], gaps: [], canGenerate: true, blockers: [], connectedPlatforms: { facebook: true, instagram: false }, ...profile },
    },
  }
}

export const generationDoc = (o = {}) => ({ id: 'gen-1', version: 1, status: 'generating', startedAt: '2026-10-09T10:00:00.000Z', finishedAt: null, planning: null, failure: null, ...o })

/** A saved planning choice as the API returns it (toApiPlanning). */
export const planningDoc = (o = {}) => ({ postsPerWeek: 3, months: 3, platforms: ['facebook'], estimatedPosts: 39, confirmedAt: '2026-10-09T10:00:00.000Z', ...o })

/** POST /social/ai-strategy/plan-preview: the SERVER's planner answer (the number below is the fixture's, never computed by the UI). */
export const planPreviewResponse = (o = {}) => ({
  success: true,
  data: {
    postsPerWeek: 3, months: 3, platforms: ['facebook'], estimatedPosts: 39,
    basis: { startDate: '2026-10-14', endDate: '2027-01-13', partialWeeks: [] },
    platformStates: { facebook: 'connected', instagram: 'none' },
    quota: { period: '2026-10', user: { limit: null, used: 0, committed: 0, reserved: 0, remaining: null }, project: { limit: null }, unavailable: null },
    quotaCheck: { fits: true },
    ...o,
  },
})

// ── single-post AI content (GET /social/ai-content/status, POST .../generate) ──

/** A generation record exactly as the backend returns it (toApiGeneration in socialContentGenerationService). */
export const contentGenerationDoc = (o = {}) => ({
  id: 'cgen-1', status: 'generating', request: { platform: 'facebook', contentPillar: 'Dental tips', objective: 'educational' }, strategyVersion: 1,
  startedAt: '2026-10-09T10:00:00.000Z', finishedAt: null, failure: null, result: null, ...o,
})

/** The saved draft as the status endpoint returns it (toApiDraft): re-read from the real SocialPublication. */
export const contentDraft = (o = {}) => ({
  id: 'pub-ai-1', status: 'draft', platform: 'facebook', content: 'Brushing for two minutes twice a day protects your smile. Book a check-up\n\n#DentalCare', contentVersion: 1,
  approvalState: 'content_review', approvalStage: 'content_review',
  generation: { source: 'ai', type: 'social_content', strategyVersion: 1, contentPillar: 'Dental tips', objective: 'educational' }, ...o,
})

/** The whole GET /social/ai-content/status response. */
export function contentStatusResponse({ status = 'none', generation = null, publication = null } = {}) {
  return { success: true, data: { status, generation, publication } }
}

/** POST /social/ai-content/generate -> 202. */
export function contentStartResponse({ generation = contentGenerationDoc(), alreadyRunning = false } = {}) {
  return { success: true, data: { status: 'generating', generationId: generation.id, alreadyRunning, generation } }
}

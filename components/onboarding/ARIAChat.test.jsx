import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

/**
 * Onboarding chat: business-search failure -> manual website fallback.
 *
 * Every Google / backend call is mocked (apiService is replaced wholesale), so
 * nothing here can reach Google, the Python worker, or a database.
 */

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))

const subscription = vi.hoisted(() => {
  const active = { data: { data: { status: 'active', credits: { remaining: 5 } } } }
  return { refetch: vi.fn(), active }
})
vi.mock('@/hooks/useDashboardQueries', () => ({
  useSubscription: () => ({ data: subscription.active, refetch: subscription.refetch }),
}))

const api = vi.hoisted(() => ({
  searchBusiness: vi.fn(),
  extractFromWebsite: vi.fn(),
  resolveWebsiteLocation: vi.fn(),
  generateKeywords: vi.fn(),
  createProject: vi.fn(),
  checkRanking: vi.fn(),
  saveRanking: vi.fn(),
  startAudit: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

import ARIAChat from './ARIAChat'
import { ONBOARDING_UPGRADE_RESUME_KEY } from '@/lib/onboardingResume'

// ── helpers ────────────────────────────────────────────────────────────────
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

const input = () => document.querySelector('.chat-input-row .chat-input')
const sendBtn = () => document.querySelector('.chat-send')

/** Type into the chat box and press send; the component answers after a 600 ms "thinking" delay. */
const say = async (text) => {
  fireEvent.change(input(), { target: { value: text } })
  fireEvent.click(sendBtn())
  await flush(700)
}

const backendError = (status, code, message = 'Service temporarily unavailable. Please try again later.') =>
  Object.assign(new Error(message), { status, code })

const BIZ = {
  placeId: 'ChIJ1', name: 'Sapphire Digital Agency', address: '1 Main St, Nashik, India', city: 'Nashik',
  country: 'India', countryCode: 'IN', website: 'https://www.sapphiredigitalagency.com/', location: { lat: 19.9, lng: 73.7 },
}

const extracted = (over = {}) => ({
  success: true,
  data: { businessName: 'Naxonify Scraped', address: '12 Scraped Rd, Pune', phone: '+91 1', email: 'hi@naxonify.com', category: 'Agency', confidence: 80, title: 'Naxonify', description: 'd', ...over },
})

const whole = (re) => screen.getByText(re)
const messagesText = () => Array.from(document.querySelectorAll('.chat-bubble')).map((n) => n.textContent)
// the extracted-data confirmation card (not the echoed user bubbles)
const cardText = () => Array.from(document.querySelectorAll('.chat-bubble-group'))
  .filter((g) => /here's what I found/i.test(g.textContent))
  .map((g) => g.textContent).join(' ')
const countMessages = (re) => messagesText().filter((t) => re.test(t)).length

/** Ask for name + location so the (mocked) search runs. */
const startSearch = async (name = 'sapphire digital agency', where = 'Nashik') => {
  await say(name)
  await say(where)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  sessionStorage.clear()

  subscription.refetch.mockResolvedValue(subscription.active)
  api.searchBusiness.mockResolvedValue({ success: true, data: { results: [BIZ] } })
  api.extractFromWebsite.mockResolvedValue(extracted())
  api.resolveWebsiteLocation.mockResolvedValue({ success: true, data: { city: 'Nashik', country: 'IN' } })
  api.generateKeywords.mockResolvedValue({ success: true, data: { keywords: [{ keyword: 'seo nashik' }, { keyword: 'digital agency nashik' }] } })
  api.createProject.mockResolvedValue({ success: true, data: { projectId: 'proj-1' } })
  api.checkRanking.mockResolvedValue({ success: false })
  api.saveRanking.mockResolvedValue({ success: true })
  api.startAudit.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── 1-2. discovery works / finds nothing ────────────────────────────────────
describe('business discovery - normal paths are unchanged', () => {
  it('lists matching businesses and shows no fallback form', async () => {
    render(<ARIAChat />)
    await startSearch()
    expect(api.searchBusiness).toHaveBeenCalledWith('sapphire digital agency', 'Nashik')
    expect(screen.getByText(/I found 1 business/i)).toBeInTheDocument()
    expect(screen.getByText('Sapphire Digital Agency')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: /continue with your website/i })).not.toBeInTheDocument()
  })

  it('selecting a listing continues onboarding (type step) with no extra website question', async () => {
    render(<ARIAChat />)
    await startSearch()
    fireEvent.click(screen.getByRole('button', { name: /yes, this is my business/i }))
    await flush()
    expect(screen.getByText(/What type of business is it/i)).toBeInTheDocument()
  })

  it('zero matches is NOT an error: the existing "Continue with Website" CTA appears', async () => {
    api.searchBusiness.mockResolvedValue({ success: true, data: { results: [] } })
    render(<ARIAChat />)
    await startSearch()
    expect(screen.getByText(/couldn't find your business/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with website/i })).toBeInTheDocument()
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument()
  })
})

// ── 3-4. discovery FAILS ────────────────────────────────────────────────────
describe('business discovery failure shows the manual website fallback', () => {
  it.each([
    ['403', backendError(403, 'PLACES_ACCESS_DENIED'), /not available right now/i],
    ['429', backendError(429, 'RATE_LIMIT_EXCEEDED'), /too many searches/i],
    ['500', backendError(500, 'INTERNAL_ERROR'), /something went wrong while looking up/i],
    ['503', backendError(503, 'API_CONFIGURATION_ERROR'), /not available right now/i],
    ['504 timeout', backendError(504, 'SEARCH_TIMEOUT'), /took too long/i],
    ['network failure', new TypeError('Failed to fetch'), /couldn't reach the search service/i],
  ])('%s -> fallback form, specific copy, conversation not reset', async (_label, error, copy) => {
    api.searchBusiness.mockRejectedValue(error)
    render(<ARIAChat />)
    await startSearch()

    expect(screen.getByText(/Business search is temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(screen.getByText(/connect your Google Business Profile later/i)).toBeInTheDocument()

    const form = screen.getByRole('form', { name: /continue with your website/i })
    expect(within(form).getByLabelText(/website url/i)).toBeInTheDocument()
    expect(within(form).getByLabelText(/business name/i)).toHaveValue('sapphire digital agency')
    expect(within(form).getByLabelText(/city or location/i)).toHaveValue('Nashik')
    expect(within(form).getByRole('button', { name: /continue with website/i })).toBeEnabled()

    // An API failure is not "no results", and not the old dead-end copy.
    expect(screen.queryByText(/couldn't find your business/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/I had trouble searching/i)).not.toBeInTheDocument()
    // The business-name question is asked exactly once (the greeting), never repeated.
    expect(countMessages(/what's your business name/i)).toBe(1)
    expect(input().placeholder).toMatch(/paste your website/i)
  })

  it('a credentials/config failure still offers Try Again (it may be fixed while the user waits) alongside the website form', async () => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    render(<ARIAChat />)
    await startSearch()
    const form = screen.getByRole('form', { name: /continue with your website/i })
    expect(within(form).getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: /continue with website/i })).toBeInTheDocument()
  })

  it('never shows raw upstream text, keys, or "API key"', async () => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR', 'Google Places API access denied. Check your API key.'))
    render(<ARIAChat />)
    await startSearch()
    expect(document.body.textContent).not.toMatch(/api key|PERMISSION_DENIED|places\.googleapis/i)
  })
})

// ── 5, 7. URL typed straight into the chat ──────────────────────────────────
describe('a website typed directly into the chat', () => {
  it('https://naxonify.com/ is recognized as a website, not a business name or location', async () => {
    render(<ARIAChat />)
    await say('https://naxonify.com/')

    expect(api.extractFromWebsite).toHaveBeenCalledTimes(1)
    expect(api.extractFromWebsite).toHaveBeenCalledWith('https://naxonify.com')
    expect(api.searchBusiness).not.toHaveBeenCalled()
    expect(screen.queryByText(/what's your business location/i)).not.toBeInTheDocument()
    expect(screen.getByText(/here's what I found on your website/i)).toBeInTheDocument()
  })

  it('a scheme-less domain is normalized to https', async () => {
    render(<ARIAChat />)
    await say('naxonify.com')
    expect(api.extractFromWebsite).toHaveBeenCalledWith('https://naxonify.com')
  })

  it('a URL given where the LOCATION is expected is still a website, and the name is kept', async () => {
    render(<ARIAChat />)
    await say('Naxonify')
    await say('https://naxonify.com')
    expect(api.searchBusiness).not.toHaveBeenCalled()
    expect(api.extractFromWebsite).toHaveBeenCalledWith('https://naxonify.com')
    // the typed name wins over the scraped one on the confirmation card
    expect(cardText()).toContain('Naxonify')
    expect(cardText()).not.toContain('Naxonify Scraped')
  })

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'ftp://naxonify.com', 'http://localhost:3000', 'http://169.254.169.254/'])(
    'rejects %s: explains why, calls nothing, stays on the same step',
    async (bad) => {
      render(<ARIAChat />)
      await say(bad)
      expect(api.extractFromWebsite).not.toHaveBeenCalled()
      expect(api.searchBusiness).not.toHaveBeenCalled()
      // still on the business-name step: it was not consumed as a name
      expect(input().placeholder).toMatch(/business name/i)
      expect(screen.queryByText(/what's your business location/i)).not.toBeInTheDocument()
    }
  )

  it('an invalid address in the website step is rejected with a helpful message', async () => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    render(<ARIAChat />)
    await startSearch()
    await say('not a website at all')
    expect(api.extractFromWebsite).not.toHaveBeenCalled()
    expect(screen.getByText(/doesn't look like a valid website address/i)).toBeInTheDocument()
  })
})

// ── 6, 8. URL entered after a failure; retry keeps values ───────────────────
describe('after a failed search', () => {
  beforeEach(() => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
  })

  it('a URL pasted into the chat box continues onboarding and keeps the earlier name/location', async () => {
    render(<ARIAChat />)
    await startSearch()
    await say('https://naxonify.com/')
    expect(api.extractFromWebsite).toHaveBeenCalledWith('https://naxonify.com')
    // user-entered values outrank scraped ones
    expect(cardText()).toContain('sapphire digital agency')
    expect(cardText()).not.toContain('Naxonify Scraped')
  })

  it('Try Again re-runs the search with the SAME values and keeps the website the user entered', async () => {
    render(<ARIAChat />)
    await startSearch()
    fireEvent.change(screen.getByLabelText(/website url/i), { target: { value: 'https://naxonify.com' } })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await flush()

    expect(api.searchBusiness).toHaveBeenCalledTimes(2)
    expect(api.searchBusiness).toHaveBeenLastCalledWith('sapphire digital agency', 'Nashik')

    // fails again -> a fresh form, still carrying everything
    const form = screen.getAllByRole('form', { name: /continue with your website/i }).at(-1)
    expect(within(form).getByLabelText(/website url/i)).toHaveValue('https://naxonify.com')
    expect(within(form).getByLabelText(/business name/i)).toHaveValue('sapphire digital agency')
    expect(within(form).getByLabelText(/city or location/i)).toHaveValue('Nashik')
    // only the newest failure keeps a live form
    expect(screen.getAllByRole('form', { name: /continue with your website/i })).toHaveLength(1)
  })

  it('a successful retry keeps the saved website when the chosen listing has none', async () => {
    render(<ARIAChat />)
    await startSearch()
    fireEvent.change(screen.getByLabelText(/website url/i), { target: { value: 'https://naxonify.com' } })
    api.searchBusiness.mockResolvedValue({ success: true, data: { results: [{ ...BIZ, website: '' }] } })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /yes, this is my business/i }))
    await flush()
    // the website is already known, so it is not asked for again
    expect(screen.queryByText(/couldn't find a website/i)).not.toBeInTheDocument()
    expect(screen.getByText(/What type of business is it/i)).toBeInTheDocument()
  })

  it('Try Again never re-asks for a name the user already gave, even if the form field was cleared', async () => {
    render(<ARIAChat />)
    await startSearch()
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/website url/i), { target: { value: 'https://naxonify.com' } })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await flush()
    // searched again with the name/location collected earlier in the chat
    expect(api.searchBusiness).toHaveBeenLastCalledWith('sapphire digital agency', 'Nashik')
    expect(countMessages(/what's your business name/i)).toBe(1)
    expect(screen.queryByText(/I need your business name/i)).not.toBeInTheDocument()
  })

  it('Continue with Website validates the address inline and does not submit an invalid one', async () => {
    render(<ARIAChat />)
    await startSearch()
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(within(form).getByRole('button', { name: /continue with website/i }))
    await flush()
    expect(within(form).getByRole('alert')).toHaveTextContent(/only http/i)
    expect(within(form).getByLabelText(/website url/i)).toHaveAttribute('aria-invalid', 'true')
    expect(api.extractFromWebsite).not.toHaveBeenCalled()
  })

  it('double-clicking Continue posts one message and runs one extraction', async () => {
    let release
    api.extractFromWebsite.mockReturnValue(new Promise((r) => { release = r }))
    render(<ARIAChat />)
    await startSearch()
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: 'naxonify.com' } })
    const btn = within(form).getByRole('button', { name: /continue with website/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    await flush()
    expect(api.extractFromWebsite).toHaveBeenCalledTimes(1)
    expect(countMessages(/^Continue with naxonify\.com$/)).toBe(1)
    await act(async () => { release(extracted()) })
  })
})

// ── 9-11. manual onboarding to project creation, no Google involved ─────────
describe('manual website onboarding', () => {
  const failSearchThenContinueManually = async ({ website = 'https://naxonify.com/', name = 'Naxonify', where = 'Nashik' } = {}) => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    render(<ARIAChat />)
    await startSearch(name, where)
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: website } })
    fireEvent.click(within(form).getByRole('button', { name: /continue with website/i }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    await flush()
  }

  const chooseType = async () => {
    fireEvent.click(screen.getByText('Service-based'))
    await flush()
    await say('digital marketing')
  }

  it('Local SEO: creates the project from the website + typed name/location, with no Google data', async () => {
    await failSearchThenContinueManually()
    await chooseType()
    fireEvent.click(screen.getByText(/Local \(city-level\)/))
    await flush(50)
    fireEvent.click(screen.getByRole('button', { name: /yes, use these/i }))
    await flush()

    expect(api.createProject).toHaveBeenCalledTimes(1)
    const p = api.createProject.mock.calls[0][0]
    expect(p).toMatchObject({
      main_url: 'https://naxonify.com',
      seo_scope: 'local',
      location: 'Nashik',          // the user's own city, not the scraped "12 Scraped Rd, Pune"
      business_name: 'Naxonify',   // the user's own name, not "Naxonify Scraped"
      onboarding_mode: 'website_manual',
      discovery_source: 'website_scrape',
      source: 'website_manual',
    })
    // nothing pretends to be a verified Google listing
    expect(p.verified_business?.placeId).toBeUndefined()
    expect(p.verified_business?.verifiedAt).toBeUndefined()
    expect(p.verified_business?.name).toBeUndefined()
    // the scraped address is kept as metadata only
    expect(p.extracted_metadata.contact_info.address).toBe('12 Scraped Rd, Pune')
    expect(push).toHaveBeenCalledWith('/processing/proj-1')
  })

  it('National SEO selection is preserved', async () => {
    await failSearchThenContinueManually()
    await chooseType()
    fireEvent.click(screen.getByText(/Country level/))
    await flush()
    fireEvent.click(screen.getByText('India'))
    await flush(50)
    fireEvent.click(screen.getByRole('button', { name: /yes, use these/i }))
    await flush()
    expect(api.createProject.mock.calls[0][0]).toMatchObject({ seo_scope: 'national', country: 'IN', main_url: 'https://naxonify.com' })
  })

  it('name and location are optional: the website alone is enough to continue', async () => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    render(<ARIAChat />)
    await startSearch()
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/business name/i), { target: { value: '' } })
    fireEvent.change(within(form).getByLabelText(/city or location/i), { target: { value: '' } })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: 'naxonify.com' } })
    fireEvent.click(within(form).getByRole('button', { name: /continue with website/i }))
    await flush()
    // nothing was invented: the scraped values are shown instead
    expect(api.extractFromWebsite).toHaveBeenCalledWith('https://naxonify.com')
    expect(cardText()).toContain('Naxonify Scraped')
  })

  it('Local SEO with no location anywhere asks the user for a city, explaining why', async () => {
    api.resolveWebsiteLocation.mockResolvedValue({ success: false })
    api.extractFromWebsite.mockResolvedValue(extracted({ address: '' }))
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    render(<ARIAChat />)
    await startSearch('Naxonify', 'Nashik')
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/city or location/i), { target: { value: '' } })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: 'naxonify.com' } })
    fireEvent.click(within(form).getByRole('button', { name: /continue with website/i }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /looks good/i }))
    await flush()
    await chooseType()
    fireEvent.click(screen.getByText(/Local \(city-level\)/))
    await flush(50)
    expect(screen.getByText(/which city would you like to target/i)).toBeInTheDocument()
  })

  it('duplicate submission: a double click on "Yes, use these" creates exactly one project', async () => {
    let release
    api.createProject.mockReturnValue(new Promise((r) => { release = r }))
    await failSearchThenContinueManually()
    await chooseType()
    fireEvent.click(screen.getByText(/Country level/))
    await flush()
    fireEvent.click(screen.getByText('India'))
    await flush(50)
    const yes = screen.getByRole('button', { name: /yes, use these/i })
    fireEvent.click(yes)
    fireEvent.click(yes)
    await flush()
    expect(api.createProject).toHaveBeenCalledTimes(1)
    await act(async () => { release({ success: true, data: { projectId: 'proj-1' } }) })
    expect(api.createProject).toHaveBeenCalledTimes(1)
  })

  it('a failed creation returns to a usable step (no stuck spinner) and can be retried once', async () => {
    api.createProject.mockRejectedValueOnce(backendError(500, undefined, 'Internal server error'))
    await failSearchThenContinueManually()
    await chooseType()
    fireEvent.click(screen.getByText(/Country level/))
    await flush()
    fireEvent.click(screen.getByText('India'))
    await flush(50)
    fireEvent.click(screen.getByRole('button', { name: /yes, use these/i }))
    await flush()
    expect(screen.getByText(/Error: Internal server error/i)).toBeInTheDocument()
    // the confirmation card is back, so the user can try again
    fireEvent.click(screen.getByRole('button', { name: /yes, use these/i }))
    await flush()
    expect(api.createProject).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledWith('/processing/proj-1')
  })
})

// ── website analysis itself fails ───────────────────────────────────────────
describe('website analysis failure does not strand onboarding', () => {
  it('"Continue without analysis" proceeds with the user-entered details only', async () => {
    api.searchBusiness.mockRejectedValue(backendError(503, 'API_CONFIGURATION_ERROR'))
    api.extractFromWebsite.mockRejectedValue(backendError(500, 'EXTRACTION_FAILED', 'raw python trace'))
    render(<ARIAChat />)
    await startSearch('Naxonify', 'Nashik')
    const form = screen.getByRole('form', { name: /continue with your website/i })
    fireEvent.change(within(form).getByLabelText(/website url/i), { target: { value: 'https://naxonify.com' } })
    fireEvent.click(within(form).getByRole('button', { name: /continue with website/i }))
    await flush()

    expect(document.body.textContent).not.toMatch(/raw python trace/)
    fireEvent.click(screen.getByRole('button', { name: /continue without analysis/i }))
    await flush()
    fireEvent.click(screen.getByText('Service-based'))
    await flush()
    await say('digital marketing')
    fireEvent.click(screen.getByText(/Country level/))
    await flush()
    fireEvent.click(screen.getByText('India'))
    await flush(50)
    fireEvent.click(screen.getByRole('button', { name: /yes, use these/i }))
    await flush()

    const p = api.createProject.mock.calls[0][0]
    expect(p).toMatchObject({ main_url: 'https://naxonify.com', business_name: 'Naxonify', location: 'Nashik', discovery_source: 'manual_entry' })
    expect(p.extracted_metadata).toBeUndefined()
    expect(p.verified_business).toBeUndefined()
  })

  it('a rejected address (400) offers no skip - it would only fail later', async () => {
    api.extractFromWebsite.mockRejectedValue(backendError(400, 'INVALID_URL', 'This URL is not allowed for security reasons'))
    render(<ARIAChat />)
    await say('naxonify.com')
    expect(screen.getByText(/not allowed for security reasons/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue without analysis/i })).not.toBeInTheDocument()
  })
})

// ── 13. resume ──────────────────────────────────────────────────────────────
describe('resume after the upgrade/checkout redirect (the only existing persistence)', () => {
  it('restores a manual-website session intact: scope, URL, name, location, no verified business', async () => {
    const projectData = {
      websiteUrl: 'https://naxonify.com', businessName: 'Naxonify', businessLocation: 'Nashik', location: 'Nashik',
      manualBusinessName: 'Naxonify', manualLocation: 'Nashik', onboardingMode: 'website_manual', extractedMetadata: null,
      targetLevel: 'local', resolvedCity: 'Nashik', businessType: 'Service-based', subType: 'digital marketing',
      selectedKeywords: ['seo nashik'], keywords: ['seo nashik'], country: 'IN', language: 'en', verifiedBusiness: null,
    }
    sessionStorage.setItem(ONBOARDING_UPGRADE_RESUME_KEY, JSON.stringify({ projectData, overrideKeywords: ['seo nashik'], previousFlowState: 'CONFIRM_KEYWORDS' }))

    render(<ARIAChat />)
    await flush(50)
    expect(screen.getByText(/Subscription activated successfully/i)).toBeInTheDocument()
    expect(sessionStorage.getItem(ONBOARDING_UPGRADE_RESUME_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /proceed/i }))
    await flush()
    expect(api.createProject).toHaveBeenCalledTimes(1)
    expect(api.createProject.mock.calls[0][0]).toMatchObject({
      main_url: 'https://naxonify.com', seo_scope: 'local', location: 'Nashik', business_name: 'Naxonify',
      discovery_source: 'manual_entry', onboarding_mode: 'website_manual',
    })
  })

  it('a plain page refresh starts a clean chat (no saved partial state exists to restore)', () => {
    render(<ARIAChat />)
    expect(messagesText()).toHaveLength(1)
    expect(input().placeholder).toMatch(/business name/i)
  })
})

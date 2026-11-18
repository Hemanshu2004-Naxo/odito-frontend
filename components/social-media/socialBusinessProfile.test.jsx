import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithClient, businessProfileData, fact, apiError, EMPTY_EDITABLE_PROFILE } from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({ getSocialBusinessProfile: vi.fn(), updateSocialBusinessProfile: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: project ? [project] : [], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { BusinessProfileScreen } from './BusinessProfileScreen'
import { BrandKitSettings } from './BrandKitSettings'
import { useProject } from '@/contexts/ProjectContext'

// The Brand Kit moved from Business Profile to Settings -> Brand kit; the combined view keeps the old page's surface.
function BrandKitTab() { return <BrandKitSettings projectId={useProject().activeProjectId} /> }
function ProfileAndBrandKit() { return <><BusinessProfileScreen /><BrandKitTab /></> }

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  project = { _id: 'proj-1', project_name: 'Acme' }
})

const load = (opts) => api.getSocialBusinessProfile.mockResolvedValue(businessProfileData(opts))
const renderSettings = () => renderWithClient(<ProfileAndBrandKit />)
const renderProfile = () => renderWithClient(<BusinessProfileScreen />)
const renderBrand = () => renderWithClient(<BrandKitTab />)
const editor = (section) => screen.getByTestId(`editor-${section}`)

describe('Business profile — real data', () => {
  it('shows the REAL resolved business facts, each with its source, and the logo found by the shared resolver', async () => {
    load({ google: true })
    renderSettings()
    expect(await screen.findByTestId('fact-name-value')).toHaveTextContent('Acme Dental')
    expect(api.getSocialBusinessProfile).toHaveBeenCalledWith('proj-1')
    const name = screen.getByTestId('fact-name')
    expect(within(name).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
    expect(screen.getByTestId('fact-phone-value')).toHaveTextContent('+91 20 5550100')
    expect(screen.getByTestId('fact-hours-value')).toHaveTextContent('2 weekly opening periods on Google')
    expect(screen.getByTestId('fact-rating-value')).toHaveTextContent('4.6 / 5 · 120 reviews')
    expect(within(screen.getByTestId('fact-place')).getByTestId('source-badge')).toHaveAttribute('data-source', 'verified_business')
    expect(within(screen.getByTestId('fact-logo')).getByTestId('source-badge')).toHaveAttribute('data-source', 'website_extraction')
  })

  it('a fact nobody has is shown as "Not available" with an unavailable source — nothing invented', async () => {
    load({ google: false })
    renderSettings()
    expect(await screen.findByTestId('fact-phone-value')).toHaveTextContent('Not available')
    expect(within(screen.getByTestId('fact-phone')).getByTestId('source-badge')).toHaveAttribute('data-source', 'unavailable')
    expect(screen.getByTestId('fact-rating-value')).toHaveTextContent('Not available')
    expect(screen.getByTestId('fact-hours-value')).toHaveTextContent('Not available')
  })

  it('NO dummy defaults appear anywhere (the old Sapphire / Nashik / digital-marketing / brand-kit sample values are gone)', async () => {
    load({ google: false })
    renderSettings()
    await screen.findByTestId('fact-name-value')
    const text = document.body.textContent + Array.from(document.querySelectorAll('input,textarea')).map((i) => i.value).join(' ')
    for (const dummy of [/Sapphire/i, /Nashik/i, /digital-marketing/i, /sapphiredigitalagency/i, /#0F2D6B/i, /#7C3AED/i, /Helpful and confident/i]) {
      expect(text).not.toMatch(dummy)
    }
  })

  it('Google-managed facts are READ-ONLY: the facts card has no inputs; the only inputs are the Social AI fields', async () => {
    load({ google: true })
    renderSettings()
    const facts = await screen.findByTestId('resolved-facts')
    expect(facts.querySelectorAll('input, textarea, select')).toHaveLength(0)
    expect(screen.queryByRole('textbox', { name: /^Business name$/ })).toBeInTheDocument() // only inside the explicit Social AI override form
    expect(within(editor('overrides')).getByLabelText('Business name')).toBeInTheDocument()
    expect(screen.getByText(/never change Google Business Profile/i)).toBeInTheDocument()
  })
})

describe('Business profile — Google Business Profile is a DATA SOURCE here, not a connection card', () => {
  it('shows the source order and the connection state in one read-only line, and sends the user to Connect Accounts to manage it', async () => {
    load({ google: true })
    renderSettings()
    const line = await screen.findByTestId('data-sources')
    expect(line).toHaveTextContent('your own values, then Google Business Profile (Connected, last synced')
    expect(line).toHaveTextContent('then your project and website')
    expect(within(line).getByRole('link', { name: 'Connect Accounts' })).toHaveAttribute('href', '/app/social-media/connect-accounts')
    // the connection card itself belongs to Connect Accounts
    expect(screen.queryByTestId('gbp-status')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Google Business Profile$/ })).not.toBeInTheDocument()
  })

  it('NOT CONNECTED: says so and still shows the project data', async () => {
    load({ google: false })
    renderSettings()
    expect(await screen.findByTestId('data-sources')).toHaveTextContent('Google Business Profile (Not connected)')
    expect(screen.getByTestId('fact-name-value')).toHaveTextContent('Acme Dental')
    expect(screen.queryByTestId('gbp-status')).not.toBeInTheDocument()
  })

  it('EXPIRED and a CHANGED LOCATION are reported honestly in the line (managing them happens in Connect Accounts)', async () => {
    load({ google: true, googleStatus: { connected: false, connectionStatus: 'expired' } })
    const { unmount } = renderSettings()
    expect(await screen.findByTestId('data-sources')).toHaveTextContent('Reconnect required')
    unmount()
    load({ google: true, googleStatus: { connectionStatus: 'revoked', connected: false } })
    renderSettings()
    expect(await screen.findByTestId('data-sources')).toHaveTextContent('Disconnected')
  })

  it('the business-information source badges still tell Google / project / website / user apart', async () => {
    load({ google: true })
    renderSettings()
    const hint = await screen.findByTestId('hint-name')
    expect(within(hint).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
    expect(within(screen.getByTestId('hint-city')).getByTestId('source-badge')).toHaveAttribute('data-source', 'verified_business')
  })
})

describe('Business profile — editing the Social AI fields', () => {
  const saved = (editable) => businessProfileData({ google: true, editable: { exists: true, updatedAt: '2026-10-09T10:00:00.000Z', ...editable } })

  it('loads the saved manual fields into the form', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(saved({
      audience: { primary: 'Young families', secondary: ['Retirees'] }, toneOfVoice: { primary: 'Warm', secondary: [] },
      goals: ['More bookings', 'More reviews'], offers: [{ name: 'Free check-up', description: 'First visit free', url: 'https://offers.example/free' }],
      competitors: [{ name: 'Rival', website: null }],
    }))
    renderSettings()
    expect(await screen.findByLabelText('Primary audience')).toHaveValue('Young families')
    expect(within(screen.getByTestId('editor-strategy')).queryByLabelText('Tone of voice')).not.toBeInTheDocument() // tone of voice belongs to the Brand Kit's identity form
    expect(within(screen.getByTestId('editor-identity')).getByLabelText('Tone of voice')).toHaveValue('Warm')
    expect(screen.getByLabelText('Goals')).toHaveValue('More bookings\nMore reviews')
    expect(screen.getByLabelText('Offers 1 Name')).toHaveValue('Free check-up')
    expect(screen.getByLabelText('Competitors 1 Name')).toHaveValue('Rival')
  })

  it('Save is disabled until something changes; saving sends ONLY that section\'s Social AI fields to the API', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockResolvedValue(saved({ goals: ['Grow'] }))
    renderSettings()
    const strategy = await screen.findByTestId('editor-strategy')
    api.getSocialBusinessProfile.mockResolvedValue(saved({ goals: ['Grow'] })) // what the server returns on the refetch after the save
    const save = within(strategy).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(within(strategy).getByLabelText('Goals'), { target: { value: ' Grow \n\n' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    const [pid, body] = api.updateSocialBusinessProfile.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(body.goals).toEqual(['Grow'])
    expect(Object.keys(body).sort()).toEqual(['additionalInstructions', 'audience', 'competitors', 'contentPillars', 'goals', 'offers'])
    // brand fields (tone, unique selling points, phrases to avoid, ...) belong to the Brand kit forms, never to this one
    for (const forbidden of ['overrides', 'brand', 'toneOfVoice', 'uniqueSellingPoints', 'prohibitedPhrases', 'businessModel', 'services', 'business_location_id', 'rating', 'regularHours', 'name', 'phone']) expect(body).not.toHaveProperty(forbidden)
    expect(await within(strategy).findByRole('status')).toHaveTextContent('Saved')
  })

  it('after a save the query is REFETCHED from the server and the form shows what the server stored', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockResolvedValue(saved({ goals: ['Normalised goal'] }))
    renderSettings()
    const strategy = await screen.findByTestId('editor-strategy')
    expect(api.getSocialBusinessProfile).toHaveBeenCalledTimes(1)
    api.getSocialBusinessProfile.mockResolvedValue(saved({ goals: ['Normalised goal'] }))
    fireEvent.change(within(strategy).getByLabelText('Goals'), { target: { value: 'normalised   goal' } })
    fireEvent.click(within(strategy).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.getSocialBusinessProfile.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(within(screen.getByTestId('editor-strategy')).getByLabelText('Goals')).toHaveValue('Normalised goal'))
  })

  it('overrides: blank fields are sent as null (clear), filled ones as typed — and they never touch the Google facts card', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockResolvedValue(saved({ overrides: { businessName: 'Brand Name', description: null, category: null, secondaryCategories: null, phone: null, website: null, address: null, city: null, region: null, country: null, postalCode: null, serviceArea: ['Pune', 'Mumbai'] } }))
    renderSettings()
    const ov = await screen.findByTestId('editor-overrides')
    fireEvent.change(within(ov).getByLabelText('Business name'), { target: { value: 'Brand Name' } })
    fireEvent.change(within(ov).getByLabelText('Service area'), { target: { value: 'Pune, Mumbai' } })
    fireEvent.click(within(ov).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalled())
    expect(api.updateSocialBusinessProfile.mock.calls[0][1]).toEqual({
      overrides: {
        businessName: 'Brand Name', description: null, category: null, secondaryCategories: [], phone: null, website: null, address: null,
        city: null, region: null, country: null, postalCode: null, serviceArea: ['Pune', 'Mumbai'],
      },
    })
  })

  it('a refused save shows the backend\'s message and keeps what the user typed', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockRejectedValue(apiError('offers[0].url must start with http:// or https://.', { status: 400, code: 'INVALID_PROFILE' }))
    renderSettings()
    const strategy = await screen.findByTestId('editor-strategy')
    fireEvent.click(within(strategy).getByRole('button', { name: 'Add an offer' }))
    fireEvent.change(within(strategy).getByLabelText('Offers 1 Name'), { target: { value: 'Deal' } })
    fireEvent.change(within(strategy).getByLabelText('Offers 1 Link (optional)'), { target: { value: 'ftp://x.example' } })
    fireEvent.click(within(strategy).getByRole('button', { name: 'Save' }))
    expect(await within(strategy).findByRole('alert')).toHaveTextContent('offers[0].url must start with http')
    expect(within(strategy).getByLabelText('Offers 1 Name')).toHaveValue('Deal')
    expect(within(strategy).getByLabelText('Offers 1 Link (optional)')).toHaveValue('ftp://x.example')
  })

  it('blank offer / competitor rows are not sent', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockResolvedValue(saved({}))
    renderSettings()
    const strategy = await screen.findByTestId('editor-strategy')
    fireEvent.click(within(strategy).getByRole('button', { name: 'Add a competitor' }))
    fireEvent.change(within(strategy).getByLabelText('Goals'), { target: { value: 'x' } })
    fireEvent.click(within(strategy).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalled())
    expect(api.updateSocialBusinessProfile.mock.calls[0][1].competitors).toEqual([])
  })
})

describe('Business profile — states', () => {
  it('LOADING: skeletons, then content', async () => {
    api.getSocialBusinessProfile.mockReturnValue(new Promise(() => {}))
    renderProfile()
    expect(screen.getByTestId('profile-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('resolved-facts')).not.toBeInTheDocument()
  })

  it('ERROR: shows the failure with a working retry — no sample data as a fallback', async () => {
    api.getSocialBusinessProfile.mockRejectedValueOnce(apiError('Failed to load the business profile', { status: 500 }))
    renderProfile()
    expect(await screen.findByTestId('profile-error')).toHaveTextContent('Failed to load the business profile')
    load({ google: true })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('fact-name-value')).toHaveTextContent('Acme Dental')
  })

  it('NO PROJECT: asks for a project and requests nothing', () => {
    project = null
    renderProfile()
    expect(screen.getByTestId('profile-no-project')).toBeInTheDocument()
    expect(api.getSocialBusinessProfile).not.toHaveBeenCalled()
  })

  it('the query is project-scoped: another project refetches for ITS id', async () => {
    load({ google: true })
    const { unmount } = renderProfile()
    await screen.findByTestId('fact-name-value')
    unmount()
    project = { _id: 'proj-2', project_name: 'Other' }
    renderProfile()
    await waitFor(() => expect(api.getSocialBusinessProfile).toHaveBeenCalledWith('proj-2'))
  })
})

describe('Brand kit', () => {
  it('with nothing saved the colour and font fields are EMPTY (no fake brand defaults) and the preview is neutral', async () => {
    load({ google: false })
    renderBrand()
    const brand = await screen.findByTestId('editor-brand')
    for (const label of ['Heading font', 'Body font']) expect(within(brand).getByLabelText(label)).toHaveValue('')
    for (const input of within(brand).getAllByRole('textbox').filter((i) => i.className.includes('w-28'))) expect(input).toHaveValue('')
    expect(screen.getByTestId('brand-preview-name')).toHaveTextContent('Acme Dental')
    expect(screen.getByTestId('brand-preview-name').style.color).toBe('')
    expect(document.body.textContent).not.toMatch(/Build your online presence|Sapphire|Inter/)
  })

  it('without an uploaded logo, the one in use comes from the shared brand resolver (with its source) and the user can upload their own instead', async () => {
    load({ google: true, media: { logo: fact('https://g.example/logo.jpg', 'google_business_profile', null, 'google_logo') } })
    renderBrand()
    const logo = await screen.findByTestId('brand-logo')
    expect(within(logo).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
    expect(within(logo).getByText(/Upload your own logo to use it instead/)).toBeInTheDocument()
    expect(within(logo).getByRole('button', { name: 'Upload logo' })).toBeEnabled()
    expect(within(logo).queryByRole('button', { name: /Remove uploaded logo/ })).not.toBeInTheDocument() // nothing of the user's own to remove
    expect(logo.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  })

  it('saved colours and fonts are applied to the preview, and saving sends only the brand fields', async () => {
    load({ google: true })
    const afterSave = businessProfileData({
      google: true, brand: { primaryColor: '#112233', secondaryColor: null, accentColor: '#AA00FF', fontHeading: 'Poppins', fontBody: null },
      editable: { exists: true, updatedAt: '2026-10-09T10:00:00.000Z', brand: { primaryColor: '#112233', secondaryColor: null, accentColor: '#AA00FF', fontHeading: 'Poppins', fontBody: null } },
    })
    api.updateSocialBusinessProfile.mockResolvedValue(afterSave)
    renderBrand()
    const brand = await screen.findByTestId('editor-brand')
    api.getSocialBusinessProfile.mockResolvedValue(afterSave)
    fireEvent.change(within(brand).getByLabelText('Heading font'), { target: { value: 'Poppins' } })
    fireEvent.change(within(brand).getByLabelText('Primary color picker'), { target: { value: '#112233' } })
    fireEvent.change(within(brand).getByLabelText('Accent color picker'), { target: { value: '#aa00ff' } })
    fireEvent.click(within(brand).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalled())
    expect(api.updateSocialBusinessProfile.mock.calls[0][1]).toEqual({
      brand: { primaryColor: '#112233', secondaryColor: null, accentColor: '#AA00FF', fontHeading: 'Poppins', fontBody: null },
    })
    await waitFor(() => expect(screen.getByTestId('brand-preview-name')).toHaveStyle({ color: '#112233' }))
    expect(screen.getByTestId('brand-preview-accent')).toHaveStyle({ background: '#AA00FF' })
  })
})

describe('sanity — EMPTY editable profile fixture matches the backend defaults', () => {
  it('has no persisted document and no manual values', () => {
    expect(EMPTY_EDITABLE_PROFILE.exists).toBe(false)
    expect(EMPTY_EDITABLE_PROFILE.businessModel).toBeNull()
    expect(EMPTY_EDITABLE_PROFILE.services).toEqual([])
    expect(EMPTY_EDITABLE_PROFILE.brand).toEqual({
      primaryColor: null, secondaryColor: null, accentColor: null, fontHeading: null, fontBody: null,
      name: null, description: null, voice: null, personality: [], tagline: null, keyMessages: [], preferredWords: [], additionalInstructions: null, logo: null,
    })
  })
})

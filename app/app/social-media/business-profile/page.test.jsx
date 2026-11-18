import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import { renderWithClient, businessProfileData, fact, productList, productData, apiError } from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({
  getSocialBusinessProfile: vi.fn(), updateSocialBusinessProfile: vi.fn(), listSocialProducts: vi.fn(), getSocialProduct: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: project ? [project] : [], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import BusinessProfilePage from './page'

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  project = { _id: 'proj-1', project_name: 'Acme' }
  api.listSocialProducts.mockResolvedValue(productList([]))
})

const withModel = (model, extra = {}) => businessProfileData({
  google: true,
  editable: { exists: true, businessModel: model, ...(extra.editable || {}) },
  business: { businessModel: model ? fact(model, 'social_override') : fact(null, 'unavailable'), ...(extra.business || {}) },
  ...Object.fromEntries(Object.entries(extra).filter(([k]) => !['editable', 'business'].includes(k))),
})
const load = (model, extra) => api.getSocialBusinessProfile.mockResolvedValue(withModel(model, extra))
const top = (el) => el.getBoundingClientRect && Array.from(document.body.querySelectorAll('*')).indexOf(el)

describe('Business Profile page — the single place for business and brand information', () => {
  it('titles the page for what it is and lays out the four sections in order', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Business Profile' })).toBeInTheDocument()
    await screen.findByTestId('business-profile-page')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Business type', 'Business information', 'Services', 'How Social AI sees your business'])
    const nav = screen.getByRole('navigation', { name: 'Business Profile sections' })
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#business-type', '#business-information', '#offerings', '#social-ai-view'])
  })

  it('every management surface exists exactly ONCE on the page — one business type control, one business-information form', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    for (const id of ['business-model', 'editor-overrides', 'resolved-facts', 'services']) {
      expect(screen.getAllByTestId(id), id).toHaveLength(1)
    }
    expect(screen.getAllByRole('radiogroup', { name: 'Business type' })).toHaveLength(1)
    expect(screen.getAllByLabelText('Business name')).toHaveLength(1)
  })

  it('the sections appear in the documented order on the page', async () => {
    load('product')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    const order = ['business-model', 'editor-overrides', 'product-catalog', 'resolved-facts'].map((id) => top(screen.getByTestId(id)))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('the Brand Kit is no longer on the Business Profile page', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    expect(screen.queryByTestId('brand-kit')).not.toBeInTheDocument()
    expect(screen.queryByTestId('brand-logo')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Brand Kit' })).not.toBeInTheDocument()
  })

  it('Business information holds the business facts, each with its source and what an override replaced', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(withModel('service', {
      business: { name: { value: 'Sapphire Digital Agency', source: 'social_override', lastUpdated: null, underlying: { value: 'Sapphire Digital Agency LLC', source: 'google_business_profile' } } },
    }))
    renderWithClient(<BusinessProfilePage />)
    const info = await screen.findByTestId('editor-overrides')
    for (const label of ['Business name', 'Description', 'Category', 'Secondary categories', 'Phone', 'Website', 'Address', 'City', 'State / region', 'Country', 'Postal code', 'Service area']) {
      expect(within(info).getByLabelText(label), label).toBeInTheDocument()
    }
    expect(within(screen.getByTestId('hint-name')).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
    expect(screen.getByTestId('hint-name-underlying')).toHaveTextContent('Sapphire Digital Agency LLC (Google Business Profile)')
    expect(within(screen.getByTestId('hint-phone')).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
  })

  it('SERVICE business: Services are offered, not the Product Catalog (and no product request is made)', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    expect(await screen.findByTestId('services')).toBeInTheDocument()
    expect(screen.queryByTestId('product-catalog')).not.toBeInTheDocument()
    expect(api.listSocialProducts).not.toHaveBeenCalled()
  })

  it('PRODUCT business: the Product Catalog is offered, not Services; products load once', async () => {
    load('product')
    api.listSocialProducts.mockResolvedValue(productList([productData()]))
    renderWithClient(<BusinessProfilePage />)
    expect(await screen.findByTestId('product-catalog')).toBeInTheDocument()
    expect(await screen.findByText('Premium Face Serum')).toBeInTheDocument()
    expect(screen.queryByTestId('services')).not.toBeInTheDocument()
    expect(api.listSocialProducts).toHaveBeenCalledTimes(1)
    expect(api.listSocialProducts).toHaveBeenCalledWith('proj-1')
  })

  it('NO business type yet: section 3 asks for the type and neither catalog is shown', async () => {
    load(null)
    renderWithClient(<BusinessProfilePage />)
    expect(await screen.findByTestId('catalog-choose-model')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Services or products' })).toBeInTheDocument()
    expect(screen.queryByTestId('services')).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-catalog')).not.toBeInTheDocument()
  })

  it('the Google connection card is NOT here (Connect Accounts owns it); only a read-only data-sources line with a link', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    expect(screen.queryByTestId('gbp-status')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('data-sources')).getByRole('link', { name: 'Connect Accounts' })).toHaveAttribute('href', '/app/social-media/connect-accounts')
  })

  it('"How Social AI sees your business" is a read-only preview with a source on every row: business facts, brand, audience and what you offer', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(withModel('service', {
      services: [{ id: 's1', name: 'Teeth Whitening', status: 'active' }],
      brand: { primaryColor: null, secondaryColor: null, accentColor: null, fontHeading: null, fontBody: null, name: 'Acme Smiles', description: null, voice: 'Friendly', personality: [], tagline: 'Smile more', keyMessages: [], preferredWords: [], additionalInstructions: null },
    }))
    renderWithClient(<BusinessProfilePage />)
    const view = await screen.findByTestId('resolved-facts')
    expect(within(view).getByRole('heading', { name: 'How Social AI sees your business' })).toBeInTheDocument()
    expect(view.querySelectorAll('input, textarea, select, button')).toHaveLength(0) // a preview, not a form
    expect(within(view).getByTestId('fact-name-value')).toHaveTextContent('Acme Dental')
    expect(within(within(view).getByTestId('fact-name')).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
    expect(within(view).getByTestId('fact-brand-name-value')).toHaveTextContent('Acme Smiles')
    expect(within(within(view).getByTestId('fact-brand-name')).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
    expect(within(view).getByTestId('fact-brand-voice-value')).toHaveTextContent('Friendly')
    expect(within(view).getByTestId('fact-tagline-value')).toHaveTextContent('Smile more')
    expect(within(view).getByTestId('fact-services-value')).toHaveTextContent('1 active: Teeth Whitening')
    expect(within(view).queryByTestId('fact-products')).not.toBeInTheDocument() // a service business shows services only
    expect(within(view).getByTestId('fact-audience-value')).toHaveTextContent('Not set') // never filled in for the user
  })

  it('a product business sees its products in the preview, not services', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(withModel('product', { products: [productData(), productData({ id: 'p2', name: 'Night Cream' })] }))
    api.listSocialProducts.mockResolvedValue(productList([productData(), productData({ id: 'p2', name: 'Night Cream' })]))
    renderWithClient(<BusinessProfilePage />)
    const view = await screen.findByTestId('resolved-facts')
    expect(within(view).getByTestId('fact-products-value')).toHaveTextContent('2 active: Premium Face Serum, Night Cream')
    expect(within(view).queryByTestId('fact-services')).not.toBeInTheDocument()
  })

  it('ONE profile request serves the whole page, scoped to the active project', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    await new Promise((r) => setTimeout(r, 50))
    expect(api.getSocialBusinessProfile).toHaveBeenCalledTimes(1)
    expect(api.getSocialBusinessProfile).toHaveBeenCalledWith('proj-1')
  })

  it('LOADING shows skeletons; ERROR offers a retry with no sample data; NO PROJECT asks for a project and requests nothing', async () => {
    api.getSocialBusinessProfile.mockReturnValue(new Promise(() => {}))
    const first = renderWithClient(<BusinessProfilePage />)
    expect(screen.getByTestId('profile-loading')).toBeInTheDocument()
    first.unmount()

    api.getSocialBusinessProfile.mockReset()
    api.getSocialBusinessProfile.mockRejectedValueOnce(apiError('Failed to load the business profile', { status: 500 }))
    const second = renderWithClient(<BusinessProfilePage />)
    expect(await screen.findByTestId('profile-error')).toHaveTextContent('Failed to load the business profile')
    expect(screen.queryByTestId('resolved-facts')).not.toBeInTheDocument()
    second.unmount()

    api.getSocialBusinessProfile.mockReset()
    project = null
    renderWithClient(<BusinessProfilePage />)
    expect(screen.getByTestId('profile-no-project')).toBeInTheDocument()
    expect(api.getSocialBusinessProfile).not.toHaveBeenCalled()
  })

  it('layout hooks for small screens: the section nav wraps', async () => {
    load('service')
    renderWithClient(<BusinessProfilePage />)
    await screen.findByTestId('business-profile-page')
    expect(screen.getByRole('navigation', { name: 'Business Profile sections' }).className).toMatch(/flex-wrap/)
  })
})

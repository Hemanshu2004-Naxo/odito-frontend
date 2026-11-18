import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import {
  renderWithClient, businessProfileData, fact, apiError, productData, productImage, productList, productResponse,
} from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({
  getSocialBusinessProfile: vi.fn(), updateSocialBusinessProfile: vi.fn(),
  listSocialProducts: vi.fn(), getSocialProduct: vi.fn(), createSocialProduct: vi.fn(), updateSocialProduct: vi.fn(), deleteSocialProduct: vi.fn(),
  uploadSocialProductImage: vi.fn(), replaceSocialProductImage: vi.fn(), deleteSocialProductImage: vi.fn(), updateSocialProductImage: vi.fn(), reorderSocialProductImages: vi.fn(),
  uploadSocialBrandLogo: vi.fn(), deleteSocialBrandLogo: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

const project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project._id, projects: [project], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { BusinessProfileScreen } from './BusinessProfileScreen'
import { BrandKitSettings } from './BrandKitSettings'
import { useProject } from '@/contexts/ProjectContext'

// The Brand Kit moved from Business Profile to Settings -> Brand kit; the combined view keeps the old page's surface.
function BrandKitTab() { return <BrandKitSettings projectId={useProject().activeProjectId} /> }
function ProfileAndBrandKit() { return <><BusinessProfileScreen /><BrandKitTab /></> }
import { StrategyProfileChangedBanner } from './StrategyProfileChangedBanner'
import { StrategyBusinessContext } from './StrategyBusinessContext'

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.listSocialProducts.mockResolvedValue(productList([]))
})

const SERVER_MODEL = (businessModel) => ({ editable: { exists: true, businessModel }, business: { businessModel: businessModel ? fact(businessModel, 'social_override') : fact(null, 'unavailable') } })
const load = (opts = {}) => api.getSocialBusinessProfile.mockResolvedValue(businessProfileData({ google: true, ...opts }))
const withModel = (model, extra = {}) => businessProfileData({ google: true, ...SERVER_MODEL(model), ...extra, editable: { ...SERVER_MODEL(model).editable, ...(extra.editable || {}) } })
const loadModel = (model, extra) => api.getSocialBusinessProfile.mockResolvedValue(withModel(model, extra))
const renderSettings = () => renderWithClient(<ProfileAndBrandKit />)
const renderBrand = () => renderWithClient(<BrandKitTab />)
const file = (name = 'photo.png', type = 'image/png', size = 2048) => new File([new Uint8Array(size)], name, { type })
const pickFiles = (input, files) => fireEvent.change(input, { target: { files } })

const svc = (over = {}) => ({ id: 'svc-1', name: 'Teeth Whitening', description: 'Professional whitening.', category: 'Cosmetic', features: [], benefits: ['Brighter smile'], serviceUrl: null, tags: [], status: 'active', ...over })

// ── business model ───────────────────────────────────────────────────────────

describe('Business type', () => {
  it('asks "What type of business do you run?" with both options explained — and nothing is pre-selected or guessed', async () => {
    load()
    renderSettings()
    const section = await screen.findByTestId('business-model')
    expect(within(section).getByText('What type of business do you run?')).toBeInTheDocument()
    expect(within(section).getByText('Service-based')).toBeInTheDocument()
    expect(within(section).getByText('Your business primarily provides services to customers.')).toBeInTheDocument()
    expect(within(section).getByText('Product-based')).toBeInTheDocument()
    expect(within(section).getByText('Your business primarily sells physical or digital products.')).toBeInTheDocument()
    for (const radio of within(section).getAllByRole('radio')) expect(radio).not.toBeChecked()
    expect(within(section).getByTestId('business-model-unset')).toHaveTextContent('Not chosen yet')
  })

  it('with no type chosen, neither the Services nor the Product Catalog is offered — just a prompt (and no product request is made)', async () => {
    load()
    renderSettings()
    expect(await screen.findByTestId('catalog-choose-model')).toHaveTextContent('Choose your business type')
    expect(screen.queryByTestId('services')).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-catalog')).not.toBeInTheDocument()
    expect(api.listSocialProducts).not.toHaveBeenCalled()
  })

  it('choosing Service-based saves ONLY the business type, then shows Services (not the Product Catalog)', async () => {
    load()
    api.updateSocialBusinessProfile.mockResolvedValue(withModel('service'))
    renderSettings()
    const section = await screen.findByTestId('business-model')
    api.getSocialBusinessProfile.mockResolvedValue(withModel('service')) // the refetch after the save
    fireEvent.click(within(section).getByRole('radio', { name: /Service-based/ }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    expect(api.updateSocialBusinessProfile).toHaveBeenCalledWith('proj-1', { businessModel: 'service' })
    expect(await screen.findByTestId('services')).toBeInTheDocument()
    expect(screen.queryByTestId('product-catalog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('catalog-choose-model')).not.toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByTestId('business-model')).getByRole('radio', { name: /Service-based/ })).toBeChecked())
    expect(screen.getByTestId('fact-model-value')).toHaveTextContent('Service-based')
    expect(within(screen.getByTestId('fact-model')).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
  })

  it('choosing Product-based shows the Product Catalog and loads the products (project-scoped)', async () => {
    load()
    api.updateSocialBusinessProfile.mockResolvedValue(withModel('product'))
    renderSettings()
    const section = await screen.findByTestId('business-model')
    api.getSocialBusinessProfile.mockResolvedValue(withModel('product'))
    fireEvent.click(within(section).getByRole('radio', { name: /Product-based/ }))
    expect(await screen.findByTestId('product-catalog')).toBeInTheDocument()
    expect(screen.queryByTestId('services')).not.toBeInTheDocument()
    await waitFor(() => expect(api.listSocialProducts).toHaveBeenCalledWith('proj-1'))
  })

  it('while saving the clicked option is shown as chosen and the options are locked (one request, no double submit)', async () => {
    load()
    let finish
    api.updateSocialBusinessProfile.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderSettings()
    const section = await screen.findByTestId('business-model')
    fireEvent.click(within(section).getByRole('radio', { name: /Product-based/ }))
    await waitFor(() => expect(within(section).getByRole('radio', { name: /Product-based/ })).toBeChecked())
    for (const radio of within(section).getAllByRole('radio')) expect(radio).toBeDisabled()
    fireEvent.click(within(section).getByRole('radio', { name: /Service-based/ }))
    expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1)
    api.getSocialBusinessProfile.mockResolvedValue(withModel('product'))
    await act(async () => { finish(withModel('product')) })
    await waitFor(() => expect(within(screen.getByTestId('business-model')).getByRole('radio', { name: /Service-based/ })).toBeEnabled())
  })

  it('a refused save shows the backend message and the previous choice stays', async () => {
    loadModel('service')
    api.updateSocialBusinessProfile.mockRejectedValue(apiError('businessModel must be one of: service, product.', { status: 400, code: 'INVALID_PROFILE' }))
    renderSettings()
    const section = await screen.findByTestId('business-model')
    fireEvent.click(within(section).getByRole('radio', { name: /Product-based/ }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('businessModel must be one of')
    await waitFor(() => expect(within(section).getByRole('radio', { name: /Service-based/ })).toBeChecked())
    expect(screen.queryByTestId('product-catalog')).not.toBeInTheDocument()
  })
})

// ── services ────────────────────────────────────────────────────────────────

describe('Services (service business)', () => {
  it('an empty list is a real empty state with an Add action — no sample services', async () => {
    loadModel('service')
    renderSettings()
    const services = await screen.findByTestId('services')
    expect(within(services).getByTestId('services-empty')).toHaveTextContent('No services added yet.')
    expect(within(services).getByRole('button', { name: /Add service/ })).toBeEnabled()
    expect(within(services).queryByTestId('services-list')).not.toBeInTheDocument()
  })

  it('lists the saved services with their details', async () => {
    loadModel('service', { editable: { services: [svc(), svc({ id: 'svc-2', name: 'Check-up', status: 'draft', description: '' })] } })
    renderSettings()
    const list = await screen.findByTestId('services-list')
    expect(within(list).getByText('Teeth Whitening')).toBeInTheDocument()
    expect(within(list).getByText('Professional whitening.')).toBeInTheDocument()
    expect(within(within(list).getByTestId('service-svc-1')).getByText('Benefits: Brighter smile')).toBeInTheDocument()
    expect(within(within(list).getByTestId('service-svc-2')).getByText('Draft')).toBeInTheDocument()
  })

  it('adding a service sends the whole list through the profile PUT (new entry without an id) and shows what the server stored', async () => {
    loadModel('service', { editable: { services: [svc()] } })
    const after = withModel('service', { editable: { services: [svc(), svc({ id: 'svc-new', name: 'Implants', features: ['Titanium'] })] } })
    api.updateSocialBusinessProfile.mockResolvedValue(after)
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: /Add service/ }))
    const form = await screen.findByTestId('service-form')
    api.getSocialBusinessProfile.mockResolvedValue(after)
    fireEvent.change(within(form).getByLabelText('Service name'), { target: { value: 'Implants' } })
    fireEvent.change(within(form).getByLabelText('Features'), { target: { value: 'Titanium\n\n' } })
    fireEvent.change(within(form).getByLabelText('Tags'), { target: { value: 'dental, surgery' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    const [pid, body] = api.updateSocialBusinessProfile.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(Object.keys(body)).toEqual(['services'])
    expect(body.services).toEqual([
      { id: 'svc-1', name: 'Teeth Whitening', description: 'Professional whitening.', category: 'Cosmetic', features: [], benefits: ['Brighter smile'], serviceUrl: null, tags: [], status: 'active' },
      { name: 'Implants', description: '', category: null, features: ['Titanium'], benefits: [], serviceUrl: null, tags: ['dental', 'surgery'], status: 'active' },
    ])
    expect(body.services[1]).not.toHaveProperty('id')
    expect(await screen.findByText('Implants')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('service-form')).not.toBeInTheDocument())
  })

  it('editing keeps the service id; the name is required and nothing is sent without it', async () => {
    loadModel('service', { editable: { services: [svc()] } })
    api.updateSocialBusinessProfile.mockResolvedValue(withModel('service', { editable: { services: [svc({ name: 'Whitening Plus' })] } }))
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Teeth Whitening' }))
    const form = await screen.findByTestId('service-form')
    expect(within(form).getByLabelText('Service name')).toHaveValue('Teeth Whitening')
    fireEvent.change(within(form).getByLabelText('Service name'), { target: { value: '   ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save service' }))
    expect(await within(form).findByText('Give the service a name.')).toBeInTheDocument()
    expect(api.updateSocialBusinessProfile).not.toHaveBeenCalled()
    fireEvent.change(within(form).getByLabelText('Service name'), { target: { value: 'Whitening Plus' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save service' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    expect(api.updateSocialBusinessProfile.mock.calls[0][1].services[0]).toMatchObject({ id: 'svc-1', name: 'Whitening Plus' })
  })

  it('deleting asks first, then sends the list without it', async () => {
    loadModel('service', { editable: { services: [svc(), svc({ id: 'svc-2', name: 'Check-up' })] } })
    api.updateSocialBusinessProfile.mockResolvedValue(withModel('service', { editable: { services: [svc({ id: 'svc-2', name: 'Check-up' })] } }))
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Teeth Whitening' }))
    expect(api.updateSocialBusinessProfile).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete service' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    expect(api.updateSocialBusinessProfile.mock.calls[0][1].services.map((s) => s.id)).toEqual(['svc-2'])
  })

  it('a refused save is shown inside the form and what was typed is kept', async () => {
    loadModel('service')
    api.updateSocialBusinessProfile.mockRejectedValue(apiError('services[0].serviceUrl must start with http:// or https://.', { status: 400, code: 'INVALID_PROFILE' }))
    renderSettings()
    fireEvent.click((await screen.findAllByRole('button', { name: /Add service/ }))[0])
    const form = await screen.findByTestId('service-form')
    fireEvent.change(within(form).getByLabelText('Service name'), { target: { value: 'Bad link' } })
    fireEvent.change(within(form).getByLabelText('Link (optional)'), { target: { value: 'ftp://x.example' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add service' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('serviceUrl must start with http')
    expect(within(form).getByLabelText('Service name')).toHaveValue('Bad link')
    expect(within(form).getByLabelText('Link (optional)')).toHaveValue('ftp://x.example')
  })
})

// ── product catalog ──────────────────────────────────────────────────────────

describe('Product Catalog (product business)', () => {
  const open = async (products = []) => {
    loadModel('product')
    api.listSocialProducts.mockResolvedValue(productList(products))
    api.getSocialProduct.mockImplementation(async (_pid, id) => productResponse(products.find((p) => p.id === id) || productData({ id })))
    const view = renderSettings()
    await screen.findByTestId('product-catalog')
    return view
  }

  it('LOADING: a skeleton grid while the products load', async () => {
    loadModel('product')
    api.listSocialProducts.mockReturnValue(new Promise(() => {}))
    renderSettings()
    expect(await screen.findByTestId('products-loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('EMPTY: "No products added yet." with an Add product action — no sample products', async () => {
    await open([])
    const empty = await screen.findByTestId('products-empty')
    expect(empty).toHaveTextContent('No products added yet.')
    expect(within(empty).getByRole('button', { name: /Add product/ })).toBeEnabled()
    expect(screen.queryByTestId('products-grid')).not.toBeInTheDocument()
  })

  it('ERROR: shows the failure with a working retry — no sample products as a fallback', async () => {
    loadModel('product')
    api.listSocialProducts.mockRejectedValueOnce(apiError('Failed to load products', { status: 500 }))
    renderSettings()
    expect(await screen.findByTestId('products-error')).toHaveTextContent('Failed to load products')
    api.listSocialProducts.mockResolvedValue(productList([productData()]))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('products-grid')).toBeInTheDocument()
  })

  it('shows each product as a card: image, name, category, short description and price (sale price over the struck-through price)', async () => {
    await open([
      productData({ images: [productImage()], primaryImageUrl: 'https://media.example/storage/social_media/proj-1/a.png' }),
      productData({ id: 'prod-2', name: 'Night Cream', price: 1299, priceDisplay: '₹1,299', salePrice: 999, salePriceDisplay: '₹999', shortDescription: '', description: 'Rich night cream.', category: null, status: 'draft' }),
    ])
    const first = await screen.findByTestId('product-prod-1')
    expect(within(first).getByText('Premium Face Serum')).toBeInTheDocument()
    expect(within(first).getByText('Skincare')).toBeInTheDocument()
    expect(within(first).getByText('Vitamin C serum')).toBeInTheDocument()
    expect(within(first).getByTestId('product-prod-1-price')).toHaveTextContent('₹999')
    expect(first.querySelector('img')).toHaveAttribute('src', 'https://media.example/storage/social_media/proj-1/a.png')
    expect(within(first).getByRole('link', { name: /Product page/ })).toHaveAttribute('href', 'https://shop.example.com/serum')
    const second = screen.getByTestId('product-prod-2')
    expect(within(second).getByTestId('product-prod-2-price')).toHaveTextContent('₹999')
    expect(within(second).getByTestId('product-prod-2-price')).toHaveTextContent('₹1,299')
    expect(within(second).getByText('Rich night cream.')).toBeInTheDocument()
    expect(within(second).getByText('draft')).toBeInTheDocument()
    expect(second.querySelector('img')).toBeNull() // no image yet: a neutral placeholder, never a made-up picture
  })

  it('the status filter shows only that status, and says so when there are none', async () => {
    await open([productData(), productData({ id: 'prod-2', name: 'Archived Thing', status: 'archived' })])
    await screen.findByTestId('products-grid')
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }))
    expect(screen.queryByText('Premium Face Serum')).not.toBeInTheDocument()
    expect(screen.getByText('Archived Thing')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Draft' }))
    expect(screen.getByTestId('products-filter-empty')).toHaveTextContent('No draft products.')
    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByText('Premium Face Serum')).toBeInTheDocument()
  })

  it('CREATE: sends exactly the typed product (no images), then stays open as the editor with the image manager and the new card appears', async () => {
    await open([])
    const created = productData({ id: 'new-1', name: 'Hydra Gel', price: 499, priceDisplay: '₹499', category: 'Skincare', features: ['Aloe'], tags: ['gel', 'hydration'], productUrl: 'https://shop.example.com/gel/' })
    api.createSocialProduct.mockResolvedValue(productResponse(created))
    api.getSocialProduct.mockResolvedValue(productResponse(created))
    fireEvent.click((await screen.findByTestId('products-empty')).querySelector('button'))
    const dialog = await screen.findByTestId('product-dialog')
    const form = within(dialog).getByTestId('product-form')
    expect(within(dialog).getByTestId('product-images-locked')).toHaveTextContent('Create the product first')

    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'Hydra Gel' } })
    fireEvent.change(within(form).getByLabelText('Short description'), { target: { value: 'Cooling gel' } })
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: 'Skincare' } })
    fireEvent.change(within(form).getByLabelText('Features'), { target: { value: 'Aloe\n' } })
    fireEvent.change(within(form).getByLabelText('Price'), { target: { value: '499' } })
    fireEvent.change(within(form).getByLabelText('Currency'), { target: { value: 'inr' } })
    fireEvent.change(within(form).getByLabelText('Product URL'), { target: { value: 'shop.example.com/gel' } })
    fireEvent.change(within(form).getByLabelText('Tags'), { target: { value: 'gel, hydration' } })
    api.listSocialProducts.mockResolvedValue(productList([created]))
    fireEvent.click(within(form).getByRole('button', { name: 'Create product' }))

    await waitFor(() => expect(api.createSocialProduct).toHaveBeenCalledTimes(1))
    const [pid, body] = api.createSocialProduct.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(body).toEqual({
      name: 'Hydra Gel', description: '', shortDescription: 'Cooling gel', category: 'Skincare', subcategory: null, features: ['Aloe'], benefits: [],
      price: '499', salePrice: null, currency: 'INR', productUrl: 'shop.example.com/gel', sku: null, tags: ['gel', 'hydration'], status: 'active',
    })
    expect(body).not.toHaveProperty('images')
    expect(await within(dialog).findByTestId('product-created')).toHaveTextContent('Product saved. You can add images below.')
    expect(await within(dialog).findByTestId('product-images')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    expect(await screen.findByTestId('product-new-1')).toBeInTheDocument()
  })

  it('CREATE: obvious mistakes are caught before any request (name, price format, sale price, currency)', async () => {
    await open([])
    fireEvent.click((await screen.findByTestId('products-empty')).querySelector('button'))
    const form = within(await screen.findByTestId('product-dialog')).getByTestId('product-form')
    const submit = () => fireEvent.click(within(form).getByRole('button', { name: 'Create product' }))

    submit()
    expect(await within(form).findByText('Give the product a name.')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'X' } })
    fireEvent.change(within(form).getByLabelText('Price'), { target: { value: 'abc' } })
    expect(await within(form).findByText('Enter a number such as 999 or 19.99.')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Price'), { target: { value: '100' } })
    expect(await within(form).findByText('Choose a currency for the price.')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Currency'), { target: { value: 'USD' } })
    fireEvent.change(within(form).getByLabelText('Sale price'), { target: { value: '150' } })
    expect(await within(form).findByText('The sale price cannot be higher than the price.')).toBeInTheDocument()
    submit()
    expect(api.createSocialProduct).not.toHaveBeenCalled()
    fireEvent.change(within(form).getByLabelText('Sale price'), { target: { value: '' } })
    expect(within(form).queryByText(/sale price cannot|needs a regular price/i)).not.toBeInTheDocument()
  })

  it('CREATE: a refused save shows the backend message, keeps what was typed and creates nothing', async () => {
    await open([])
    api.createSocialProduct.mockRejectedValue(apiError('Another product in this project already uses that SKU.', { status: 409, code: 'DUPLICATE_SKU' }))
    fireEvent.click((await screen.findByTestId('products-empty')).querySelector('button'))
    const form = within(await screen.findByTestId('product-dialog')).getByTestId('product-form')
    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'Dup' } })
    fireEvent.change(within(form).getByLabelText('SKU'), { target: { value: 'A-1' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Create product' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('already uses that SKU')
    expect(within(form).getByLabelText('SKU')).toHaveValue('A-1')
    expect(within(screen.getByTestId('product-dialog')).getByTestId('product-images-locked')).toBeInTheDocument()
  })

  it('the live preview follows the form as typed', async () => {
    await open([])
    fireEvent.click((await screen.findByTestId('products-empty')).querySelector('button'))
    const dialog = await screen.findByTestId('product-dialog')
    const form = within(dialog).getByTestId('product-form')
    const preview = within(dialog).getByTestId('product-preview')
    expect(preview).toHaveTextContent('Untitled product')
    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'Live Serum' } })
    fireEvent.change(within(form).getByLabelText('Short description'), { target: { value: 'As you type' } })
    fireEvent.change(within(form).getByLabelText('Price'), { target: { value: '20' } })
    fireEvent.change(within(form).getByLabelText('Currency'), { target: { value: 'USD' } })
    expect(preview).toHaveTextContent('Live Serum')
    expect(preview).toHaveTextContent('As you type')
    expect(within(preview).getByTestId('product-preview-price')).toHaveTextContent('$20')
  })

  it('EDIT: opens with the saved values; Save is only enabled after a change; PATCH carries the product id and the fields; the card updates', async () => {
    const product = productData({ features: ['Vitamin C'], tags: ['skin'] })
    await open([product])
    const updated = { ...product, name: 'Premium Face Serum 2', price: 1099, priceDisplay: '₹1,099' }
    api.updateSocialProduct.mockResolvedValue(productResponse(updated))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Premium Face Serum' }))
    const dialog = await screen.findByTestId('product-dialog')
    const form = within(dialog).getByTestId('product-form')
    expect(within(form).getByLabelText('Product name')).toHaveValue('Premium Face Serum')
    expect(within(form).getByLabelText('Price')).toHaveValue('999')
    expect(within(form).getByLabelText('Currency')).toHaveValue('INR')
    expect(within(form).getByLabelText('Tags')).toHaveValue('skin')
    const save = within(form).getByRole('button', { name: 'Save product' })
    expect(save).toBeDisabled()
    api.listSocialProducts.mockResolvedValue(productList([updated]))
    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'Premium Face Serum 2' } })
    fireEvent.change(within(form).getByLabelText('Price'), { target: { value: '1099' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.updateSocialProduct).toHaveBeenCalledTimes(1))
    const [pid, productId, fields] = api.updateSocialProduct.mock.calls[0]
    expect([pid, productId]).toEqual(['proj-1', 'prod-1'])
    expect(fields).toMatchObject({ name: 'Premium Face Serum 2', price: '1099', currency: 'INR' })
    expect(fields).not.toHaveProperty('images')
    expect(fields).not.toHaveProperty('slug')
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    expect(await screen.findByText('Premium Face Serum 2')).toBeInTheDocument()
  })

  it('DELETE: asks first, then deletes by id and the card disappears; a failure is shown in the dialog and the product stays', async () => {
    await open([productData(), productData({ id: 'prod-2', name: 'Night Cream' })])
    api.deleteSocialProduct.mockRejectedValueOnce(apiError('The product request failed.', { status: 500 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Night Cream' }))
    expect(api.deleteSocialProduct).not.toHaveBeenCalled()
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('"Night Cream" and its 0 images will be deleted')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete product' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The product request failed.')
    expect(screen.getByText('Night Cream')).toBeInTheDocument()

    api.deleteSocialProduct.mockResolvedValue({ success: true, data: { id: 'prod-2' } })
    api.listSocialProducts.mockResolvedValue(productList([productData()]))
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete product' }))
    await waitFor(() => expect(api.deleteSocialProduct).toHaveBeenLastCalledWith('proj-1', 'prod-2'))
    await waitFor(() => expect(screen.queryByText('Night Cream')).not.toBeInTheDocument())
    expect(screen.getByText('Premium Face Serum')).toBeInTheDocument()
  })

  it('a product change refetches the business profile and the AI strategy (both derive from the catalog); the product list is not duplicated', async () => {
    const { queryClient } = await open([productData()])
    const strategyRefetch = vi.fn()
    queryClient.setQueryData(['social', 'ai-strategy', 'proj-1'], { status: 'ready' })
    queryClient.getQueryCache().find({ queryKey: ['social', 'ai-strategy', 'proj-1'] })?.setOptions({ queryFn: async () => { strategyRefetch(); return { status: 'ready' } } })
    api.updateSocialProduct.mockResolvedValue(productResponse(productData({ name: 'Renamed' })))
    const profileCalls = api.getSocialBusinessProfile.mock.calls.length
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Premium Face Serum' }))
    const form = within(await screen.findByTestId('product-dialog')).getByTestId('product-form')
    fireEvent.change(within(form).getByLabelText('Product name'), { target: { value: 'Renamed' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save product' }))
    await waitFor(() => expect(api.updateSocialProduct).toHaveBeenCalled())
    await waitFor(() => expect(api.getSocialBusinessProfile.mock.calls.length).toBeGreaterThan(profileCalls))
    expect(queryClient.getQueryState(['social', 'ai-strategy', 'proj-1']).isInvalidated || strategyRefetch.mock.calls.length > 0).toBe(true)
  })
})

// ── product images ───────────────────────────────────────────────────────────

describe('Product images', () => {
  const img = (n, over = {}) => productImage({ mediaId: `img-${n}`, url: `https://media.example/storage/social_media/proj-1/${n}.png`, isPrimary: n === 1, sortOrder: n - 1, ...over })
  const product = (images) => productData({ images, primaryImageUrl: images[0]?.url || null })

  async function openImages(images) {
    loadModel('product')
    const p = product(images)
    api.listSocialProducts.mockResolvedValue(productList([p]))
    api.getSocialProduct.mockResolvedValue(productResponse(p))
    const view = renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Manage images for Premium Face Serum' }))
    const manager = await screen.findByTestId('product-images')
    return { ...view, manager, p }
  }

  it('shows an honest empty state, the count and the limits', async () => {
    const { manager } = await openImages([])
    expect(within(manager).getByTestId('product-images-empty')).toHaveTextContent('No images yet.')
    expect(within(manager).getByTestId('product-images-count')).toHaveTextContent('0 of 8')
    expect(within(manager).getByTestId('product-image-input')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    expect(within(manager).getByTestId('product-image-input')).toHaveAttribute('multiple')
  })

  it('UPLOAD: sends the project, the product and the file; shows progress and processing; the new image appears', async () => {
    const { manager, p } = await openImages([])
    let report
    let finish
    api.uploadSocialProductImage.mockImplementation((_pid, _prod, _file, onProgress) => { report = onProgress; return new Promise((resolve) => { finish = resolve }) })
    const f = file('front.png')
    pickFiles(within(manager).getByTestId('product-image-input'), [f])
    await waitFor(() => expect(api.uploadSocialProductImage).toHaveBeenCalledTimes(1))
    expect(api.uploadSocialProductImage.mock.calls[0].slice(0, 3)).toEqual(['proj-1', 'prod-1', f])

    const uploads = await within(manager).findByTestId('product-uploads')
    expect(within(uploads).getByText('front.png')).toBeInTheDocument()
    act(() => report(40))
    expect(within(uploads).getByRole('progressbar', { name: 'Uploading front.png' })).toHaveAttribute('aria-valuenow', '40')
    expect(within(uploads).getByText('40%')).toBeInTheDocument()
    expect(within(manager).getByRole('button', { name: /Upload images/ })).toBeDisabled()
    act(() => report(100))
    expect(within(uploads).getByText('Processing…')).toBeInTheDocument()

    await act(async () => { finish(productResponse(product([img(1)]), { mediaId: 'img-1' })) })
    expect(await within(manager).findByTestId('product-images-grid')).toBeInTheDocument()
    expect(within(manager).queryByTestId('product-uploads')).not.toBeInTheDocument()
    expect(within(manager).getByTestId('primary-badge')).toBeInTheDocument()
    expect(within(manager).getByTestId('product-images-count')).toHaveTextContent('1 of 8')
    expect(p.images).toHaveLength(0)
  })

  it('UPLOAD: unsupported, oversized and empty files are refused on the spot with no request (SVG included)', async () => {
    const { manager } = await openImages([])
    const input = within(manager).getByTestId('product-image-input')
    pickFiles(input, [file('logo.svg', 'image/svg+xml'), file('big.png', 'image/png', 9 * 1024 * 1024), file('doc.pdf', 'application/pdf'), file('empty.png', 'image/png', 0)])
    const uploads = await within(manager).findByTestId('product-uploads')
    expect(within(uploads).getAllByText('Only JPEG, PNG or WEBP images are allowed.')).toHaveLength(2) // the SVG and the PDF
    expect(within(uploads).getByText('Images must be 8MB or smaller.')).toBeInTheDocument()
    expect(within(uploads).getByText('That file is empty.')).toBeInTheDocument()
    expect(api.uploadSocialProductImage).not.toHaveBeenCalled()
    fireEvent.click(within(uploads).getAllByRole('button', { name: /Dismiss/ })[0])
    expect(within(uploads).getAllByRole('button', { name: /Dismiss/ })).toHaveLength(3)
  })

  it('UPLOAD: a server refusal (bad bytes) is shown against that file, and a later file in the batch still uploads', async () => {
    const { manager } = await openImages([])
    api.uploadSocialProductImage
      .mockRejectedValueOnce(apiError('The uploaded file is not a valid image.', { status: 400, code: 'INVALID_MEDIA_TYPE', details: { code: 'INVALID_MEDIA_TYPE' } }))
      .mockResolvedValueOnce(productResponse(product([img(1)]), { mediaId: 'img-1' }))
    pickFiles(within(manager).getByTestId('product-image-input'), [file('fake.png'), file('real.png')])
    const uploads = await within(manager).findByTestId('product-uploads')
    expect(await within(uploads).findByText('The uploaded file is not a valid image.')).toBeInTheDocument()
    await waitFor(() => expect(api.uploadSocialProductImage).toHaveBeenCalledTimes(2))
    expect(await within(manager).findByTestId('product-images-grid')).toBeInTheDocument()
    expect(within(uploads).queryByText('real.png')).not.toBeInTheDocument()
  })

  it('UPLOAD: files beyond the 8-image limit are not sent', async () => {
    const eight = Array.from({ length: 7 }, (_, i) => img(i + 1))
    const { manager } = await openImages(eight)
    api.uploadSocialProductImage.mockResolvedValue(productResponse(product([...eight, img(8, { isPrimary: false })]), { mediaId: 'img-8' }))
    pickFiles(within(manager).getByTestId('product-image-input'), [file('a.png'), file('b.png')])
    await waitFor(() => expect(api.uploadSocialProductImage).toHaveBeenCalledTimes(1))
    const uploads = await within(manager).findByTestId('product-uploads')
    expect(await within(uploads).findByText('A product can have at most 8 images.')).toBeInTheDocument()
    expect(within(manager).getByRole('button', { name: /Upload images/ })).toBeDisabled()
  })

  it('PRIMARY and ORDER: make-primary and move send the product, image ids and the full new order', async () => {
    const { manager } = await openImages([img(1), img(2), img(3)])
    api.updateSocialProductImage.mockResolvedValue(productResponse(product([img(1, { isPrimary: false }), img(2, { isPrimary: true, sortOrder: 1 }), img(3)])))
    fireEvent.click(within(manager).getByRole('button', { name: 'Make image 2 the primary image' }))
    await waitFor(() => expect(api.updateSocialProductImage).toHaveBeenCalledWith('proj-1', 'prod-1', 'img-2', { isPrimary: true }))
    await waitFor(() => expect(within(within(manager).getByTestId('product-image-img-2')).getByTestId('primary-badge')).toBeInTheDocument())

    api.reorderSocialProductImages.mockResolvedValue(productResponse(product([img(1, { isPrimary: false, sortOrder: 0 }), img(3, { sortOrder: 1 }), img(2, { isPrimary: true, sortOrder: 2 })])))
    fireEvent.click(within(manager).getByRole('button', { name: 'Move image 3 earlier' }))
    await waitFor(() => expect(api.reorderSocialProductImages).toHaveBeenCalledWith('proj-1', 'prod-1', { mediaIds: ['img-1', 'img-3', 'img-2'], primaryMediaId: undefined }))
    await waitFor(() => {
      const ids = Array.from(manager.querySelectorAll('[data-testid^="product-image-img-"]')).map((el) => el.getAttribute('data-testid'))
      expect(ids).toEqual(['product-image-img-1', 'product-image-img-3', 'product-image-img-2'])
    })
    expect(within(manager).getByRole('button', { name: 'Move image 1 earlier' })).toBeDisabled()
    expect(within(manager).getByRole('button', { name: 'Move image 3 later' })).toBeDisabled()
  })

  it('ALT TEXT: saved when the field is left, only if it changed', async () => {
    const { manager } = await openImages([img(1)])
    api.updateSocialProductImage.mockResolvedValue(productResponse(product([img(1, { altText: 'Front of the bottle' })])))
    const field = within(manager).getByLabelText('Description for image 1')
    fireEvent.blur(field)
    expect(api.updateSocialProductImage).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: ' Front of the bottle ' } })
    fireEvent.blur(field)
    await waitFor(() => expect(api.updateSocialProductImage).toHaveBeenCalledWith('proj-1', 'prod-1', 'img-1', { altText: 'Front of the bottle' }))
  })

  it('REMOVE: asks first; confirming deletes that image and it disappears; a failure stays inside the dialog', async () => {
    const { manager } = await openImages([img(1), img(2)])
    api.deleteSocialProductImage.mockRejectedValueOnce(apiError('The product request failed.', { status: 500 }))
    fireEvent.click(within(manager).getByRole('button', { name: 'Remove image 2' }))
    expect(api.deleteSocialProductImage).not.toHaveBeenCalled()
    const confirm = (await screen.findAllByRole('dialog')).find((d) => d.textContent.includes('Remove this image?'))
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove image' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('The product request failed.')
    expect(within(manager).getByTestId('product-image-img-2')).toBeInTheDocument()

    api.deleteSocialProductImage.mockResolvedValue(productResponse(product([img(1)])))
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove image' }))
    await waitFor(() => expect(api.deleteSocialProductImage).toHaveBeenLastCalledWith('proj-1', 'prod-1', 'img-2'))
    await waitFor(() => expect(within(manager).queryByTestId('product-image-img-2')).not.toBeInTheDocument())
    expect(within(manager).getByTestId('product-images-count')).toHaveTextContent('1 of 8')
  })

  it('REPLACE: sends the new file for that image; a refused file shows the reason and nothing changes', async () => {
    const { manager } = await openImages([img(1)])
    const input = within(manager).getByTestId('product-image-replace-input')
    fireEvent.click(within(manager).getByRole('button', { name: 'Replace image 1' }))
    pickFiles(input, [file('new.svg', 'image/svg+xml')])
    expect(await within(manager).findByText('Only JPEG, PNG or WEBP images are allowed.')).toBeInTheDocument()
    expect(api.replaceSocialProductImage).not.toHaveBeenCalled()

    api.replaceSocialProductImage.mockResolvedValue(productResponse(product([img(1, { url: 'https://media.example/storage/social_media/proj-1/replaced.png' })])))
    const f = file('new.png')
    fireEvent.click(within(manager).getByRole('button', { name: 'Replace image 1' }))
    pickFiles(input, [f])
    await waitFor(() => expect(api.replaceSocialProductImage).toHaveBeenCalledTimes(1))
    expect(api.replaceSocialProductImage.mock.calls[0].slice(0, 4)).toEqual(['proj-1', 'prod-1', 'img-1', f])
    await waitFor(() => expect(within(manager).getByTestId('product-image-img-1').querySelector('img')).toHaveAttribute('src', expect.stringContaining('replaced.png')))
  })

  it('image changes do NOT refetch the business profile or the AI strategy (media is not part of what the strategy depends on)', async () => {
    const { manager, queryClient } = await openImages([img(1)])
    await waitFor(() => expect(api.getSocialBusinessProfile).toHaveBeenCalled())
    const before = api.getSocialBusinessProfile.mock.calls.length
    queryClient.setQueryData(['social', 'ai-strategy', 'proj-1'], { status: 'ready' })
    api.updateSocialProductImage.mockResolvedValue(productResponse(product([img(1, { altText: 'x' })])))
    fireEvent.change(within(manager).getByLabelText('Description for image 1'), { target: { value: 'x' } })
    fireEvent.blur(within(manager).getByLabelText('Description for image 1'))
    await waitFor(() => expect(api.updateSocialProductImage).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(api.getSocialBusinessProfile.mock.calls.length).toBe(before)
    expect(queryClient.getQueryState(['social', 'ai-strategy', 'proj-1']).isInvalidated).toBe(false)
  })
})

// ── brand kit ────────────────────────────────────────────────────────────────

describe('Brand kit — logo upload', () => {
  const ownLogo = (over = {}) => ({ logo: fact('https://media.example/storage/social_media/proj-1/logo.png', 'social_override', '2026-10-09T10:00:00.000Z', 'user_upload'), ...over })

  it('uploads the chosen file for the project, shows progress, and the logo becomes "User provided"', async () => {
    load({ google: true, media: { logo: fact('https://g.example/logo.jpg', 'google_business_profile') } })
    let report
    let finish
    api.uploadSocialBrandLogo.mockImplementation((_pid, _file, onProgress) => { report = onProgress; return new Promise((resolve) => { finish = resolve }) })
    renderBrand()
    const card = await screen.findByTestId('brand-logo')
    const f = file('logo.png')
    pickFiles(within(card).getByTestId('brand-logo-input'), [f])
    await waitFor(() => expect(api.uploadSocialBrandLogo).toHaveBeenCalledTimes(1))
    expect(api.uploadSocialBrandLogo.mock.calls[0].slice(0, 2)).toEqual(['proj-1', f])
    act(() => report(55))
    expect(within(card).getByRole('button', { name: /Uploading 55%/ })).toBeDisabled()

    const after = businessProfileData({ google: true, media: ownLogo() })
    api.getSocialBusinessProfile.mockResolvedValue(after)
    await act(async () => { finish(after) })
    await waitFor(() => expect(within(screen.getByTestId('brand-logo')).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override'))
    const updated = screen.getByTestId('brand-logo')
    expect(within(updated).getByText('User provided')).toBeInTheDocument()
    expect(within(updated).getByText(/You uploaded this logo/)).toBeInTheDocument()
    expect(within(updated).getByRole('button', { name: 'Replace logo' })).toBeEnabled()
    expect(within(updated).getByRole('button', { name: /Remove uploaded logo/ })).toBeEnabled()
  })

  it('refuses SVG, oversized and non-image files before any request', async () => {
    load({ google: false })
    renderBrand()
    const card = await screen.findByTestId('brand-logo')
    const input = within(card).getByTestId('brand-logo-input')
    pickFiles(input, [file('logo.svg', 'image/svg+xml')])
    expect(await within(card).findByRole('alert')).toHaveTextContent('Only JPEG, PNG or WEBP images are allowed.')
    pickFiles(input, [file('huge.png', 'image/png', 9 * 1024 * 1024)])
    await waitFor(() => expect(within(card).getByRole('alert')).toHaveTextContent('Images must be 8MB or smaller.'))
    expect(api.uploadSocialBrandLogo).not.toHaveBeenCalled()
    expect(within(card).getByText(/SVG files are not supported/)).toBeInTheDocument()
  })

  it('a server refusal is shown and the current logo stays', async () => {
    load({ google: true })
    api.uploadSocialBrandLogo.mockRejectedValue(apiError('The uploaded file is not a valid image.', { status: 400, details: { code: 'INVALID_MEDIA_TYPE' } }))
    renderBrand()
    const card = await screen.findByTestId('brand-logo')
    pickFiles(within(card).getByTestId('brand-logo-input'), [file('fake.png')])
    expect(await within(card).findByRole('alert')).toHaveTextContent('The uploaded file is not a valid image.')
    expect(within(card).getByTestId('source-badge')).toHaveAttribute('data-source', 'website_extraction')
  })

  it('removing the uploaded logo falls back to the automatic one', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(businessProfileData({ google: true, media: ownLogo() }))
    const fallback = businessProfileData({ google: true })
    api.deleteSocialBrandLogo.mockResolvedValue(fallback)
    renderBrand()
    const card = await screen.findByTestId('brand-logo')
    expect(within(card).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
    api.getSocialBusinessProfile.mockResolvedValue(fallback)
    fireEvent.click(within(card).getByRole('button', { name: /Remove uploaded logo/ }))
    await waitFor(() => expect(api.deleteSocialBrandLogo).toHaveBeenCalledWith('proj-1'))
    await waitFor(() => expect(within(screen.getByTestId('brand-logo')).getByTestId('source-badge')).toHaveAttribute('data-source', 'website_extraction'))
    expect(within(screen.getByTestId('brand-logo')).queryByRole('button', { name: /Remove uploaded logo/ })).not.toBeInTheDocument()
  })
})

describe('Brand kit — identity and messaging', () => {
  const saved = (editable) => businessProfileData({ google: true, editable: { exists: true, updatedAt: '2026-10-09T10:00:00.000Z', ...editable } })

  it('identity loads the saved values and saves ONLY brand identity + tone (blank -> null, lists from lines)', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(saved({
      toneOfVoice: { primary: 'Warm', secondary: [] },
      brand: { ...businessProfileData().data.editableProfile.brand, name: 'Acme Smiles', voice: 'Friendly', tagline: 'Smile more', personality: ['warm'] },
    }))
    api.updateSocialBusinessProfile.mockResolvedValue(saved({}))
    renderBrand()
    const identity = await screen.findByTestId('editor-identity')
    expect(within(identity).getByLabelText('Brand name')).toHaveValue('Acme Smiles')
    expect(within(identity).getByLabelText('Tone of voice')).toHaveValue('Warm')
    expect(within(identity).getByLabelText('Brand personality')).toHaveValue('warm')
    const save = within(identity).getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(within(identity).getByLabelText('Brand voice'), { target: { value: '  ' } })
    fireEvent.change(within(identity).getByLabelText('Brand personality'), { target: { value: 'warm\n\nbold' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    expect(api.updateSocialBusinessProfile.mock.calls[0]).toEqual(['proj-1', {
      brand: { name: 'Acme Smiles', description: null, voice: null, personality: ['warm', 'bold'], tagline: 'Smile more' },
      toneOfVoice: { primary: 'Warm', secondary: [] },
    }])
  })

  it('messaging saves ONLY key messages, USPs, preferred words, phrases to avoid and brand instructions', async () => {
    load({ google: true })
    api.updateSocialBusinessProfile.mockResolvedValue(saved({}))
    renderBrand()
    const messaging = await screen.findByTestId('editor-messaging')
    fireEvent.change(within(messaging).getByLabelText('Key messages'), { target: { value: 'Gentle care' } })
    fireEvent.change(within(messaging).getByLabelText('Unique selling points'), { target: { value: 'Open late' } })
    fireEvent.change(within(messaging).getByLabelText('Phrases to avoid'), { target: { value: 'cheapest' } })
    fireEvent.change(within(messaging).getByLabelText('Additional brand instructions'), { target: { value: 'No emojis' } })
    fireEvent.click(within(messaging).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateSocialBusinessProfile).toHaveBeenCalledTimes(1))
    expect(api.updateSocialBusinessProfile.mock.calls[0][1]).toEqual({
      brand: { keyMessages: ['Gentle care'], preferredWords: [], additionalInstructions: 'No emojis' },
      uniqueSellingPoints: ['Open late'], prohibitedPhrases: ['cheapest'],
    })
  })

  it('every user-entered field lives in exactly ONE form, so no two forms can overwrite each other', async () => {
    load({ google: true })
    const fieldsOf = (el) => new Set(Array.from(el.querySelectorAll('input,textarea')).map((i) => i.getAttribute('aria-label') || i.id).filter(Boolean))
    const business = renderSettings()
    await screen.findByTestId('editor-strategy')
    const businessForms = ['overrides', 'strategy'].map((s) => fieldsOf(screen.getByTestId(`editor-${s}`)))
    business.unmount()
    renderBrand()
    await screen.findByTestId('editor-identity')
    const brandForms = ['identity', 'messaging', 'brand'].map((s) => fieldsOf(screen.getByTestId(`editor-${s}`)))
    const all = [...businessForms, ...brandForms]
    const seen = new Map()
    all.forEach((set, idx) => set.forEach((id) => { if (seen.has(id)) throw new Error(`"${id}" is in forms ${seen.get(id)} and ${idx}`); seen.set(id, idx) }))
    expect(seen.size).toBeGreaterThan(30)
  })

  it('the preview uses the brand name, tagline and colours the user saved, falling back to the business name', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(businessProfileData({
      google: true, brand: { primaryColor: '#112233', secondaryColor: null, accentColor: null, fontHeading: null, fontBody: null, name: 'Acme Smiles', description: 'Brighter, kinder dentistry.', voice: null, personality: [], tagline: 'Smile more', keyMessages: [], preferredWords: [], additionalInstructions: null },
    }))
    renderBrand()
    expect(await screen.findByTestId('brand-preview-name')).toHaveTextContent('Acme Smiles')
    expect(screen.getByTestId('brand-preview-tagline')).toHaveTextContent('Smile more')
    expect(within(screen.getByTestId('brand-preview')).getByText('Brighter, kinder dentistry.')).toBeInTheDocument()
  })
})

// ── source transparency ──────────────────────────────────────────────────────

describe('Source indicators — overrides are never silent', () => {
  const overridden = () => businessProfileData({
    google: true,
    business: { name: { value: 'Acme Dental', source: 'social_override', lastUpdated: '2026-10-09T10:00:00.000Z', underlying: { value: 'Acme Dental Clinic', source: 'google_business_profile' } } },
    editable: { exists: true, overrides: { businessName: 'Acme Dental', description: null, category: null, secondaryCategories: null, phone: null, website: null, address: null, city: null, region: null, country: null, postalCode: null, serviceArea: null } },
  })

  it('the facts card says the user value is used and shows the Google value it replaces', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(overridden())
    renderSettings()
    const row = await screen.findByTestId('fact-name')
    expect(within(row).getByTestId('fact-name-value')).toHaveTextContent('Acme Dental')
    expect(within(row).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
    expect(within(row).getByText('User provided')).toBeInTheDocument()
    expect(within(row).getByTestId('fact-name-underlying')).toHaveTextContent('Your value is being used instead of Acme Dental Clinic (Google Business Profile).')
  })

  it('the Business information form shows, under the field, what is used and what the override replaced', async () => {
    api.getSocialBusinessProfile.mockResolvedValue(overridden())
    renderSettings()
    const hint = await screen.findByTestId('hint-name')
    expect(hint).toHaveTextContent('Using your value: Acme Dental')
    expect(within(hint).getByTestId('source-badge')).toHaveAttribute('data-source', 'social_override')
    expect(screen.getByTestId('hint-name-underlying')).toHaveTextContent('Without your value, Social AI would use Acme Dental Clinic (Google Business Profile).')
    expect(within(screen.getByTestId('editor-overrides')).getByLabelText('Business name')).toHaveValue('Acme Dental')
  })

  it('a field without an override says where its value comes from, with no "replaced" line', async () => {
    load({ google: true })
    renderSettings()
    const hint = await screen.findByTestId('hint-name')
    expect(hint).toHaveTextContent('Currently using: Acme Dental')
    expect(within(hint).getByTestId('source-badge')).toHaveAttribute('data-source', 'google_business_profile')
    expect(screen.queryByTestId('hint-name-underlying')).not.toBeInTheDocument()
    expect(screen.getByTestId('hint-postal')).toHaveTextContent('Nothing from Google or your project yet.')
  })
})

// ── AI strategy compatibility ────────────────────────────────────────────────

describe('AI strategy — the profile-changed banner and the stored context', () => {
  it('the banner names catalog changes in plain words and still never regenerates by itself', () => {
    const regenerate = vi.fn()
    renderWithClient(<StrategyProfileChangedBanner changes={['businessModel', 'products', 'services', 'brandKit']} onRegenerate={regenerate} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your Business Profile has changed since this strategy was generated.')
    expect(screen.getByTestId('profile-changes')).toHaveTextContent('Business type, Products, Services, Brand identity & messaging')
    expect(regenerate).not.toHaveBeenCalled()
  })

  const snapshot = (extra = {}) => ({
    generatedAt: '2026-10-01T10:00:00.000Z',
    data: {
      business: { name: 'Acme', category: 'Skincare', location: {} }, audience: { primary: 'Everyone' }, toneOfVoice: { primary: 'Warm' }, goals: ['x'], uniqueSellingPoints: [],
      connectedPlatforms: { facebook: false, instagram: false }, ...extra,
    },
  })

  it('shows the business type and how many products the strategy was based on', () => {
    renderWithClient(<StrategyBusinessContext snapshot={snapshot({ businessModel: 'product', products: [{ id: 'a' }, { id: 'b' }] })} />)
    expect(screen.getByTestId('context-business-type')).toHaveTextContent('Product-based')
    expect(screen.getByTestId('context-products')).toHaveTextContent('2 listed')
    expect(screen.queryByTestId('context-services')).not.toBeInTheDocument()
  })

  it('shows services for a service business, and "Not set" for a strategy made before the business type existed (no invented value)', () => {
    const { unmount } = renderWithClient(<StrategyBusinessContext snapshot={snapshot({ businessModel: 'service', services: [{ id: 's' }] })} />)
    expect(screen.getByTestId('context-services')).toHaveTextContent('1 listed')
    unmount()
    renderWithClient(<StrategyBusinessContext snapshot={snapshot()} />)
    expect(screen.getByTestId('context-business-type')).toHaveTextContent('Not set')
    expect(screen.queryByTestId('context-products')).not.toBeInTheDocument()
    expect(screen.queryByTestId('context-services')).not.toBeInTheDocument()
  })
})

// ── layout hooks for small screens ───────────────────────────────────────────

describe('Responsive layout', () => {
  it('forms and grids collapse to one column on small screens (mobile-first classes), and the dialog preview is desktop-only', async () => {
    loadModel('product')
    api.listSocialProducts.mockResolvedValue(productList([productData()]))
    renderSettings()
    expect((await screen.findByTestId('products-grid')).className).toMatch(/grid-cols-1\b.*sm:grid-cols-2/)
    expect(screen.getByTestId('business-model').querySelector('[role="radiogroup"]').className).toMatch(/grid-cols-1\b.*sm:grid-cols-2/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Premium Face Serum' }))
    const dialog = await screen.findByTestId('product-dialog')
    expect(within(dialog).getByLabelText('Product preview').className).toMatch(/hidden lg:block/)
    expect(dialog.className).toMatch(/max-h-\[92vh\]/)
    expect(dialog.className).toMatch(/overflow-y-auto/)
  })
})

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react'
import { renderWithClient, apiError } from '@/test-utils/socialMediaAI'
import {
  studioState, studioGeneration, generatingGeneration, studioCandidate, withSelectedDesign, gatedState, startedResponse, okResponse, BRAND, EMPTY_BRAND,
} from '@/test-utils/socialStudio'

const api = vi.hoisted(() => ({ getSocialStudio: vi.fn(), generateSocialStudioDesigns: vi.fn(), regenerateSocialStudioDesign: vi.fn(), selectSocialStudioDesign: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { StudioWorkspace } from './StudioWorkspace'

const studioReturns = (...states) => {
  api.getSocialStudio.mockReset()
  states.slice(0, -1).forEach((s) => api.getSocialStudio.mockResolvedValueOnce(okResponse(s)))
  api.getSocialStudio.mockResolvedValue(okResponse(states.at(-1)))
}
const renderStudio = (opts) => renderWithClient(<StudioWorkspace projectId="proj-1" publicationId="pub-1" />, opts)
const card = (slot) => screen.getByTestId(`design-card-${slot}`)

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
})
afterEach(() => { vi.useRealTimers() })

describe('Creative Studio - the content is the real publication', () => {
  it('shows the server caption, hashtags, platform, versions and approval state', async () => {
    studioReturns(studioState())
    renderStudio()
    expect(await screen.findByTestId('studio-caption')).toHaveTextContent('Brushing for two minutes protects your smile. Book a check-up')
    expect(screen.getByTestId('studio-hashtags')).toHaveTextContent('#DentalCare')
    expect(screen.getByTestId('studio-hashtags')).toHaveTextContent('#HealthySmile')
    expect(screen.getByTestId('studio-platform')).toHaveTextContent('Facebook')
    expect(screen.getByTestId('studio-approval')).toHaveTextContent('Content approved')
    expect(screen.getByTestId('studio-versions')).toHaveTextContent('Content v1 · Design v1')
    expect(api.getSocialStudio).toHaveBeenCalledWith('proj-1', 'pub-1')
  })

  it('contains none of the old mock content', async () => {
    studioReturns(studioState())
    renderStudio()
    await screen.findByTestId('studio-caption')
    const text = document.body.textContent
    for (const mock of ['Build your online presence', 'Sapphire Digital Agency', '#BusinessGrowth', '#OnlinePresence', 'Save draft', 'Approve & continue']) expect(text).not.toContain(mock)
    expect(document.querySelectorAll('img').length).toBe(1) // only the brand logo from the server: no placeholder design images
  })

  it('shows the product and service the post is about, from the server', async () => {
    studioReturns(studioState({ product: { id: 'p1', name: 'Whitening kit', images: [] }, service: { id: 's1', name: 'SEO Audit' }, plan: { itemId: 'i1', topic: 'Brushing basics' } }))
    renderStudio()
    expect(await screen.findByTestId('studio-product-name')).toHaveTextContent('Whitening kit')
    expect(screen.getByTestId('studio-service-name')).toHaveTextContent('SEO Audit')
    expect(screen.getByTestId('studio-about')).toHaveTextContent('Brushing basics')
  })

  it('links to the content details and the approval screen', async () => {
    studioReturns(withSelectedDesign(1))
    renderStudio()
    expect((await screen.findByText('View content details')).closest('a')).toHaveAttribute('href', '/app/social-media/content-approvals')
    expect(screen.getByTestId('open-approval')).toHaveAttribute('href', '/app/social-media/content-approvals')
  })
})

describe('Creative Studio - brand settings are the real brand kit', () => {
  it('shows the business name, logo, colours, typography, tone, guidelines and the real format', async () => {
    studioReturns(studioState())
    renderStudio()
    expect(await screen.findByTestId('brand-name')).toHaveTextContent('Acme Dental')
    expect(within(screen.getByTestId('brand-logo')).getByRole('img')).toHaveAttribute('src', BRAND.logo.url)
    expect(screen.getByTestId('brand-colors')).toHaveTextContent('#1d4ed8')
    expect(screen.getByTestId('brand-colors')).toHaveTextContent('#f59e0b')
    expect(screen.getByTestId('brand-fonts')).toHaveTextContent('Headings: Poppins · Body: Inter')
    expect(screen.getByTestId('brand-tone')).toHaveTextContent('Warm')
    expect(screen.getByTestId('brand-guidelines')).toHaveTextContent('Bright, clean photography')
    expect(screen.getByTestId('brand-format')).toHaveTextContent('Facebook feed image (3:2)')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument() // the format and fonts are not editable fakes
  })

  it('says so when nothing is configured: no logo, no colours, default typography', async () => {
    studioReturns(studioState({ brand: EMPTY_BRAND }))
    renderStudio()
    expect(await screen.findByTestId('brand-logo-empty')).toHaveTextContent('No logo available')
    expect(screen.getByTestId('brand-colors-empty')).toHaveTextContent('Brand colors not configured')
    expect(screen.getByTestId('brand-fonts-default')).toHaveTextContent('Default typography')
    expect(within(screen.getByTestId('brand-logo')).queryByRole('img')).not.toBeInTheDocument()
  })

  it('a plan that calls for a video or carousel explains that the studio makes the still image', async () => {
    studioReturns(studioState({ format: { ...studioState().format, plannedFormat: 'reel', note: 'The plan calls for a video: Creative Studio creates the still image for it.' } }))
    renderStudio()
    expect(await screen.findByTestId('brand-format')).toHaveTextContent('still image')
  })
})

describe('Creative Studio - never shows a stale copy as fresh', () => {
  it('revisiting with an old state in the cache (the app\'s default staleTime is 5 minutes) still refetches and shows what the server says now', async () => {
    const { createQueryClient } = await import('@/test-utils/socialMediaAI')
    const queryClient = createQueryClient()
    queryClient.setDefaultOptions({ queries: { staleTime: 5 * 60 * 1000, retry: false } })
    // what the cache holds from before the design was selected
    queryClient.setQueryData(['social', 'studio', 'proj-1', 'pub-1'], studioState({ generation: studioGeneration() }))
    studioReturns(withSelectedDesign(1))
    renderStudio({ queryClient })
    await waitFor(() => expect(api.getSocialStudio).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('design-card-1')).toHaveAttribute('data-current', 'true'))
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Design review')
  })
})

describe('Creative Studio - the approval gate', () => {
  it('unapproved content: the server message and Review Content; no generate button and no generation request', async () => {
    studioReturns(gatedState())
    renderStudio()
    expect(await screen.findByTestId('studio-gate-message')).toHaveTextContent('Content approval required before creating the design.')
    expect(screen.getByText('Review Content').closest('a')).toHaveAttribute('href', '/app/social-media/content-approvals')
    expect(screen.queryByTestId('generate-designs-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('design-grid')).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Content pending approval')
    expect(api.generateSocialStudioDesigns).not.toHaveBeenCalled()
  })

  it('approved content with no designs: Ready to generate, with an honest empty grid', async () => {
    studioReturns(studioState())
    renderStudio()
    expect(await screen.findByTestId('design-grid-empty')).toHaveTextContent('No designs yet')
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Ready to generate')
    expect(screen.getByTestId('generate-designs-button')).toHaveTextContent('Generate designs')
    expect(screen.queryByTestId('regenerate-selected-button')).not.toBeInTheDocument()
  })
})

describe('Creative Studio - generating', () => {
  it('Generate designs sends only the publication and the content version the user sees', async () => {
    studioReturns(studioState(), studioState({ generation: generatingGeneration() }))
    api.generateSocialStudioDesigns.mockResolvedValue(startedResponse())
    renderStudio()
    fireEvent.click(await screen.findByTestId('generate-designs-button'))
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledTimes(1))
    // (apiService fills replaceApproved: false; the page never asks to replace anything on its own)
    expect(api.generateSocialStudioDesigns).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', contentVersion: 1, productMediaIds: undefined })
  })

  it('shows exactly three skeletons while the server says generating - and no image', async () => {
    studioReturns(studioState({ generation: generatingGeneration() }))
    renderStudio()
    expect(await screen.findAllByTestId('design-skeleton')).toHaveLength(3)
    expect(screen.queryByTestId('design-card-image')).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Generating designs')
    expect(screen.getByTestId('generate-designs-button')).toBeDisabled()
    expect(screen.getByTestId('studio-generating')).toBeInTheDocument()
  })

  it('a fast double click sends ONE request', async () => {
    studioReturns(studioState())
    let release
    api.generateSocialStudioDesigns.mockReturnValue(new Promise((r) => { release = r }))
    renderStudio()
    const button = await screen.findByTestId('generate-designs-button')
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledTimes(1))
    fireEvent.click(button)
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(api.generateSocialStudioDesigns).toHaveBeenCalledTimes(1)
    await act(async () => { release(startedResponse()) })
  })

  it('polls the studio only while generating, then shows the three real designs and stops polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    studioReturns(studioState({ generation: generatingGeneration() }), studioState({ generation: generatingGeneration() }), studioState({ generation: studioGeneration() }))
    renderStudio()
    expect(await screen.findAllByTestId('design-skeleton')).toHaveLength(3)
    expect(api.getSocialStudio).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    await waitFor(() => expect(screen.getAllByTestId('design-card-image')).toHaveLength(3))
    const calls = api.getSocialStudio.mock.calls.length
    expect(calls).toBe(3)
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(api.getSocialStudio.mock.calls.length).toBe(calls) // no polling once finished
    expect(screen.queryByTestId('design-skeleton')).not.toBeInTheDocument()
  })

  it('stops polling when the page is left', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    studioReturns(studioState({ generation: generatingGeneration() }))
    const { unmount } = renderStudio()
    await screen.findAllByTestId('design-skeleton')
    unmount()
    const calls = api.getSocialStudio.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(api.getSocialStudio.mock.calls.length).toBe(calls)
  })

  it('only the card being regenerated is a skeleton; the other two keep their real images', async () => {
    studioReturns(studioState({ generation: studioGeneration({ status: 'generating', active: true, action: 'regenerate', activeCandidateId: 'cand-1' }) }))
    renderStudio()
    expect(await screen.findAllByTestId('design-skeleton')).toHaveLength(1)
    expect(screen.getAllByTestId('design-card-image')).toHaveLength(2)
  })
})

describe('Creative Studio - three real designs', () => {
  it('each card shows the server image, its creative direction and that it is not selected yet', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    renderStudio()
    await screen.findByTestId('design-grid')
    const cards = [0, 1, 2].map(card)
    expect(cards.map((c) => within(c).getByTestId('design-card-label').textContent)).toEqual(['Educational list', 'Premium editorial', 'Modern SaaS / technology'])
    expect(cards.map((c) => within(c).getByTestId('design-card-image').getAttribute('src'))).toEqual([0, 1, 2].map((i) => `http://localhost:5000/storage/social_media/proj-1/design-${i}.jpg`))
    cards.forEach((c) => expect(c).toHaveTextContent('Not selected yet'))
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Designs ready')
    expect(screen.getByText('Choose from 3 AI designs')).toBeInTheDocument()
  })

  it('enlarges a design in a preview', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    renderStudio()
    fireEvent.click(within(await screen.findByTestId('design-card-1')).getByTestId('design-card-enlarge'))
    expect(await screen.findByTestId('design-lightbox')).toBeInTheDocument()
    expect(within(screen.getByTestId('design-lightbox')).getByRole('img')).toHaveAttribute('src', 'http://localhost:5000/storage/social_media/proj-1/design-1.jpg')
  })

  it('Regenerate all is offered instead of Generate designs, and regenerates the three through the server', async () => {
    studioReturns(studioState({ generation: studioGeneration() }), studioState({ generation: generatingGeneration({ id: 'gen-2' }) }))
    api.generateSocialStudioDesigns.mockResolvedValue(startedResponse(generatingGeneration({ id: 'gen-2' })))
    renderStudio()
    const button = await screen.findByTestId('generate-designs-button')
    expect(button).toHaveTextContent('Regenerate all')
    fireEvent.click(button)
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledWith('proj-1', expect.objectContaining({ publicationId: 'pub-1', contentVersion: 1 })))
    expect(await screen.findAllByTestId('design-skeleton')).toHaveLength(3)
  })

  it('a card drawn without its photograph says why (the server\'s plain reason), and is still a design that can be selected', async () => {
    const fellBack = studioCandidate(1, { layoutId: 'statement_quote', notes: ['photo_fallback'], fallback: { code: 'DESIGN_IMAGE_MODEL_UNAVAILABLE', message: 'The AI image model Odito is set up to use is not available (it may have been retired), so no photograph could be made. This option uses a layout without a photograph instead.' } })
    studioReturns(studioState({ generation: studioGeneration({ candidates: [studioCandidate(0), fellBack, studioCandidate(2)] }) }))
    renderStudio()
    const notes = await screen.findAllByTestId('design-card-fallback')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toHaveTextContent('no photograph could be made. This option uses a layout without a photograph instead.')
    expect(screen.queryByTestId('design-card-failure')).not.toBeInTheDocument()
    expect(screen.getByTestId('design-card-1')).toHaveAttribute('data-status', 'ready')
  })

  it('a failed card shows the server reason and Try again regenerates just that design', async () => {
    const failed = studioCandidate(2, { status: 'failed', imageUrl: null, failure: { code: 'AI_TIMEOUT', message: 'The design took too long.' } })
    studioReturns(studioState({ generation: studioGeneration({ candidates: [studioCandidate(0), studioCandidate(1), failed] }) }))
    api.regenerateSocialStudioDesign.mockResolvedValue(startedResponse())
    renderStudio()
    expect(await screen.findByTestId('design-card-failure')).toHaveTextContent('The design took too long.')
    expect(screen.getAllByTestId('design-card-image')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('design-card-retry'))
    await waitFor(() => expect(api.regenerateSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ generationId: 'gen-1', candidateId: 'cand-2' })))
  })
})

describe('Creative Studio - selecting persists through the server', () => {
  it('Select design sends the ids and versions the user saw, then shows what the SERVER now says', async () => {
    studioReturns(studioState({ generation: studioGeneration() }), withSelectedDesign(1))
    api.selectSocialStudioDesign.mockResolvedValue(okResponse({ designVersion: 2, publication: { id: 'pub-1' } }))
    const { queryClient } = renderStudio()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    fireEvent.click(within(await screen.findByTestId('design-card-1')).getByTestId('design-card-select'))
    await waitFor(() => expect(api.selectSocialStudioDesign).toHaveBeenCalledTimes(1))
    expect(api.selectSocialStudioDesign).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', generationId: 'gen-1', candidateId: 'cand-1', contentVersion: 1, designVersion: 1, replaceApproved: false })
    await waitFor(() => expect(screen.getByTestId('design-card-1')).toHaveAttribute('data-current', 'true'))
    expect(within(card(1)).getByTestId('design-card-current')).toHaveTextContent('Selected design')
    expect(card(1)).toHaveTextContent('Design v2')
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Design review')
    expect(screen.getByTestId('open-approval')).toBeInTheDocument()
    // the publishing lists and approval counts are refetched (the post moved in the workflow)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['social', 'publishing', 'proj-1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['social', 'studio', 'proj-1', 'pub-1'], exact: true })
    // the other cards offer Replace design now
    expect(within(card(0)).getByTestId('design-card-select')).toHaveTextContent('Replace design')
    expect(within(card(1)).queryByTestId('design-card-select')).not.toBeInTheDocument()
  })

  it('is not "selected" until the server says so: a refused select leaves every card unselected and shows why', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    api.selectSocialStudioDesign.mockRejectedValue(apiError('The design changed since you loaded it. Reload and try again.', { code: 'DESIGN_VERSION_MISMATCH', status: 409 }))
    renderStudio()
    fireEvent.click(within(await screen.findByTestId('design-card-0')).getByTestId('design-card-select'))
    expect(await screen.findByTestId('studio-error-message')).toHaveTextContent('The design changed since you loaded it.')
    ;[0, 1, 2].forEach((i) => expect(card(i)).toHaveAttribute('data-current', 'false'))
  })

  it('a design that is already on the post is not offered for selection again', async () => {
    studioReturns(withSelectedDesign(0))
    renderStudio()
    await screen.findByTestId('design-grid')
    expect(within(card(0)).queryByTestId('design-card-select')).not.toBeInTheDocument()
    expect(within(card(1)).getByTestId('design-card-select')).toBeInTheDocument()
  })
})

describe('Creative Studio - replacing an approved design is explicit', () => {
  it('asks first; nothing is sent until confirmed, then replaceApproved is true', async () => {
    studioReturns(withSelectedDesign(1, { approvalState: 'design_approved' }), withSelectedDesign(0))
    api.selectSocialStudioDesign.mockResolvedValue(okResponse({ designVersion: 3 }))
    renderStudio()
    expect(await screen.findByTestId('design-approved-note')).toBeInTheDocument()
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Design approved')
    fireEvent.click(within(card(0)).getByTestId('design-card-select'))
    expect(await screen.findByText('Replace the approved design?')).toBeInTheDocument()
    expect(api.selectSocialStudioDesign).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Replace design' }))
    await waitFor(() => expect(api.selectSocialStudioDesign).toHaveBeenCalledTimes(1))
    expect(api.selectSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ candidateId: 'cand-0', designVersion: 2, replaceApproved: true }))
  })

  it('cancelling the confirmation sends nothing', async () => {
    studioReturns(withSelectedDesign(1, { approvalState: 'design_approved' }))
    renderStudio()
    fireEvent.click(within(await screen.findByTestId('design-card-0')).getByTestId('design-card-select'))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep current design' }))
    await waitFor(() => expect(screen.queryByText('Replace the approved design?')).not.toBeInTheDocument())
    expect(api.selectSocialStudioDesign).not.toHaveBeenCalled()
  })

  it('refining the approved design also needs the confirmation (it becomes a new version in review)', async () => {
    studioReturns(withSelectedDesign(1, { approvalState: 'design_approved' }))
    api.regenerateSocialStudioDesign.mockResolvedValue(startedResponse())
    renderStudio()
    await screen.findByTestId('design-grid')
    fireEvent.change(screen.getByTestId('refine-input'), { target: { value: 'Use a darker background' } })
    fireEvent.click(screen.getByTestId('apply-ai-changes'))
    expect(await screen.findByText('Replace the approved design?')).toBeInTheDocument()
    expect(api.regenerateSocialStudioDesign).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Replace design' }))
    await waitFor(() => expect(api.regenerateSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ candidateId: 'cand-1', instruction: 'Use a darker background', replaceApproved: true })))
  })
})

describe('Creative Studio - regenerate selected and Tell the AI what to change', () => {
  it('Regenerate selected needs a design to be chosen first, then regenerates only that one (no instruction)', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    api.regenerateSocialStudioDesign.mockResolvedValue(startedResponse(studioGeneration({ status: 'generating', active: true, action: 'regenerate', activeCandidateId: 'cand-2' })))
    renderStudio()
    const button = await screen.findByTestId('regenerate-selected-button')
    expect(button).toBeDisabled()
    expect(screen.getByTestId('refine-target')).toHaveTextContent('Choose one of the designs above')
    fireEvent.click(within(card(2)).getByTestId('design-card-focus'))
    expect(card(2)).toHaveAttribute('data-focused', 'true')
    expect(screen.getByTestId('refine-target')).toHaveTextContent('Modern SaaS / technology')
    expect(button).toBeEnabled()
    fireEvent.click(button)
    await waitFor(() => expect(api.regenerateSocialStudioDesign).toHaveBeenCalledTimes(1))
    expect(api.regenerateSocialStudioDesign).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', generationId: 'gen-1', candidateId: 'cand-2', contentVersion: 1, instruction: undefined, productMediaIds: undefined, replaceApproved: false })
  })

  it('Apply AI changes sends the instruction for the chosen design and clears the box', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    api.regenerateSocialStudioDesign.mockResolvedValue(startedResponse())
    renderStudio()
    await screen.findByTestId('design-grid')
    expect(screen.getByTestId('apply-ai-changes')).toBeDisabled()
    expect(screen.getByTestId('refine-input')).toBeDisabled()
    fireEvent.click(within(card(0)).getByTestId('design-card-focus'))
    fireEvent.change(screen.getByTestId('refine-input'), { target: { value: '  Make the   headline larger ' } })
    fireEvent.click(screen.getByTestId('apply-ai-changes'))
    await waitFor(() => expect(api.regenerateSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ candidateId: 'cand-0', instruction: 'Make the headline larger' })))
    await waitFor(() => expect(screen.getByTestId('refine-input')).toHaveValue(''))
  })

  it('a suggestion only fills the box; nothing is sent until Apply AI changes', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    renderStudio()
    await screen.findByTestId('design-grid')
    fireEvent.click(within(card(1)).getByTestId('design-card-focus'))
    fireEvent.click(screen.getByRole('button', { name: 'Use a darker background' }))
    expect(screen.getByTestId('refine-input')).toHaveValue('Use a darker background')
    expect(api.regenerateSocialStudioDesign).not.toHaveBeenCalled()
  })

  it('an instruction over the limit cannot be applied', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    renderStudio()
    await screen.findByTestId('design-grid')
    fireEvent.click(within(card(1)).getByTestId('design-card-focus'))
    fireEvent.change(screen.getByTestId('refine-input'), { target: { value: 'x'.repeat(450) } })
    expect(screen.getByTestId('apply-ai-changes')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('under 400')
  })

  it('the design the post carries is the default target, so a change returns it to review (server-side) without picking it first', async () => {
    studioReturns(withSelectedDesign(2))
    api.regenerateSocialStudioDesign.mockResolvedValue(startedResponse())
    renderStudio()
    await screen.findByTestId('design-grid')
    expect(screen.getByTestId('refine-target')).toHaveTextContent('Modern SaaS / technology')
    fireEvent.change(screen.getByTestId('refine-input'), { target: { value: 'More premium' } })
    fireEvent.click(screen.getByTestId('apply-ai-changes'))
    await waitFor(() => expect(api.regenerateSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ candidateId: 'cand-2', instruction: 'More premium', replaceApproved: false })))
  })
})

describe('Creative Studio - product photos', () => {
  const product = { id: 'p1', name: 'Whitening kit', images: [
    { mediaId: 'm1', url: 'http://localhost:5000/storage/social_media/proj-1/a.jpg', altText: 'Kit front', isPrimary: true, selected: true },
    { mediaId: 'm2', url: 'http://localhost:5000/storage/social_media/proj-1/b.jpg', altText: 'Kit box', isPrimary: false, selected: false },
  ] }

  it('lists the real product photos with the server default selected, and sends the chosen ones', async () => {
    studioReturns(studioState({ product }))
    api.generateSocialStudioDesigns.mockResolvedValue(startedResponse())
    renderStudio()
    expect(await screen.findByTestId('product-photo-m1')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('product-photo-m2')).toHaveAttribute('data-selected', 'false')
    fireEvent.click(screen.getByTestId('product-photo-m2'))
    fireEvent.click(screen.getByTestId('product-photo-m1'))
    expect(screen.getByTestId('product-photo-m2')).toHaveAttribute('data-selected', 'true')
    fireEvent.click(screen.getByTestId('generate-designs-button'))
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledWith('proj-1', expect.objectContaining({ productMediaIds: ['m2'] })))
  })

  it('a product with no photos says so and offers the catalog - no invented picture', async () => {
    studioReturns(studioState({ product: { id: 'p1', name: 'Whitening kit', images: [] } }))
    renderStudio()
    expect(await screen.findByTestId('product-no-photos')).toHaveTextContent('no photos')
    expect(screen.queryByTestId('product-photo-m1')).not.toBeInTheDocument()
  })

  it('a post without a product has no product section', async () => {
    studioReturns(studioState())
    renderStudio()
    await screen.findByTestId('studio-brand')
    expect(screen.queryByTestId('brand-product')).not.toBeInTheDocument()
  })
})

describe('Creative Studio - errors are shown, never faked', () => {
  it('a refused generation shows the server message with Try again; no fallback image appears', async () => {
    studioReturns(studioState())
    api.generateSocialStudioDesigns.mockRejectedValueOnce(apiError('AI design generation is not available right now.', { code: 'AI_UNAVAILABLE', status: 503 }))
    api.generateSocialStudioDesigns.mockResolvedValueOnce(startedResponse())
    renderStudio()
    fireEvent.click(await screen.findByTestId('generate-designs-button'))
    expect(await screen.findByTestId('studio-error-message')).toHaveTextContent('AI design generation is not available right now.')
    expect(screen.queryByTestId('design-card-image')).not.toBeInTheDocument()
    expect(screen.queryByTestId('design-skeleton')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-error-retry'))
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByTestId('studio-error')).not.toBeInTheDocument())
  })

  it('a failed generation shows the server failure message and Try again; nothing was generated', async () => {
    studioReturns(studioState({ generation: studioGeneration({ status: 'failed', candidates: [], failure: { code: 'AI_TIMEOUT', message: 'The design took too long. Try again.' } }) }))
    api.generateSocialStudioDesigns.mockResolvedValue(startedResponse())
    renderStudio()
    expect(await screen.findByTestId('generation-failed-message')).toHaveTextContent('The design took too long. Try again.')
    expect(screen.getByTestId('studio-state-label')).toHaveTextContent('Generation failed')
    expect(screen.queryByTestId('design-card-image')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('generation-failed-retry'))
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledTimes(1))
  })

  it('a stale refusal (the caption changed) shows the server message', async () => {
    studioReturns(studioState())
    api.generateSocialStudioDesigns.mockRejectedValue(apiError('The caption changed since you loaded it. Reload and try again.', { code: 'VERSION_MISMATCH', status: 409 }))
    renderStudio()
    fireEvent.click(await screen.findByTestId('generate-designs-button'))
    expect(await screen.findByTestId('studio-error-message')).toHaveTextContent('The caption changed')
  })

  it('a studio that cannot load says so with a retry; a post that does not exist says it was not found', async () => {
    api.getSocialStudio.mockRejectedValue(apiError('Server error', { status: 500 }))
    const { unmount } = renderStudio()
    expect(await screen.findByTestId('studio-load-error-message')).toHaveTextContent('Server error')
    expect(screen.getByTestId('studio-load-error-retry')).toBeInTheDocument()
    unmount()
    api.getSocialStudio.mockReset()
    api.getSocialStudio.mockRejectedValue(apiError('That publication was not found.', { code: 'NOT_FOUND', status: 404 }))
    renderStudio()
    expect(await screen.findByText('That post was not found.')).toBeInTheDocument()
  })

  it('shows a loading skeleton, not content, while the studio loads', () => {
    api.getSocialStudio.mockReturnValue(new Promise(() => {}))
    renderStudio()
    expect(screen.getByTestId('studio-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-caption')).not.toBeInTheDocument()
  })

  it('an image that fails to load shows a neutral placeholder, not a broken icon', async () => {
    studioReturns(studioState({ generation: studioGeneration() }))
    renderStudio()
    fireEvent.error(within(await screen.findByTestId('design-card-0')).getByTestId('design-card-image'))
    expect(await within(card(0)).findByTestId('design-card-image-error')).toBeInTheDocument()
  })
})

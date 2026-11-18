import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import { renderWithClient, managedPublication, apiError } from '@/test-utils/socialMediaAI'
import { mapPublicationToApprovalPost } from '@/lib/socialMedia/postMapper'

const api = vi.hoisted(() => ({ getSocialAIDesignStatus: vi.fn(), generateSocialAIDesign: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { DesignApprovalPanel } from './DesignApprovalPanel'
import { resetDesignFollowers } from '@/hooks/useSocialMediaAI'

const GEN = (o = {}) => ({ id: 'dgen-1', publicationId: 'pub-x', status: 'generating', platform: 'facebook', contentVersion: 1, designVersion: null, startedAt: '2026-10-09T10:00:00.000Z', finishedAt: null, failure: null, ...o })
const statusBody = ({ status = 'none', generation = null, publication = null } = {}) => ({ success: true, data: { status, generation, publication } })
const startBody = (generation = GEN()) => ({ success: true, data: { status: 'generating', generationId: generation.id, alreadyRunning: false, generation } })

beforeEach(() => {
  resetDesignFollowers()
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getSocialAIDesignStatus.mockResolvedValue(statusBody())
})
afterEach(() => { vi.useRealTimers() })

const post = (state, over = {}, approvalOver = {}) => mapPublicationToApprovalPost(managedPublication(state, { id: 'pub-x', ...over }, approvalOver))
const renderPanel = (p, opts) => renderWithClient(<DesignApprovalPanel post={p} projectId="proj-1" uploading={false} error={null} onReplace={() => {}} />, opts)
const MEDIA = [{ url: 'http://localhost:5000/storage/social_media/p/a.jpg', type: 'image' }]

describe('Design generate control - when it is offered', () => {
  it('appears for a draft whose content is approved, and asks the server (not the client) what is going on', async () => {
    renderPanel(post('content_approved'))
    expect(await screen.findByTestId('generate-design-button')).toHaveTextContent('Generate design')
    expect(screen.getByTestId('generate-design-button')).toBeEnabled()
    await waitFor(() => expect(api.getSocialAIDesignStatus).toHaveBeenCalledWith('proj-1', 'pub-x'))
  })

  it.each(['content_review'])('does NOT appear while the content is still in %s - and nothing is requested', async (state) => {
    renderPanel(post(state))
    expect(screen.getByTestId('design-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('design-generate')).not.toBeInTheDocument()
    expect(api.getSocialAIDesignStatus).not.toHaveBeenCalled()
  })

  it('does NOT appear for a post outside the workflow, or one that is already scheduled/published', () => {
    renderPanel(mapPublicationToApprovalPost({ ...managedPublication('content_approved'), approval: null }))
    expect(screen.queryByTestId('design-generate')).not.toBeInTheDocument()
  })

  it('does NOT appear for a scheduled post even if fully approved', () => {
    renderPanel(post('design_approved', { status: 'scheduled' }))
    expect(screen.queryByTestId('design-generate')).not.toBeInTheDocument()
  })

  it('appears as "Regenerate design" when a design exists (in review), and says what replacing an APPROVED design does', async () => {
    const { unmount } = renderPanel(post('design_review', { media: MEDIA }))
    expect(await screen.findByTestId('generate-design-button')).toHaveTextContent('Regenerate design')
    expect(screen.getByTestId('design-generate')).not.toHaveTextContent('sends this post back to design review')
    unmount()
    renderPanel(post('design_approved', { media: MEDIA }))
    expect(await screen.findByTestId('design-generate')).toHaveTextContent('sends this post back to design review')
  })
})

describe('Design generate control - generating', () => {
  it('sends ONLY the publication, the content version the user sees and replaceApproved; no state, design version, prompt or size', async () => {
    api.generateSocialAIDesign.mockResolvedValue(startBody())
    renderPanel(post('content_approved', {}, { contentVersion: 3 }))
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    await waitFor(() => expect(api.generateSocialAIDesign).toHaveBeenCalledTimes(1))
    expect(api.generateSocialAIDesign).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-x', contentVersion: 3, replaceApproved: false })
  })

  it('replaceApproved is sent only when replacing an already APPROVED design', async () => {
    api.generateSocialAIDesign.mockResolvedValue(startBody())
    renderPanel(post('design_approved', { media: MEDIA }, { designVersion: 2 }))
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    await waitFor(() => expect(api.generateSocialAIDesign).toHaveBeenCalled())
    expect(api.generateSocialAIDesign.mock.calls[0][1].replaceApproved).toBe(true)
  })

  it('shows the honest generating state (no percentages) and locks the button; a fast double-click sends ONE request', async () => {
    let resolve
    api.generateSocialAIDesign.mockReturnValue(new Promise((r) => { resolve = r }))
    renderPanel(post('content_approved'))
    const button = await screen.findByTestId('generate-design-button')
    fireEvent.click(button); fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(api.generateSocialAIDesign).toHaveBeenCalledTimes(1))
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Generating…')
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'generating', generation: GEN() }))
    await act(async () => { resolve(startBody()) })
    expect(await screen.findByTestId('design-generating')).toHaveTextContent('Drawing your design on the server')
    expect(screen.queryByText(/\d+\s?%/)).not.toBeInTheDocument()
    expect(api.generateSocialAIDesign).toHaveBeenCalledTimes(1)
  })

  it('a generation already running when the page opens is picked up (locked + generating) and polled only while the server says generating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'generating', generation: GEN() }))
    renderPanel(post('content_approved'))
    expect(await screen.findByTestId('design-generating')).toBeInTheDocument()
    expect(screen.getByTestId('generate-design-button')).toBeDisabled()
    const during = api.getSocialAIDesignStatus.mock.calls.length

    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'ready', generation: GEN({ status: 'ready', designVersion: 2 }), publication: {} }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    await waitFor(() => expect(screen.queryByTestId('design-generating')).not.toBeInTheDocument())
    expect(api.getSocialAIDesignStatus.mock.calls.length).toBeGreaterThan(during)
    const settled = api.getSocialAIDesignStatus.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
    expect(api.getSocialAIDesignStatus.mock.calls.length).toBe(settled)
  })

  it('does not poll at all when nothing is generating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderPanel(post('content_approved'))
    await screen.findByTestId('generate-design-button')
    const n = api.getSocialAIDesignStatus.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(api.getSocialAIDesignStatus.mock.calls.length).toBe(n)
  })

  it('when the generation finishes, the publishing lists + approval counts are refetched (the post moved in the workflow) - no page reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // a generation already running on the server: no click, so no click-time invalidation can satisfy this test
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'generating', generation: GEN() }))
    const { queryClient } = renderPanel(post('content_approved'))
    await screen.findByTestId('design-generating')
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    spy.mockClear()
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'ready', generation: GEN({ status: 'ready', designVersion: 2 }), publication: {} }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['social', 'publishing', 'proj-1'] }))
  })
})

describe('Design generate control - failures are the server\'s', () => {
  it('a failed generation shows the backend\'s safe message and "nothing was changed", and the button works again', async () => {
    api.generateSocialAIDesign.mockResolvedValue(startBody())
    renderPanel(post('content_approved'))
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'failed', generation: GEN({ status: 'failed', failure: { code: 'MEDIA_INVALID', message: 'The generated image did not meet the platform\'s requirements. Please try again.' } }) }))
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    expect(await screen.findByTestId('design-failed')).toHaveTextContent('did not meet the platform')
    expect(screen.getByTestId('design-failed')).toHaveTextContent('Nothing was changed')
    await waitFor(() => expect(screen.getByTestId('generate-design-button')).toBeEnabled())
  })

  it('a stale discard (the caption changed meanwhile) is reported as such', async () => {
    api.generateSocialAIDesign.mockResolvedValue(startBody())
    renderPanel(post('content_approved'))
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'failed', generation: GEN({ status: 'failed', failure: { code: 'DESIGN_STALE', message: 'The post changed while the design was being generated, so the new design was discarded. Generate it again from the latest version.' } }) }))
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    expect(await screen.findByTestId('design-failed')).toHaveTextContent('new design was discarded')
  })

  it.each([
    [409, 'VERSION_MISMATCH', 'The caption changed since you loaded it (you saw version 1, current is 2). Reload and try again.'],
    [409, 'CONTENT_NOT_APPROVED', 'Approve the post\'s content before generating its design.'],
    [409, 'PLATFORM_NOT_CONNECTED', 'Reconnect the Facebook Page before generating a design for this post.'],
    [429, 'RATE_LIMITED', 'Too many design generation requests. Please wait and try again.'],
    [503, 'AI_UNAVAILABLE', 'AI design generation is not available right now. Please try again later.'],
  ])('a refused start (%s %s) shows the server\'s own message and creates no result', async (status, code, message) => {
    api.generateSocialAIDesign.mockRejectedValue(apiError(message, { status, code }))
    renderPanel(post('content_approved'))
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    expect(await screen.findByTestId('design-start-error')).toHaveTextContent(message)
    expect(screen.queryByTestId('design-generating')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('generate-design-button')).toBeEnabled())
  })

  it('a failure from an EARLIER visit is not shown as if it just happened', async () => {
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'failed', generation: GEN({ id: 'old', status: 'failed', failure: { code: 'AI_BUSY', message: 'The AI service is busy right now.' } }) }))
    renderPanel(post('content_approved'))
    await screen.findByTestId('generate-design-button')
    await waitFor(() => expect(api.getSocialAIDesignStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('design-failed')).not.toBeInTheDocument()
  })
})

describe('Design panel - real media only', () => {
  it('shows the post\'s real media after generation (from the refetched publication), the design version and the Design review state', () => {
    renderPanel(post('design_review', { media: MEDIA }, { designVersion: 2 }))
    expect(screen.getByAltText('Post design')).toHaveAttribute('src', MEDIA[0].url)
    expect(screen.getByTestId('design-panel')).toHaveTextContent('Version 2')
    expect(screen.getByTestId('design-status')).toHaveTextContent('Waiting for approval')
  })

  it('a Facebook text post has no placeholder image and no empty box: one line, "Text post · no design needed", with an optional image', () => {
    renderPanel(post('content_approved'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('design-text-post')).toHaveTextContent('Text post · no design needed')
    expect(screen.getByTestId('design-panel')).not.toHaveTextContent('No image or video on this post')
    expect(screen.getByRole('button', { name: /Add image/ })).toBeInTheDocument()
  })

  it('there is no approve / schedule / publish control inside the generator', async () => {
    renderPanel(post('content_approved'))
    await screen.findByTestId('design-generate')
    const box = screen.getByTestId('design-generate')
    const buttons = Array.from(box.querySelectorAll('button'))
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toMatch(/Generate design/)
    expect(box.textContent).not.toMatch(/schedule post|publish now/i)
  })

  it('does not mention any AI vendor', async () => {
    renderPanel(post('content_approved'))
    await screen.findByTestId('design-generate')
    expect(document.body.textContent).not.toMatch(/openai|gpt|anthropic|claude|dall-?e/i)
  })
})

describe('Design generation keeps being followed when the panel is no longer on screen', () => {
  it('switching away (the panel unmounts) while generating still refetches the lists once the server finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.generateSocialAIDesign.mockResolvedValue(startBody())
    const { queryClient, unmount } = renderPanel(post('content_approved'))
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    fireEvent.click(await screen.findByTestId('generate-design-button'))
    await waitFor(() => expect(api.generateSocialAIDesign).toHaveBeenCalledTimes(1))
    unmount() // e.g. the user clicked another tab: the post is no longer in the selected tab
    spy.mockClear()
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'generating', generation: GEN() }))
    await act(async () => { await vi.advanceTimersByTimeAsync(7000) })
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['social', 'publishing', 'proj-1'] })
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'ready', generation: GEN({ status: 'ready', designVersion: 2 }), publication: {} }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['social', 'publishing', 'proj-1'] })
    // and it stops: no further status requests after it has finished
    const calls = api.getSocialAIDesignStatus.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(api.getSocialAIDesignStatus.mock.calls.length).toBe(calls)
  })

  it('one follower per post: starting twice does not multiply the polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { followDesignGeneration } = await import('@/hooks/useSocialMediaAI')
    const { createQueryClient } = await import('@/test-utils/socialMediaAI')
    const qc = createQueryClient()
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'generating', generation: GEN() }))
    followDesignGeneration(qc, 'proj-9', 'pub-9'); followDesignGeneration(qc, 'proj-9', 'pub-9'); followDesignGeneration(qc, 'proj-9', 'pub-9')
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    expect(api.getSocialAIDesignStatus).toHaveBeenCalledTimes(1)
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'failed', generation: GEN({ status: 'failed' }) }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
  })
})

describe('AI design provenance in the mapper', () => {
  const aiDesign = { source: 'ai', designVersion: 2, contentVersion: 1, generatedAt: '2026-10-09T10:00:00.000Z' }
  it('carries server-supplied AI design provenance through and is null for anything else (or a spoofed source)', () => {
    expect(post('design_review', { design: aiDesign }).design).toEqual(aiDesign)
    expect(post('design_review').design).toBeNull()
    expect(post('design_review', { design: null }).design).toBeNull()
    expect(post('design_review', { design: { source: 'human' } }).design).toBeNull()
  })
  it('canGenerateDesign is true only for a draft with approved content (any later design stage), never earlier or once scheduled', () => {
    expect(post('content_approved').canGenerateDesign).toBe(true)
    expect(post('design_review').canGenerateDesign).toBe(true)
    expect(post('design_approved').canGenerateDesign).toBe(true)
    expect(post('content_review').canGenerateDesign).toBe(false)
    expect(post('design_approved', { status: 'scheduled' }).canGenerateDesign).toBe(false)
  })
})

describe('Design generate control - the creative direction that was chosen', () => {
  const ready = (p, creative) => statusBody({ status: 'ready', generation: GEN({ status: 'ready', designVersion: p.approval.designVersion, creative }), publication: {} })

  it('names the creative direction of the CURRENT design and the real assets it used', async () => {
    const p = post('design_review', { media: MEDIA })
    api.getSocialAIDesignStatus.mockResolvedValue(ready(p, { type: 'product_showcase', label: 'Product showcase', logoApplied: true, referencePhotos: 1, notes: [] }))
    renderPanel(p)
    const box = await screen.findByTestId('design-creative')
    expect(box).toHaveTextContent('Creative direction: Product showcase')
    expect(box).toHaveTextContent('built on your product photo')
    expect(box).toHaveTextContent('your logo added')
  })

  it('says plainly when a real asset could not be used (no invented stand-in): a missing product photo, a logo that could not be placed', async () => {
    const p = post('design_review', { media: MEDIA })
    api.getSocialAIDesignStatus.mockResolvedValue(ready(p, { type: 'premium_editorial', label: 'Premium editorial', logoApplied: false, referencePhotos: 0, notes: ['product_photo_missing', 'logo_not_applied', 'no_supplied_figures', 'some_internal_code'] }))
    renderPanel(p)
    expect(await screen.findByTestId('design-note-product_photo_missing')).toHaveTextContent('this design does not show the product')
    expect(screen.getByTestId('design-note-logo_not_applied')).toHaveTextContent('could not be placed')
    expect(screen.getByTestId('design-note-no_supplied_figures')).toBeInTheDocument()
    expect(screen.queryByText(/some_internal_code/)).not.toBeInTheDocument()
    expect(screen.getByTestId('design-creative')).not.toHaveTextContent('your logo added')
  })

  it('is not shown for an older design (another design version), while generating, or when the server sent no creative', async () => {
    const p = post('design_review', { media: MEDIA })
    api.getSocialAIDesignStatus.mockResolvedValue(statusBody({ status: 'ready', generation: GEN({ status: 'ready', designVersion: p.approval.designVersion + 5, creative: { type: 'quote', label: 'Quote', notes: [] } }), publication: {} }))
    const { unmount } = renderPanel(p)
    await screen.findByTestId('generate-design-button')
    await waitFor(() => expect(api.getSocialAIDesignStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('design-creative')).not.toBeInTheDocument()
    unmount()
    api.getSocialAIDesignStatus.mockResolvedValue(ready(p, null))
    renderPanel(p)
    await screen.findByTestId('generate-design-button')
    expect(screen.queryByTestId('design-creative')).not.toBeInTheDocument()
  })

  it('the offer text describes a designed creative from the caption, plan and brand (not "drawing an image")', async () => {
    renderPanel(post('content_approved'))
    expect(await screen.findByTestId('design-generate')).toHaveTextContent('Odito designs a professional creative for this post from its approved caption, your content plan and your brand.')
  })
})

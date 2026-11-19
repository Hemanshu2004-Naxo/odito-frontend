import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, fireEvent, waitFor, within, render } from '@testing-library/react'
import { renderWithClient } from '@/test-utils/socialMediaAI'
import { studioState, okResponse } from '@/test-utils/socialStudio'

const api = vi.hoisted(() => ({
  getSocialStudio: vi.fn(), generateSocialStudioDesigns: vi.fn(), regenerateSocialStudioDesign: vi.fn(), selectSocialStudioDesign: vi.fn(),
  getDesignSlides: vi.fn(), regenerateDesignSlide: vi.fn(), reorderDesignSlides: vi.fn(), deleteDesignSlide: vi.fn(), getDesignJobs: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { CarouselPreview } from './CarouselPreview'
import { CarouselSlidesPanel } from './CarouselSlidesPanel'
import { DesignProgress } from './DesignProgress'
import { ConceptStudio } from '../studio/ConceptStudio'
import { StudioWorkspace } from '../studio/StudioWorkspace'
import { stepsFor, currentStepIndex, doneMessage, trackDesignJob, pendingDesignJobs, settleDesignJob } from '@/lib/socialMedia/designJobs'

const url = (k) => `https://media.example/${k}.jpg`
const KEYS = ['hook', 'p1', 'p2', 'p3', 'cta']
const media = KEYS.map((k) => ({ url: url(k), type: 'image' }))
const slide = (key, i, over = {}) => ({
  key, kind: key === 'hook' ? 'hook' : key === 'cta' ? 'cta' : 'point', position: i, status: 'ready', stage: null, url: url(key), inPost: true, headline: `Headline ${key}`, number: key.startsWith('p') ? Number(key.slice(1)) : null,
  qc: { score: 8, passed: true, retries: [], needsAttention: null }, ...over,
})
const slidesData = (over = {}) => ({
  designVersion: 3, approvalState: 'design_review', busy: false,
  generation: { id: 'g1', active: false, status: 'ready', phase: 'render', format: 'carousel', slides: KEYS.map((k, i) => slide(k, i, k === 'p2' ? { qc: { score: 6, passed: false, retries: ['picture'], needsAttention: { score: 6, failure: 'execution', reasons: ['the hands look wrong'] } } } : {})), ...over },
})

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); window.localStorage.clear() })

describe('CarouselPreview', () => {
  it('shows one slide at a time with arrows, dots, the count and the slide order; wraps around', () => {
    render(<CarouselPreview slides={media.map((m, i) => ({ key: KEYS[i], url: m.url, needsAttention: i === 2 }))} />)
    expect(screen.getByTestId('carousel-count')).toHaveTextContent('1 / 5')
    expect(within(screen.getByTestId('carousel-dots')).getAllByRole('button')).toHaveLength(5)
    expect(within(screen.getByTestId('carousel-order')).getAllByRole('button')).toHaveLength(5)
    fireEvent.click(screen.getByTestId('carousel-next'))
    expect(screen.getByTestId('carousel-count')).toHaveTextContent('2 / 5')
    fireEvent.click(screen.getByLabelText('Go to slide 3'))
    expect(screen.getByTestId('carousel-count')).toHaveTextContent('3 / 5')
    expect(screen.getByTestId('carousel-attention')).toHaveTextContent('Needs attention')
    fireEvent.click(screen.getByTestId('carousel-prev')); fireEvent.click(screen.getByTestId('carousel-prev')); fireEvent.click(screen.getByTestId('carousel-prev'))
    expect(screen.getByTestId('carousel-count')).toHaveTextContent('5 / 5')
  })
})

describe('CarouselSlidesPanel (Content Approvals + Studio)', () => {
  const renderPanel = (props = {}) => renderWithClient(<CarouselSlidesPanel projectId="proj-1" publicationId="pub-1" media={media} versions={{ contentVersion: 1, designVersion: 3 }} approvalState="design_review" {...props} />)

  it('marks a slide that needs attention, with the QC reason', async () => {
    api.getDesignSlides.mockResolvedValue(okResponse(slidesData()))
    renderPanel()
    await screen.findByTestId('slide-controls')
    fireEvent.click(screen.getByLabelText('Go to slide 3'))
    expect(screen.getByTestId('slide-needs-attention')).toHaveTextContent('QC 6/10')
    expect(screen.getByTestId('slide-needs-attention')).toHaveTextContent('the hands look wrong')
    fireEvent.click(screen.getByLabelText('Go to slide 1'))
    expect(screen.queryByTestId('slide-needs-attention')).toBeNull()
  })

  it('"Regenerate this slide" sends the slide and the versions it saw', async () => {
    api.getDesignSlides.mockResolvedValue(okResponse(slidesData()))
    api.regenerateDesignSlide.mockResolvedValue(okResponse({ started: true, generation: { ...slidesData().generation, active: true, phase: 'slide', slideKey: 'p2', stage: 'image' } }))
    renderPanel()
    await screen.findByTestId('slide-controls')
    fireEvent.click(screen.getByLabelText('Go to slide 3'))
    fireEvent.click(screen.getByTestId('slide-regenerate'))
    await waitFor(() => expect(api.regenerateDesignSlide).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', contentVersion: 1, designVersion: 3, slideKey: 'p2' }))
    expect(pendingDesignJobs('proj-1')).toHaveLength(1)
  })

  it('moves a slide (the whole new order is sent) and deletes one only after a confirmation; at 2 slides delete is disabled', async () => {
    api.getDesignSlides.mockResolvedValue(okResponse(slidesData()))
    api.reorderDesignSlides.mockResolvedValue(okResponse({ designVersion: 4 }))
    api.deleteDesignSlide.mockResolvedValue(okResponse({ designVersion: 4 }))
    renderPanel()
    await screen.findByTestId('slide-controls')
    fireEvent.click(screen.getByLabelText('Go to slide 2'))
    fireEvent.click(screen.getByTestId('slide-move-right'))
    await waitFor(() => expect(api.reorderDesignSlides).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', contentVersion: 1, designVersion: 3, order: ['hook', 'p2', 'p1', 'p3', 'cta'] }))
    fireEvent.click(screen.getByTestId('slide-delete'))
    expect(api.deleteDesignSlide).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete slide' }))
    await waitFor(() => expect(api.deleteDesignSlide).toHaveBeenCalled())
  })

  it('an APPROVED carousel asks first: any change sends it back to design review', async () => {
    api.getDesignSlides.mockResolvedValue(okResponse(slidesData({})))
    api.regenerateDesignSlide.mockResolvedValue(okResponse({ started: true }))
    renderPanel({ approvalState: 'design_approved' })
    await screen.findByTestId('slide-controls')
    fireEvent.click(screen.getByTestId('slide-regenerate'))
    expect(await screen.findByText(/goes back to design review and needs approval again/)).toBeInTheDocument()
    expect(api.regenerateDesignSlide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(api.regenerateDesignSlide).toHaveBeenCalled())
  })

  it('two slides: delete is disabled', async () => {
    const two = slidesData({ slides: [slide('hook', 0), slide('cta', 1)] })
    api.getDesignSlides.mockResolvedValue(okResponse(two))
    renderWithClient(<CarouselSlidesPanel projectId="proj-1" publicationId="pub-1" media={[{ url: url('hook'), type: 'image' }, { url: url('cta'), type: 'image' }]} versions={{ contentVersion: 1, designVersion: 3 }} approvalState="design_review" />)
    await screen.findByTestId('slide-controls')
    expect(screen.getByTestId('slide-delete')).toBeDisabled()
  })
})

describe('DesignProgress and the job helpers', () => {
  it('shows the carousel stages from the server (Writing concept -> Hook image -> Slides -> Quality check) and a chip per slide', () => {
    const generation = { active: true, status: 'generating', phase: 'render', format: 'carousel', stage: 'slides', slides: [slide('hook', 0), { ...slide('p1', 1), status: 'generating', stage: 'image' }, { ...slide('p2', 2), status: 'pending' }] }
    render(<DesignProgress generation={generation} />)
    expect(screen.getByTestId('design-step-concept')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('design-step-hook')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('design-step-slides')).toHaveAttribute('data-state', 'current')
    expect(screen.getByTestId('design-step-quality')).toHaveAttribute('data-state', 'pending')
    expect(screen.getByTestId('slide-chip-p1')).toHaveAttribute('data-status', 'generating')
    expect(screen.getByText(/You can leave this page/)).toBeInTheDocument()
  })

  it('names the steps per job, and words the "done" message', () => {
    expect(stepsFor({ phase: 'compare' }).map((s) => s.label)).toEqual(['Writing concepts', 'Preview images'])
    expect(stepsFor({ phase: 'render', format: 'single' }).map((s) => s.key)).toEqual(['concept', 'image', 'quality'])
    expect(currentStepIndex({ active: false, status: 'ready', phase: 'render', format: 'carousel' })).toBe(4)
    expect(doneMessage({ status: 'ready', phase: 'render', format: 'carousel', slides: 7, needsAttention: 0 }, 'Design').text).toMatch(/7-slide carousel is ready/)
    expect(doneMessage({ status: 'ready', phase: 'render', format: 'carousel', slides: 7, needsAttention: 2 }, 'Design').text).toMatch(/2 slides need attention/)
    trackDesignJob({ projectId: 'p', publicationId: 'a', label: 'X' })
    expect(pendingDesignJobs('p')).toHaveLength(1)
    settleDesignJob('p', 'a')
    expect(pendingDesignJobs('p')).toHaveLength(0)
  })
})

describe('Concept Studio', () => {
  const conceptState = (over = {}) => studioState({
    pipeline: 'concept',
    formats: { single: { allowed: true }, carousel: { allowed: true, points: 5, reason: null } },
    costs: { currency: 'USD', post: { usd: 1.2147, generations: 2, calls: 31 }, month: { key: '2026-11', usd: 4.5, generations: 9, calls: 120 } },
    generation: null, ...over,
  })
  const candidate = (i, over = {}) => ({ id: `c${i}`, slot: i, status: 'ready', label: ['Photo · full bleed bottom', '3D render · editorial cover', 'Photo · split image text'][i], concept: { headline: `Headline ${i}`, bigIdea: `Idea ${i}`, visualStyle: 'photo', layout: 'full_bleed_bottom' }, preview: { url: url(`prev${i}`), quality: 'low' }, picked: false, costUsd: 0.02, ...over })
  const compared = (over = {}) => ({ id: 'g1', pipeline: 'concept', status: 'ready', active: false, phase: 'compare', format: 'carousel', stage: null, candidates: [0, 1, 2].map((i) => candidate(i)), slides: [], costUsd: 0.12, needsAttention: 0, ...over })

  it('the studio switches to Concept Studio for a concept post: format, compare, costs', async () => {
    api.getSocialStudio.mockResolvedValue(okResponse(conceptState({ generation: compared() })))
    renderWithClient(<StudioWorkspace projectId="proj-1" publicationId="pub-1" />)
    expect(await screen.findByTestId('concept-studio')).toBeInTheDocument()
    expect(screen.getAllByTestId('concept-card')).toHaveLength(3)
    expect(screen.getAllByText('Preview · low quality')).toHaveLength(3)
    expect(screen.getByTestId('cost-post')).toHaveTextContent('$1.21')
    expect(screen.getByTestId('cost-month')).toHaveTextContent('$4.50')
  })

  it('choosing the carousel format and creating concepts sends the format; picking a concept renders it (and is tracked for the done notification)', async () => {
    const studio = conceptState({ generation: compared() })
    api.generateSocialStudioDesigns.mockResolvedValue(okResponse({ status: 'generating', generation: { ...compared(), active: true, status: 'generating', stage: 'concept', candidates: [] } }))
    api.selectSocialStudioDesign.mockResolvedValue(okResponse({ status: 'generating', rendering: true, generation: { ...compared(), active: true, phase: 'render', stage: 'concept' } }))
    renderWithClient(<ConceptStudio projectId="proj-1" publicationId="pub-1" studio={studio} />)
    fireEvent.click(screen.getByTestId('format-carousel'))
    fireEvent.click(screen.getByTestId('create-concepts'))
    await waitFor(() => expect(api.generateSocialStudioDesigns).toHaveBeenCalledWith('proj-1', { publicationId: 'pub-1', contentVersion: 1, format: 'carousel' }))
    fireEvent.click(screen.getAllByTestId('use-concept')[1])
    await waitFor(() => expect(api.selectSocialStudioDesign).toHaveBeenCalledWith('proj-1', expect.objectContaining({ publicationId: 'pub-1', generationId: 'g1', candidateId: 'c1', contentVersion: 1, designVersion: 1, format: 'carousel' })))
    expect(pendingDesignJobs('proj-1')).toHaveLength(1)
  })

  it('a caption Odito will split into points: the carousel option is enabled and says so', () => {
    renderWithClient(<ConceptStudio projectId="proj-1" publicationId="pub-1" studio={conceptState({ formats: { single: { allowed: true }, carousel: { allowed: true, points: null, source: 'outline', reason: null } } })} />)
    expect(screen.getByTestId('format-carousel')).not.toBeDisabled()
    expect(screen.getByTestId('format-carousel')).toHaveTextContent('3 to 6 slides with the main points of your caption')
  })

  it('a caption too short for a carousel: the option says why and is disabled', () => {
    renderWithClient(<ConceptStudio projectId="proj-1" publicationId="pub-1" studio={conceptState({ formats: { single: { allowed: true }, carousel: { allowed: false, points: 0, reason: 'This caption is too short to split into carousel slides.' } } })} />)
    expect(screen.getByTestId('format-carousel')).toBeDisabled()
    expect(screen.getByTestId('format-carousel')).toHaveTextContent('too short to split')
  })

  it('while the carousel is being made, the live progress shows the stages and the slides', () => {
    const generation = { ...compared(), active: true, status: 'generating', phase: 'render', stage: 'hook', slides: KEYS.map((k, i) => ({ ...slide(k, i), status: i === 0 ? 'generating' : 'pending', stage: i === 0 ? 'image' : null })) }
    renderWithClient(<ConceptStudio projectId="proj-1" publicationId="pub-1" studio={conceptState({ generation })} />)
    expect(screen.getByTestId('design-step-hook')).toHaveAttribute('data-state', 'current')
    expect(screen.getAllByTestId(/^slide-chip-/)).toHaveLength(5)
  })
})

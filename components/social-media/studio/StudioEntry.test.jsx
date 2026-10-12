import React from 'react'
import fs from 'fs'
import path from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import {
  renderWithClient, managedPublication, installPublicationsApi, contentStatusResponse, contentStartResponse, contentGenerationDoc, apiError,
} from '@/test-utils/socialMediaAI'
import { studioState, okResponse } from '@/test-utils/socialStudio'

const api = vi.hoisted(() => ({
  getSocialStudio: vi.fn(), generateSocialStudioDesigns: vi.fn(), regenerateSocialStudioDesign: vi.fn(), selectSocialStudioDesign: vi.fn(),
  getSocialPublications: vi.fn(), getSocialContentCalendar: vi.fn(), getSocialContentCalendarStatus: vi.fn(),
  getSocialAIContentStatus: vi.fn(), generateSocialCalendarItemContent: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())
const search = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }))
vi.mock('@/contexts/ProjectContext', () => ({ useProject: () => ({ activeProjectId: search.project === undefined ? 'proj-1' : search.project }) }))

import { StudioEntry } from './StudioEntry'
import CreativeStudioPage from '@/app/app/social-media/creative-studio/page'

const calendar = (items) => okResponse({ status: 'ready', calendar: { version: 1, strategy: { version: 1 } }, items })
const item = (over = {}) => ({ id: 'item-1', status: 'plan_approved', platforms: ['facebook'], publications: [], topic: 'Brushing basics', revision: 3, ...over })
const linked = (platform, id) => ({ id, platform, status: 'draft', approvalState: 'content_approved', content: 'x' })

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  search.params = new URLSearchParams()
  search.project = undefined
  api.getSocialStudio.mockResolvedValue(okResponse(studioState()))
  api.getSocialAIContentStatus.mockResolvedValue(contentStatusResponse())
  installPublicationsApi(api, [])
})

describe('Creative Studio entry - which post opens', () => {
  it('?publicationId= opens THAT post through the studio endpoint', async () => {
    renderWithClient(<StudioEntry projectId="proj-1" publicationId="pub-7" />)
    expect(await screen.findByTestId('studio-caption')).toBeInTheDocument()
    expect(api.getSocialStudio).toHaveBeenCalledWith('proj-1', 'pub-7')
  })

  it('with nothing to open and no posts: "Content has not been generated yet." and a way to generate content', async () => {
    renderWithClient(<StudioEntry projectId="proj-1" />)
    expect(await screen.findByText('Content has not been generated yet.')).toBeInTheDocument()
    expect(screen.getByTestId('generate-content-link')).toHaveTextContent('Generate Content')
    expect(screen.getByTestId('generate-content-link')).toHaveAttribute('href', '/app/social-media/content-calendar')
    expect(api.getSocialStudio).not.toHaveBeenCalled()
  })

  it('with no params and real posts: a picker of the project\'s own posts, each opening its studio', async () => {
    installPublicationsApi(api, [
      managedPublication('content_approved', { id: 'pub-a', content: 'First real caption' }),
      managedPublication('content_review', { id: 'pub-b', content: 'Second real caption' }),
      managedPublication('design_review', { id: 'pub-c', status: 'scheduled', content: 'Scheduled, not a draft' }),
    ])
    renderWithClient(<StudioEntry projectId="proj-1" />)
    expect(await screen.findByTestId('studio-pick-pub-a')).toHaveAttribute('href', '/app/social-media/creative-studio?publicationId=pub-a')
    expect(screen.getByTestId('studio-pick-pub-a')).toHaveTextContent('First real caption')
    expect(screen.getByTestId('studio-pick-pub-b')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-pick-pub-c')).not.toBeInTheDocument()
  })

  it('a calendar item with ONE linked post opens that post (the one for the requested platform)', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item({ platforms: ['facebook', 'instagram'], publications: [linked('facebook', 'pub-fb'), linked('instagram', 'pub-ig')] })]))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" platform="instagram" />)
    expect(await screen.findByTestId('studio-caption')).toBeInTheDocument()
    expect(api.getSocialStudio).toHaveBeenCalledWith('proj-1', 'pub-ig')
    expect(api.getSocialStudio).not.toHaveBeenCalledWith('proj-1', 'pub-fb')
  })

  it('a calendar item with posts for several platforms and no platform given lets the user choose', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item({ platforms: ['facebook', 'instagram'], publications: [linked('facebook', 'pub-fb'), linked('instagram', 'pub-ig')] })]))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" />)
    expect(await screen.findByTestId('studio-choose-platform')).toBeInTheDocument()
    expect(screen.getByText('Facebook').closest('a')).toHaveAttribute('href', '/app/social-media/creative-studio?publicationId=pub-fb')
    expect(screen.getByText('Instagram').closest('a')).toHaveAttribute('href', '/app/social-media/creative-studio?publicationId=pub-ig')
    expect(api.getSocialStudio).not.toHaveBeenCalled()
  })

  it('a calendar item with no content yet: "Content has not been generated yet." + Generate Content (the plan has no caption, so the AI writes it), through the existing calendar endpoint', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item()]))
    api.generateSocialCalendarItemContent.mockResolvedValue(contentStartResponse({ generation: contentGenerationDoc({ calendarItemId: 'item-1' }) }))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" platform="facebook" />)
    expect(await screen.findByText('Content has not been generated yet.')).toBeInTheDocument()
    expect(screen.getByTestId('generate-content-button')).toHaveTextContent('Generate Content')
    expect(screen.getByText(/has no caption yet, so Odito will write the post/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('generate-content-button'))
    await waitFor(() => expect(api.generateSocialCalendarItemContent).toHaveBeenCalledWith('proj-1', 'item-1', 'facebook', { mode: undefined, expectedRevision: 3 }))
    expect(api.getSocialStudio).not.toHaveBeenCalled()
  })

  it('a plan item WITH a reviewed caption says the post is created from it, exactly as written, and sends no mode (the server uses the caption)', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item({ caption: 'The reviewed caption.' })]))
    api.generateSocialCalendarItemContent.mockResolvedValue({ success: true, data: { mode: 'plan', status: 'draft_created', item: item({ caption: 'The reviewed caption.' }), publication: { id: 'pub-1' } } })
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" platform="facebook" />)
    expect(await screen.findByText(/exactly as it is/)).toBeInTheDocument()
    expect(screen.getByTestId('generate-content-button')).toHaveTextContent('Create post from plan')
    fireEvent.click(screen.getByTestId('generate-content-button'))
    await waitFor(() => expect(api.generateSocialCalendarItemContent).toHaveBeenCalledWith('proj-1', 'item-1', 'facebook', { mode: undefined, expectedRevision: 3 }))
  })

  it('an item whose plan is not approved cannot generate from here: it points to the Content Calendar', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item({ status: 'planned' })]))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" />)
    expect(await screen.findByText('Content has not been generated yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('generate-content-button')).not.toBeInTheDocument()
    expect(screen.getByText('Open Content Calendar').closest('a')).toHaveAttribute('href', '/app/social-media/content-calendar')
  })

  it('shows the server reason when content generation is refused', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item()]))
    api.generateSocialCalendarItemContent.mockRejectedValue(apiError('Approve the plan first.', { status: 409 }))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="item-1" />)
    fireEvent.click(await screen.findByTestId('generate-content-button'))
    expect(await screen.findByTestId('generate-content-error')).toHaveTextContent('Approve the plan first.')
  })

  it('an unknown calendar item is reported, not replaced by anything else', async () => {
    api.getSocialContentCalendar.mockResolvedValue(calendar([item()]))
    renderWithClient(<StudioEntry projectId="proj-1" itemId="nope" />)
    expect(await screen.findByText('That calendar item was not found.')).toBeInTheDocument()
  })
})

describe('Creative Studio page', () => {
  it('reads ?publicationId= from the URL and opens it', async () => {
    search.params = new URLSearchParams('publicationId=pub-9')
    renderWithClient(<CreativeStudioPage />)
    expect(screen.getByRole('heading', { name: 'Creative Studio' })).toBeInTheDocument()
    expect(await screen.findByTestId('studio-caption')).toBeInTheDocument()
    expect(api.getSocialStudio).toHaveBeenCalledWith('proj-1', 'pub-9')
  })

  it('with no active project it asks for one and calls nothing', () => {
    search.project = null
    renderWithClient(<CreativeStudioPage />)
    expect(screen.getByTestId('no-project')).toBeInTheDocument()
    expect(api.getSocialStudio).not.toHaveBeenCalled()
    expect(api.getSocialPublications).not.toHaveBeenCalled()
  })
})

describe('Creative Studio has no static or mock data left', () => {
  const root = path.resolve(__dirname, '../../..')
  const files = [
    ...fs.readdirSync(path.join(root, 'components/social-media/studio')).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(root, 'components/social-media/studio', f)),
    path.join(root, 'app/app/social-media/creative-studio/page.jsx'),
    path.join(root, 'lib/socialMedia/studio.js'),
  ]

  it('no studio source imports the dummy-data module or the static image registry', () => {
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/socialMediaAIDummyData|socialMediaImages|SOCIAL_MEDIA_IMAGES|getSocialImage/)
      expect(text, file).not.toMatch(/CREATIVE_(APPROVED_CONTENT|DESIGNS|DESIGN_VARIANTS|BRAND_SETTINGS|WORKFLOW_STEPS)/)
      expect(text, file).not.toMatch(/Math\.random|setTimeout\(/)
    }
  })

  it('the mock components, mock data and mock design images are gone', () => {
    for (const gone of ['ApprovedContentBanner', 'DesignGrid', 'DesignCard', 'RegenerateControls', 'AIChangePanel', 'BrandSettingsPanel', 'WorkflowStepper', 'CreativeStudioActions', 'BrandColorPicker', 'BrandFontSelect', 'FormatSelect']) {
      expect(fs.existsSync(path.join(root, `components/social-media/${gone}.jsx`)), gone).toBe(false)
    }
    const dummy = fs.readFileSync(path.join(root, 'lib/socialMediaAIDummyData.js'), 'utf8')
    expect(dummy).not.toMatch(/CREATIVE_|creative-design/)
    expect(fs.readFileSync(path.join(root, 'lib/socialMediaImages.js'), 'utf8')).not.toMatch(/creative-design|approval-post-01/)
    expect(fs.existsSync(path.join(root, 'public/social-media/designs'))).toBe(false)
  })
})

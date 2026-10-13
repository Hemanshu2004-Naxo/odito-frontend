import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import { renderWithClient, strategyResponse, strategyDoc, generationDoc, planningDoc, planPreviewResponse, apiError } from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({ previewSocialAIStrategyPlan: vi.fn(), getSocialContentCalendar: vi.fn(), getSocialAIStrategy: vi.fn(), getSocialAIStrategyStatus: vi.fn(), generateSocialAIStrategy: vi.fn(), getSocialAIContentStatus: vi.fn(), generateSocialAIContent: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: project ? [project] : [], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import AIStrategyPage from './page'

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
  api.getSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'none', calendar: null } })
  api.previewSocialAIStrategyPlan.mockResolvedValue(planPreviewResponse())
  project = { _id: 'proj-1', project_name: 'Acme' }
})
afterEach(() => { vi.useRealTimers() })

const renderPage = () => renderWithClient(<AIStrategyPage />)
const ready = (opts = {}) => strategyResponse({ status: 'ready', strategy: strategyDoc(opts.doc), profile: opts.profile })

/** Walks the wizard: platforms -> frequency -> duration -> review, then (optionally) confirms. */
async function runWizard({ frequency, months, confirm = true } = {}) {
  const wizard = await screen.findByTestId('strategy-wizard')
  fireEvent.click(within(wizard).getByTestId('wizard-next'))
  if (frequency) fireEvent.click(within(wizard).getByTestId(`wizard-frequency-${frequency}`).querySelector('input'))
  fireEvent.click(within(wizard).getByTestId('wizard-next'))
  if (months) fireEvent.click(within(wizard).getByTestId(`wizard-months-${months}`).querySelector('input'))
  fireEvent.click(within(wizard).getByTestId('wizard-next'))
  await within(wizard).findByTestId('wizard-review')
  if (confirm) {
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
  }
  return wizard
}
const openDetails = (id) => { fireEvent.click(screen.getByTestId(`details-toggle-${id}`)) }

describe('AI Strategy — loading real strategy state', () => {
  it('LOADING: skeletons, then content', async () => {
    api.getSocialAIStrategy.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId('strategy-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('strategy-summary')).not.toBeInTheDocument()
  })

  it('NO PROJECT: asks for a project and requests nothing', () => {
    project = null
    renderPage()
    expect(screen.getByTestId('no-project')).toBeInTheDocument()
    expect(api.getSocialAIStrategy).not.toHaveBeenCalled()
  })

  it('ERROR: shows the failure with a retry — never sample strategy data as a fallback', async () => {
    api.getSocialAIStrategy.mockRejectedValueOnce(apiError('Failed to load the AI strategy', { status: 500 }))
    renderPage()
    expect(await screen.findByTestId('strategy-error')).toHaveTextContent('Failed to load the AI strategy')
    expect(screen.queryByTestId('strategy-summary')).not.toBeInTheDocument()
    expect(screen.queryByText(/Educate|Build trust|Convert|12 posts/)).not.toBeInTheDocument()
    api.getSocialAIStrategy.mockResolvedValue(ready())
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('strategy-summary')).toBeInTheDocument()
  })

  it('EMPTY: no strategy yet — an honest empty state, a Generate button and the live profile gaps', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none', profile: { gaps: [{ field: 'audience', importance: 'high', reason: 'No primary audience has been defined.', source: 'profile' }] } }))
    renderPage()
    expect(await screen.findByTestId('strategy-empty')).toHaveTextContent("You don't have an AI strategy yet")
    expect(api.getSocialAIStrategy).toHaveBeenCalledWith('proj-1')
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('No strategy yet')
    expect(screen.getByTestId('generate-button')).toHaveTextContent('Create AI Strategy')
    expect(screen.getByTestId('generate-button')).toBeEnabled()
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('strategy-gaps')).getByTestId('gap-audience')).toHaveTextContent('No primary audience has been defined.')
    expect(screen.queryByTestId('strategy-summary')).not.toBeInTheDocument()
  })

  it('a profile too thin to generate from: the button is disabled and the server\'s reason is shown', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none', profile: { canGenerate: false, blockers: [{ field: 'description', reason: 'Add a business description or category in the Business profile.' }] } }))
    renderPage()
    expect(await screen.findByTestId('strategy-blocked')).toHaveTextContent('Add a business description or category')
    expect(screen.getByTestId('generate-button')).toBeDisabled()
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('No strategy yet')
  })
})

describe('AI Strategy — a ready strategy', () => {
  it('renders every real section from the stored strategy', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    expect(await screen.findByTestId('strategy-summary')).toHaveTextContent('Build local trust with practical dental education')
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('Strategy v1 ready')
    expect(screen.getByTestId('strategy-ready-title')).toHaveTextContent('Your AI strategy is ready.')
    openDetails('voice')
    expect(screen.getByTestId('section-positioning')).toHaveTextContent('A friendly neighbourhood dental practice.')
    expect(screen.getByTestId('section-audience')).toHaveTextContent('Young families nearby')
    expect(screen.getByTestId('section-goals')).toHaveTextContent('More bookings')
    expect(screen.getAllByTestId('pillar-card').map((c) => c.textContent)).toEqual([expect.stringContaining('Dental tips'), expect.stringContaining('Meet the team')])
    openDetails('content')
    expect(screen.getByTestId('mix-educational')).toHaveTextContent('50%')
    expect(screen.getByTestId('mix-behind_the_scenes')).toHaveTextContent('Behind the scenes')
    openDetails('platforms')
    expect(within(screen.getByTestId('platform-facebook')).getByText('Connected')).toBeInTheDocument()
    expect(within(screen.getByTestId('platform-instagram')).getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByTestId('section-posting')).toHaveTextContent('4 posts per week')
    expect(screen.getByTestId('section-tone')).toHaveTextContent('Warm and professional')
    openDetails('hashtags')
    expect(screen.getByTestId('section-hashtags')).toHaveTextContent('A few local tags.')
    expect(screen.getByTestId('section-cta')).toHaveTextContent('Book a check-up')
    openDetails('rules')
    expect(screen.getByTestId('section-brand')).toHaveTextContent('cheapest')
    openDetails('more')
    expect(screen.getByTestId('section-recommendations')).toHaveTextContent('Post consistently for 8 weeks')
    expect(screen.queryByTestId('section-assumptions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-changed')).not.toBeInTheDocument()
  })

  it('shows the business profile the strategy was generated from (the stored snapshot), not the live one', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    await screen.findByTestId('strategy-summary')
    openDetails('basis')
    const ctx = await screen.findByTestId('strategy-context')
    expect(ctx).toHaveTextContent('Acme Dental')
    expect(ctx).toHaveTextContent('Pune, Maharashtra, India')
    expect(within(ctx).getByTestId('context-platforms')).toHaveTextContent('Facebook connected')
    expect(within(ctx).getByTestId('context-platforms')).toHaveTextContent('Instagram not connected')
  })

  it('missing audience / goals are stated plainly, never filled in', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ doc: { strategy: { audience: { primaryAudience: '', secondaryAudiences: [], painPoints: [], interests: [], motivations: [] }, goals: [] }, strategyGaps: [
      { field: 'audience', importance: 'high', reason: 'No primary audience has been defined.', source: 'profile' },
      { field: 'goals', importance: 'high', reason: 'No business goals have been defined.', source: 'profile' },
      { field: 'offers', importance: 'low', reason: 'No offers have been defined.', source: 'ai' },
    ] } }))
    renderPage()
    expect(await screen.findByTestId('audience-missing')).toHaveTextContent('No audience has been defined, so none is assumed')
    expect(screen.getByTestId('goals-missing')).toHaveTextContent('none are assumed')
    const gaps = screen.getByTestId('strategy-gaps')
    expect(within(gaps).getByTestId('gap-audience')).toHaveTextContent('High')
    expect(within(gaps).getByTestId('gap-offers')).toBeInTheDocument()
  })

  it('assumptions the AI reported are shown for the user to check', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ doc: { strategy: { assumptions: ['Assumed a small team posts 3-4 times a week.'] } } }))
    renderPage()
    await screen.findByTestId('strategy-summary')
    openDetails('more')
    expect(await screen.findByTestId('section-assumptions')).toHaveTextContent('Assumed a small team')
  })

  it('NO dummy strategy data anywhere (the old sample pillars, post types, settings and business snapshot are gone)', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    await screen.findByTestId('strategy-summary')
    const text = document.body.textContent
    for (const dummy of [/Sapphire/i, /Small business owners/, /Web design and digital marketing/, /Share useful knowledge, tips, insights/, /Show expertise, experience, processes and real customer stories/, /Present your services, offers and clear calls to action/, /12 posts \/ month/, /Sep 2026/, /roadmap/i, /Approve & create calendar/, /Adjust strategy/, /Analysis complete/, /Hard sell \d+%/]) {
      expect(text).not.toMatch(dummy)
    }
  })

  it('the strategy text is read-only: no inputs, sliders or edit fields on the page itself (the wizard is a separate dialog that is closed; the only controls are the post generator\'s three selects)', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    await screen.findByTestId('strategy-summary')
    const controls = Array.from(document.querySelectorAll('input, textarea, select, [role="slider"]'))
    expect(controls.filter((el) => !el.closest('[data-testid="single-post-generator"]'))).toHaveLength(0)
    expect(controls.every((el) => el.tagName === 'SELECT')).toBe(true)
    expect(controls).toHaveLength(3)
  })

  it('the post generator appears only for a READY strategy - not while generating, not with no strategy', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none' }))
    const first = renderPage()
    await screen.findByTestId('strategy-empty')
    expect(screen.queryByTestId('single-post-generator')).not.toBeInTheDocument()
    first.unmount()
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    expect(await screen.findByTestId('single-post-generator')).toBeInTheDocument()
  })
})

describe('AI Strategy — generating', () => {
  it('GENERATE starts a generation on the server and the page then shows the SERVER\'s generating state', async () => {
    api.getSocialAIStrategy.mockResolvedValueOnce(strategyResponse({ status: 'none' }))
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating', alreadyRunning: false, generation: generationDoc() } })
    renderPage()
    const button = await screen.findByTestId('generate-button')
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'generating', generation: generationDoc() }))
    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'generating', currentVersion: null, generation: generationDoc() } })
    fireEvent.click(button)
    await runWizard({ frequency: 5, months: 6 })
    await waitFor(() => expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1))
    const [pid, options] = api.generateSocialAIStrategy.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(options.planning).toEqual({ postsPerWeek: 5, months: 6, platforms: ['facebook'] })
    expect(options.expectedVersion).toBe(0)
    expect(options.requestId).toMatch(/^wiz_/)
    expect(Object.keys(options.planning)).not.toContain('estimatedPosts')
    expect(await screen.findByTestId('strategy-generating')).toHaveTextContent('Generating your strategy')
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('Generating your strategy')
    await waitFor(() => expect(screen.queryByTestId('strategy-wizard')).not.toBeInTheDocument())
  })

  it('NO fake progress: no percentage, progress bar or invented steps while generating', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'generating', generation: generationDoc() }))
    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'generating', generation: generationDoc() } })
    renderPage()
    const panel = await screen.findByTestId('strategy-generating')
    expect(panel.textContent).not.toMatch(/\d+\s*%/)
    expect(document.querySelectorAll('[role="progressbar"], progress')).toHaveLength(0)
  })

  it('a double click starts ONE generation (the button is disabled the moment it is pressed)', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none' }))
    api.generateSocialAIStrategy.mockReturnValue(new Promise(() => {}))
    renderPage()
    fireEvent.click(await screen.findByTestId('generate-button'))
    const wizard = await runWizard({ confirm: false })
    const confirmButton = within(wizard).getByTestId('wizard-generate')
    await waitFor(() => expect(confirmButton).toBeEnabled())
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)
    await waitFor(() => expect(confirmButton).toBeDisabled())
    expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1)
  })

  it('while the server says generating it POLLS the cheap status endpoint, and refetches the strategy when it becomes ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'generating', generation: generationDoc() }))
    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'generating', generation: generationDoc() } })
    renderPage()
    await screen.findByTestId('strategy-generating')
    await waitFor(() => expect(api.getSocialAIStrategyStatus).toHaveBeenCalled())
    const callsWhileGenerating = api.getSocialAIStrategy.mock.calls.length

    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'ready', currentVersion: 1, generation: null } })
    api.getSocialAIStrategy.mockResolvedValue(ready())
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(await screen.findByTestId('strategy-summary')).toBeInTheDocument()
    expect(api.getSocialAIStrategy.mock.calls.length).toBeGreaterThan(callsWhileGenerating)
    expect(screen.queryByTestId('strategy-generating')).not.toBeInTheDocument()
  })

  it('does not poll when nothing is generating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getSocialAIStrategy.mockResolvedValue(ready())
    renderPage()
    await screen.findByTestId('strategy-summary')
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(api.getSocialAIStrategyStatus).not.toHaveBeenCalled()
  })
})

describe('AI Strategy — failures and regeneration', () => {
  it('a refused start shows the server\'s message (e.g. AI not configured) and nothing else changes', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none' }))
    api.generateSocialAIStrategy.mockRejectedValue(apiError('AI strategy generation is not available right now. Please try again later.', { status: 503, code: 'AI_UNAVAILABLE' }))
    renderPage()
    fireEvent.click(await screen.findByTestId('generate-button'))
    const wizard = await runWizard({ frequency: 5, months: 6 })
    expect(await within(wizard).findByTestId('wizard-error')).toHaveTextContent('not available right now')
    // the selections are still there: nothing was lost, and the person can simply try again
    expect(within(wizard).getByTestId('review-frequency')).toHaveTextContent('5 posts per week')
    expect(within(wizard).getByTestId('review-months')).toHaveTextContent('6 months')
    expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled()
    expect(screen.getByTestId('strategy-empty')).toBeInTheDocument()
  })

  it('a FAILED generation shows the real, safe failure message — and no fake strategy', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'failed', generation: generationDoc({ status: 'failed', finishedAt: '2026-10-09T10:01:00.000Z', failure: { code: 'AI_TIMEOUT', message: 'The AI took too long to respond. Please try again.' } }) }))
    renderPage()
    expect(await screen.findByTestId('strategy-failed-message')).toHaveTextContent('The AI took too long to respond. Please try again.')
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('Generation failed')
    expect(screen.queryByTestId('strategy-summary')).not.toBeInTheDocument()
    expect(screen.getByTestId('strategy-empty')).toBeInTheDocument()
    expect(screen.getByTestId('generate-button')).toBeEnabled()
  })

  it('a FAILED generation keeps the person\'s choices and "Try again" re-opens the review with them (no new choices to make, nothing generated until confirmed)', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'failed', generation: generationDoc({ status: 'failed', planning: planningDoc({ postsPerWeek: 5, months: 6, platforms: ['facebook', 'instagram'] }), failure: { code: 'AI_BUSY', message: 'The AI service is busy right now. Please try again in a few minutes.' } }) }))
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating', generation: generationDoc({ version: 2 }) } })
    renderPage()
    expect(await screen.findByTestId('strategy-failed-choice')).toHaveTextContent('5 posts per week for 6 months')
    fireEvent.click(screen.getByTestId('retry-strategy'))
    const wizard = await screen.findByTestId('strategy-wizard')
    expect(await within(wizard).findByTestId('review-frequency')).toHaveTextContent('5 posts per week')
    expect(within(wizard).getByTestId('review-months')).toHaveTextContent('6 months')
    expect(within(wizard).getByTestId('review-platforms')).toHaveTextContent('Facebook + Instagram')
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
    await waitFor(() => expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1))
    expect(api.generateSocialAIStrategy.mock.calls[0][1].planning).toEqual({ postsPerWeek: 5, months: 6, platforms: ['facebook', 'instagram'] })
  })

  it('a failed REGENERATION keeps the last good strategy visible and says so', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'failed', strategy: strategyDoc(), generation: generationDoc({ version: 2, status: 'failed', failure: { code: 'AI_BUSY', message: 'The AI service is busy right now. Please try again in a few minutes.' } }) }))
    renderPage()
    expect(await screen.findByTestId('strategy-summary')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-failed')).toHaveTextContent('busy right now')
    expect(screen.getByTestId('strategy-failed')).toHaveTextContent('version 1) is shown below and is unchanged')
    expect(screen.getByTestId('regenerate-strategy')).toHaveTextContent('Regenerate strategy')
  })

  it('REGENERATE opens the review with the saved choices, calls generate only after confirmation, and the invalidation refetches the state', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ doc: { planning: planningDoc() } }))
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating', alreadyRunning: false, generation: generationDoc({ version: 2 }) } })
    renderPage()
    const button = await screen.findByTestId('regenerate-strategy')
    expect(button).toHaveTextContent('Regenerate strategy')
    const before = api.getSocialAIStrategy.mock.calls.length
    fireEvent.click(button)
    const wizard = await screen.findByTestId('strategy-wizard')
    await within(wizard).findByTestId('wizard-review')
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
    await waitFor(() => expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.getSocialAIStrategy.mock.calls.length).toBeGreaterThan(before))
  })
})

describe('AI Strategy — Business Profile changed', () => {
  it('shows the warning with what changed, keeps the strategy viewable, and does NOT regenerate on its own', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ profile: { changed: true, changes: ['goals', 'business.name'] } }))
    renderPage()
    const banner = await screen.findByTestId('profile-changed')
    expect(banner).toHaveTextContent('Your Business Profile has changed since this strategy was generated.')
    expect(screen.getByTestId('profile-changes')).toHaveTextContent('Goals, Business name')
    expect(within(banner).getByRole('link', { name: 'Review changes' })).toHaveAttribute('href', '/app/social-media/business-profile')
    expect(screen.getByTestId('strategy-summary')).toBeInTheDocument()
    expect(screen.getByTestId('strategy-status-title')).toHaveTextContent('may be out of date')
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
  })

  it('"Regenerate strategy" in the banner starts a generation', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ profile: { changed: true, changes: ['goals'] } }))
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating', generation: generationDoc({ version: 2 }) } })
    renderPage()
    const banner = await screen.findByTestId('profile-changed')
    fireEvent.click(within(banner).getByRole('button', { name: 'Regenerate strategy' }))
    const wizard = await screen.findByTestId('strategy-wizard')
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
    await runWizard({ confirm: false })
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
    await waitFor(() => expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1))
  })

  it('no warning when the profile is unchanged', async () => {
    api.getSocialAIStrategy.mockResolvedValue(ready({ profile: { changed: false, changes: [] } }))
    renderPage()
    await screen.findByTestId('strategy-summary')
    expect(screen.queryByTestId('profile-changed')).not.toBeInTheDocument()
  })
})

describe('AI Strategy — project scoping', () => {
  it('requests the active project\'s strategy and nothing from another; switching project refetches for its id', async () => {
    api.getSocialAIStrategy.mockImplementation(async (pid) => (pid === 'proj-1' ? ready({ doc: { strategy: { summary: 'Project one strategy.' } } }) : strategyResponse({ status: 'none' })))
    const first = renderPage()
    expect(await screen.findByTestId('strategy-summary')).toHaveTextContent('Project one strategy.')
    first.unmount()
    project = { _id: 'proj-2', project_name: 'Other' }
    renderPage()
    expect(await screen.findByTestId('strategy-empty')).toBeInTheDocument()
    expect(screen.queryByText('Project one strategy.')).not.toBeInTheDocument()
    expect(api.getSocialAIStrategy.mock.calls.map((c) => c[0])).toEqual(['proj-1', 'proj-2'])
  })
})

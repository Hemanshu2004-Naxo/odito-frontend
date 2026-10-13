import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithClient, strategyResponse, strategyDoc, planningDoc, planPreviewResponse } from '@/test-utils/socialMediaAI'
import { strategyBodyV2, calendarState } from '@/test-utils/socialMediaPlan'

const api = vi.hoisted(() => ({
  previewSocialAIStrategyPlan: vi.fn(), getSocialContentCalendar: vi.fn(), getSocialAIStrategy: vi.fn(), getSocialAIStrategyStatus: vi.fn(),
  generateSocialAIStrategy: vi.fn(), getSocialAIContentStatus: vi.fn(), generateSocialAIContent: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: { _id: 'proj-1', project_name: 'Acme' }, activeProjectId: 'proj-1', projects: [], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import AIStrategyPage from './page'

/**
 * The simplified strategy page: a short overview, the few things a business owner needs, and everything else behind explicit buttons - with
 * no stored field lost, a strategy saved before the wizard still readable, and the edit / calendar handoffs wired to the saved choice.
 */

const OUTLOOK = {
  seasonalThemes: [{ theme: 'Back-to-school check-ups', timing: 'Month 1', idea: 'Remind families to book before term gets busy.' }],
  campaignIdeas: [{ name: 'Smile check week', idea: 'A week of short tips ending with a booking invitation.' }],
  successMetrics: [{ metric: 'Booking enquiries', whatGoodLooks: 'More messages asking to book after educational posts.' }],
}
const v3 = (over = {}) => strategyBodyV2({ schemaVersion: 3, planOutlook: OUTLOOK, ...over })
const load = (doc = {}, extra = {}) => api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'ready', strategy: strategyDoc({ planning: planningDoc(), ...doc, strategy: doc.strategy || v3() }), ...extra }))
const render = () => renderWithClient(<AIStrategyPage />)

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
  api.getSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'none', calendar: null } })
  api.previewSocialAIStrategyPlan.mockResolvedValue(planPreviewResponse())
})

describe('Strategy overview', () => {
  it('shows the strategy name, platforms, posts per week, planning period, planned posts and status - and the three actions', async () => {
    load()
    render()
    expect(await screen.findByTestId('strategy-ready-title')).toHaveTextContent('Your AI strategy is ready.')
    expect(screen.getByTestId('strategy-name')).toHaveTextContent('Acme Dental social strategy · version 1')
    const stats = screen.getByTestId('strategy-stats')
    expect(within(stats).getByTestId('stat-platforms')).toHaveTextContent('Facebook')
    expect(within(stats).getByTestId('stat-frequency')).toHaveTextContent('3')
    expect(within(stats).getByTestId('stat-duration')).toHaveTextContent('3 months')
    expect(within(stats).getByTestId('stat-posts')).toHaveTextContent('about 39')
    expect(within(stats).getByTestId('stat-status')).toHaveTextContent('Ready')
    expect(screen.getByTestId('edit-strategy')).toHaveTextContent('Edit strategy')
    expect(screen.getByTestId('regenerate-strategy')).toHaveTextContent('Regenerate strategy')
    const cta = screen.getByTestId('create-calendar-cta')
    expect(cta).toHaveTextContent('Generate Content Calendar')
    expect(cta).toHaveAttribute('href', '/app/social-media/content-calendar')
    expect(screen.getByTestId('calendar-handoff-note')).toHaveTextContent('Your calendar starts from 3 posts per week for 3 months on Facebook. You only choose a start date')
  })

  it('does not put the detailed recommendations in the overview', async () => {
    load()
    render()
    const overview = await screen.findByTestId('strategy-overview')
    expect(overview.textContent.length).toBeLessThan(900)
    expect(overview).not.toHaveTextContent('Back-to-school')
    expect(overview).not.toHaveTextContent('Brushing basics')
  })

  it('a strategy saved BEFORE the wizard still reads: frequency and period say "Not set", nothing is invented, and the calendar button is still offered', async () => {
    load({ planning: null, strategy: strategyBodyV2() })
    render()
    const stats = await screen.findByTestId('strategy-stats')
    expect(within(stats).getByTestId('stat-frequency')).toHaveTextContent('Not set')
    expect(within(stats).getByTestId('stat-duration')).toHaveTextContent('Not set')
    expect(within(stats).getByTestId('stat-posts')).toHaveTextContent('—')
    expect(screen.getByTestId('no-planning-note')).toHaveTextContent('made before you could choose a posting frequency')
    expect(screen.getByTestId('create-calendar-cta')).toBeInTheDocument()
    expect(screen.getByTestId('metrics-missing')).toHaveTextContent('Regenerate it to add them')
  })

  it('a legacy v1 body (no overview, brand analysis, hooks or outlook at all) renders without errors', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'ready', strategy: strategyDoc() }))
    render()
    expect(await screen.findByTestId('strategy-summary')).toBeInTheDocument()
    expect(screen.getByTestId('section-pillars')).toBeInTheDocument()
    expect(screen.queryByTestId('details-outlook')).not.toBeInTheDocument()
    expect(screen.queryByTestId('details-competitors')).not.toBeInTheDocument()
  })

  it('when a calendar already exists for THIS strategy the primary action becomes "View content calendar", and says so', async () => {
    load()
    const mine = calendarState({ status: 'ready', items: [] })
    mine.calendar.strategy = { id: 'strat-1', version: 1 } // the id of the strategy loaded above
    api.getSocialContentCalendar.mockResolvedValue({ success: true, data: mine })
    render()
    await screen.findByTestId('strategy-overview')
    await waitFor(() => expect(screen.getByTestId('create-calendar-cta')).toHaveTextContent('View content calendar'))
    expect(screen.getByTestId('calendar-handoff-note')).toHaveTextContent('A content calendar already exists for this strategy')
  })

  it('a calendar made from a DIFFERENT (older) strategy does not claim to be this one\'s', async () => {
    load({ planning: planningDoc() })
    const other = calendarState({ status: 'ready', items: [] })
    other.calendar.strategy = { id: 'strat-OLD', version: 1 }
    api.getSocialContentCalendar.mockResolvedValue({ success: true, data: other })
    render()
    await screen.findByTestId('strategy-overview')
    const cta = screen.getByTestId('create-calendar-cta')
    expect(cta).toHaveTextContent('Generate Content Calendar')
    expect(cta).toHaveAttribute('href', '/app/social-media/content-calendar?plan=new')
    expect(screen.getByTestId('calendar-handoff-note')).toHaveTextContent('made from strategy version 1; this creates a new one and keeps the old one in history')
  })

  it('with no calendar at all the button goes to the calendar page as before (its form is already open)', async () => {
    load()
    render()
    await screen.findByTestId('strategy-overview')
    expect(screen.getByTestId('create-calendar-cta')).toHaveAttribute('href', '/app/social-media/content-calendar')
  })
})

describe('Strategy page — concise by default, complete on demand', () => {
  it('shows only the summary, goals, audience, content mix, posting plan and success measures first', async () => {
    load()
    render()
    await screen.findByTestId('strategy-highlights')
    for (const id of ['strategy-summary', 'section-goals', 'section-audience', 'section-pillars', 'section-posting', 'section-metrics']) expect(screen.getByTestId(id)).toBeInTheDocument()
    expect(screen.getByTestId('strategy-summary')).toHaveTextContent('Build local trust with practical dental education')
    expect(screen.getByTestId('section-metrics')).toHaveTextContent('Booking enquiries')
    expect(screen.getByTestId('section-posting')).toHaveTextContent('3 posts per week for 3 months')
    // none of the detail is in the page until asked for
    for (const id of ['section-hashtags', 'section-cta', 'section-tone', 'section-brand', 'section-hooks', 'section-trending', 'section-competitors', 'section-brand-analysis', 'section-platforms', 'section-mix', 'section-recommendations', 'section-outlook']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
  })

  it('each detail area has a one-line preview and an explicit "View details" button that reports its state', async () => {
    load()
    render()
    await screen.findByTestId('strategy-details')
    const toggle = screen.getByTestId('details-toggle-hashtags')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('View details')
    expect(screen.getByTestId('details-preview-hashtags')).toHaveTextContent('A few local tags.')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Hide')
    expect(screen.getByTestId('section-hashtags')).toHaveTextContent('A few local tags.')
    expect(screen.getByRole('region', { name: 'Hashtag guidance' })).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByTestId('section-hashtags')).not.toBeInTheDocument()
  })

  it('NOTHING stored is lost: with every detail area open, the extra fields of a full strategy are all reachable', async () => {
    load()
    render()
    await screen.findByTestId('strategy-details')
    // two passes: the areas first, then the "show details" inside each of them
    for (let pass = 0; pass < 2; pass += 1) for (const el of within(screen.getByTestId('strategy-details')).queryAllByRole('button', { expanded: false })) fireEvent.click(el)
    const text = screen.getByTestId('strategy-details').textContent
    for (const stored of [
      'Back-to-school check-ups', 'Smile check week', // outlook
      'Brushing basics', 'Carousel', // pillar topics and formats
      'Most people brush too hard. Here is the fix.', 'A calm checklist for a first visit', // hooks, trending
      'No competitor data provided', // competitor analysis
      'Clear family-dentistry focus', 'More educational authority content', 'Little proof content so far', // brand analysis (the weaknesses are two levels down)
      'Warm and professional', 'Reassuring', 'Plain language', 'Jargon', // tone
      'Community and offers', 'Local families look for trusted practices.', // platforms
      'A few local tags.', 'Book a check-up', 'Follow for more', // hashtags, CTA
      'cheapest', 'Explain, never scare', 'Bright, clean photography', // brand rules
      'Post consistently for 8 weeks', // recommendations
      'Acme Dental', // the stored business snapshot
    ]) expect(text, stored).toContain(stored)
    expect(screen.getByTestId('campaign-ideas')).toHaveTextContent('A week of short tips')
  })

  it('shows at most three goals and says how many more the strategy holds', async () => {
    load({ strategy: v3({ goals: ['a', 'b', 'c', 'd', 'e'].map((g, i) => ({ goal: `Goal ${g}`, priority: i === 0 ? 'high' : 'medium', rationale: `Because ${g}` })) }) })
    render()
    const goals = await screen.findByTestId('section-goals')
    expect(within(goals).getAllByRole('listitem')).toHaveLength(3)
    expect(goals).toHaveTextContent('2 more goals in the strategy.')
  })
})

describe('Content mix', () => {
  it('shows every pillar with its share and purpose, sorted largest first, with a text alternative for the bars', async () => {
    load()
    render()
    const mix = await screen.findByTestId('pillar-mix')
    const cards = within(mix).getAllByTestId('pillar-card')
    expect(cards.map((c) => c.textContent)).toEqual([expect.stringContaining('Dental tips'), expect.stringContaining('Meet the team')])
    expect(cards[0]).toHaveTextContent('60%')
    expect(cards[0]).toHaveTextContent('Build trust')
    expect(within(mix).getByTestId('pillar-mix-text')).toHaveTextContent('Share of your posts by topic: Dental tips: 60%, Meet the team: 40%.')
    expect(mix.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    expect(within(mix).queryByTestId('pillar-mix-warning')).not.toBeInTheDocument()
  })

  it('says so when stored shares do not add up to 100 (data from before the server balanced them)', async () => {
    load({ strategy: v3({ contentPillars: [{ name: 'A', description: 'd', purpose: 'p', suggestedPercentage: 50, exampleTopics: ['x'], formats: ['f'] }, { name: 'B', description: 'd', purpose: 'p', suggestedPercentage: 30, exampleTopics: ['x'], formats: ['f'] }] }) })
    render()
    expect(await screen.findByTestId('pillar-mix-warning')).toHaveTextContent('add up to 80%, not 100%')
  })
})

describe('Editing the strategy', () => {
  it('"Edit strategy" opens the wizard on the frequency step with the current values, and confirming creates the next version against the version that was seen', async () => {
    load({ planning: planningDoc({ postsPerWeek: 3, months: 3 }) })
    api.generateSocialAIStrategy.mockResolvedValue({ success: true, data: { status: 'generating', generation: { id: 'g2', version: 2, status: 'generating', startedAt: '2026-10-10T10:00:00.000Z', finishedAt: null, planning: null, failure: null } } })
    render()
    fireEvent.click(await screen.findByTestId('edit-strategy'))
    const wizard = await screen.findByTestId('strategy-wizard')
    expect(within(wizard).getByTestId('wizard-step-label')).toHaveTextContent('Step 2 of 4')
    expect(within(wizard).getByTestId('wizard-current')).toHaveTextContent('Currently: 3 posts per week for 3 months on Facebook.')
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
    fireEvent.click(within(within(wizard).getByTestId('wizard-frequency-5')).getByRole('radio'))
    fireEvent.click(within(wizard).getByTestId('wizard-next'))
    fireEvent.click(within(wizard).getByTestId('wizard-next'))
    expect(await within(wizard).findByTestId('review-version-note')).toHaveTextContent('creates strategy version 2')
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
    await waitFor(() => expect(api.generateSocialAIStrategy).toHaveBeenCalledTimes(1))
    const [pid, options] = api.generateSocialAIStrategy.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(options).toMatchObject({ planning: { postsPerWeek: 5, months: 3, platforms: ['facebook'] }, expectedVersion: 1 })
  })

  it('a stale decision (the strategy changed meanwhile) is refused by the server: the message is shown in the wizard and the choices stay', async () => {
    load()
    const conflict = Object.assign(new Error('The strategy changed since you opened this page. Reload to see the latest version, then try again.'), { status: 409, details: { code: 'STRATEGY_CONFLICT', currentVersion: 2 } })
    api.generateSocialAIStrategy.mockRejectedValue(conflict)
    render()
    fireEvent.click(await screen.findByTestId('regenerate-strategy'))
    const wizard = await screen.findByTestId('strategy-wizard')
    await within(wizard).findByTestId('wizard-review')
    await waitFor(() => expect(within(wizard).getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(within(wizard).getByTestId('wizard-generate'))
    expect(await within(wizard).findByTestId('wizard-error')).toHaveTextContent('The strategy changed since you opened this page')
    expect(within(wizard).getByTestId('review-frequency')).toHaveTextContent('3 posts per week')
  })

  it('the existing strategy and its overview stay on screen while the wizard is open and nothing is requested until confirmation', async () => {
    load()
    render()
    fireEvent.click(await screen.findByTestId('edit-strategy'))
    await screen.findByTestId('strategy-wizard')
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('strategy-wizard')).not.toBeInTheDocument())
    expect(screen.getByTestId('strategy-overview')).toBeInTheDocument()
    expect(api.generateSocialAIStrategy).not.toHaveBeenCalled()
  })

  it('while a new version is generating the actions are not offered twice', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'generating', strategy: strategyDoc({ planning: planningDoc(), strategy: v3() }), generation: { id: 'g2', version: 2, status: 'generating', startedAt: '2026-10-10T10:00:00.000Z', finishedAt: null, planning: null, failure: null } }))
    api.getSocialAIStrategyStatus.mockResolvedValue({ success: true, data: { status: 'generating', currentVersion: 1, generation: null } })
    render()
    expect(await screen.findByTestId('strategy-generating')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-strategy')).not.toBeInTheDocument()
    expect(screen.queryByTestId('regenerate-strategy')).not.toBeInTheDocument()
  })
})

describe('Strategy page — responsive and accessible structure', () => {
  it('uses a heading hierarchy (one h1, sectioned h2s) and labelled landmarks; the detail buttons are real buttons inside headings', async () => {
    load()
    render()
    await screen.findByTestId('strategy-details')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Strategy overview' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Detailed insights' })).toBeInTheDocument()
    for (const toggle of screen.getAllByTestId(/^details-toggle-/)) { expect(toggle.tagName).toBe('BUTTON'); expect(toggle.closest('h3')).not.toBeNull() }
  })

  it('stacks on small screens: grids are single-column by default and the stats wrap (no fixed widths)', async () => {
    load()
    render()
    const stats = await screen.findByTestId('strategy-stats')
    expect(stats.className).toMatch(/grid-cols-2/)
    expect(screen.getByTestId('strategy-actions').className).toMatch(/flex-wrap/)
    expect(screen.queryByTestId('strategy-wizard')).not.toBeInTheDocument()
  })
})

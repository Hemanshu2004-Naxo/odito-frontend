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

// "Detailed insights" is four tabs; each old detail area lives in one of them (Radix tabs activate on mouse down)
const DETAIL_TAB = { content: 'content', outlook: 'content', voice: 'voice', rules: 'voice', brand: 'voice', platforms: 'platforms', hashtags: 'platforms', basis: 'sources', more: 'sources', competitors: 'sources' }
const openTab = (group) => { const tab = screen.getByTestId(`details-tab-${group}`); fireEvent.mouseDown(tab); fireEvent.click(tab) }

describe('Strategy overview', () => {
  it('shows the strategy name, platforms, posts per week, planning period, planned posts and status - and the three actions', async () => {
    load()
    render()
    expect(await screen.findByTestId('strategy-ready-title')).toHaveTextContent('Your AI strategy is ready')
    expect(screen.getByTestId('strategy-name')).toHaveTextContent('Acme Dental social strategy · version 1 · generated')
    // "ready" is said once: no separate status badge, no status tile - four facts only
    expect(screen.queryByTestId('strategy-status')).not.toBeInTheDocument()
    const stats = screen.getByTestId('strategy-stats')
    expect(within(stats).getByTestId('stat-platforms')).toHaveTextContent('Facebook')
    expect(within(stats).getByTestId('stat-frequency')).toHaveTextContent('3')
    expect(within(stats).getByTestId('stat-duration')).toHaveTextContent('3 months')
    expect(within(stats).getByTestId('stat-posts')).toHaveTextContent('About 39')
    expect(within(stats).queryByTestId('stat-status')).not.toBeInTheDocument()
    expect(within(stats).getAllByRole('term')).toHaveLength(4)
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
    expect(screen.getByTestId('section-pillar-mix')).toBeInTheDocument()
    expect(screen.queryByTestId('section-outlook')).not.toBeInTheDocument()
    openTab('sources')
    expect(screen.queryByTestId('section-competitors')).not.toBeInTheDocument()
  })

  it('when a calendar already exists for THIS strategy the action becomes "View content calendar" and Planned posts shows its real count and dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-08T12:00:00') })
    load()
    const mine = calendarState({ status: 'ready', items: [] })
    mine.calendar.strategy = { id: 'strat-1', version: 1 } // the id of the strategy loaded above
    mine.calendar.plan = { ...mine.calendar.plan, totalItems: 13 }
    api.getSocialContentCalendar.mockResolvedValue({ success: true, data: mine })
    render()
    await screen.findByTestId('strategy-overview')
    await waitFor(() => expect(screen.getByTestId('create-calendar-cta')).toHaveTextContent('View content calendar'))
    const posts = screen.getByTestId('stat-posts')
    expect(posts).toHaveTextContent('13 posts')
    expect(posts).toHaveTextContent('Tue 6 Oct – Mon 12 Oct 2026')
    expect(posts).not.toHaveTextContent('About')
    expect(screen.queryByTestId('calendar-handoff-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('plan-ended')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('a plan made from this strategy that has ended says so on the strategy page too, with "Plan next month"', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-16T12:00:00') })
    load()
    const mine = calendarState({ status: 'ready', items: [] })
    mine.calendar.strategy = { id: 'strat-1', version: 1 }
    api.getSocialContentCalendar.mockResolvedValue({ success: true, data: mine })
    render()
    const ended = await screen.findByTestId('plan-ended')
    expect(ended).toHaveTextContent('This plan ended on Mon 12 Oct 2026')
    expect(within(ended).getByRole('link', { name: 'Plan next month' })).toHaveAttribute('href', '/app/social-media/content-calendar?plan=next')
    expect(screen.getByTestId('stat-posts')).toHaveTextContent('ended')
    vi.useRealTimers()
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
    for (const id of ['strategy-summary', 'section-goals', 'section-audience', 'section-pillar-mix', 'section-posting', 'section-metrics']) expect(screen.getByTestId(id)).toBeInTheDocument()
    expect(screen.getByTestId('strategy-summary')).toHaveTextContent('Build local trust with practical dental education')
    expect(screen.getByTestId('section-metrics')).toHaveTextContent('Booking enquiries')
    expect(screen.getByTestId('section-posting')).toHaveTextContent('3 posts per week for 3 months')
    // the detail of the other tabs is not in the page until its tab is chosen (the Content tab is the open one)
    for (const id of ['section-hashtags', 'section-cta', 'section-tone', 'section-brand', 'section-competitors', 'section-brand-analysis', 'section-platforms', 'section-recommendations']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
  })

  it('the detail is four groups (tabs), not ten identical rows: choosing one shows its sections and reports its state', async () => {
    load()
    render()
    await screen.findByTestId('strategy-details')
    const tabs = within(screen.getByRole('tablist', { name: 'Detailed insights' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Content & campaigns', 'Brand voice & rules', 'Platforms & hashtags', 'Sources & assumptions'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('section-hashtags')).not.toBeInTheDocument()
    openTab('platforms')
    expect(screen.getByTestId('details-tab-platforms')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('section-hashtags')).toHaveTextContent('A few local tags.')
    expect(screen.queryByTestId('section-hooks')).not.toBeInTheDocument()
  })

  it('NOTHING stored is lost: with every detail area open, the extra fields of a full strategy are all reachable', async () => {
    load()
    render()
    await screen.findByTestId('strategy-details')
    // every tab in turn, and the "show details" inside each of them
    let text = ''
    for (const group of ['content', 'voice', 'platforms', 'sources']) {
      openTab(group)
      for (const el of within(screen.getByTestId('strategy-details')).queryAllByRole('button', { expanded: false })) fireEvent.click(el)
      text += screen.getByTestId('strategy-details').textContent
      if (group === 'content') expect(screen.getByTestId('campaign-ideas')).toHaveTextContent('A week of short tips')
    }
    // with no competitors supplied there is no competitor analysis at all: it is listed under "Improve this strategy" instead
    expect(text).not.toContain('No competitor data provided')
    for (const stored of [
      'Back-to-school check-ups', 'Smile check week', // outlook
      'Brushing basics', 'Carousel', // pillar topics and formats
      'Most people brush too hard. Here is the fix.', 'A calm checklist for a first visit', // hooks, trending
      'Clear family-dentistry focus', 'More educational authority content', 'Little proof content so far', // brand analysis (the weaknesses are two levels down)
      'Warm and professional', 'Reassuring', 'Plain language', 'Jargon', // tone
      'Community and offers', 'Local families look for trusted practices.', // platforms
      'A few local tags.', 'Book a check-up', 'Follow for more', // hashtags, CTA
      'cheapest', 'Explain, never scare', 'Bright, clean photography', // brand rules
      'Post consistently for 8 weeks', // recommendations
      'Acme Dental', // the stored business snapshot
    ]) expect(text, stored).toContain(stored)
  })

  it('shows three goals, then "Show all goals"; a priority badge only when the priorities differ', async () => {
    load({ strategy: v3({ goals: ['a', 'b', 'c', 'd', 'e'].map((g, i) => ({ goal: `Goal ${g}`, priority: i === 0 ? 'high' : 'medium', rationale: `Because ${g}` })) }) })
    const first = render()
    const goals = await screen.findByTestId('section-goals')
    expect(within(goals).getAllByRole('listitem')).toHaveLength(3)
    expect(within(goals).getByText('High')).toBeInTheDocument()
    const toggle = screen.getByTestId('goals-toggle')
    expect(toggle).toHaveTextContent('Show all goals (5)')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(within(goals).getAllByRole('listitem')).toHaveLength(5)
    expect(toggle).toHaveTextContent('Show fewer goals')
    first.unmount()

    load({ strategy: v3({ goals: ['a', 'b'].map((g) => ({ goal: `Goal ${g}`, priority: 'high', rationale: `Because ${g}` })) }) })
    render()
    const same = await screen.findByTestId('section-goals')
    expect(within(same).queryByText('High')).not.toBeInTheDocument()
    expect(screen.queryByTestId('goals-toggle')).not.toBeInTheDocument()
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
    expect(screen.getByRole('region', { name: 'Your AI strategy is ready' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Detailed insights' })).toBeInTheDocument()
    for (const tab of screen.getAllByRole('tab')) expect(tab.tagName).toBe('BUTTON')
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

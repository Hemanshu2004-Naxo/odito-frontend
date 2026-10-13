import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { renderWithClient, strategyResponse, strategyDoc, strategyBody } from '@/test-utils/socialMediaAI'
import { strategyBodyV2 } from '@/test-utils/socialMediaPlan'

vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { AIStrategySections } from './AIStrategySections'

const view = (strategy = strategyBodyV2()) => render(<AIStrategySections strategy={strategy} />)

describe('AI Strategy v2 — a compact strategic document', () => {
  it('shows an overview first: positioning, audience, objective, opportunities and platform focus', () => {
    view()
    const overview = screen.getByTestId('strategy-summary')
    expect(overview).toHaveTextContent('Build local trust with practical dental education')
    const fields = within(screen.getByTestId('overview-fields'))
    expect(fields.getByTestId('overview-positioning')).toHaveTextContent('A friendly neighbourhood dental practice.')
    expect(fields.getByTestId('overview-primary-audience')).toHaveTextContent('Young families nearby')
    expect(fields.getByTestId('overview-primary-objective')).toHaveTextContent('Trust and new patient bookings')
    expect(fields.getByTestId('overview-strongest-opportunity')).toHaveTextContent('Educational content that calms dental anxiety')
    expect(fields.getByTestId('overview-growth-opportunity')).toHaveTextContent('Consistent proof and team-led content')
    expect(fields.getByTestId('overview-platform-focus')).toHaveTextContent('Facebook for community')
  })

  it('has every section the product asks for, grouped (brand & audience, content, competitors, execution, guardrails)', () => {
    view()
    for (const id of ['section-brand-analysis', 'section-audience', 'section-positioning', 'section-goals', 'section-pillars', 'section-mix', 'section-trending', 'section-hooks', 'section-competitors', 'section-platforms', 'section-posting', 'section-cta', 'section-hashtags', 'section-tone', 'section-brand', 'section-recommendations']) {
      expect(screen.getByTestId(id), id).toBeInTheDocument()
    }
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Strategy overview', 'Brand and audience', 'Content strategy', 'Competitive intelligence', 'Execution strategy', 'Brand guardrails'])
  })

  it('brand analysis shows strengths, opportunities and risks up front; the rest is behind a toggle', () => {
    view()
    const card = screen.getByTestId('section-brand-analysis')
    expect(card).toHaveTextContent('Clear family-dentistry focus')
    expect(card).toHaveTextContent('More educational authority content')
    expect(card).toHaveTextContent('Generic dental messaging')
    expect(card).not.toHaveTextContent('Little proof content so far') // a weakness: secondary
    expect(within(card).queryByTestId('brand-analysis-more')).not.toBeInTheDocument()
  })

  it('SECONDARY detail is collapsed by default and absent from the page until expanded; the toggle reports its state', () => {
    view()
    const card = screen.getByTestId('section-audience')
    const toggle = within(card).getByRole('button', { name: 'Show details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    for (const hidden of ['Convenient appointment times', 'A child needs a check-up', 'Worried about cost']) expect(screen.queryByText(hidden)).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(within(card).getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true')
    const more = within(card).getByTestId('audience-more')
    expect(toggle).toHaveAttribute('aria-controls', more.id)
    for (const shown of ['Convenient appointment times', 'A child needs a check-up', 'Worried about cost', 'Nervous about dental visits']) expect(within(more).getByText(shown)).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Hide details' }))
    expect(screen.queryByText('Worried about cost')).not.toBeInTheDocument()
  })

  it('positioning, tone and pillar detail expand the same way', () => {
    view()
    expect(screen.queryByText('Nothing to be nervous about.')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('section-positioning')).getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Nothing to be nervous about.')).toBeInTheDocument()
    expect(screen.getByText('Gentle care and convenient hours.')).toBeInTheDocument()

    expect(screen.queryByText('Plain language')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('section-tone')).getByRole('button', { name: 'Show details' }))
    expect(screen.getByText('Plain language')).toBeInTheDocument()

    expect(screen.queryByText('Brushing basics')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getAllByTestId('pillar-card')[0]).getByRole('button', { name: 'Topics and formats' }))
    expect(screen.getByText('Brushing basics')).toBeInTheDocument()
    expect(screen.getByText('Carousel')).toBeInTheDocument()
  })

  it('content pillars: name and percentage up front, in a compact row each', () => {
    view()
    const pillars = screen.getAllByTestId('pillar-card')
    expect(pillars).toHaveLength(2)
    expect(pillars[0]).toHaveTextContent('Dental tips')
    expect(pillars[0]).toHaveTextContent('60%')
    expect(pillars[0]).toHaveTextContent('Build trust')
    expect(pillars[1]).toHaveTextContent('40%')
  })

  it('Trending topics are labelled as RECOMMENDED CURRENT TOPICS with a no-live-data note — never as live trends', () => {
    view()
    const card = screen.getByTestId('section-trending')
    expect(within(card).getByRole('heading', { name: 'Recommended current topics' })).toBeInTheDocument()
    expect(card).toHaveTextContent('Odito has no live trend data')
    const topic = within(card).getByTestId('trending-topic')
    expect(topic).toHaveTextContent('Back-to-school check-ups')
    expect(topic).toHaveTextContent('High relevance')
    expect(topic).toHaveTextContent('Seasonal')
    expect(topic).toHaveTextContent('A calm checklist for a first visit')
    expect(topic).toHaveTextContent('Parents book before term starts.')
    expect(card.textContent).not.toMatch(/\d+\s?%|rising|surging|going viral|#1/i)
  })

  it('no topics: says so plainly instead of inventing some', () => {
    view(strategyBodyV2({ trendingTopics: [] }))
    expect(screen.getByTestId('trending-empty')).toHaveTextContent('No standout topics')
  })

  it('working hooks are grouped by category and the main page shows a manageable number', () => {
    view()
    const card = screen.getByTestId('section-hooks')
    expect(within(card).getAllByTestId('hook')).toHaveLength(6)
    expect(within(within(card).getByTestId('hooks-educational')).getByText('Most people brush too hard. Here is the fix.')).toBeInTheDocument()
    expect(within(card).getByTestId('hooks-problem_solution')).toHaveTextContent('Problem / solution')
    expect(within(card).getByTestId('hooks-contrarian')).toBeInTheDocument()
  })

  it('competitors: with none supplied it says "No competitor data provided." and links to where to add them — no analysis is shown', () => {
    view()
    const card = screen.getByTestId('section-competitors')
    expect(within(card).getByTestId('competitors-none')).toHaveTextContent('No competitor data provided.')
    expect(within(card).getByRole('link', { name: 'Add competitors in Business Profile' })).toHaveAttribute('href', '/app/social-media/business-profile#brand-kit')
    expect(card).not.toHaveTextContent('What to do differently')
  })

  it('competitors: with supplied competitors it shows what to do differently, and says Odito does not read their accounts', () => {
    view(strategyBodyV2({ competitorAnalysis: { hasCompetitorData: true, analysisBasis: 'supplied_competitors', competitorsConsidered: ['Rival Dental'], differentiationOpportunities: ['Teach, do not discount'], contentGaps: ['Few explainers'], recommendations: ['Show real proof'] } }))
    const card = screen.getByTestId('section-competitors')
    expect(card).toHaveTextContent('Based on the competitors you listed: Rival Dental. Odito does not read their accounts.')
    expect(card).toHaveTextContent('What to do differently')
    expect(card).toHaveTextContent('Teach, do not discount')
    expect(card).toHaveTextContent('Few explainers')
    expect(card).toHaveTextContent('Show real proof')
    expect(within(card).queryByTestId('competitors-none')).not.toBeInTheDocument()
  })

  it('platform strategy: connection state, role and formats up front; behaviour and guidance on demand', () => {
    view()
    expect(within(screen.getByTestId('platform-facebook')).getByText('Connected')).toBeInTheDocument()
    expect(within(screen.getByTestId('platform-instagram')).getByText('Not connected')).toBeInTheDocument()
    expect(screen.queryByText('Lead with a local benefit')).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('platform-facebook')).getByRole('button', { name: 'Audience and guidance' }))
    expect(screen.getByText('Lead with a local benefit')).toBeInTheDocument()
  })

  it('posting strategy is a RECOMMENDATION: a range, best days, and a way to create the calendar — not a schedule', () => {
    view()
    const card = screen.getByTestId('section-posting')
    expect(card).toHaveTextContent('A recommendation. You choose the real frequency when you create the calendar.')
    expect(screen.getByTestId('recommended-frequency')).toHaveTextContent('3-5 posts/week')
    expect(card).toHaveTextContent('Tue')
    expect(card).toHaveTextContent('Thu')
    expect(within(card).getByTestId('create-calendar-link')).toHaveAttribute('href', '/app/social-media/content-calendar')
    expect(card).not.toHaveTextContent(/posts per week/i)
  })

  it('CTA strategy shows the preferred CTAs and which suit which objective', () => {
    view()
    const card = screen.getByTestId('section-cta')
    expect(card).toHaveTextContent('Book a check-up')
    const byObjective = within(card).getByTestId('cta-by-objective')
    expect(byObjective).toHaveTextContent('Awareness: Follow for more')
    expect(byObjective).toHaveTextContent('Lead generation: Book a check-up')
  })

  it('brand guardrails: prohibited phrases, messaging rules and visual guidelines', () => {
    view()
    const card = screen.getByTestId('section-brand')
    expect(card).toHaveTextContent('cheapest')
    expect(card).toHaveTextContent('Explain, never scare')
    expect(card).toHaveTextContent('Bright, clean photography')
  })

  it('missing audience / goals are stated plainly, never filled in; the audience note links to where to add them', () => {
    view(strategyBodyV2({ audience: { primaryAudience: '', secondaryAudiences: [], painPoints: [], needs: [], motivations: [], buyingTriggers: [], objections: [], interests: [] }, goals: [] }))
    expect(screen.getByTestId('audience-missing')).toHaveTextContent('No audience has been defined, so none is assumed')
    expect(within(screen.getByTestId('audience-missing')).getByRole('link', { name: 'Business profile' })).toHaveAttribute('href', '/app/social-media/business-profile#brand-kit')
    expect(screen.getByTestId('goals-missing')).toBeInTheDocument()
    expect(within(screen.getByTestId('section-audience')).queryByRole('button', { name: 'Show details' })).not.toBeInTheDocument()
    expect(screen.getByTestId('overview-primary-audience')).toHaveTextContent('Not defined yet')
  })

  it('is genuinely compact: no huge text blocks on the page by default', () => {
    view()
    const longest = Math.max(...Array.from(document.body.querySelectorAll('p, li, dd')).map((el) => el.textContent.length))
    expect(longest).toBeLessThan(320)
    expect(document.body.textContent.length).toBeLessThan(5200)
  })
})

describe('AI Strategy — strategies saved before v2 still render, and say what they lack', () => {
  it('a v1 strategy renders its own sections, omits the v2 sections (nothing invented) and explains how to get them', () => {
    view(strategyBody())
    expect(screen.getByTestId('strategy-legacy-note')).toHaveTextContent('Regenerate it to include them')
    expect(screen.getByTestId('strategy-summary')).toHaveTextContent('Build local trust')
    expect(screen.queryByTestId('overview-fields')).not.toBeInTheDocument()
    for (const id of ['section-brand-analysis', 'section-trending', 'section-hooks', 'section-competitors', 'group-competitors']) expect(screen.queryByTestId(id), id).not.toBeInTheDocument()
    for (const id of ['section-positioning', 'section-audience', 'section-goals', 'section-pillars', 'section-mix', 'section-platforms', 'section-posting', 'section-cta', 'section-tone', 'section-brand']) expect(screen.getByTestId(id), id).toBeInTheDocument()
    expect(screen.getByTestId('section-posting')).toHaveTextContent('4 posts per week')
  })

  it('a v2 strategy shows no legacy note', () => {
    view()
    expect(screen.queryByTestId('strategy-legacy-note')).not.toBeInTheDocument()
  })
})

// ── the page ─────────────────────────────────────────────────────────────────

const api = vi.hoisted(() => ({ getSocialContentCalendar: vi.fn(), previewSocialAIStrategyPlan: vi.fn(), getSocialAIStrategy: vi.fn(), getSocialAIStrategyStatus: vi.fn(), generateSocialAIStrategy: vi.fn(), getSocialAIContentStatus: vi.fn(), generateSocialAIContent: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: { _id: 'proj-1' }, activeProjectId: 'proj-1', projects: [], setActiveProject: vi.fn() }),
}))

describe('AI Strategy page — calendar hand-off', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
    api.getSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'none', calendar: null } })
  })

  const load = async (strategy) => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'ready', strategy: strategyDoc({ strategy }) }))
    const { default: Page } = await import('@/app/app/social-media/ai-strategy/page')
    return renderWithClient(<Page />)
  }

  it('offers "Create content calendar" once the strategy is ready, next to Regenerate', async () => {
    await load(strategyBodyV2())
    const cta = await screen.findByTestId('create-calendar-cta')
    expect(cta).toHaveAttribute('href', '/app/social-media/content-calendar')
    expect(cta).toHaveTextContent('Generate Content Calendar')
    expect(screen.getByTestId('regenerate-strategy')).toHaveTextContent('Regenerate strategy')
  })

  it('has no calendar CTA without a strategy', async () => {
    api.getSocialAIStrategy.mockResolvedValue(strategyResponse({ status: 'none' }))
    const { default: Page } = await import('@/app/app/social-media/ai-strategy/page')
    renderWithClient(<Page />)
    await screen.findByTestId('strategy-empty')
    expect(screen.queryByTestId('create-calendar-cta')).not.toBeInTheDocument()
  })

  it('shows the strategy BEFORE the single-post generator (the brain first, the execution tool after)', async () => {
    await load(strategyBodyV2())
    const summary = await screen.findByTestId('strategy-summary')
    const generator = await screen.findByTestId('single-post-generator')
    expect(summary.compareDocumentPosition(generator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// jsdom has no layout engine: render the chart containers without measuring.
vi.mock('recharts', async (orig) => {
  const actual = await orig()
  return { ...actual, ResponsiveContainer: () => <div data-testid="chart" /> }
})

const hook = vi.hoisted(() => ({ useBusinessProfileReviewAnalytics: vi.fn() }))
vi.mock('@/hooks/useDashboardQueries', () => hook)

import ReviewAnalyticsView from './ReviewAnalyticsView'
import { payload, comparison, keywords, themes } from './analyticsFixtures'

const ok = (data) => ({ data: { data }, isLoading: false, isError: false, isFetching: false, isPlaceholderData: false, refetch: vi.fn() })
const setup = (q, props = {}) => {
  hook.useBusinessProfileReviewAnalytics.mockReturnValue(q)
  const onRangeChange = vi.fn()
  render(<ReviewAnalyticsView projectId="p1" locationId="L1" range="90d" onRangeChange={onRangeChange} {...props} />)
  return { onRangeChange }
}
const card = (title) => screen.getByRole('heading', { name: title }).closest('section')

beforeEach(() => vi.clearAllMocks())

describe('ReviewAnalyticsView (reference layout)', () => {
  it('ONE analytics request for project + location + the shared range (+ timezone)', () => {
    setup(ok(payload()))
    expect(hook.useBusinessProfileReviewAnalytics).toHaveBeenCalledTimes(1)
    const [projectId, opts] = hook.useBusinessProfileReviewAnalytics.mock.calls[0]
    expect(projectId).toBe('p1')
    expect(opts).toMatchObject({ locationId: 'L1', range: '90d' })
    expect(typeof opts.tz).toBe('string')
  })

  it('renders every card of the reference, in order', () => {
    setup(ok(payload()))
    const titles = ['Review Insight Count Cards', 'Reviews Rating', 'Reviews at a glance', 'Reviews Distribution', 'Review Sentiment Score', 'Sentiment Timeline', 'Comparison', 'Keyword Cloud', 'Review Themes']
    const nodes = titles.map((t) => screen.getByRole('heading', { name: t }))
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const t of ['NPS', 'AI ']) expect(screen.queryByText(new RegExp(t))).not.toBeInTheDocument()
  })

  it('Insight Count Cards: five metrics from real data (lifetime) with the period beneath; Deleted Reviews is "--"', () => {
    setup(ok(payload()))
    const strip = within(card('Review Insight Count Cards')).getByRole('region', { name: 'Review insight cards' })
    for (const [label, value] of [['Google Reviews', '1,052'], ['Avg Google Rating', '4.9'], ['With Text', '900'], ['Without Text', '152'], ['Deleted Reviews', '--']]) {
      const cell = within(strip).getByText(label).closest('div').parentElement
      expect(cell).toHaveTextContent(value)
    }
    expect(strip).toHaveTextContent('Lifetime · Google reports 1,053 · 101 in last 90 days')
    expect(strip).toHaveTextContent('87 in last 90 days')
    expect(strip).toHaveTextContent('Not tracked yet')
  })

  it('Reviews Rating: the period total and the 5★..1★ rows with real counts and shares', () => {
    setup(ok(payload()))
    const c = card('Reviews Rating')
    expect(within(c).getByText('101')).toBeInTheDocument()
    const rows = within(within(c).getByRole('list', { name: 'Reviews by star rating' })).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('90')
    expect(rows[0]).toHaveTextContent('89.1%')
    expect(rows[4]).toHaveTextContent('1')
    expect(within(c).getByTestId('chart')).toBeInTheDocument()
  })

  it('Reviews at a glance: period + all-time figures and the fixed 7 / 30 day windows', () => {
    setup(ok(payload()))
    const c = card('Reviews at a glance')
    expect(c).toHaveTextContent('Review Glance')
    expect(c).toHaveTextContent('101')
    expect(c).toHaveTextContent('1,052')
    expect(c).toHaveTextContent('Review Treatment')
    expect(c).toHaveTextContent('100.0%')
    expect(c).toHaveTextContent('99.6%')
    const w7 = within(c).getByText('Review in last 7 days').closest('div')
    expect(w7).toHaveTextContent('1Negative')
    expect(w7).toHaveTextContent('8Positive')
    expect(within(c).getByText('Review in last 30 days').closest('div')).toHaveTextContent('17Positive')
  })

  it('Reviews Distribution: with / without text counts', () => {
    setup(ok(payload()))
    const c = card('Reviews Distribution')
    expect(c).toHaveTextContent('With Text - 87')
    expect(c).toHaveTextContent('Without Text - 14')
  })

  it('Sentiment: a net score + the three shares from the existing sentiment model - not an NPS', () => {
    setup(ok(payload()))
    const c = card('Review Sentiment Score')
    expect(c).toHaveTextContent('Current Score: 95.05')
    expect(c).toHaveTextContent('97.0%')
    expect(c).toHaveTextContent('1.0%')
    expect(c).toHaveTextContent('2.0%')
    expect(c).toHaveTextContent('Based on star rating')
    expect(screen.queryByText(/NPS/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentiment Timeline' })).toBeInTheDocument()
  })

  it('Comparison shows the honest unavailable state (today: one snapshot only) and Keyword Cloud / Themes render', () => {
    setup(ok(payload()))
    const c = card('Comparison')
    expect(c).toHaveTextContent('Not enough historical data')
    expect(c).toHaveTextContent('Odito began collecting daily snapshots on October 7, 2026')
    expect(within(card('Keyword Cloud')).getByRole('button', { name: 'staff, 60 reviews' })).toBeInTheDocument()
    expect(within(card('Review Themes')).getByText('Doctors')).toBeInTheDocument()
  })

  it('Comparison renders the populated MoM / YoY table when snapshots exist', () => {
    setup(ok(payload({ comparison: comparison() })))
    const c = card('Comparison')
    expect(within(c).getByRole('rowheader', { name: 'Total Reviews' }).closest('tr')).toHaveTextContent('+3.24 %')
    expect(within(c).getByRole('columnheader', { name: /MoM % Change/ })).toBeInTheDocument()
    expect(within(c).getByRole('columnheader', { name: /YoY % Change/ })).toBeInTheDocument()
  })

  it('ONE shared range: every card has the chips, all show the same selection, and any chip changes the single state', () => {
    const { onRangeChange } = setup(ok(payload()))
    const groups = screen.getAllByRole('radiogroup', { name: 'Date range' })
    expect(groups.length).toBeGreaterThanOrEqual(7)
    for (const g of groups) {
      expect(within(g).getAllByRole('radio').map((r) => r.textContent.replace(/Jul 10 – Oct 7/, '').trim())).toEqual(['7D', '30D', '90D', '6M', '12M'])
      expect(within(g).getByRole('radio', { name: 'Last 90 days' })).toHaveAttribute('aria-checked', 'true')
      expect(g).toHaveTextContent('Jul 10 – Oct 7') // the active chip carries the real span, as in the reference
    }
    fireEvent.click(within(groups[3]).getByRole('radio', { name: 'Last 30 days' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(onRangeChange).toHaveBeenCalledWith('30d')
    fireEvent.click(within(groups[0]).getByRole('radio', { name: 'Last 90 days' }))
    expect(onRangeChange).toHaveBeenCalledTimes(1) // re-selecting the active range is a no-op
  })

  it('loading: skeleton only - no numbers, no charts, no zero-filled values', () => {
    setup({ data: undefined, isLoading: true, isError: false, isFetching: true })
    expect(screen.getByLabelText('Loading review analytics')).toBeInTheDocument()
    expect(screen.queryByText('Reviews Rating')).not.toBeInTheDocument()
    expect(screen.queryByText('Comparison')).not.toBeInTheDocument()
  })

  it('error: a clear message and a working Retry', () => {
    const refetch = vi.fn()
    setup({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch })
    expect(screen.getByText('Unable to load reviews')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('zero reviews overall: polished empty state, no charts', () => {
    const p = payload()
    p.overview.lifetime = { totalReviews: 0, averageRating: null, withText: 0, withoutText: 0 }
    setup(ok(p))
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
    expect(screen.queryByText('Reviews Rating')).not.toBeInTheDocument()
  })

  it('reviews exist but none in the period: lifetime cards stay, period cards say so (no misleading zero charts)', () => {
    const p = payload()
    p.overview.period = { totalReviews: 0, averageRating: null, withText: 0, withoutText: 0 }
    p.distribution.totals = { withText: 0, withoutText: 0 }
    p.sentiment.period = { positive: 0, neutral: 0, negative: 0, total: 0, positivePercent: 0, neutralPercent: 0, negativePercent: 0 }
    setup(ok(p), { range: '7d' })
    expect(card('Review Insight Count Cards')).toHaveTextContent('1,052')
    expect(card('Review Insight Count Cards')).toHaveTextContent('Lifetime · no reviews in last 90 days')
    expect(within(card('Reviews Rating')).getByText('No reviews available for this period.')).toBeInTheDocument()
    expect(within(card('Reviews Distribution')).getByText('No reviews available for this period.')).toBeInTheDocument()
    // the sentiment card has two halves (score + timeline), each states it
    expect(within(card('Review Sentiment Score')).getAllByText('No reviews available for this period.')).toHaveLength(2)
    expect(within(card('Keyword Cloud')).getByText('No review insights available for this period.')).toBeInTheDocument()
    expect(within(card('Review Themes')).getByText('No review insights available for this period.')).toBeInTheDocument()
  })

  it('a failed text-analytics module (keywords/themes = null) does NOT break the numeric dashboard', () => {
    setup(ok(payload({ keywords: null, themes: null })))
    expect(within(card('Keyword Cloud')).getByText('Unable to load review insights.')).toBeInTheDocument()
    expect(within(card('Review Themes')).getByText('Unable to load review insights.')).toBeInTheDocument()
    expect(within(card('Reviews Rating')).getByText('101')).toBeInTheDocument()
    expect(card('Review Insight Count Cards')).toHaveTextContent('1,052')
  })

  it('a failed comparison does not take the other modules down', () => {
    setup(ok(payload({ comparison: null })))
    expect(within(card('Comparison')).getByText('Unable to load the period comparison.')).toBeInTheDocument()
    expect(card('Reviews Rating')).toBeInTheDocument()
    expect(card('Keyword Cloud')).toBeInTheDocument()
  })

  it('keywords have no text to work with: "Not enough review text" - no fake keywords', () => {
    setup(ok(payload({ keywords: keywords({ status: 'insufficient_text', words: [], phrases: [] }), themes: themes({ status: 'no_themes', items: [] }) })))
    expect(within(card('Keyword Cloud')).getByText('Not enough review text to identify keywords.')).toBeInTheDocument()
    expect(within(card('Review Themes')).getByText('No recurring themes found for this period.')).toBeInTheDocument()
  })

  it('restricted by Google: unavailable state with the reason, not an error', () => {
    setup(ok({ available: false, status: 'restricted', reason: 'Restricted by Google' }))
    expect(screen.getByText('Reviews unavailable')).toBeInTheDocument()
    expect(screen.getByText('Restricted by Google')).toBeInTheDocument()
  })

  it('switching range keeps the previous dashboard visible, dimmed (no flash)', () => {
    setup({ ...ok(payload()), isPlaceholderData: true, isFetching: true })
    expect(screen.getByText('Reviews Rating')).toBeInTheDocument()
    expect(screen.getByText('Reviews Rating').closest('.opacity-60')).toBeTruthy()
  })
})

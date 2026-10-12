import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { renderWithClient } from '@/test-utils/socialMediaAI'
import { calendarItem, calendarState, calendarResponse, calendarGeneration, calendarOptionsResponse, itemPublication } from '@/test-utils/socialMediaPlan'

vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

const api = vi.hoisted(() => ({ getSocialContentCalendar: vi.fn(), getSocialContentCalendarStatus: vi.fn(), generateSocialContentCalendar: vi.fn(), previewSocialContentCalendar: vi.fn(), resumeSocialContentCalendar: vi.fn(), cancelSocialContentCalendar: vi.fn(), getSocialCalendarHistory: vi.fn(), getSocialCalendarVersion: vi.fn(), restoreSocialCalendarVersion: vi.fn(), getSocialAIContentStatus: vi.fn(), getSocialCalendarOptions: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

import { ContentPlanSection } from './ContentPlanSection'
import { socialContentCalendarKey } from '@/hooks/useSocialMediaAI'
import { periodEndDate, dayCount } from '@/lib/socialMedia/contentCalendar'

const ITEMS = [
  calendarItem({ id: 'i1', date: '2026-10-06', platforms: ['facebook'], format: 'static_post', topic: 'Meet Dr Lee', hook: 'The face behind your smile', contentPillar: 'Meet the team', contentType: 'educational', primaryCta: 'Book a check-up' }),
  calendarItem({ id: 'i2', date: '2026-10-07', platforms: ['instagram'], topic: '5 brushing mistakes', serviceId: 'svc-1', serviceName: 'Family check-up' }),
  calendarItem({ id: 'i3', date: '2026-10-09', platforms: ['facebook', 'instagram'], format: 'reel', topic: 'Whitening kit demo', productId: 'prod-1', productName: 'Whitening kit', objective: 'conversion', primaryKpi: 'clicks', requiresReview: true, approvalNotes: 'Avoid result guarantees.', footerDisclaimer: 'Results vary.' }),
  calendarItem({ id: 'i4', date: '2026-10-14', platforms: ['instagram'], topic: 'Cancelled idea', status: 'cancelled' }),
]
const ready = (over = {}) => calendarResponse({ status: 'ready', items: ITEMS, ...over })
const none = (over = {}) => calendarResponse({ status: 'none', ...over })

const load = (response) => api.getSocialContentCalendar.mockResolvedValue(response)
const mount = () => renderWithClient(<ContentPlanSection projectId="proj-1" />)

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
  api.getSocialCalendarOptions.mockResolvedValue(calendarOptionsResponse())
  // stands in for the server's exact preview (the real rule is tested in the backend); the form only has to show what it is told
  api.previewSocialContentCalendar.mockImplementation(async (pid, c) => {
    const endDate = periodEndDate(c.startDate, c.months)
    const days = dayCount(c.startDate, endDate)
    return { success: true, data: { startDate: c.startDate, endDate, months: c.months, days, postsPerWeek: c.postsPerWeek, totalPosts: Math.round((c.postsPerWeek * days) / 7), partialWeeks: [{ weekStart: c.startDate, days: 3, posts: 1 }], steps: Math.ceil((c.postsPerWeek * days) / 7 / 4) } }
  })
})
afterEach(() => { vi.useRealTimers() })

describe('Content plan — states before a calendar exists', () => {
  it('shows a loading skeleton, then the form', async () => {
    let release
    api.getSocialContentCalendar.mockReturnValue(new Promise((r) => { release = r }))
    mount()
    expect(screen.getByTestId('plan-loading')).toHaveAttribute('aria-busy', 'true')
    await act(async () => { release(none()) })
    expect(await screen.findByTestId('calendar-plan-form')).toBeInTheDocument()
    expect(screen.queryByTestId('plan-loading')).not.toBeInTheDocument()
  })

  it('a load failure is an error with a retry, not an empty plan', async () => {
    api.getSocialContentCalendar.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(none())
    mount()
    const error = await screen.findByTestId('plan-error')
    expect(error).toHaveTextContent("Couldn't load your content plan")
    fireEvent.click(within(error).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('calendar-plan-form')).toBeInTheDocument()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2)
  })

  it('without a strategy it sends the user to AI Strategy and offers no generator', async () => {
    load(none({ strategy: { available: false } }))
    mount()
    const card = await screen.findByTestId('plan-no-strategy')
    expect(within(card).getByRole('link', { name: 'Go to AI Strategy' })).toHaveAttribute('href', '/app/social-media/ai-strategy')
    expect(screen.queryByTestId('calendar-plan-form')).not.toBeInTheDocument()
  })

  it('with no connected platform it says so and links to Connect accounts; Generate stays disabled', async () => {
    load(none({ connectedPlatforms: { facebook: false, instagram: false } }))
    mount()
    expect(await screen.findByTestId('plan-no-platforms')).toHaveTextContent('Connect Facebook or Instagram')
    expect(within(screen.getByTestId('plan-no-platforms')).getByRole('link', { name: 'Connect accounts' })).toHaveAttribute('href', '/app/social-media/connect-accounts')
    expect(screen.getByTestId('generate-calendar-button')).toBeDisabled()
    expect(screen.getByTestId('plan-problems')).toHaveTextContent('Choose at least one platform.')
  })
})

describe('Content plan — the planning form', () => {
  const form = async (response = none()) => { load(response); mount(); return screen.findByTestId('calendar-plan-form') }

  it('offers 1–7 posts per week, defaults to the strategy recommendation, and says the number is a TOTAL', async () => {
    const f = await form()
    const options = within(within(f).getByTestId('posts-per-week')).getAllByRole('radio')
    expect(options.map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(options.find((o) => o.checked).value).toBe('4')
    expect(f).toHaveTextContent('Total posts, not per platform.')
    expect(f).toHaveTextContent('Your strategy recommends 3-5 posts/week')
  })

  it('lists only CONNECTED platforms as choosable; a disconnected one is disabled with a Connect link', async () => {
    const f = await form(none({ connectedPlatforms: { facebook: true, instagram: false } }))
    const platforms = within(f).getByTestId('platforms')
    const [fb, ig] = within(platforms).getAllByRole('checkbox')
    expect(fb).toBeChecked()
    expect(fb).toBeEnabled()
    expect(ig).toBeDisabled()
    expect(ig).not.toBeChecked()
    expect(within(platforms).getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '/app/social-media/connect-accounts')
    expect(within(f).queryByTestId('distribution')).not.toBeInTheDocument() // one platform: nothing to distribute
  })

  it('a connected platform that the strategy does not cover cannot be chosen either', async () => {
    const f = await form(none({ strategy: { ...calendarState().strategy, platforms: ['facebook'] } }))
    const [, ig] = within(within(f).getByTestId('platforms')).getAllByRole('checkbox')
    expect(ig).toBeDisabled()
    expect(f).toHaveTextContent('Not in your strategy')
  })

  it('shows the distribution modes only when two platforms are selected', async () => {
    const f = await form()
    const dist = within(f).getByTestId('distribution')
    expect(within(dist).getAllByRole('radio').map((r) => r.value)).toEqual(['ai_optimized', 'balanced', 'platform_specific'])
    expect(within(dist).getByRole('radio', { name: /AI optimized/ })).toBeChecked()
    fireEvent.click(within(within(f).getByTestId('platforms')).getAllByRole('checkbox')[1])
    expect(within(f).queryByTestId('distribution')).not.toBeInTheDocument()
  })

  it('offers 1 to 6 months and a start date - and no end date to type', async () => {
    const f = await form()
    const group = within(f).getByTestId('duration-months')
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['1 month', '2 months', '3 months', '4 months', '5 months', '6 months'])
    expect(within(group).getByRole('radio', { name: '1 month' })).toBeChecked()
    expect(within(f).getByLabelText('Start date')).toBeInTheDocument()
    expect(within(f).queryByLabelText('End date')).not.toBeInTheDocument()
    expect(within(f).queryByTestId('quick-ranges')).not.toBeInTheDocument()
  })

  it('summarises the exact post count the server worked out, over the chosen months, and never doubles it per platform', async () => {
    const f = await form()
    fireEvent.click(within(f).getByRole('radio', { name: '2 posts per week' }))
    fireEvent.click(within(within(f).getByTestId('duration-months')).getByRole('radio', { name: '3 months' }))
    await waitFor(() => expect(api.previewSocialContentCalendar).toHaveBeenLastCalledWith('proj-1', expect.objectContaining({ months: 3, postsPerWeek: 2 })))
    const summary = within(f).getByTestId('plan-summary')
    await waitFor(() => expect(summary).toHaveTextContent(/\d+ posts over 3 months \(\d+ days\) · 2 per week · Facebook \+ Instagram/))
    expect(summary).not.toHaveTextContent('About')
    expect(summary).toHaveTextContent('This is the exact number')
    expect(summary).toHaveTextContent('proportional share')
    expect(summary).toHaveTextContent('may become more than one publication')
    expect(summary).toHaveTextContent(/planned in \d+ steps/)
  })

  it('shows the derived period, and a start on the 31st clamps to the end of a short month', async () => {
    const f = await form()
    fireEvent.change(within(f).getByLabelText('Start date'), { target: { value: '2027-01-31' } })
    await waitFor(() => expect(within(f).getByTestId('plan-period')).toHaveTextContent('Runs Sun 31 Jan 2027 to Sat 27 Feb 2027 (28 days)'))
    fireEvent.click(within(within(f).getByTestId('duration-months')).getByRole('radio', { name: '2 months' }))
    await waitFor(() => expect(within(f).getByTestId('plan-period')).toHaveTextContent('to Tue 30 Mar 2027'))
  })

  it('uses the server\'s end date and day count when it has them', async () => {
    api.previewSocialContentCalendar.mockResolvedValue({ success: true, data: { startDate: '2027-01-10', endDate: '2027-02-09', months: 1, days: 31, totalPosts: 14, partialWeeks: [], steps: 4 } })
    const f = await form()
    fireEvent.change(within(f).getByLabelText('Start date'), { target: { value: '2027-01-10' } })
    await waitFor(() => expect(within(f).getByTestId('plan-period')).toHaveTextContent('to Tue 9 Feb 2027 (31 days)'))
    expect(within(f).getByTestId('plan-summary')).toHaveTextContent('14 posts over 1 month (31 days)')
  })

  it('validates: no platform and a past start are explained and block generating', async () => {
    const f = await form()
    const generate = within(f).getByTestId('generate-calendar-button')
    expect(generate).toBeEnabled()

    const [fb, ig] = within(within(f).getByTestId('platforms')).getAllByRole('checkbox')
    fireEvent.click(fb); fireEvent.click(ig)
    expect(within(f).getByTestId('plan-problems')).toHaveTextContent('Choose at least one platform.')
    expect(generate).toBeDisabled()
    fireEvent.click(fb)
    expect(generate).toBeEnabled()

    fireEvent.change(within(f).getByLabelText('Start date'), { target: { value: '2020-01-01' } })
    expect(within(f).getByTestId('plan-problems')).toHaveTextContent('The calendar cannot start in the past.')
    expect(generate).toBeDisabled()

    fireEvent.change(within(f).getByLabelText('Start date'), { target: { value: '' } })
    expect(within(f).getByTestId('plan-problems')).toHaveTextContent('Choose a valid start date.')
    expect(generate).toBeDisabled()
  })

  it('a calendar the server refuses (too large) shows its message and cannot be generated; changing the choices lifts it', async () => {
    api.previewSocialContentCalendar.mockImplementation(async (pid, c) => {
      if (c.months >= 6 && c.postsPerWeek >= 7) throw Object.assign(new Error('x'), { response: { status: 400, data: { details: { code: 'CALENDAR_TOO_LARGE' }, message: 'That would be 210 posts; a calendar can hold at most 200.' } } })
      return { success: true, data: { startDate: c.startDate, endDate: periodEndDate(c.startDate, c.months), months: c.months, days: 30, totalPosts: 10, partialWeeks: [], steps: 3 } }
    })
    const f = await form()
    fireEvent.click(within(within(f).getByTestId('duration-months')).getByRole('radio', { name: '6 months' }))
    fireEvent.click(within(f).getByRole('radio', { name: '7 posts per week' }))
    await waitFor(() => expect(within(f).getByTestId('plan-problems')).toBeInTheDocument())
    expect(within(f).getByTestId('generate-calendar-button')).toBeDisabled()
    fireEvent.click(within(f).getByRole('radio', { name: '3 posts per week' }))
    await waitFor(() => expect(within(f).queryByTestId('plan-problems')).not.toBeInTheDocument())
    expect(within(f).getByTestId('generate-calendar-button')).toBeEnabled()
  })

  it('sends ONLY the user\'s choices — never strategy, profile, catalog, prompt or model fields', async () => {
    api.getSocialContentCalendar.mockResolvedValueOnce(none()).mockResolvedValue(none({ status: 'generating', generation: calendarGeneration() }))
    api.generateSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'generating' } })
    const f = await form()
    fireEvent.click(within(f).getByRole('radio', { name: '5 posts per week' }))
    fireEvent.click(within(within(f).getByTestId('duration-months')).getByRole('radio', { name: '3 months' }))
    fireEvent.click(within(within(f).getByTestId('distribution')).getByRole('radio', { name: /Balanced/ }))
    fireEvent.click(within(f).getByTestId('generate-calendar-button'))
    await waitFor(() => expect(api.generateSocialContentCalendar).toHaveBeenCalledTimes(1))
    const [pid, body] = api.generateSocialContentCalendar.mock.calls[0]
    expect(pid).toBe('proj-1')
    // the END date is never sent: the server derives it from the start date and the months
    expect(Object.keys(body).sort()).toEqual(['distributionMode', 'months', 'platforms', 'postsPerWeek', 'startDate'])
    expect(body).toMatchObject({ postsPerWeek: 5, months: 3, platforms: ['facebook', 'instagram'], distributionMode: 'balanced' })
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a single selected platform is always sent as balanced, whatever mode was picked before', async () => {
    api.generateSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'generating' } })
    const f = await form()
    fireEvent.click(within(within(f).getByTestId('distribution')).getByRole('radio', { name: /Platform-specific/ }))
    fireEvent.click(within(within(f).getByTestId('platforms')).getAllByRole('checkbox')[1])
    fireEvent.click(within(f).getByTestId('generate-calendar-button'))
    await waitFor(() => expect(api.generateSocialContentCalendar).toHaveBeenCalled())
    expect(api.generateSocialContentCalendar.mock.calls[0][1]).toMatchObject({ platforms: ['facebook'], distributionMode: 'balanced' })
  })

  it('a double-click starts ONE generation', async () => {
    let release
    api.generateSocialContentCalendar.mockReturnValue(new Promise((r) => { release = r }))
    const f = await form()
    const button = within(f).getByTestId('generate-calendar-button')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.submit(f)
    expect(await screen.findByText('Starting…')).toBeInTheDocument()
    await waitFor(() => expect(api.generateSocialContentCalendar).toHaveBeenCalledTimes(1))
    fireEvent.submit(f)
    await act(async () => { release({ success: true, data: { status: 'generating' } }) })
    expect(api.generateSocialContentCalendar).toHaveBeenCalledTimes(1)
  })

  it('a refused start shows the server message in the form and keeps the choices', async () => {
    api.generateSocialContentCalendar.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 409, data: { code: 'CALENDAR_GENERATION_IN_PROGRESS', message: 'A calendar is already being generated.' } } }))
    const f = await form()
    fireEvent.click(within(f).getByRole('radio', { name: '6 posts per week' }))
    fireEvent.click(within(f).getByTestId('generate-calendar-button'))
    expect(await screen.findByTestId('plan-start-error')).toBeInTheDocument()
    expect(within(screen.getByTestId('calendar-plan-form')).getByRole('radio', { name: '6 posts per week' })).toBeChecked()
    expect(within(screen.getByTestId('calendar-plan-form')).getByTestId('generate-calendar-button')).toBeEnabled()
  })
})

describe('Content plan — asynchronous generation', () => {
  it('while the server is generating: a status banner, no form, no regenerate, and it polls the cheap status endpoint', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    load(none({ status: 'generating', generation: calendarGeneration() }))
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'generating' } })
    mount()
    const banner = await screen.findByTestId('plan-generating')
    expect(banner).toHaveTextContent('Planning and writing your content calendar from your strategy')
    expect(banner).toHaveTextContent('You can leave this page')
    expect(screen.queryByTestId('calendar-plan-form')).not.toBeInTheDocument()
    await waitFor(() => expect(api.getSocialContentCalendarStatus).toHaveBeenCalledTimes(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
    expect(api.getSocialContentCalendarStatus.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(1) // polling never re-downloads the whole plan
  })

  it('when the poll reports it finished, the full plan is fetched and the banner goes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getSocialContentCalendar
      .mockResolvedValueOnce(none({ status: 'generating', generation: calendarGeneration() }))
      .mockResolvedValue(ready())
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'ready' } })
    mount()
    await screen.findByTestId('plan-generating')
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(await screen.findByTestId('plan-table')).toBeInTheDocument()
    expect(screen.queryByTestId('plan-generating')).not.toBeInTheDocument()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2)
  })

  it('a failed attempt shows the server message, keeps the form for another try, and says a previous calendar is unchanged', async () => {
    load(none({ status: 'failed', generation: calendarGeneration({ status: 'failed', failure: { code: 'AI_UNAVAILABLE', message: 'The AI service is unavailable. Please try again.' } }) }))
    mount()
    expect(await screen.findByTestId('plan-failed-message')).toHaveTextContent('The AI service is unavailable.')
    expect(screen.getByTestId('calendar-plan-form')).toBeInTheDocument()
    expect(screen.getByTestId('plan-failed')).not.toHaveTextContent('previous calendar')
  })

  it('a failed regeneration leaves the previous calendar visible and untouched', async () => {
    // the fixture only attaches a calendar for status 'ready', so build the "failed regeneration" state from a ready one
    load({ success: true, data: { ...ready().data, status: 'failed', generation: calendarGeneration({ status: 'failed', failure: { code: 'CALENDAR_INVALID_OUTPUT', message: 'The plan could not be completed.' } }) } })
    mount()
    const failed = await screen.findByTestId('plan-failed')
    expect(failed).toHaveTextContent('Your previous calendar (version 1) is shown below and is unchanged.')
    expect(screen.getByTestId('plan-table')).toBeInTheDocument()
  })
})

describe('Content plan — long generations: progress, waiting to retry, and a calendar that stopped part-way', () => {
  const progress = (over = {}) => ({ plannedPosts: 20, totalPosts: 40, completedBatches: 5, totalBatches: 10, ...over })
  const PARTIAL_ITEMS = [
    calendarItem({ id: 'p1', date: '2026-10-13', platforms: ['facebook'], topic: 'Saved post one' }),
    calendarItem({ id: 'p2', date: '2026-10-15', platforms: ['instagram'], topic: 'Saved post two' }),
  ]
  const partialState = (over = {}) => ({
    ...none({ status: 'partial' }).data,
    status: 'partial',
    generation: calendarGeneration({ status: 'partial', canResume: true, progress: progress(), failure: { code: 'AI_BUSY', message: 'The AI service is busy right now. Please try again in a few minutes.' } }),
    partial: { calendar: { id: 'cal-2', version: 2, status: 'partial', config: ready().data.calendar.config, strategy: { id: 's', version: 3 }, plan: { totalItems: 2, pillarDistribution: [], platformCounts: {}, warnings: [] } }, items: PARTIAL_ITEMS },
    ...over,
  })

  it('while generating, it shows real progress from the server (posts planned of total, the step) as an accessible progress bar', async () => {
    load(none({ status: 'generating', generation: calendarGeneration({ progress: progress() }) }))
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'generating' } })
    mount()
    const banner = await screen.findByTestId('plan-generating')
    expect(within(banner).getByTestId('generation-progress-text')).toHaveTextContent('20 of 40 posts planned · step 6 of 10')
    const bar = within(banner).getByRole('progressbar', { name: 'Posts planned' })
    expect(bar).toHaveAttribute('aria-valuenow', '20')
    expect(bar).toHaveAttribute('aria-valuemax', '40')
    expect(within(banner).queryByTestId('plan-retrying')).not.toBeInTheDocument()
  })

  it('waiting out a transient failure is said plainly: what happened, that it continues by itself, and that the saved posts are kept', async () => {
    load(none({ status: 'generating', generation: calendarGeneration({ progress: progress(), retry: { code: 'AI_BUSY', at: '2026-10-12T10:05:00.000Z' } }) }))
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'generating' } })
    mount()
    const retrying = await screen.findByTestId('plan-retrying')
    expect(retrying).toHaveTextContent('The AI service is busy.')
    expect(retrying).toHaveTextContent('carry on by itself')
    expect(retrying).toHaveTextContent('the posts already planned are kept')
  })

  it('Stop asks the server to cancel the run and refetches the calendar', async () => {
    load(none({ status: 'generating', generation: calendarGeneration({ progress: progress() }) }))
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'generating' } })
    api.cancelSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'cancelled' } })
    mount()
    fireEvent.click(await screen.findByTestId('stop-generation'))
    await waitFor(() => expect(api.cancelSocialContentCalendar).toHaveBeenCalledWith('proj-1'))
    await waitFor(() => expect(api.getSocialContentCalendar.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('a partial calendar is NOT shown as finished: it says how far it got and why it stopped, lists the saved posts read-only, and offers no form', async () => {
    load({ success: true, data: partialState() })
    mount()
    const card = await screen.findByTestId('plan-partial')
    expect(within(card).getByTestId('plan-partial-title')).toHaveTextContent('stopped after 20 of 40 posts')
    expect(within(card).getByTestId('plan-partial-message')).toHaveTextContent('The AI service is busy right now.')
    expect(within(card).getByTestId('plan-partial-message')).toHaveTextContent('only plans the ones that are missing')
    expect(within(card).getByTestId('partial-items')).toHaveTextContent('Saved post one')
    expect(within(card).getByTestId('partial-items')).toHaveTextContent('Saved post two')
    expect(within(card).queryByRole('button', { name: /Saved post/ })).not.toBeInTheDocument() // not openable / editable
    expect(screen.queryByTestId('calendar-plan-form')).not.toBeInTheDocument()
    expect(screen.queryByTestId('plan-table')).not.toBeInTheDocument()
  })

  it('Resume starts the server-side continuation once and refetches; the button shows it is working', async () => {
    load({ success: true, data: partialState() })
    let release
    api.resumeSocialContentCalendar.mockReturnValue(new Promise((r) => { release = r }))
    mount()
    const resume = await screen.findByTestId('resume-generation')
    fireEvent.click(resume)
    expect(await screen.findByText('Resuming…')).toBeInTheDocument()
    expect(screen.getByTestId('discard-generation')).toBeDisabled()
    await waitFor(() => expect(api.resumeSocialContentCalendar).toHaveBeenCalledTimes(1))
    expect(api.resumeSocialContentCalendar).toHaveBeenCalledWith('proj-1')
    await act(async () => { release({ success: true, data: { status: 'generating' } }) })
    await waitFor(() => expect(api.getSocialContentCalendar.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('Discard cancels the unfinished calendar and the planning form comes back', async () => {
    api.getSocialContentCalendar.mockResolvedValueOnce({ success: true, data: partialState() }).mockResolvedValue(none())
    api.cancelSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'cancelled' } })
    mount()
    fireEvent.click(await screen.findByTestId('discard-generation'))
    await waitFor(() => expect(api.cancelSocialContentCalendar).toHaveBeenCalledWith('proj-1'))
    expect(await screen.findByTestId('calendar-plan-form')).toBeInTheDocument()
    expect(screen.queryByTestId('plan-partial')).not.toBeInTheDocument()
  })

  it('a refused resume shows the server message and keeps the choices', async () => {
    load({ success: true, data: partialState() })
    api.resumeSocialContentCalendar.mockRejectedValue(Object.assign(new Error('Calendar generation is not available right now. Please try again later.'), { status: 503, details: { code: 'AI_UNAVAILABLE' } }))
    mount()
    fireEvent.click(await screen.findByTestId('resume-generation'))
    expect(await screen.findByTestId('plan-partial-error')).toHaveTextContent('not available right now')
    expect(screen.getByTestId('resume-generation')).toBeEnabled()
  })

  it('with a ready calendar AND an unfinished newer one: both are shown, and the ready one says it is unchanged', async () => {
    load({ success: true, data: { ...ready().data, ...partialState({ calendar: ready().data.calendar, items: ITEMS, strategy: ready().data.strategy, connectedPlatforms: ready().data.connectedPlatforms, limits: ready().data.limits, stale: ready().data.stale }) } })
    mount()
    expect(await screen.findByTestId('plan-partial')).toHaveTextContent('Your previous calendar is unchanged and shown underneath.')
    expect(screen.getByTestId('plan-table')).toBeInTheDocument()
  })
})

describe('Content plan — version history', () => {
  const version = (n, over = {}) => ({
    id: `cal-${n}`, version: n, status: n === 2 ? 'ready' : 'archived', isCurrent: n === 2, generatedAt: '2026-10-05T10:00:00.000Z',
    config: { startDate: '2026-10-06', endDate: '2026-11-05', months: 1, postsPerWeek: 3, platforms: ['facebook'], distributionMode: 'balanced' },
    strategy: { version: 3 }, counts: { total: 13, edited: 2, approvedPlans: 1, withPosts: 0 }, ...over,
  })
  const history = (versions) => ({ success: true, data: { versions, currentVersion: versions.find((v) => v.isCurrent)?.version || null } })
  const openHistory = async () => {
    load(ready())
    mount()
    await screen.findByTestId('plan-table')
    fireEvent.click(screen.getByTestId('open-history'))
    return screen.findByTestId('calendar-history')
  }

  it('the regenerate confirmation says exactly what moves into the history: the edited posts, the approved plans, the posts already created', async () => {
    const items = [
      calendarItem({ id: 'e1', date: '2026-10-06', editedFields: ['caption'], status: 'edited' }),
      calendarItem({ id: 'e2', date: '2026-10-07', planApprovedAt: '2026-10-05T10:00:00.000Z', status: 'plan_approved' }),
      calendarItem({ id: 'e3', date: '2026-10-08', publications: [itemPublication()], status: 'content_generated' }),
      calendarItem({ id: 'e4', date: '2026-10-09' }),
    ]
    load(ready({ items }))
    mount()
    await screen.findByTestId('plan-table')
    fireEvent.click(screen.getByTestId('regenerate-calendar'))
    fireEvent.click(within(await screen.findByTestId('calendar-plan-form')).getByTestId('generate-calendar-button'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('4 posts · 1 edited by you · 1 approved plan · 1 post created from it')
    expect(dialog).toHaveTextContent('Version 1 moves into Version history')
  })

  it('lists every version, newest first: the current one is marked and cannot be restored; an archived one says what it holds', async () => {
    api.getSocialCalendarHistory.mockResolvedValue(history([version(2, { counts: { total: 14, edited: 0, approvedPlans: 0, withPosts: 0 } }), version(1)]))
    const panel = await openHistory()
    expect(await within(panel).findByTestId('history-version-2')).toHaveTextContent('Current')
    expect(within(panel).getByTestId('history-facts-2')).toHaveTextContent('14 posts')
    expect(within(panel).getByTestId('history-facts-1')).toHaveTextContent('13 posts · 2 edited by you · 1 approved plan')
    expect(within(panel).getByTestId('history-version-1')).toHaveTextContent('Strategy v3')
    expect(within(panel).queryByTestId('history-restore-2')).not.toBeInTheDocument()
    expect(within(panel).getByTestId('history-restore-1')).toBeInTheDocument()
  })

  it('"View posts" opens an archived version read-only: its posts with their edited marks and statuses', async () => {
    api.getSocialCalendarHistory.mockResolvedValue(history([version(2), version(1)]))
    api.getSocialCalendarVersion.mockResolvedValue({ success: true, data: { version: version(1), items: [calendarItem({ id: 'o1', date: '2026-10-06', topic: 'My old topic', editedFields: ['topic'], status: 'edited', locked: true })] } })
    const panel = await openHistory()
    fireEvent.click(await within(panel).findByTestId('history-view-1'))
    const posts = await within(panel).findByTestId('version-posts-cal-1')
    expect(posts).toHaveTextContent('My old topic')
    expect(posts).toHaveTextContent('Edited')
    expect(api.getSocialCalendarVersion).toHaveBeenCalledWith('proj-1', 'cal-1')
    expect(within(posts).queryByRole('button')).not.toBeInTheDocument()
  })

  it('Restore asks first and says what happens to both versions; confirming restores it and refetches the calendar; keeping the current one sends nothing', async () => {
    api.getSocialCalendarHistory.mockResolvedValue(history([version(2), version(1)]))
    api.restoreSocialCalendarVersion.mockResolvedValue({ success: true, data: { status: 'restored', restoredVersion: 1, replacedVersion: 2 } })
    const panel = await openHistory()
    fireEvent.click(await within(panel).findByTestId('history-restore-1'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Restore version 1?')
    expect(dialog).toHaveTextContent('exactly as you left it (13 posts · 2 edited by you · 1 approved plan)')
    expect(dialog).toHaveTextContent('version 2, moves into this history; nothing in it is lost')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep the current calendar' }))
    expect(api.restoreSocialCalendarVersion).not.toHaveBeenCalled()

    fireEvent.click(within(panel).getByTestId('history-restore-1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore this version' }))
    await waitFor(() => expect(api.restoreSocialCalendarVersion).toHaveBeenCalledWith('proj-1', 'cal-1'))
    await waitFor(() => expect(api.getSocialContentCalendar.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.queryByTestId('calendar-history')).not.toBeInTheDocument()) // the panel closes: the restored calendar is the one on screen
  })

  it('a refused restore (a generation is running) shows the reason in the dialog and keeps everything', async () => {
    api.getSocialCalendarHistory.mockResolvedValue(history([version(2), version(1)]))
    api.restoreSocialCalendarVersion.mockRejectedValue(Object.assign(new Error('A calendar is being generated, or has an unfinished draft. Finish, resume or discard it before restoring an earlier version.'), { status: 409, details: { code: 'GENERATION_IN_PROGRESS' } }))
    const panel = await openHistory()
    fireEvent.click(await within(panel).findByTestId('history-restore-1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore this version' }))
    expect(await screen.findByText(/Finish, resume or discard it before restoring/)).toBeInTheDocument()
    expect(screen.getByTestId('calendar-history')).toBeInTheDocument()
  })

  it('says so when there is no earlier version, and shows the server\'s reason when the history cannot be loaded', async () => {
    api.getSocialCalendarHistory.mockResolvedValueOnce(history([version(2)]))
    const panel = await openHistory()
    expect(await within(panel).findByTestId('history-version-2')).toBeInTheDocument()
  })

  it('a load failure is an error, not an empty history', async () => {
    api.getSocialCalendarHistory.mockRejectedValue(Object.assign(new Error('The history is unavailable.'), { status: 500 }))
    const panel = await openHistory()
    expect(await within(panel).findByTestId('history-error')).toHaveTextContent('The history is unavailable.')
    expect(within(panel).queryByTestId('history-empty')).not.toBeInTheDocument()
  })
})

describe('Content plan — a ready calendar', () => {
  const open = async (response = ready()) => { load(response); mount(); return screen.findByTestId('plan-table') }

  it('shows one compact row per post with date, platforms, format, pillar, topic/hook, focus, CTA and status', async () => {
    const table = await open()
    expect(within(table).getAllByTestId(/^plan-row-/)).toHaveLength(4)
    const row = within(table).getByTestId('plan-row-i1')
    expect(row).toHaveTextContent('Facebook')
    expect(within(row).getByTestId('item-format')).toHaveTextContent('Static post')
    expect(within(row).getByTestId('item-pillar')).toHaveTextContent('Meet the team')
    expect(within(row).getByTestId('item-topic')).toHaveTextContent('Meet Dr Lee')
    expect(within(row).getByTestId('item-hook')).toHaveTextContent('The face behind your smile')
    expect(within(row).getByTestId('item-cta')).toHaveTextContent('Book a check-up')
    expect(within(row).getByTestId('item-focus')).toHaveTextContent('Brand')
    expect(row).toHaveTextContent('Planned')
  })

  it('shows the linked service or product name — and "Brand" when a post is about neither', async () => {
    const table = await open()
    expect(within(within(table).getByTestId('plan-row-i2')).getByTestId('item-focus')).toHaveTextContent('Family check-up')
    expect(within(within(table).getByTestId('plan-row-i3')).getByTestId('item-focus')).toHaveTextContent('Whitening kit')
    expect(within(within(table).getByTestId('plan-row-i3')).getByTestId('item-platforms')).toHaveTextContent('FacebookInstagram')
  })

  it('flags posts that need a careful review and shows cancelled ones as such', async () => {
    const table = await open()
    expect(within(within(table).getByTestId('plan-row-i3')).getByLabelText('Needs review')).toBeInTheDocument()
    expect(within(within(table).getByTestId('plan-row-i1')).queryByLabelText('Needs review')).not.toBeInTheDocument()
    expect(within(table).getByTestId('plan-row-i4')).toHaveTextContent('Cancelled')
  })

  it('has a responsive layout: the column header only from xl, rows stack on small screens', async () => {
    const table = await open()
    expect(within(table).getByTestId('plan-table-head').className).toMatch(/hidden[^"]*xl:grid/)
    expect(within(table).getByTestId('plan-row-i1').className).toMatch(/grid-cols-1[^"]*xl:grid-cols-\[/)
  })

  it('summary: provenance, size, range, per-platform counts, planned-vs-target pillar mix', async () => {
    await open()
    expect(screen.getByTestId('plan-provenance')).toHaveTextContent('Generated from Strategy v3 · Calendar v1')
    const facts = screen.getByTestId('plan-facts')
    expect(facts).toHaveTextContent('4 posts')
    expect(facts).toHaveTextContent('3 per week')
    expect(facts).toHaveTextContent('Facebook 1, Instagram 2')
    const dist = screen.getByTestId('pillar-distribution')
    expect(within(dist).getByTestId('distribution-Dental tips')).toHaveTextContent('2 posts · 66.7% (target 60%)')
    expect(within(dist).getByTestId('distribution-Meet the team')).toHaveTextContent('(target 40%)')
  })

  it('warnings are collapsed until asked for', async () => {
    await open(ready({ calendar: { ...calendarState({ status: 'ready', items: ITEMS }).calendar, plan: { ...calendarState({ status: 'ready', items: ITEMS }).calendar.plan, warnings: ['Two hooks were reused to keep the topics distinct.'] } } }))
    const toggle = screen.getByRole('button', { name: 'Odito adjusted 1 thing' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Two hooks were reused to keep the topics distinct.')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(within(screen.getByTestId('plan-warnings')).getByText('Two hooks were reused to keep the topics distinct.')).toBeInTheDocument()
  })

  it('an empty calendar says so', async () => {
    load(ready({ items: [] }))
    mount()
    expect(await screen.findByTestId('plan-empty')).toBeInTheDocument()
  })

  it('switches between the table and the weekly calendar grid', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    const grid = await screen.findByTestId('plan-grid')
    expect(screen.queryByTestId('plan-table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grid).getAllByTestId(/^plan-chip-/)).toHaveLength(4)
    // 2026-10-06 and 2026-10-14 are Tuesdays of different weeks
    expect(within(grid).getAllByTestId(/^plan-week-/)).toHaveLength(2)
    expect(within(grid).getByTestId('plan-chip-i1')).toHaveTextContent('Meet Dr Lee')
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(await screen.findByTestId('plan-table')).toBeInTheDocument()
  })

  it('opens a centered MODAL (not a drawer) with the post\'s planning fields, its status and its plan provenance', async () => {
    const table = await open()
    fireEvent.click(within(table).getByTestId('plan-row-i3'))
    expect(await screen.findByLabelText('Topic')).toHaveValue('Whitening kit demo')
    const modal = screen.getByTestId('item-modal')
    expect(screen.getByRole('dialog')).toBe(modal)
    expect(screen.queryByTestId('plan-drawer')).not.toBeInTheDocument()
    expect(modal.className).toMatch(/left-\[50%\]/)
    expect(modal.className).not.toMatch(/\bright-0\b|slide-in-from-right/)
    expect(within(modal).getByTestId('item-modal-title')).toHaveTextContent('Edit content plan')
    expect(modal).toHaveTextContent('Whitening kit demo')
    expect(within(modal).getByTestId('item-status')).toHaveTextContent('Planned')
    expect(within(modal).getByTestId('item-content-id')).toHaveTextContent('OCT-P01')
    expect(within(modal).getByTestId('item-provenance')).toHaveTextContent('Planned from Strategy v3')
    expect(within(modal).queryByRole('button', { name: /publish|schedule/i })).not.toBeInTheDocument()
  })

  it('a grid chip opens the same modal', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    fireEvent.click(await screen.findByTestId('plan-chip-i2'))
    expect(await screen.findByLabelText('Topic')).toHaveValue('5 brushing mistakes')
    expect(screen.getByTestId('item-modal')).toHaveTextContent('5 brushing mistakes')
    expect(screen.queryByTestId('plan-drawer')).not.toBeInTheDocument()
  })

  it('the modal closes with Escape (nothing unsaved, so no confirmation)', async () => {
    const table = await open()
    fireEvent.click(within(table).getByTestId('plan-row-i1'))
    await screen.findByTestId('item-modal')
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('item-modal')).not.toBeInTheDocument())
  })
})

describe('Content plan — staleness and regeneration', () => {
  it('no stale notice when nothing changed', async () => {
    load(ready())
    mount()
    await screen.findByTestId('plan-table')
    expect(screen.queryByTestId('calendar-stale')).not.toBeInTheDocument()
  })

  it('tells the user when the strategy changed, names both versions, and promises nothing was regenerated', async () => {
    load(ready({ stale: { strategyChanged: true, currentStrategyVersion: 4, profileChanged: false } }))
    mount()
    const banner = await screen.findByTestId('calendar-stale')
    expect(banner).toHaveTextContent('Your strategy has changed since this calendar was generated.')
    expect(banner).toHaveTextContent('Strategy v3; the current strategy is v4')
    expect(banner).toHaveTextContent('Nothing was regenerated automatically.')
    expect(screen.getByTestId('plan-table')).toBeInTheDocument()
    expect(api.generateSocialContentCalendar).not.toHaveBeenCalled()
  })

  it('tells the user when only the business profile changed', async () => {
    load(ready({ stale: { strategyChanged: false, currentStrategyVersion: 3, profileChanged: true } }))
    mount()
    expect(await screen.findByTestId('calendar-stale')).toHaveTextContent('Your business profile has changed since this calendar was generated.')
    expect(screen.getByRole('link', { name: 'Review strategy' })).toHaveAttribute('href', '/app/social-media/ai-strategy')
  })

  it('Regenerate opens the form (with the old calendar still showing) and Cancel closes it', async () => {
    load(ready())
    mount()
    await screen.findByTestId('plan-table')
    expect(screen.queryByTestId('calendar-plan-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('regenerate-calendar'))
    const form = await screen.findByTestId('calendar-plan-form')
    expect(screen.getByTestId('plan-table')).toBeInTheDocument()
    expect(within(form).getByTestId('generate-calendar-button')).toHaveTextContent('Regenerate calendar')
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('calendar-plan-form')).not.toBeInTheDocument()
  })

  it('regeneration is CONFIRMED first: nothing is sent until the user agrees; keeping the calendar sends nothing', async () => {
    load(ready())
    mount()
    await screen.findByTestId('plan-table')
    fireEvent.click(screen.getByTestId('regenerate-calendar'))
    fireEvent.click(within(await screen.findByTestId('calendar-plan-form')).getByTestId('generate-calendar-button'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Regenerate the content calendar?')
    expect(dialog).toHaveTextContent('Version 1 moves into Version history')
    expect(dialog).toHaveTextContent('you can restore it later')
    expect(dialog).toHaveTextContent('version 2')
    expect(api.generateSocialContentCalendar).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep current calendar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.generateSocialContentCalendar).not.toHaveBeenCalled()
  })

  it('confirming starts generation once, then the calendar is refetched (query invalidation) and the banner shows', async () => {
    api.getSocialContentCalendar.mockResolvedValueOnce(ready()).mockResolvedValue(ready({ status: 'generating', generation: calendarGeneration({ version: 2 }) }))
    api.getSocialContentCalendarStatus.mockResolvedValue({ success: true, data: { status: 'generating' } })
    api.generateSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'generating' } })
    const { queryClient } = mount()
    await screen.findByTestId('plan-table')
    fireEvent.click(screen.getByTestId('regenerate-calendar'))
    fireEvent.click(within(await screen.findByTestId('calendar-plan-form')).getByTestId('generate-calendar-button'))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Regenerate calendar' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(api.generateSocialContentCalendar).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('plan-generating')).toBeInTheDocument()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(socialContentCalendarKey('proj-1')).status).toBe('generating')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('the stale banner\'s Regenerate button opens the same form', async () => {
    load(ready({ stale: { strategyChanged: true, currentStrategyVersion: 4, profileChanged: false } }))
    mount()
    const banner = await screen.findByTestId('calendar-stale')
    fireEvent.click(within(banner).getByRole('button', { name: 'Regenerate calendar' }))
    expect(await screen.findByTestId('calendar-plan-form')).toBeInTheDocument()
  })

  it('is planning only: no caption, design, schedule or publish control anywhere on the plan', async () => {
    load(ready())
    mount()
    await screen.findByTestId('plan-table')
    expect(screen.queryByRole('button', { name: /generate (caption|content|design)|create design|schedule|publish|post now/i })).not.toBeInTheDocument()
  })
})

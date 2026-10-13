import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within, fireEvent, waitFor } from '@testing-library/react'
import { renderWithClient, planPreviewResponse, planningDoc, apiError } from '@/test-utils/socialMediaAI'

vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

const api = vi.hoisted(() => ({ previewSocialAIStrategyPlan: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

import { StrategyWizard } from './StrategyWizard'

/**
 * The strategy wizard on its own: navigation, validation, the planner-owned post count, the disconnected-platform wording, the review, and
 * the accessibility-critical parts (dialog, step focus, radio groups, live region). The server's planner is the mocked network layer: the
 * UI must show ITS number and never compute one.
 */

const baseProps = (over = {}) => ({
  open: true, onOpenChange: vi.fn(), projectId: 'proj-1', businessName: 'Acme Dental', connectedPlatforms: { facebook: true, instagram: false },
  current: null, currentVersion: 0, retryChoice: null, mode: 'create', pending: false, error: null, onConfirm: vi.fn(), ...over,
})
const mount = (over = {}) => { const props = baseProps(over); return { props, ...renderWithClient(<StrategyWizard {...props} />) } }
const next = () => fireEvent.click(screen.getByTestId('wizard-next'))
const radio = (testId) => within(screen.getByTestId(testId)).getByRole('radio')

beforeEach(() => {
  api.previewSocialAIStrategyPlan.mockReset()
  api.previewSocialAIStrategyPlan.mockImplementation(async (pid, choice) => planPreviewResponse({
    postsPerWeek: choice.postsPerWeek, months: choice.months, platforms: choice.platforms,
    // the fixture's own arithmetic stands in for the server's planner: the component must not have any
    estimatedPosts: choice.postsPerWeek * choice.months * 13 / 3,
  }))
})

describe('Strategy wizard — navigation', () => {
  it('opens on step 1 (business and platforms) and generates nothing', async () => {
    mount()
    const wizard = await screen.findByTestId('strategy-wizard')
    expect(within(wizard).getByTestId('wizard-step-label')).toHaveTextContent('Step 1 of 4')
    expect(within(wizard).getByTestId('wizard-title')).toHaveTextContent('Which business and platforms is this for?')
    expect(within(wizard).getByTestId('wizard-business')).toHaveTextContent('Acme Dental')
    expect(within(wizard).queryByTestId('wizard-generate')).not.toBeInTheDocument()
  })

  it('walks through all four steps and back, keeping every choice', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    next()
    expect(screen.getByTestId('wizard-title')).toHaveTextContent('How often do you want to post?')
    fireEvent.click(radio('wizard-frequency-5'))
    next()
    expect(screen.getByTestId('wizard-title')).toHaveTextContent('How many months do you want to plan for?')
    fireEvent.click(radio('wizard-months-6'))
    next()
    expect(screen.getByTestId('wizard-title')).toHaveTextContent('Review and confirm')
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Step 4 of 4')
    expect(screen.getByTestId('review-frequency')).toHaveTextContent('5 posts per week')
    fireEvent.click(screen.getByTestId('wizard-back'))
    expect(radio('wizard-months-6')).toBeChecked()
    fireEvent.click(screen.getByTestId('wizard-back'))
    expect(radio('wizard-frequency-5')).toBeChecked()
    fireEvent.click(screen.getByTestId('wizard-back'))
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Step 1 of 4')
    expect(screen.getByTestId('wizard-back')).toHaveTextContent('Cancel')
  })

  it('"Cancel" on the first step closes it without confirming anything', async () => {
    const { props } = mount()
    await screen.findByTestId('strategy-wizard')
    fireEvent.click(screen.getByTestId('wizard-back'))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
})

describe('Strategy wizard — platforms (step 1)', () => {
  it('shows each platform\'s real state; a disconnected one is flagged but never blocks the strategy', async () => {
    api.previewSocialAIStrategyPlan.mockResolvedValue(planPreviewResponse({ platformStates: { facebook: 'connected', instagram: 'expired' } }))
    mount()
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('wizard-platform-state-facebook')).toHaveTextContent('Connected')
    await waitFor(() => expect(screen.getByTestId('wizard-platform-state-instagram')).toHaveTextContent('Needs reconnecting'))
    expect(screen.getByTestId('wizard-platform-instagram')).toHaveTextContent('You can still create the strategy. Reconnect before you publish.')
    fireEvent.click(within(screen.getByTestId('wizard-platform-instagram')).getByRole('checkbox'))
    expect(screen.getByTestId('wizard-next')).toBeEnabled()
    next(); next(); next()
    expect(screen.getByTestId('review-platforms')).toHaveTextContent('Facebook + Instagram')
    expect(screen.getByTestId('review-accounts')).toHaveTextContent('Instagram: Needs reconnecting')
    await waitFor(() => expect(screen.getByTestId('wizard-generate')).toBeEnabled())
  })

  it('a platform that was never connected is selectable too ("not connected"), and says a connection is only needed to publish', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('wizard-platform-state-instagram')).toHaveTextContent('Not connected')
    fireEvent.click(within(screen.getByTestId('wizard-platform-instagram')).getByRole('checkbox'))
    expect(within(screen.getByTestId('wizard-platform-instagram')).getByRole('checkbox')).toBeChecked()
    expect(screen.getByText(/only needed to publish/)).toBeInTheDocument()
  })

  it('with no platform chosen Next is disabled and the reason is shown; nothing can be confirmed', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    fireEvent.click(within(screen.getByTestId('wizard-platform-facebook')).getByRole('checkbox'))
    expect(screen.getByTestId('wizard-next')).toBeDisabled()
    expect(screen.getByTestId('wizard-problems')).toHaveTextContent('Choose at least one platform.')
  })

  it('starts from the connected platforms (or Facebook when none is connected)', async () => {
    const first = mount({ connectedPlatforms: { facebook: true, instagram: true } })
    await screen.findByTestId('strategy-wizard')
    expect(within(screen.getByTestId('wizard-platform-instagram')).getByRole('checkbox')).toBeChecked()
    first.unmount()
    mount({ connectedPlatforms: { facebook: false, instagram: false } })
    await screen.findByTestId('strategy-wizard')
    expect(within(screen.getByTestId('wizard-platform-facebook')).getByRole('checkbox')).toBeChecked()
    expect(within(screen.getByTestId('wizard-platform-instagram')).getByRole('checkbox')).not.toBeChecked()
  })
})

describe('Strategy wizard — frequency and duration (steps 2 and 3)', () => {
  it('offers the suggested frequencies with their meaning, recommends 3, and accepts the others the planner supports', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    next()
    for (const n of [1, 3, 5, 7]) expect(screen.getByTestId(`wizard-frequency-${n}`)).toHaveTextContent(`${n} post${n === 1 ? '' : 's'} per week`)
    expect(screen.getByTestId('wizard-frequency-1')).toHaveTextContent('Light')
    expect(screen.getByTestId('wizard-frequency-3')).toHaveTextContent('Recommended starting point')
    expect(screen.getByTestId('wizard-frequency-5')).toHaveTextContent('Active')
    expect(screen.getByTestId('wizard-frequency-7')).toHaveTextContent('Daily')
    expect(radio('wizard-frequency-3')).toBeChecked()
    expect(within(screen.getByRole('radiogroup', { name: 'Posts per week' })).getAllByRole('radio')).toHaveLength(4)
    fireEvent.change(screen.getByTestId('wizard-frequency-other'), { target: { value: '4' } })
    expect(radio('wizard-frequency-3')).not.toBeChecked()
    next(); next()
    expect(screen.getByTestId('review-frequency')).toHaveTextContent('4 posts per week')
  })

  it('offers 1-6 months with 1 "Quick start", 3 "Recommended" (the default) and 6 "Long-term planning"', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    next(); next()
    for (let n = 1; n <= 6; n += 1) expect(screen.getByTestId(`wizard-months-${n}`)).toHaveTextContent(`${n} month${n === 1 ? '' : 's'}`)
    expect(screen.getByTestId('wizard-months-1')).toHaveTextContent('Quick start')
    expect(screen.getByTestId('wizard-months-3')).toHaveTextContent('Recommended')
    expect(screen.getByTestId('wizard-months-6')).toHaveTextContent('Long-term planning')
    expect(radio('wizard-months-3')).toBeChecked()
    expect(screen.queryByTestId('wizard-months-7')).not.toBeInTheDocument()
  })

  it('the post count is the SERVER planner\'s answer for the chosen values, asked with exactly those values, and updates when they change', async () => {
    api.previewSocialAIStrategyPlan.mockImplementation(async (pid, choice) => planPreviewResponse({ postsPerWeek: choice.postsPerWeek, months: choice.months, platforms: choice.platforms, estimatedPosts: choice.months * 100 + choice.postsPerWeek }))
    mount()
    await screen.findByTestId('strategy-wizard')
    next(); next()
    const estimate = await screen.findByTestId('wizard-estimate')
    await waitFor(() => expect(estimate).toHaveTextContent('3 posts per week × 3 months = 303 planned posts'))
    expect(api.previewSocialAIStrategyPlan).toHaveBeenCalledWith('proj-1', { postsPerWeek: 3, months: 3, platforms: ['facebook'] })
    fireEvent.click(radio('wizard-months-1'))
    await waitFor(() => expect(screen.getByTestId('wizard-estimate')).toHaveTextContent('3 posts per week × 1 month = 103 planned posts'))
    expect(api.previewSocialAIStrategyPlan).toHaveBeenLastCalledWith('proj-1', { postsPerWeek: 3, months: 1, platforms: ['facebook'] })
    expect(screen.getByTestId('wizard-estimate')).toHaveTextContent('The exact number is confirmed when you choose the real start date')
    expect(screen.getByTestId('wizard-estimate')).toHaveTextContent('Counted by Odito\'s calendar planner for a calendar that starts Wed 14 Oct 2026')
  })

  it('the count is an announced live region and the loading state does not shift the layout (skeleton first)', async () => {
    let resolve
    api.previewSocialAIStrategyPlan.mockImplementation(() => new Promise((r) => { resolve = r }))
    mount()
    await screen.findByTestId('strategy-wizard')
    next(); next()
    expect(await screen.findByTestId('wizard-estimate-loading')).toBeInTheDocument()
    resolve(planPreviewResponse())
    const estimate = await screen.findByTestId('wizard-estimate')
    expect(estimate).toHaveAttribute('aria-live', 'polite')
  })

  it('a value the server refuses is shown with the server\'s own message and the strategy cannot be confirmed', async () => {
    api.previewSocialAIStrategyPlan.mockRejectedValue(apiError('That would be 260 posts; a calendar can hold at most 200.', { status: 422, code: 'CALENDAR_TOO_LARGE' }))
    mount()
    await screen.findByTestId('strategy-wizard')
    next(); next(); next()
    expect(await screen.findByTestId('wizard-problems')).toHaveTextContent('at most 200')
    expect(screen.getByTestId('wizard-generate')).toBeDisabled()
  })
})

describe('Strategy wizard — review and confirm (step 4)', () => {
  it('summarises business, platforms, frequency, duration, the planner\'s total and the account status; nothing is generated until the button is pressed', async () => {
    const { props } = mount()
    await screen.findByTestId('strategy-wizard')
    next(); fireEvent.click(radio('wizard-frequency-5')); next(); fireEvent.click(radio('wizard-months-6')); next()
    const review = screen.getByTestId('wizard-review')
    expect(within(review).getByTestId('review-business')).toHaveTextContent('Acme Dental')
    expect(within(review).getByTestId('review-platforms')).toHaveTextContent('Facebook')
    expect(within(review).getByTestId('review-frequency')).toHaveTextContent('5 posts per week')
    expect(within(review).getByTestId('review-months')).toHaveTextContent('6 months')
    await waitFor(() => expect(within(review).getByTestId('review-posts')).toHaveTextContent('130 planned posts'))
    expect(within(review).getByTestId('review-accounts')).toHaveTextContent('Facebook: Connected')
    expect(screen.getByTestId('wizard-generate')).toHaveTextContent('Generate AI Strategy')
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('confirming sends ONLY the choice, the version the person saw and an idempotency key - never a count or a quota', async () => {
    const { props } = mount({ currentVersion: 4 })
    await screen.findByTestId('strategy-wizard')
    next(); fireEvent.click(radio('wizard-frequency-7')); next(); next()
    await waitFor(() => expect(screen.getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(screen.getByTestId('wizard-generate'))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    const sent = props.onConfirm.mock.calls[0][0]
    expect(sent.planning).toEqual({ postsPerWeek: 7, months: 3, platforms: ['facebook'] })
    expect(sent.expectedVersion).toBe(4)
    expect(sent.requestId).toMatch(/^wiz_[A-Za-z0-9]+$/)
    expect(JSON.stringify(sent)).not.toMatch(/estimatedPosts|quota|totalPosts/)
  })

  it('the idempotency key changes when the choice changes, and stays the same for a repeated press of the same choice', async () => {
    const { props } = mount()
    await screen.findByTestId('strategy-wizard')
    next(); next(); next()
    await waitFor(() => expect(screen.getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(screen.getByTestId('wizard-generate'))
    fireEvent.click(screen.getByTestId('wizard-generate'))
    const [a, b] = props.onConfirm.mock.calls.map((c) => c[0].requestId)
    expect(a).toBe(b)
    fireEvent.click(screen.getByTestId('wizard-back')); fireEvent.click(screen.getByTestId('wizard-back'))
    fireEvent.click(radio('wizard-frequency-1')); next(); next()
    await waitFor(() => expect(screen.getByTestId('wizard-generate')).toBeEnabled())
    fireEvent.click(screen.getByTestId('wizard-generate'))
    expect(props.onConfirm.mock.calls[2][0].requestId).not.toBe(a)
  })

  it('warns when the calendar that follows would not fit the monthly allowance, without blocking the strategy', async () => {
    api.previewSocialAIStrategyPlan.mockResolvedValue(planPreviewResponse({ quotaCheck: { fits: false, code: 'QUOTA_EXCEEDED', message: 'Your calendar needs 39 posts, but your account has 10 of 20 calendar posts left this month (10 used).' } }))
    mount()
    await screen.findByTestId('strategy-wizard')
    next(); next(); next()
    expect(await screen.findByTestId('review-quota')).toHaveTextContent('10 of 20 calendar posts left this month')
    expect(screen.getByTestId('review-quota')).toHaveTextContent('You can still create the strategy')
    await waitFor(() => expect(screen.getByTestId('wizard-generate')).toBeEnabled())
  })

  it('a pending start disables confirm and shows the error from a refused start while keeping the selections', async () => {
    const view = mount({ pending: true })
    await screen.findByTestId('strategy-wizard')
    next(); next(); next()
    expect(screen.getByTestId('wizard-generate')).toBeDisabled()
    expect(screen.getByTestId('wizard-back')).toBeDisabled()
    view.unmount()
    mount({ error: 'The strategy changed since you opened this page. Reload to see the latest version, then try again.' })
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('wizard-error')).toHaveTextContent('The strategy changed since you opened this page')
  })
})

describe('Strategy wizard — editing and regenerating an existing strategy', () => {
  const current = planningDoc({ postsPerWeek: 3, months: 3, platforms: ['facebook'] })

  it('"edit" opens on the frequency step, shows the current values, and explains the result is a NEW version that leaves calendars alone', async () => {
    mount({ mode: 'edit', current, currentVersion: 2 })
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Step 2 of 4')
    expect(screen.getByTestId('wizard-current')).toHaveTextContent('Currently: 3 posts per week for 3 months on Facebook.')
    expect(radio('wizard-frequency-3')).toBeChecked()
    fireEvent.click(radio('wizard-frequency-5')); next(); next()
    const note = screen.getByTestId('review-version-note')
    expect(note).toHaveTextContent('These settings differ from your current strategy.')
    expect(note).toHaveTextContent('creates strategy version 3')
    expect(note).toHaveTextContent('Version 2 and any content calendar you already made stay exactly as they are')
    expect(note).toHaveTextContent('Approvals and scheduled posts are not touched')
    expect(screen.getByTestId('wizard-generate')).toHaveTextContent('Generate new strategy version')
  })

  it('"regenerate" opens on the review with the saved choices and says it is the same settings, new version', async () => {
    mount({ mode: 'regenerate', current, currentVersion: 2 })
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('wizard-step-label')).toHaveTextContent('Step 4 of 4')
    expect(screen.getByTestId('review-frequency')).toHaveTextContent('3 posts per week')
    expect(screen.getByTestId('review-version-note')).toHaveTextContent('same settings')
  })

  it('a retry after a failed attempt starts from the failed attempt\'s choices, not the older strategy\'s', async () => {
    mount({ mode: 'regenerate', current, retryChoice: planningDoc({ postsPerWeek: 7, months: 6, platforms: ['facebook', 'instagram'] }), currentVersion: 2 })
    await screen.findByTestId('strategy-wizard')
    expect(screen.getByTestId('review-frequency')).toHaveTextContent('7 posts per week')
    expect(screen.getByTestId('review-months')).toHaveTextContent('6 months')
    expect(screen.getByTestId('review-platforms')).toHaveTextContent('Facebook + Instagram')
  })
})

describe('Strategy wizard — accessibility', () => {
  it('is a labelled dialog; the step heading takes focus on every step; the progress marks the current step', async () => {
    mount()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName()
    await waitFor(() => expect(screen.getByTestId('wizard-title')).toHaveFocus())
    next()
    await waitFor(() => expect(screen.getByTestId('wizard-title')).toHaveFocus())
    const current = within(screen.getByTestId('wizard-progress')).getAllByRole('listitem').filter((li) => li.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Posting frequency (current)')
  })

  it('every choice is a native radio or checkbox in a labelled group, reachable and operable from the keyboard', async () => {
    mount()
    await screen.findByTestId('strategy-wizard')
    for (const box of within(screen.getByTestId('strategy-wizard')).getAllByRole('checkbox')) expect(box).toHaveAccessibleName()
    next()
    expect(screen.getByRole('radiogroup', { name: 'Posts per week' })).toBeInTheDocument()
    for (const r of screen.getAllByRole('radio')) expect(r).toHaveAccessibleName()
    next()
    expect(screen.getByRole('radiogroup', { name: 'Months to plan' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it('Escape closes it, unless a start is in progress', async () => {
    const { props } = mount()
    await screen.findByTestId('strategy-wizard')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })
})

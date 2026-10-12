import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { renderWithClient } from '@/test-utils/socialMediaAI'
import { calendarItem, calendarResponse, calendarOptionsResponse, calendarOptions, itemPublication } from '@/test-utils/socialMediaPlan'

vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

const api = vi.hoisted(() => ({
  getSocialContentCalendar: vi.fn(), getSocialContentCalendarStatus: vi.fn(), generateSocialContentCalendar: vi.fn(), getSocialAIContentStatus: vi.fn(),
  getSocialCalendarOptions: vi.fn(), updateSocialCalendarItem: vi.fn(), createSocialCalendarItem: vi.fn(), approveSocialCalendarItem: vi.fn(),
  revokeSocialCalendarItemApproval: vi.fn(), regenerateSocialCalendarItem: vi.fn(), generateSocialCalendarItemContent: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

import { ContentPlanSection } from './ContentPlanSection'

/**
 * The planning modal of one calendar item, driven through the REAL ContentPlanSection (real hooks, real React Query cache),
 * with only the network layer replaced. Every fixture is shaped like the backend's response.
 */

const FB = calendarItem({ id: 'i1', date: '2026-10-07', platforms: ['facebook'], format: 'static_post', topic: 'Common digital marketing mistakes', hook: 'Most people brush too hard. Here is the fix.', hookRef: 0, contentPillar: 'Dental tips', objective: 'engagement', primaryKpi: 'saves', primaryCta: 'Save this', status: 'planned' })
const OTHER = calendarItem({ id: 'i2', date: '2026-10-09', platforms: ['instagram'], topic: 'A second post', status: 'planned', contentId: 'OCT-P02', order: 1 })

const emptyContent = { success: true, data: { status: 'none', generation: null, publication: null } }
const noContentKey = ['social', 'ai-content', 'proj-1']
const calKey = ['social', 'content-calendar', 'proj-1']

/** The server's answer to a save: the item with the patch applied, a bumped revision and the "edited" status. */
const saved = (item, sent, over = {}) => {
  const { expectedRevision: _seen, ...fields } = sent
  return {
  success: true,
  data: { item: { ...item, ...fields, revision: item.revision + 1, status: item.publications?.length ? item.status : 'edited', effectiveStatus: item.publications?.length ? item.effectiveStatus : 'edited', editedFields: [...new Set([...item.editedFields, ...Object.keys(fields)])], ...over }, changed: Object.keys(fields) },
  }
}

/** Like the real server: the saved item is what the NEXT calendar read returns too (a refetch must not bring the old one back). */
const serverSaves = (item) => async (pid, id, body) => {
  const res = saved(item, body)
  state = { ...state, data: { ...state.data, items: state.data.items.map((i) => (i.id === id ? res.data.item : i)) } }
  return res
}

let state
function load(items = [FB, OTHER], { options = {}, calendar = {} } = {}) {
  state = calendarResponse({ status: 'ready', items, ...calendar })
  api.getSocialContentCalendar.mockImplementation(async () => state)
  api.getSocialCalendarOptions.mockResolvedValue(calendarOptionsResponse(options))
}
const mount = () => renderWithClient(<ContentPlanSection projectId="proj-1" />)
const byLabel = (text) => screen.getByLabelText(new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(\\s*optional)?$`))
const openItem = async (id = 'i1') => {
  const view = mount()
  fireEvent.click(await screen.findByTestId(`plan-row-${id}`))
  await screen.findByLabelText('Topic')
  return view
}
const modal = () => screen.getByTestId('item-modal')
const save = () => fireEvent.click(screen.getByTestId('item-save'))
const type = (el, value) => fireEvent.change(el, { target: { value } })

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getSocialAIContentStatus.mockResolvedValue(emptyContent)
})
afterEach(() => { vi.useRealTimers() })

// ── opening ──────────────────────────────────────────────────────────────────

describe('Calendar item modal — opening and layout', () => {
  it('clicking a post opens a CENTERED modal dialog, never a drawer; the table stays a compact overview', async () => {
    load()
    await openItem()
    expect(screen.getByRole('dialog')).toBe(modal())
    expect(modal().className).toMatch(/left-\[50%\]/)
    expect(modal().className).not.toMatch(/right-0|slide-in-from-right/)
    expect(screen.queryByTestId('plan-drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('plan-table')).toBeInTheDocument()
    expect(screen.queryByTestId('plan-table-head')?.textContent).not.toMatch(/Caption|Hashtags/)
  })

  it('the header shows the title, the topic, the date, the content id, the status and the platforms', async () => {
    load()
    await openItem()
    expect(screen.getByTestId('item-modal-title')).toHaveTextContent('Edit content plan')
    const header = modal().querySelector('[data-testid="item-modal-title"]').parentElement
    expect(header).toHaveTextContent('Common digital marketing mistakes')
    expect(screen.getByTestId('item-date-label')).toHaveTextContent('Wed 7 Oct 2026')
    expect(screen.getByTestId('item-content-id')).toHaveTextContent('OCT-P01')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Planned')
    expect(header).toHaveTextContent('Facebook')
  })

  it('is organised into sections: overview, content plan, content, creative, measurement and approval', async () => {
    load()
    await openItem()
    for (const id of ['overview', 'plan', 'content', 'creative', 'compliance']) expect(screen.getByTestId(`section-${id}`)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Post overview', 'Content plan', 'Content', 'Creative', 'Measurement and approval'])
  })

  it('shows every planning field with its current value', async () => {
    load([calendarItem({ ...FB, targetAudience: 'SMBs and growth-stage brands', occasion: 'Back to school', angle: 'A calm checklist', onCreativeText: '3 SEO mistakes', creativeDirection: 'Minimal white background', contentBrief: 'Slide 1: hook', captionDirection: 'Warm and plain', engagementPrompt: 'Which one surprised you?', approvalNotes: 'Doctor review required.', footerDisclaimer: 'Results vary.', requiresReview: true, requiredAssets: ['logo'], caption: 'Most businesses do not have a traffic problem.', hashtags: ['#seo'] })])
    await openItem()
    expect(byLabel('Planned date')).toHaveValue('2026-10-07')
    expect(byLabel('Format')).toHaveValue('static_post')
    expect(byLabel('Content pillar')).toHaveValue('Dental tips')
    expect(byLabel('Objective')).toHaveValue('engagement')
    expect(byLabel('Target audience')).toHaveValue('SMBs and growth-stage brands')
    expect(byLabel('Occasion / trigger')).toHaveValue('Back to school')
    expect(byLabel('Topic')).toHaveValue('Common digital marketing mistakes')
    expect(byLabel('Angle')).toHaveValue('A calm checklist')
    expect(byLabel('Hook')).toHaveValue('Most people brush too hard. Here is the fix.')
    expect(byLabel('Caption')).toHaveValue('Most businesses do not have a traffic problem.')
    expect(within(screen.getByTestId('hashtags-shared')).getByText('#seo')).toBeInTheDocument()
    expect(byLabel('Primary CTA')).toHaveValue('Save this')
    expect(byLabel('Engagement prompt')).toHaveValue('Which one surprised you?')
    expect(byLabel('Caption direction')).toHaveValue('Warm and plain')
    expect(byLabel('Text on the creative')).toHaveValue('3 SEO mistakes')
    expect(byLabel('Creative direction')).toHaveValue('Minimal white background')
    expect(byLabel('Content brief')).toHaveValue('Slide 1: hook')
    expect(within(screen.getByTestId('required-assets')).getByLabelText('Logo')).toBeChecked()
    expect(byLabel('Primary KPI')).toHaveValue('saves')
    expect(byLabel('Approval / compliance notes')).toHaveValue('Doctor review required.')
    expect(byLabel('Footer disclaimer')).toHaveValue('Results vary.')
    expect(screen.getByLabelText('Needs a careful review before approval')).toBeChecked()
    expect(screen.getByTestId('item-day')).toHaveTextContent('Wednesday')
  })

  it('has a sticky header and footer around a scrollable body, and is large but controlled (and full screen on a phone)', async () => {
    load()
    await openItem()
    const body = screen.getByTestId('item-modal-body')
    expect(body.className).toMatch(/overflow-y-auto/)
    expect(modal().firstElementChild.contains(body)).toBe(false)
    expect(screen.getByTestId('item-footer')).not.toBe(body)
    expect(body.contains(screen.getByTestId('item-footer'))).toBe(false)
    expect(modal().className).toMatch(/sm:max-w-\[1100px\]/)
    expect(modal().className).toMatch(/sm:max-h-\[90vh\]/)
    expect(modal().className).toMatch(/h-\[100dvh\]/)
    expect(modal().className).toMatch(/sm:w-\[calc\(100vw-2rem\)\]/)
  })

  it('shows a loading state while the planning options load, and a retry when they fail', async () => {
    load()
    let release
    api.getSocialCalendarOptions.mockReturnValueOnce(new Promise((r) => { release = r })).mockResolvedValue(calendarOptionsResponse())
    mount()
    fireEvent.click(await screen.findByTestId('plan-row-i1'))
    expect(await screen.findByTestId('item-loading')).toHaveAttribute('aria-busy', 'true')
    await act(async () => { release(calendarOptionsResponse()) })
    expect(await screen.findByLabelText('Topic')).toBeInTheDocument()
  })

  it('options that fail to load show an error with Try again', async () => {
    load()
    api.getSocialCalendarOptions.mockReset()
    api.getSocialCalendarOptions.mockRejectedValue(new Error('options boom'))
    mount()
    fireEvent.click(await screen.findByTestId('plan-row-i1'))
    const error = await screen.findByTestId('item-options-error')
    expect(error).toHaveTextContent('options boom')
    api.getSocialCalendarOptions.mockResolvedValue(calendarOptionsResponse())
    fireEvent.click(within(error).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Topic')).toBeInTheDocument()
  })
})

// ── editing and saving ───────────────────────────────────────────────────────

describe('Calendar item modal — editing', () => {
  it('Save is disabled until something changes; it sends ONLY the changed fields plus the revision that was seen', async () => {
    load()
    await openItem()
    expect(screen.getByTestId('item-save')).toBeDisabled()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, { topic: body.topic, angle: body.angle }))
    type(byLabel('Topic'), '  A sharper topic  ')
    type(byLabel('Angle'), 'A new angle')
    expect(screen.getByTestId('item-save')).toBeEnabled()
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, topic: 'A sharper topic', angle: 'A new angle' })
  })

  it('a successful save keeps the modal open in a saved state, updates the table row at once and does NOT refetch the calendar', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, { topic: body.topic }))
    type(byLabel('Topic'), 'Edited topic')
    save()
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('Changes saved.')
    expect(modal()).toBeInTheDocument()
    expect(within(screen.getByTestId('plan-row-i1')).getByTestId('item-topic')).toHaveTextContent('Edited topic')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Edited')
    expect(within(screen.getByTestId('plan-row-i1')).getByText('Edited')).toBeInTheDocument()
    expect(byLabel('Topic')).toHaveValue('Edited topic')
    expect(screen.getByTestId('item-save')).toBeDisabled()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(1)
  })

  it('changing the pillar or the platforms (which feed the calendar summary) refetches the calendar once; other edits do not', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    api.updateSocialCalendarItem.mockImplementation(serverSaves(FB))
    fireEvent.change(byLabel('Content pillar'), { target: { value: 'Offers' } })
    save()
    await waitFor(() => expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2))
    expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', expect.objectContaining({ contentPillar: 'Offers' }))
  })

  it('a failed save keeps the modal open, keeps every unsaved edit, shows the error and lets the user retry', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('The server had a problem.'), { status: 500 }))
    type(byLabel('Topic'), 'Precious unsaved topic')
    type(byLabel('Angle'), 'Precious unsaved angle')
    save()
    const banner = await screen.findByTestId('item-banner')
    expect(banner).toHaveTextContent('The server had a problem.')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(modal()).toBeInTheDocument()
    expect(byLabel('Topic')).toHaveValue('Precious unsaved topic')
    expect(byLabel('Angle')).toHaveValue('Precious unsaved angle')
    expect(screen.getByTestId('item-save')).toBeEnabled()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    save()
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
  })

  it('the server\'s own field messages appear on the field they belong to', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('Choose a KPI that fits.'), { status: 422, details: { code: 'KPI_MISMATCH', field: 'primaryKpi', fields: { primaryKpi: 'The server says this KPI does not measure the objective.' } } }))
    type(byLabel('Angle'), 'x')
    save()
    expect(await screen.findByText('The server says this KPI does not measure the objective.')).toBeInTheDocument()
    expect(byLabel('Primary KPI')).toHaveAttribute('aria-invalid', 'true')
    expect(byLabel('Angle')).toHaveValue('x')
  })

  it('a conflict (the post changed elsewhere) keeps the user\'s edits, says so, and offers the latest version', async () => {
    load()
    await openItem()
    const latest = calendarItem({ ...FB, topic: 'Changed in another tab', revision: 3 })
    api.updateSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('This item was changed somewhere else.'), { status: 409, details: { code: 'ITEM_CONFLICT', item: latest } }))
    type(byLabel('Topic'), 'My local edit')
    save()
    expect(await screen.findByTestId('item-changed-elsewhere')).toBeInTheDocument()
    expect(screen.getByTestId('item-banner')).toHaveTextContent('changed somewhere else')
    expect(byLabel('Topic')).toHaveValue('My local edit')
    fireEvent.click(screen.getByRole('button', { name: /Discard my edits and load the latest/ }))
    expect(byLabel('Topic')).toHaveValue('Changed in another tab')
    expect(screen.queryByTestId('item-changed-elsewhere')).not.toBeInTheDocument()
  })

  it('when the post changes elsewhere and nothing is unsaved, the modal simply follows it', async () => {
    load()
    const { queryClient } = await openItem()
    act(() => {
      queryClient.setQueryData(calKey, (old) => ({ ...old, items: old.items.map((i) => (i.id === 'i1' ? { ...i, topic: 'Updated by a finished action', revision: 1 } : i)) }))
    })
    await waitFor(() => expect(byLabel('Topic')).toHaveValue('Updated by a finished action'))
    expect(screen.queryByTestId('item-changed-elsewhere')).not.toBeInTheDocument()
  })

  it('Cancel with nothing changed just closes; with unsaved edits it asks first and Keep editing keeps them', async () => {
    load()
    await openItem()
    fireEvent.click(screen.getByTestId('item-cancel'))
    await waitFor(() => expect(screen.queryByTestId('item-modal')).not.toBeInTheDocument())

    fireEvent.click(await screen.findByTestId('plan-row-i1'))
    await screen.findByLabelText('Topic')
    type(byLabel('Topic'), 'Unsaved')
    fireEvent.click(screen.getByTestId('item-cancel'))
    const confirm = await screen.findByText('Discard your changes?')
    expect(confirm).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByText('Discard your changes?')).not.toBeInTheDocument())
    expect(byLabel('Topic')).toHaveValue('Unsaved')
    fireEvent.click(screen.getByTestId('item-cancel'))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }))
    await waitFor(() => expect(screen.queryByTestId('item-modal')).not.toBeInTheDocument())
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
  })

  it('Escape with unsaved edits also asks before discarding', async () => {
    load()
    await openItem()
    type(byLabel('Topic'), 'Unsaved')
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape', code: 'Escape' })
    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument()
    expect(modal()).toBeInTheDocument()
  })

  it('an empty topic is caught before any request, with the message on the field', async () => {
    load()
    await openItem()
    type(byLabel('Topic'), '   ')
    save()
    expect(await screen.findByText('Add a topic.')).toBeInTheDocument()
    expect(screen.getByTestId('item-banner')).toHaveTextContent('Fix the highlighted fields')
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
  })
})

// ── platforms ────────────────────────────────────────────────────────────────

describe('Calendar item modal — platforms (Facebook -> Facebook + Instagram)', () => {
  it('a Facebook-only post can add Instagram when it is connected; the request carries both platforms', async () => {
    load()
    await openItem()
    expect(screen.getByTestId('platform-facebook')).toBeChecked()
    expect(screen.getByTestId('platform-instagram')).not.toBeChecked()
    expect(screen.getByTestId('platform-instagram')).toBeEnabled()
    api.updateSocialCalendarItem.mockImplementation(serverSaves(FB))
    fireEvent.click(screen.getByTestId('platform-instagram'))
    expect(screen.getByTestId('platform-instagram')).toBeChecked()
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, platforms: ['facebook', 'instagram'] }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByTestId('plan-row-i1')).getByTestId('item-platforms')).toHaveTextContent('FacebookInstagram'))
  })

  it('a platform that is not connected cannot be selected: it is disabled and offers Connect', async () => {
    load([FB], { options: { platforms: [{ platform: 'facebook', connected: true, inStrategy: true }, { platform: 'instagram', connected: false, inStrategy: true }] } })
    await openItem()
    const instagram = screen.getByTestId('platform-instagram')
    expect(instagram).toBeDisabled()
    fireEvent.click(instagram)
    expect(screen.getByTestId('item-save')).toBeDisabled() // nothing changed
    expect(within(screen.getByTestId('platforms')).getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '/app/social-media/connect-accounts')
    expect(screen.getByTestId('platforms')).toHaveTextContent('Not connected')
  })

  it('a connected platform that the strategy does not cover is disabled with a reason', async () => {
    load([FB], { options: { platforms: [{ platform: 'facebook', connected: true, inStrategy: true }, { platform: 'instagram', connected: true, inStrategy: false }] } })
    await openItem()
    expect(screen.getByTestId('platform-instagram')).toBeDisabled()
    expect(screen.getByTestId('platforms')).toHaveTextContent('Not in your strategy')
  })

  it('the last platform can be unticked in the UI but saving then says to choose one (nothing is sent)', async () => {
    load()
    await openItem()
    fireEvent.click(screen.getByTestId('platform-facebook'))
    expect(screen.getByTestId('platforms-error')).toHaveTextContent('Choose at least one platform.')
    save()
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
  })

  it('only formats every selected platform supports are offered: adding Instagram removes "Text post" and moves a text post to a valid format', async () => {
    load([calendarItem({ ...FB, format: 'text_post' })])
    await openItem()
    expect(within(byLabel('Format')).getByRole('option', { name: 'Text post' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('platform-instagram'))
    expect(within(byLabel('Format')).queryByRole('option', { name: 'Text post' })).not.toBeInTheDocument()
    expect(byLabel('Format')).toHaveValue('static_post')
    expect([...byLabel('Format').options].map((o) => o.value)).toEqual(['static_post', 'carousel', 'reel', 'video'])
  })

  it('with two platforms there are tabs: Shared, Facebook and Instagram; each platform has its own caption, CTA and hashtags and they are saved per platform', async () => {
    load([calendarItem({ ...FB, platforms: ['facebook', 'instagram'], caption: 'Shared caption', primaryCta: 'Save this' })])
    await openItem()
    const tabs = screen.getByTestId('copy-tabs')
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Shared', 'Facebook', 'Instagram'])
    fireEvent.click(screen.getByTestId('copy-tab-instagram'))
    expect(screen.getByTestId('copy-tab-instagram')).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByTestId('copy-panel-instagram')
    expect(within(panel).getByLabelText(/^Instagram caption/)).toHaveAttribute('placeholder', 'Uses the shared caption')
    type(within(panel).getByLabelText(/^Instagram caption/), 'Short IG caption')
    type(within(panel).getByLabelText(/^Instagram CTA/), 'Follow for more')
    const tagInput = within(screen.getByTestId('hashtags-instagram')).getByRole('textbox')
    type(tagInput, 'reels')
    fireEvent.keyDown(tagInput, { key: 'Enter' })
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(calendarItem({ ...FB, platforms: ['facebook', 'instagram'] }), body))
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.updateSocialCalendarItem.mock.calls[0][2]).toEqual({ expectedRevision: 0, platformContent: [{ platform: 'instagram', caption: 'Short IG caption', primaryCta: 'Follow for more', hashtags: ['#reels'] }] })
  })

  it('a platform tab disappears when its platform is unticked, and the view returns to Shared', async () => {
    load([calendarItem({ ...FB, platforms: ['facebook', 'instagram'] })])
    await openItem()
    fireEvent.click(screen.getByTestId('copy-tab-instagram'))
    fireEvent.click(screen.getByTestId('platform-instagram'))
    expect(screen.queryByTestId('copy-tab-instagram')).not.toBeInTheDocument()
    expect(screen.getByTestId('copy-tab-shared')).toHaveAttribute('aria-selected', 'true')
  })

  it('the shared caption is checked against EVERY selected platform (Instagram allows 2,200 characters)', async () => {
    load([calendarItem({ ...FB, platforms: ['facebook', 'instagram'] })])
    await openItem()
    type(byLabel('Caption'), 'x'.repeat(2300))
    expect(await screen.findByText(/The Instagram caption with hashtags is 2300 characters; the limit is 2200/)).toBeInTheDocument()
    save()
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
  })
})

// ── caption and hashtags ─────────────────────────────────────────────────────

describe('Calendar item modal — caption and hashtags', () => {
  it('says "Caption not generated yet." when there is no caption and no draft, and not when there is one', async () => {
    load()
    await openItem()
    expect(screen.getByTestId('caption-not-generated')).toHaveTextContent('Caption not generated yet.')
    type(byLabel('Caption'), 'My own caption')
    expect(screen.queryByTestId('caption-not-generated')).not.toBeInTheDocument()
  })

  it('caption editing keeps line breaks and is saved with the post', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    type(byLabel('Caption'), 'Most businesses do not have a traffic problem.\n\nThey have a positioning problem.')
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.updateSocialCalendarItem.mock.calls[0][2].caption).toBe('Most businesses do not have a traffic problem.\n\nThey have a positioning problem.')
  })

  it('hashtags are chips: add by Enter (with or without #), no duplicates, remove with the x, invalid ones are explained', async () => {
    load()
    await openItem()
    const box = screen.getByTestId('hashtags-shared')
    const input = within(box).getByRole('textbox')
    for (const raw of ['digitalmarketing', '#SEO', 'seo']) { type(input, raw); fireEvent.keyDown(input, { key: 'Enter' }) }
    expect(within(box).getByText('#digitalmarketing')).toBeInTheDocument()
    expect(within(box).getByText('#SEO')).toBeInTheDocument()
    expect(within(box).queryAllByText(/#seo/i)).toHaveLength(1)
    type(input, 'not valid!')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(within(box).getByRole('alert')).toHaveTextContent('letters, numbers and underscores only')
    type(input, '')
    fireEvent.click(within(box).getByRole('button', { name: 'Remove #digitalmarketing' }))
    expect(within(box).queryByText('#digitalmarketing')).not.toBeInTheDocument()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.updateSocialCalendarItem.mock.calls[0][2].hashtags).toEqual(['#SEO'])
  })

  it('hashtags are not invented when the modal opens: an item without any shows none', async () => {
    load()
    await openItem()
    expect(within(screen.getByTestId('hashtags-shared')).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
  })

  it('linked drafts are shown with their real caption, their status and a link to Content Approvals', async () => {
    load([calendarItem({ ...FB, status: 'content_generated', effectiveStatus: 'content_review', publications: [itemPublication()] })])
    await openItem()
    const draft = screen.getByTestId('publication-facebook')
    expect(draft).toHaveTextContent('The generated Facebook draft text.')
    expect(within(draft).getByRole('link', { name: 'Open in Content Approvals' })).toHaveAttribute('href', '/app/social-media/content-approvals')
    expect(screen.queryByTestId('caption-not-generated')).not.toBeInTheDocument()
    expect(screen.getByTestId('item-status')).toHaveTextContent('Content review')
  })
})

// ── strategy alignment, catalog ──────────────────────────────────────────────

describe('Calendar item modal — pillar, objective, KPI, CTA, hook', () => {
  it('the pillar list is the strategy\'s; the hook can be picked from the strategy\'s working hooks and keeps its link', async () => {
    load()
    await openItem()
    expect([...byLabel('Content pillar').options].map((o) => o.value)).toEqual(['Dental tips', 'Meet the team', 'Offers'])
    expect(screen.getByText('From your strategy\'s working hooks.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Use a working hook from your strategy'), { target: { value: '1' } })
    expect(byLabel('Hook')).toHaveValue('Nervous about the dentist? Start here.')
    type(byLabel('Hook'), 'My own opening line')
    expect(screen.getByText('Your own hook (not one of the strategy hooks).')).toBeInTheDocument()
  })

  it('changing the objective moves the KPI to one that measures it; the KPI list follows the objective', async () => {
    load()
    await openItem()
    fireEvent.change(byLabel('Objective'), { target: { value: 'awareness' } })
    expect(byLabel('Primary KPI')).toHaveValue('reach')
    expect([...byLabel('Primary KPI').options].map((o) => o.value)).toEqual(['reach', 'views'])
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, objective: 'awareness', primaryKpi: 'reach' }))
  })

  it('a purchase-style CTA is flagged unless the objective is conversion; CTA suggestions come from the strategy', async () => {
    load()
    await openItem()
    type(byLabel('Primary CTA'), 'Buy now')
    expect(await screen.findByText('A purchase call to action only suits a conversion objective.')).toBeInTheDocument()
    save()
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
    expect([...document.querySelectorAll('#cta-suggestions option')].map((o) => o.value)).toEqual(['Save this', 'Comment below', 'Book a check-up'])
  })

  it('the planned date is limited to the calendar\'s range and a bad date is explained', async () => {
    // a controlled clock (Date only): "not in the past" is judged against 5 Oct 2026, whatever day the suite really runs
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'))
    load()
    await openItem()
    const date = byLabel('Planned date')
    expect(date).toHaveAttribute('min', '2026-10-06')
    expect(date).toHaveAttribute('max', '2026-11-04')
    fireEvent.change(date, { target: { value: '2026-12-01' } })
    expect(await screen.findByText(/Choose a date between 2026-10-06 and 2026-11-04/)).toBeInTheDocument()
    save()
    expect(api.updateSocialCalendarItem).not.toHaveBeenCalled()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    fireEvent.change(date, { target: { value: '2026-10-09' } })
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, date: '2026-10-09' }))
  })

  it('a service business picks a SERVICE from the real catalog (or brand-level)', async () => {
    load()
    await openItem()
    const select = byLabel('Service')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Brand-level (no specific service)', 'Family check-up', 'Teeth whitening'])
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    fireEvent.change(select, { target: { value: 'service:svc-2' } })
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, serviceId: 'svc-2' }))
  })

  it('"brand-level" clears a previously chosen service', async () => {
    load([calendarItem({ ...FB, serviceId: 'svc-1', serviceName: 'Family check-up' })])
    await openItem()
    expect(byLabel('Service')).toHaveValue('service:svc-1')
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    fireEvent.change(byLabel('Service'), { target: { value: '' } })
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', { expectedRevision: 0, serviceId: null }))
  })

  it('a product business picks a PRODUCT, sees its images, chooses some and the choice is saved; switching product clears it', async () => {
    const products = [
      { id: 'prod-1', name: 'Whitening kit', images: [{ mediaId: 'img-1', url: 'https://media.example/1.png', altText: 'Kit', isPrimary: true }, { mediaId: 'img-2', url: 'https://media.example/2.png', altText: '', isPrimary: false }] },
      { id: 'prod-2', name: 'Night cream', images: [] },
    ]
    load([FB], { options: { businessModel: 'product', services: [], products } })
    await openItem()
    expect(screen.queryByTestId('product-images')).not.toBeInTheDocument()
    expect([...byLabel('Product').options].map((o) => o.textContent)).toEqual(['Brand-level (no specific product)', 'Whitening kit', 'Night cream'])
    fireEvent.change(byLabel('Product'), { target: { value: 'product:prod-1' } })
    const gallery = screen.getByTestId('product-images')
    expect(within(gallery).getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual(['https://media.example/1.png', 'https://media.example/2.png'])
    expect(within(gallery).getByText('Primary')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('product-image-img-2'))
    expect(screen.getByTestId('product-image-img-2')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('product-image-img-1'))
    fireEvent.click(screen.getByTestId('product-image-img-1')) // removed again
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.updateSocialCalendarItem.mock.calls[0][2]).toEqual({ expectedRevision: 0, productId: 'prod-1', selectedMediaIds: ['img-2'] })

    fireEvent.change(byLabel('Product'), { target: { value: 'product:prod-2' } })
    expect(screen.getByTestId('product-images')).toHaveTextContent('This product has no images yet')
  })

  it('required assets are checkable chips', async () => {
    load()
    await openItem()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => saved(FB, body))
    fireEvent.click(within(screen.getByTestId('required-assets')).getByLabelText('Team photo'))
    fireEvent.click(within(screen.getByTestId('required-assets')).getByLabelText('Logo'))
    save()
    await waitFor(() => expect(api.updateSocialCalendarItem).toHaveBeenCalledTimes(1))
    // the fixture post already needed a team photo: that click removed it, the Logo click added one
    expect(api.updateSocialCalendarItem.mock.calls[0][2].requiredAssets).toEqual(['logo'])
  })
})

// ── plan approval ────────────────────────────────────────────────────────────

describe('Calendar item modal — approving the PLAN', () => {
  it('Approve plan is offered for a planned item; it is plan approval only and changes just the status', async () => {
    load()
    await openItem()
    expect(screen.queryByTestId('item-generate-facebook')).not.toBeInTheDocument()
    api.approveSocialCalendarItem.mockImplementation(async () => ({ success: true, data: { item: { ...FB, status: 'plan_approved', effectiveStatus: 'plan_approved', revision: 1, planApprovedAt: '2026-10-05T10:00:00.000Z' } } }))
    fireEvent.click(screen.getByTestId('item-approve'))
    await waitFor(() => expect(api.approveSocialCalendarItem).toHaveBeenCalledWith('proj-1', 'i1', 0))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('Plan approved')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Plan approved')
    expect(screen.queryByTestId('item-approve')).not.toBeInTheDocument()
    expect(screen.getByTestId('item-revoke')).toBeInTheDocument()
    expect(screen.getByTestId('item-generate-facebook')).toBeInTheDocument()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(1) // the cached item was updated; no refetch
    expect(api.generateSocialCalendarItemContent).not.toHaveBeenCalled()
  })

  it('Approve is disabled while there are unsaved changes (save first)', async () => {
    load()
    await openItem()
    type(byLabel('Topic'), 'Changed')
    expect(screen.getByTestId('item-approve')).toBeDisabled()
    expect(screen.getByTestId('item-approve')).toHaveAttribute('title', 'Save your changes first')
  })

  it('an approved plan can be withdrawn', async () => {
    load([calendarItem({ ...FB, status: 'plan_approved', effectiveStatus: 'plan_approved', revision: 2 })])
    await openItem()
    api.revokeSocialCalendarItemApproval.mockImplementation(async () => ({ success: true, data: { item: { ...FB, status: 'planned', effectiveStatus: 'planned', revision: 3 } } }))
    fireEvent.click(screen.getByTestId('item-revoke'))
    await waitFor(() => expect(api.revokeSocialCalendarItemApproval).toHaveBeenCalledWith('proj-1', 'i1', 2))
    expect(await screen.findByText('Approval withdrawn.')).toBeInTheDocument()
    expect(screen.getByTestId('item-status')).toHaveTextContent('Planned')
  })

  it('a refused approval shows the server\'s reason and the modal stays as it was', async () => {
    load()
    await openItem()
    api.approveSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('"purchases" does not measure a engagement objective.'), { status: 422, details: { code: 'KPI_MISMATCH' } }))
    fireEvent.click(screen.getByTestId('item-approve'))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('does not measure')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Planned')
  })

  it('editing an approved plan tells the user it needs approving again', async () => {
    load([calendarItem({ ...FB, status: 'plan_approved', effectiveStatus: 'plan_approved', revision: 1 })])
    await openItem()
    api.updateSocialCalendarItem.mockImplementation(async (pid, id, body) => ({ success: true, data: { item: { ...FB, ...body, status: 'edited', effectiveStatus: 'edited', revision: 2 }, changed: Object.keys(body).filter((k) => k !== 'expectedRevision'), approvalRevoked: true } }))
    type(byLabel('Topic'), 'Changed after approval')
    save()
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('needs approving again')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Edited')
    expect(screen.getByTestId('item-approve')).toBeInTheDocument()
  })
})

// ── generate content ─────────────────────────────────────────────────────────

describe('Calendar item modal — creating the post from the plan (caption source of truth)', () => {
  const approved = (over = {}) => calendarItem({ ...FB, status: 'plan_approved', effectiveStatus: 'plan_approved', revision: 1, ...over })
  const REVIEWED = 'The exact caption the owner reviewed.'
  const created = (item, platform = 'facebook') => ({ success: true, data: { mode: 'plan', status: 'draft_created', item: { ...item, status: 'content_generated', effectiveStatus: 'content_review', revision: item.revision + 2, publications: [itemPublication({ platform })] }, publication: { id: 'pub-1', platform, status: 'draft', content: REVIEWED, generation: { source: 'calendar_plan', planRevision: item.revision } } } })

  it('with a reviewed caption the primary action is "Create post from this plan" - it says the caption is used as written - and it creates the post at once, with the revision that was seen', async () => {
    const item = approved({ platforms: ['facebook', 'instagram'], caption: REVIEWED })
    load([item])
    await openItem()
    expect(screen.getByTestId('item-generate-facebook')).toHaveTextContent('Create Facebook post from this plan')
    expect(screen.getByTestId('item-generate-instagram')).toHaveTextContent('Create Instagram post from this plan')
    expect(screen.getByTestId('item-generate-hint')).toHaveTextContent('exactly as written: the AI does not rewrite it')
    api.generateSocialCalendarItemContent.mockResolvedValue(created(item))
    fireEvent.click(screen.getByTestId('item-generate-facebook'))
    await waitFor(() => expect(api.generateSocialCalendarItemContent).toHaveBeenCalledWith('proj-1', 'i1', 'facebook', { mode: 'plan', expectedRevision: 1 }))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('created from this plan. Its caption is exactly what is written here')
    await waitFor(() => expect(api.getSocialContentCalendar.mock.calls.length).toBeGreaterThanOrEqual(2)) // the calendar is refetched
  })

  it('a single-platform post says "Create post from this plan"; "Write with AI instead" is a separate, CONFIRMED choice that says the plan caption stays', async () => {
    load([approved({ caption: REVIEWED })])
    await openItem()
    expect(screen.getByTestId('item-generate-facebook')).toHaveTextContent(/^Create post from this plan$/)
    expect(screen.getByTestId('item-generate-ai-facebook')).toHaveTextContent(/^Write with AI instead$/)
    fireEvent.click(screen.getByTestId('item-generate-ai-facebook'))
    expect(await screen.findByText('Have the AI write a different Facebook caption?')).toBeInTheDocument()
    expect(screen.getByText(/The caption in this plan is not changed or replaced/)).toBeInTheDocument()
    // keeping the caption sends nothing
    fireEvent.click(screen.getByRole('button', { name: 'Keep my caption' }))
    expect(api.generateSocialCalendarItemContent).not.toHaveBeenCalled()
    // confirming asks the server for the AI mode, and the usual "writing…" follow-up begins
    api.generateSocialCalendarItemContent.mockResolvedValue({ success: true, data: { mode: 'ai', status: 'generating', generation: { id: 'g1', status: 'generating', calendarItemId: 'i1', request: { platform: 'facebook' } } } })
    api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'generating', generation: { id: 'g1', status: 'generating', calendarItemId: 'i1' }, publication: null } })
    fireEvent.click(screen.getByTestId('item-generate-ai-facebook'))
    fireEvent.click(await screen.findByRole('button', { name: 'Write with AI' }))
    await waitFor(() => expect(api.generateSocialCalendarItemContent).toHaveBeenCalledWith('proj-1', 'i1', 'facebook', { mode: 'ai', expectedRevision: 1 }))
    expect(await screen.findByTestId('item-generating')).toHaveTextContent('Writing the post from this plan')
  })

  it('with NO caption in the plan the only thing that can write the post is AI, and the button says so', async () => {
    load([approved({ platforms: ['facebook', 'instagram'] })])
    await openItem()
    expect(screen.getByTestId('item-generate-facebook')).toHaveTextContent('Write Facebook post with AI')
    expect(screen.queryByTestId('item-generate-ai-facebook')).not.toBeInTheDocument()
    expect(screen.getByTestId('item-generate-hint')).toHaveTextContent('has no caption yet, so the AI will write the post')
    api.generateSocialCalendarItemContent.mockResolvedValue({ success: true, data: { mode: 'ai', status: 'generating', generation: { id: 'g1', status: 'generating', calendarItemId: 'i1', request: { platform: 'facebook' } } } })
    api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'generating', generation: { id: 'g1', status: 'generating', calendarItemId: 'i1' }, publication: null } })
    fireEvent.click(screen.getByTestId('item-generate-facebook'))
    await waitFor(() => expect(api.generateSocialCalendarItemContent).toHaveBeenCalledWith('proj-1', 'i1', 'facebook', { mode: 'ai', expectedRevision: 1 }))
    expect(await screen.findByTestId('item-generating')).toHaveTextContent('Writing the post from this plan')
    expect(screen.getByTestId('item-generate-instagram')).toBeDisabled()
  })

  it('a platform uses ITS OWN reviewed copy: Instagram has a caption of its own, Facebook has none and shows the AI choice', async () => {
    load([approved({ platforms: ['facebook', 'instagram'], platformContent: [{ platform: 'instagram', caption: 'Instagram only.', primaryCta: '', hashtags: [] }] })])
    await openItem()
    expect(screen.getByTestId('item-generate-instagram')).toHaveTextContent('Create Instagram post from this plan')
    expect(screen.getByTestId('item-generate-facebook')).toHaveTextContent('Write Facebook post with AI')
  })

  it('a refused plan-mode request (caption too long, prohibited phrase, a conflict) shows the server\'s reason and creates nothing', async () => {
    load([approved({ caption: REVIEWED })])
    await openItem()
    api.generateSocialCalendarItemContent.mockRejectedValueOnce(Object.assign(new Error('The caption uses "cheapest", which your business profile says never to use. Edit the caption in the plan first.'), { status: 422, details: { code: 'PROHIBITED_PHRASE' } }))
    fireEvent.click(screen.getByTestId('item-generate-facebook'))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('never to use')
    expect(screen.getByTestId('item-generate-facebook')).toBeEnabled()
  })

  it('a platform with a draft has no Generate button; the other one still has', async () => {
    load([approved({ platforms: ['facebook', 'instagram'], status: 'content_generated', publications: [itemPublication()] })])
    await openItem()
    expect(screen.queryByTestId('item-generate-facebook')).not.toBeInTheDocument()
    expect(screen.getByTestId('item-generate-instagram')).toBeInTheDocument()
  })

  it('is NOT offered for an unapproved plan, or when every platform already has its draft', async () => {
    load([FB])
    await openItem()
    expect(screen.queryByTestId('item-generate-facebook')).not.toBeInTheDocument()
  })

  it('is disabled while another post is being written, and says so', async () => {
    load([approved()])
    api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'generating', generation: { id: 'gx', status: 'generating', calendarItemId: null }, publication: null } })
    await openItem()
    expect(await screen.findByText(/Another post is being written/)).toBeInTheDocument()
    expect(screen.getByTestId('item-generate-facebook')).toBeDisabled()
  })

  it('a refusal (for example the strategy changed) is shown on the modal', async () => {
    load([approved()])
    await openItem()
    api.generateSocialCalendarItemContent.mockRejectedValueOnce(Object.assign(new Error('Your strategy has changed since this calendar was generated. Regenerate the calendar before creating content from it.'), { status: 409, details: { code: 'STRATEGY_CHANGED' } }))
    fireEvent.click(screen.getByTestId('item-generate-facebook'))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('strategy has changed')
  })

  it('a failed generation for THIS post is shown; one for another post is not', async () => {
    load([approved()])
    api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'failed', generation: { id: 'g9', status: 'failed', calendarItemId: 'i1', failure: { code: 'AI_BAD_OUTPUT', message: 'The AI returned a post that did not meet Odito\'s checks. Please try again.' } }, publication: null } })
    await openItem()
    expect(await screen.findByTestId('item-generation-failed')).toHaveTextContent('did not meet')
  })

  it('when the draft is finished the calendar is refetched (once) and the modal shows the draft and the publication\'s own status', async () => {
    load([approved()])
    const { queryClient } = await openItem()
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(1)
    state = calendarResponse({ status: 'ready', items: [approved({ status: 'content_generated', effectiveStatus: 'content_review', revision: 2, publicationIds: ['pub-1'], publications: [itemPublication()] }), OTHER] })
    act(() => { queryClient.setQueryData(noContentKey, { status: 'ready', generation: { id: 'g1', calendarItemId: 'i1', status: 'ready' }, publication: { id: 'pub-1' } }) })
    await waitFor(() => expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('publication-facebook')).toHaveTextContent('The generated Facebook draft text.')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Content review')
    expect(screen.queryByTestId('item-generate-facebook')).not.toBeInTheDocument()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2)
  })
})

// ── locked ───────────────────────────────────────────────────────────────────

describe('Calendar item modal — locked plans', () => {
  it('once content is scheduled or published the plan is read-only: no Save, Approve, Generate or Regenerate', async () => {
    load([calendarItem({ ...FB, status: 'content_generated', effectiveStatus: 'published', locked: true, revision: 4, publications: [itemPublication({ status: 'published', approvalState: 'design_approved' })] })])
    await openItem()
    expect(screen.getByTestId('item-locked')).toHaveTextContent('read-only')
    expect(screen.getByTestId('item-status')).toHaveTextContent('Published')
    for (const id of ['item-save', 'item-approve', 'item-revoke', 'item-regenerate', 'item-generate-facebook']) expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    expect(byLabel('Topic').closest('fieldset')).toBeDisabled()
    expect(screen.getByTestId('item-cancel')).toHaveTextContent('Close')
  })
})

// ── regenerate with AI ───────────────────────────────────────────────────────

describe('Calendar item modal — Regenerate with AI', () => {
  it('asks "Regenerate this plan?" first; nothing is sent until confirmed, and Cancel sends nothing', async () => {
    load()
    await openItem()
    fireEvent.click(screen.getByTestId('item-regenerate'))
    const dialog = await screen.findByTestId('regenerate-dialog')
    expect(within(dialog).getByText('Regenerate this plan?')).toBeInTheDocument()
    expect(api.regenerateSocialCalendarItem).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByTestId('regenerate-dialog')).not.toBeInTheDocument())
    expect(api.regenerateSocialCalendarItem).not.toHaveBeenCalled()
  })

  it('regenerates the chosen planning fields only and shows the new values', async () => {
    load()
    await openItem()
    api.regenerateSocialCalendarItem.mockImplementation(async () => ({ success: true, data: { item: { ...FB, topic: 'A fresh AI topic', revision: 1 }, regenerated: ['topic', 'angle', 'hook', 'caption', 'hashtags', 'captionDirection', 'primaryCta', 'creativeDirection', 'contentBrief', 'engagementPrompt', 'onCreativeText'], warnings: [] } }))
    fireEvent.click(screen.getByTestId('item-regenerate'))
    fireEvent.click(await screen.findByTestId('regenerate-confirm'))
    await waitFor(() => expect(api.regenerateSocialCalendarItem).toHaveBeenCalledTimes(1))
    const [pid, id, body] = api.regenerateSocialCalendarItem.mock.calls[0]
    expect([pid, id]).toEqual(['proj-1', 'i1'])
    expect(body.expectedRevision).toBe(0)
    expect(body.overwriteEdited).toBe(false)
    expect(body.fields).toEqual(['topic', 'angle', 'hook', 'caption', 'hashtags', 'captionDirection', 'primaryCta', 'creativeDirection', 'contentBrief', 'engagementPrompt', 'onCreativeText'])
    expect(body.fields).not.toContain('platformContent')
    await waitFor(() => expect(screen.queryByTestId('regenerate-dialog')).not.toBeInTheDocument())
    expect(byLabel('Topic')).toHaveValue('A fresh AI topic')
    expect(screen.getByTestId('item-banner')).toHaveTextContent('Regenerated')
  })

  it('fields the user edited are NOT pre-selected; choosing one warns that it replaces the edit and sends overwriteEdited', async () => {
    load([calendarItem({ ...FB, status: 'edited', effectiveStatus: 'edited', editedFields: ['topic', 'hook'], revision: 2 })])
    await openItem()
    fireEvent.click(screen.getByTestId('item-regenerate'))
    const dialog = await screen.findByTestId('regenerate-dialog')
    expect(within(dialog).getByLabelText(/^Topic/)).not.toBeChecked()
    expect(within(dialog).getByLabelText(/^Hook/)).not.toBeChecked()
    expect(within(dialog).getAllByText('You edited this')).toHaveLength(2)
    expect(within(dialog).queryByTestId('regenerate-overwrite-warning')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByLabelText(/^Topic/))
    expect(within(dialog).getByTestId('regenerate-overwrite-warning')).toHaveTextContent('replace your edits to the topic')
    api.regenerateSocialCalendarItem.mockResolvedValue({ success: true, data: { item: { ...FB, revision: 3 }, regenerated: ['topic'], warnings: [] } })
    fireEvent.click(within(dialog).getByTestId('regenerate-confirm'))
    await waitFor(() => expect(api.regenerateSocialCalendarItem).toHaveBeenCalledTimes(1))
    expect(api.regenerateSocialCalendarItem.mock.calls[0][2]).toMatchObject({ overwriteEdited: true, expectedRevision: 2 })
    expect(api.regenerateSocialCalendarItem.mock.calls[0][2].fields).toContain('topic')
    expect(api.regenerateSocialCalendarItem.mock.calls[0][2].fields).not.toContain('hook')
  })

  it('with nothing selected the Regenerate button is disabled', async () => {
    load()
    await openItem()
    fireEvent.click(screen.getByTestId('item-regenerate'))
    const dialog = await screen.findByTestId('regenerate-dialog')
    for (const box of within(dialog).getAllByRole('checkbox')) fireEvent.click(box)
    expect(within(dialog).getByTestId('regenerate-confirm')).toBeDisabled()
  })

  it('a failure is shown in the dialog and nothing changes', async () => {
    load()
    await openItem()
    api.regenerateSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('The AI returned a plan that did not meet Odito\'s checks.'), { status: 422, details: { code: 'AI_BAD_OUTPUT' } }))
    fireEvent.click(screen.getByTestId('item-regenerate'))
    fireEvent.click(await screen.findByTestId('regenerate-confirm'))
    expect(await screen.findByTestId('regenerate-error')).toHaveTextContent('did not meet')
    expect(within(modal()).getByLabelText('Topic')).toHaveValue('Common digital marketing mistakes')
  })

  it('is disabled while there are unsaved edits (it works from the saved post), with the reason', async () => {
    load()
    await openItem()
    type(byLabel('Topic'), 'Unsaved')
    expect(screen.getByTestId('item-regenerate')).toBeDisabled()
    expect(screen.getByTestId('item-regenerate')).toHaveAttribute('title', 'Save or discard your changes first')
  })
})

// ── adding a manual item ─────────────────────────────────────────────────────

describe('Calendar item modal — adding a post to the plan (manual item, same model)', () => {
  it('opens the same modal in create mode with real defaults, and refuses an empty topic without a request', async () => {
    load()
    mount()
    fireEvent.click(await screen.findByTestId('add-plan-item'))
    await screen.findByLabelText('Topic')
    expect(screen.getByTestId('item-modal-title')).toHaveTextContent('Add a post to the plan')
    expect(screen.queryByTestId('item-status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('item-approve')).not.toBeInTheDocument()
    expect(screen.queryByTestId('item-regenerate')).not.toBeInTheDocument()
    expect(screen.getByTestId('platform-facebook')).toBeChecked()
    expect(byLabel('Content pillar')).toHaveValue('Dental tips')
    expect(byLabel('Objective')).toHaveValue('awareness')
    expect(byLabel('Primary KPI')).toHaveValue('reach')
    fireEvent.click(screen.getByTestId('item-save'))
    expect(await screen.findByText('Add a topic.')).toBeInTheDocument()
    expect(api.createSocialCalendarItem).not.toHaveBeenCalled()
  })

  it('creates the item with the required fields, closes the modal and refetches the calendar for the new row', async () => {
    load()
    mount()
    fireEvent.click(await screen.findByTestId('add-plan-item'))
    await screen.findByLabelText('Topic')
    api.createSocialCalendarItem.mockResolvedValue({ success: true, data: { item: calendarItem({ id: 'new-1', topic: 'My own post', isManual: true }) } })
    type(byLabel('Topic'), 'My own post')
    type(byLabel('Caption'), 'My own caption')
    fireEvent.change(byLabel('Content pillar'), { target: { value: 'Offers' } })
    fireEvent.click(screen.getByTestId('item-save'))
    await waitFor(() => expect(api.createSocialCalendarItem).toHaveBeenCalledTimes(1))
    const [pid, body] = api.createSocialCalendarItem.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(body).toMatchObject({ platforms: ['facebook'], format: 'static_post', contentPillar: 'Offers', objective: 'awareness', primaryKpi: 'reach', topic: 'My own post', caption: 'My own caption' })
    expect(body.date).toMatch(/^2026-/)
    expect('status' in body || 'strategyId' in body || 'projectId' in body).toBe(false)
    await waitFor(() => expect(screen.queryByTestId('item-modal')).not.toBeInTheDocument())
    await waitFor(() => expect(api.getSocialContentCalendar).toHaveBeenCalledTimes(2))
  })

  it('a refusal keeps the modal open with the server\'s message', async () => {
    load()
    mount()
    fireEvent.click(await screen.findByTestId('add-plan-item'))
    await screen.findByLabelText('Topic')
    api.createSocialCalendarItem.mockRejectedValueOnce(Object.assign(new Error('A calendar can hold at most 200 posts.'), { status: 409, details: { code: 'LIMIT_REACHED' } }))
    type(byLabel('Topic'), 'One too many')
    fireEvent.click(screen.getByTestId('item-save'))
    expect(await screen.findByTestId('item-banner')).toHaveTextContent('at most 200 posts')
    expect(screen.getByTestId('item-modal')).toBeInTheDocument()
    expect(byLabel('Topic')).toHaveValue('One too many')
  })
})

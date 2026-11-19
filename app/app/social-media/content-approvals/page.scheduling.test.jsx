import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import {
  renderWithClient, managedPublication, approvalBlock, installPublicationsApi, statusResponse, ACTIVE_FACEBOOK, ACTIVE_INSTAGRAM, apiError,
} from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({
  getSocialAccountsStatus: vi.fn(),
  getSocialPublications: vi.fn(),
  getSocialApprovalSettings: vi.fn(),
  submitSocialContentForReview: vi.fn(),
  approveSocialContent: vi.fn(),
  requestSocialContentChanges: vi.fn(),
  submitSocialDesignForReview: vi.fn(),
  approveSocialDesign: vi.fn(),
  requestSocialDesignChanges: vi.fn(),
  updateSocialPublication: vi.fn(),
  scheduleSocialPublication: vi.fn(),
  uploadSocialMedia: vi.fn(),
  getSocialAIDesignStatus: vi.fn(),
  generateSocialAIDesign: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

let searchParams = new URLSearchParams('tab=approved')
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/app/social-media/content-approvals',
}))
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: { _id: 'proj-1', project_name: 'Acme' }, activeProjectId: 'proj-1', projects: [{ _id: 'proj-1', project_name: 'Acme' }], setActiveProject: vi.fn() }),
}))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import ContentApprovalsPage from './page'
import { useScheduledPosts, useCalendarPosts } from '@/hooks/useSocialMediaAI'

let store

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  searchParams = new URLSearchParams('tab=approved')
  api.getSocialAccountsStatus.mockResolvedValue(statusResponse({ facebook: ACTIVE_FACEBOOK, instagram: ACTIVE_INSTAGRAM }))
  api.getSocialApprovalSettings.mockResolvedValue({ success: true, data: { settings: { contentApprovalRequired: true, designApprovalRequired: true } } })
  api.getSocialAIDesignStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
})

const seed = (rows) => { store = installPublicationsApi(api, rows); return store }
const renderPage = () => renderWithClient(<ContentApprovalsPage />)
const row = (id) => store.rows.find((r) => r.id === id)
function setRow(id, patch) {
  store.rows = store.rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
  return { success: true, data: { publication: row(id) } }
}
const scheduledResponse = (id, scheduledAt, timezone) => setRow(id, { status: 'scheduled', scheduledAt, timezone, approval: approvalBlock('design_approved', {}, 'scheduled') })

/** Stands in for the Scheduled Posts + Calendar screens: the REAL hooks they use, on the same QueryClient. */
function ScheduleViews() {
  const scheduled = useScheduledPosts('proj-1')
  const calendar = useCalendarPosts('proj-1', { from: '2099-03-01', to: '2099-03-31' })
  return (
    <div>
      <span data-testid="views-scheduled">{scheduled.posts.map((p) => p.id).join(',')}</span>
      <span data-testid="views-calendar">{calendar.posts.map((p) => p.id).join(',')}</span>
    </div>
  )
}

const openSchedule = async (id) => {
  await screen.findByTestId(`approval-post-${id}`)
  fireEvent.click(screen.getByTestId('action-schedule'))
  fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2099-03-10' } })
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:00' } })
}
const MEDIA = [{ url: 'http://localhost:5000/storage/social_media/p/a.jpg', type: 'image' }]

describe('Content Approvals - scheduling a design-approved post', () => {
  it('Schedule is offered ONLY for an approved draft: not for content-approved, and not once already scheduled', async () => {
    seed([
      managedPublication('design_approved', { id: 'ready' }),
      managedPublication('content_approved', { id: 'ca' }),
      managedPublication('design_approved', { id: 'sch', status: 'scheduled' }),
    ])
    renderPage()
    await screen.findByTestId('approval-post-ready')
    fireEvent.click(screen.getByTestId('approval-post-ready'))
    expect(screen.getByTestId('action-schedule')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('approval-post-ca'))
    expect(screen.queryByTestId('action-schedule')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('approval-post-sch'))
    expect(screen.queryByTestId('action-schedule')).not.toBeInTheDocument()
  })

  it('an approved Instagram draft WITHOUT media is not offered Schedule and the reason is shown; with media it is offered', async () => {
    seed([managedPublication('design_approved', { id: 'ig-bare', platform: 'instagram', media: [] })])
    const first = renderPage()
    await screen.findByTestId('approval-post-ig-bare')
    expect(screen.queryByTestId('action-schedule')).not.toBeInTheDocument()
    expect(screen.getByTestId('schedule-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('approval-action-bar')).toHaveTextContent('Instagram posts need an image or video')
    first.unmount()

    seed([managedPublication('design_approved', { id: 'ig-ok', platform: 'instagram', media: MEDIA })])
    renderPage()
    await screen.findByTestId('approval-post-ig-ok')
    expect(screen.getByTestId('action-schedule')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-blocked')).not.toBeInTheDocument()
  })

  it('an unscheduled post says which fields are missing, and Confirm turns on only once both date and time are set', async () => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    renderPage()
    await screen.findByTestId('approval-post-r1')
    fireEvent.click(screen.getByTestId('action-schedule'))
    const confirm = await screen.findByRole('button', { name: 'Confirm schedule' })
    expect(confirm).toBeDisabled()
    expect(screen.getByTestId('schedule-hint')).toHaveTextContent('Pick a date and time to schedule this post.')
    expect(confirm).toHaveAttribute('aria-describedby', 'schedule-hint')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2099-03-10' } })
    expect(confirm).toBeDisabled()
    expect(screen.getByTestId('schedule-hint')).toHaveTextContent('Pick a time to schedule this post.')
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:00' } })
    expect(confirm).toBeEnabled()
    expect(screen.queryByTestId('schedule-hint')).not.toBeInTheDocument()
    expect(screen.queryByText(/to reschedule/)).not.toBeInTheDocument()
  })

  it('a Facebook text post (no media) can still be scheduled', async () => {
    seed([managedPublication('design_approved', { id: 'fb', platform: 'facebook', media: [] })])
    renderPage()
    await screen.findByTestId('approval-post-fb')
    expect(screen.getByTestId('action-schedule')).toBeInTheDocument()
  })

  it('sends only the instant (UTC, explicit offset) and the zone - no state, versions, account or platform', async () => {
    seed([managedPublication('design_approved', { id: 'r1' }, { contentVersion: 3, designVersion: 2 })])
    api.scheduleSocialPublication.mockImplementation(async (pid, id, scheduledAt, timezone) => scheduledResponse(id, scheduledAt, timezone))
    renderPage()
    await openSchedule('r1')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))
    await waitFor(() => expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1))
    const args = api.scheduleSocialPublication.mock.calls[0]
    expect(args).toHaveLength(4)
    expect(args[0]).toBe('proj-1')
    expect(args[1]).toBe('r1')
    expect(args[2]).toMatch(/^2099-03-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/)
    expect(typeof args[3]).toBe('string')
  })

  it('a fast double-click on Confirm sends ONE request', async () => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    let resolve
    api.scheduleSocialPublication.mockReturnValue(new Promise((r) => { resolve = r }))
    renderPage()
    await openSchedule('r1')
    const confirm = screen.getByRole('button', { name: 'Confirm schedule' })
    fireEvent.click(confirm); fireEvent.click(confirm); fireEvent.click(confirm)
    await waitFor(() => expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1))
    fireEvent.click(confirm)
    expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1)
    resolve(scheduledResponse('r1', '2099-03-10T04:30:00.000Z', 'UTC'))
  })

  it('three Confirm clicks in the SAME tick (before any re-render) still send ONE request', async () => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    let resolve
    api.scheduleSocialPublication.mockReturnValue(new Promise((r) => { resolve = r }))
    renderPage()
    await openSchedule('r1')
    const confirm = screen.getByRole('button', { name: 'Confirm schedule' })
    act(() => { confirm.click(); confirm.click(); confirm.click() })
    await waitFor(() => expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1))
    await act(async () => { resolve(scheduledResponse('r1', '2099-03-10T04:30:00.000Z', 'UTC')) })
    expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1)
  })

  it('the mapper only marks a post schedulable when it is a draft that is fully approved (and, for Instagram, has media)', async () => {
    const { mapPublicationToApprovalPost } = await import('@/lib/socialMedia/postMapper')
    const can = (state, over = {}) => mapPublicationToApprovalPost(managedPublication(state, over)).canSchedule
    expect(can('design_approved')).toBe(true)
    for (const s of ['content_review', 'content_approved', 'design_review']) expect(can(s)).toBe(false)
    expect(can('design_approved', { status: 'scheduled' })).toBe(false)
    expect(can('design_approved', { platform: 'instagram', media: [] })).toBe(false)
    expect(can('design_approved', { platform: 'instagram', media: MEDIA })).toBe(true)
  })

  it.each([
    ['SCHEDULE_IN_PAST', 400, 'scheduledAt must be in the future. Pick a later time, or use Publish Now to post immediately.'],
    ['INVALID_SCHEDULE', 400, 'scheduledAt is not a valid date.'],
    ['INVALID_TIMEZONE', 400, 'timezone must be a valid IANA timezone name such as "Asia/Kolkata".'],
    ['MEDIA_REQUIRED', 409, 'Instagram posts need an image or video. Add or generate a design before scheduling.'],
    ['ACCOUNT_RECONNECT_REQUIRED', 409, 'That account\'s connection has expired - reconnect it to continue.'],
    ['NOT_EDITABLE', 409, 'A published publication cannot be scheduled.'],
  ])('a server refusal (%s) is shown verbatim in the panel and the post stays unscheduled', async (code, status, message) => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    api.scheduleSocialPublication.mockRejectedValue(apiError(message, { status, code }))
    renderPage()
    await openSchedule('r1')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(row('r1').status).toBe('draft')
    expect(screen.queryByText('Post scheduled.')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm schedule' })).toBeEnabled())
  })

  it('an unparseable date never reaches the server (client message), and the date picker has a minimum day', async () => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    renderPage()
    await openSchedule('r1')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    const confirm = screen.getByRole('button', { name: 'Confirm schedule' })
    expect(confirm).toBeDisabled()
    expect(screen.getByTestId('schedule-hint')).toHaveTextContent('Pick a date to schedule this post.')
    fireEvent.click(confirm)
    expect(api.scheduleSocialPublication).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Date')).toHaveAttribute('min')
  })

  it('after a real schedule, Scheduled Posts, Calendar and the approvals list ALL refetch from the server - no reload, no local scheduled state', async () => {
    seed([managedPublication('design_approved', { id: 'r1' })])
    api.scheduleSocialPublication.mockImplementation(async (pid, id, scheduledAt, timezone) => scheduledResponse(id, scheduledAt, timezone))
    renderWithClient(<><ContentApprovalsPage /><ScheduleViews /></>)
    await screen.findByTestId('approval-post-r1')
    expect(screen.getByTestId('views-scheduled').textContent).toBe('')
    expect(screen.getByTestId('views-calendar').textContent).toBe('')

    fireEvent.click(screen.getByTestId('action-schedule'))
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2099-03-10' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))

    await waitFor(() => expect(screen.getByTestId('views-scheduled')).toHaveTextContent('r1'))
    await waitFor(() => expect(screen.getByTestId('views-calendar')).toHaveTextContent('r1'))
    await waitFor(() => expect(screen.getByTestId('approval-badge')).toHaveTextContent('Approved · scheduled'))
  })

  it('a refresh keeps it scheduled: a freshly mounted page reads the stored scheduled post from the server', async () => {
    seed([managedPublication('design_approved', { id: 'r1', status: 'scheduled', scheduledAt: '2099-03-10T04:30:00.000Z', timezone: 'UTC' })])
    renderPage()
    await screen.findByTestId('approval-post-r1')
    expect(screen.getByTestId('approval-badge')).toHaveTextContent('Approved · scheduled')
    expect(screen.queryByTestId('action-schedule')).not.toBeInTheDocument()
  })
})

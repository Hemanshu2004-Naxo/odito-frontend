import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import {
  renderWithClient, publication, managedPublication, installPublicationsApi, statusResponse, ACTIVE_FACEBOOK, ACTIVE_INSTAGRAM, EXPIRED, apiError,
} from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({
  getSocialAccountsStatus: vi.fn(),
  getSocialPublications: vi.fn(),
  getMetaConnectUrl: vi.fn(),
  scheduleSocialPublication: vi.fn(),
  updateSocialPublication: vi.fn(),
  cancelSocialPublication: vi.fn(),
  deleteSocialPublication: vi.fn(),
  publishSocialPublication: vi.fn(),
  createSocialPublication: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

let searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/app/social-media/scheduled-posts',
}))
let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: project ? [project] : [], setActiveProject: vi.fn() }),
}))
vi.mock('@/components/ui/dropdown-menu', async () => (await import('@/test-utils/socialMediaAI')).dropdownMenuMock())
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import ScheduledPostsPage from './page'

let assign
let store

beforeEach(() => {
  vi.clearAllMocks()
  searchParams = new URLSearchParams()
  project = { _id: 'proj-1', project_name: 'Acme' }
  assign = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { ...window.location, assign } })
  api.getSocialAccountsStatus.mockResolvedValue(statusResponse({ facebook: ACTIVE_FACEBOOK, instagram: ACTIVE_INSTAGRAM }))
})

const seed = (rows) => { store = installPublicationsApi(api, rows); return store }
const renderPage = () => renderWithClient(<ScheduledPostsPage />)
const card = (id) => screen.getByTestId(`post-${id}`)
const tab = (name) => screen.getByRole('button', { name: new RegExp(`^${name} \\(`) })
const KOLKATA_10AM = '2099-03-10T04:30:00.000Z' // 10:00 AM Asia/Kolkata on 2099-03-10

describe('Scheduled Posts — real data', () => {
  it('LOADING: skeleton rows (not a blank screen) and unknown tab counts until the backend answers', async () => {
    api.getSocialPublications.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(await screen.findByTestId('posts-loading')).toBeInTheDocument()
    expect(tab('Scheduled')).toHaveTextContent('Scheduled (–)')
  })

  it('renders REAL scheduled posts in the post\'s own timezone, with counts from the backend and no fabricated approval badges', async () => {
    seed([
      publication({ id: 'a', content: 'Launch day\nFree audit for every new client', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', platform: 'facebook' }),
      publication({ id: 'b', content: 'Second post', scheduledAt: '2099-03-11T09:00:00.000Z', timezone: 'UTC', platform: 'instagram', socialAccountId: 'acc-ig-1' }),
      publication({ id: 'p', status: 'published', publishedAt: '2099-01-01T00:00:00Z', content: 'Old one' }),
      publication({ id: 'f', status: 'failed', failureCode: 'FACEBOOK_PUBLISH_FAILED', failureReason: 'Meta rejected this post.' }),
    ])
    renderPage()
    await waitFor(() => expect(card('a')).toBeInTheDocument())
    expect(within(card('a')).getByText('Launch day')).toBeInTheDocument()
    expect(within(card('a')).getByText('Free audit for every new client')).toBeInTheDocument()
    expect(within(card('a')).getByText(/10:00 AM/)).toBeInTheDocument()
    expect(within(card('a')).getByText('Scheduled')).toBeInTheDocument()
    expect(card('b')).toBeInTheDocument()
    expect(tab('Scheduled')).toHaveTextContent('Scheduled (2)')
    expect(tab('Published')).toHaveTextContent('Published (1)')
    expect(tab('Failed')).toHaveTextContent('Failed (1)')
    expect(screen.queryByText(/Content approved|Design approved/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sapphire/)).not.toBeInTheDocument()
  })

  it('PUBLISHED tab shows real published posts', async () => {
    seed([publication({ id: 'p1', status: 'published', publishedAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', content: 'We are live', externalPostId: 'x1' })])
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^Published \(/ }))
    await waitFor(() => expect(card('p1')).toBeInTheDocument())
    expect(within(card('p1')).getByText('Published')).toBeInTheDocument()
    expect(within(card('p1')).getByText('We are live')).toBeInTheDocument()
  })

  it('a post the scheduler is publishing right now shows "Publishing…" and offers no actions', async () => {
    seed([publication({ id: 'live', status: 'publishing', content: 'In flight' })])
    renderPage()
    await waitFor(() => expect(card('live')).toBeInTheDocument())
    expect(within(card('live')).getByText('Publishing…')).toBeInTheDocument()
    expect(within(card('live')).queryByLabelText('Post options')).not.toBeInTheDocument()
    expect(within(card('live')).queryByRole('button', { name: /Retry|Edit schedule/ })).not.toBeInTheDocument()
  })

  it('a scheduled post waiting for an automatic retry shows the backend\'s retry state', async () => {
    seed([publication({ id: 'r', attempts: 2, nextRetryAt: '2099-03-10T04:35:00.000Z', timezone: 'Asia/Kolkata', lastError: 'Meta is rate-limiting requests', lastErrorCode: 'FACEBOOK_RATE_LIMITED' })])
    renderPage()
    await waitFor(() => expect(card('r')).toBeInTheDocument())
    expect(within(card('r')).getByText(/Retry scheduled · attempt 2/)).toBeInTheDocument()
    expect(within(card('r')).getByText(/Next attempt .*10:05 AM/)).toBeInTheDocument()
  })

  it.each([
    ['scheduled', 'No scheduled posts'],
    ['published', 'Nothing published yet'],
    ['failed', 'No failed posts'],
  ])('EMPTY %s tab explains itself', async (name, text) => {
    seed([])
    renderPage()
    await waitFor(() => expect(screen.queryByTestId('posts-loading')).not.toBeInTheDocument())
    fireEvent.click(tab(name.charAt(0).toUpperCase() + name.slice(1)))
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('ERROR: a clear error with Try again, then recovery without a reload', async () => {
    api.getSocialPublications.mockRejectedValue(apiError('Failed to load publications', { status: 500 }))
    renderPage()
    expect(await screen.findByTestId('posts-error')).toHaveTextContent('Failed to load publications')
    seed([publication({ id: 'ok', content: 'Recovered' })])
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(card('ok')).toBeInTheDocument())
  })

  it('LONG caption and unusual content never break the row (title clamped, full text in View post)', async () => {
    const long = `${'Supercalifragilistic '.repeat(30)}`
    seed([publication({ id: 'long', content: long })])
    renderPage()
    await waitFor(() => expect(card('long')).toBeInTheDocument())
    const title = within(card('long')).getByText(/Supercalifragilistic/, { selector: 'p.font-semibold' })
    expect(title.textContent.endsWith('…')).toBe(true)
    expect(title).toHaveClass('line-clamp-2')
  })

  it('many posts are all listed (every page is fetched: 55 posts = 2 requests of up to 50)', async () => {
    const s = seed(Array.from({ length: 55 }, (_, i) => publication({ id: `m${i}`, content: `Many ${i}`, scheduledAt: `2099-03-${String((i % 28) + 1).padStart(2, '0')}T09:00:00Z` })))
    renderPage()
    await waitFor(() => expect(tab('Scheduled')).toHaveTextContent('Scheduled (55)'), { timeout: 15000 })
    await waitFor(() => expect(screen.getAllByTestId(/^post-m/)).toHaveLength(55), { timeout: 15000 })
    const scheduledPages = s.calls.filter((c) => c.filters.status === 'scheduled').map((c) => c.filters.page)
    expect(scheduledPages).toEqual(expect.arrayContaining([1, 2]))
  }, 40000)

  it('with no project: empty state and no requests', async () => {
    project = null
    renderPage()
    expect(screen.getByTestId('no-project')).toBeInTheDocument()
    expect(api.getSocialPublications).not.toHaveBeenCalled()
  })
})

describe('Scheduled Posts — failures, retry and unknown outcome (the backend decides)', () => {
  const failed = (o) => publication({ status: 'failed', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', ...o })
  const openFailed = async () => { fireEvent.click(await screen.findByRole('button', { name: /^Failed \(/ })) }

  it('RETRYABLE failure (backend canRetry): shows the reason and a Retry button', async () => {
    seed([failed({ id: 'r1', failureCode: 'FACEBOOK_RATE_LIMITED', failureReason: 'Meta is rate-limiting requests for this Page right now. Try again shortly.', canRetry: true })])
    renderPage()
    await openFailed()
    const c = await waitFor(() => card('r1'))
    expect(within(c).getByTestId('failure-info')).toHaveTextContent('rate-limiting')
    expect(within(c).getByText('Failed to publish')).toBeInTheDocument()
    expect(within(c).getAllByRole('button', { name: 'Retry' })[0]).toBeEnabled()
  })

  it('EXPIRED authentication: "Reconnect account", never Retry', async () => {
    seed([failed({ id: 'e1', failureCode: 'FACEBOOK_TOKEN_INVALID', requiresReconnect: true, canRetry: false, failureReason: 'Meta denied this request — the Facebook connection has expired or was revoked and needs to be reconnected.' })])
    renderPage()
    await openFailed()
    const c = await waitFor(() => card('e1'))
    expect(within(c).getByText('Reconnect required')).toBeInTheDocument()
    expect(within(c).getByRole('button', { name: 'Reconnect account' })).toBeInTheDocument()
    expect(within(c).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    api.getMetaConnectUrl.mockResolvedValue({ success: true, data: { url: 'https://www.facebook.com/dialog/oauth?s=1' } })
    fireEvent.click(within(c).getByRole('button', { name: 'Reconnect account' }))
    await waitFor(() => expect(api.getMetaConnectUrl).toHaveBeenCalledWith('proj-1', 'social-media', true))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.facebook.com/dialog/oauth?s=1'))
  })

  it('UNKNOWN outcome: an explanatory message and NO Retry anywhere (even if a stale canRetry slipped through)', async () => {
    seed([failed({ id: 'u1', failureCode: 'PUBLISH_OUTCOME_UNKNOWN', outcomeUnknown: true, canRetry: true, failureReason: 'Odito could not confirm whether this post was published (the attempt was interrupted). It will not be re-sent until that is verified.' })])
    renderPage()
    await openFailed()
    const c = await waitFor(() => card('u1'))
    expect(within(c).getByText('Outcome unknown')).toBeInTheDocument()
    expect(within(c).getByTestId('failure-info')).toHaveTextContent(/Check your page/)
    expect(within(c).getByTestId('failure-info')).toHaveTextContent(/will not be re-sent/)
    expect(within(c).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(c).queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByText('Retry')).not.toBeInTheDocument() // not in the menu either
  })

  it('a permanent / invalid-media failure (canRetry false) shows the real reason and no Retry', async () => {
    seed([failed({ id: 'm1', platform: 'instagram', failureCode: 'INSTAGRAM_MEDIA_INVALID', canRetry: false, failureReason: 'Instagram could not process this media — the file may be corrupt.' })])
    renderPage()
    await openFailed()
    const c = await waitFor(() => card('m1'))
    expect(within(c).getByTestId('failure-info')).toHaveTextContent('Instagram could not process this media')
    expect(within(c).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('a missed schedule is explained; Retry is offered only because the backend allows it', async () => {
    seed([failed({ id: 's1', failureCode: 'SCHEDULE_MISSED', canRetry: true, failureReason: 'This post was not published automatically because it was more than 60 minutes past its scheduled time.' })])
    renderPage()
    await openFailed()
    const c = await waitFor(() => card('s1'))
    expect(within(c).getByText('Missed schedule')).toBeInTheDocument()
    expect(within(c).getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0)
  })

  it('Retry calls the backend publish endpoint; a Meta rejection (200 + publishError) is shown and the post is re-read from the DB', async () => {
    seed([failed({ id: 'r2', failureCode: 'FACEBOOK_RATE_LIMITED', canRetry: true })])
    api.publishSocialPublication.mockResolvedValue({ success: true, data: { publication: {}, publishError: { code: 'FACEBOOK_RATE_LIMITED', message: 'Meta is rate-limiting requests for this Page right now. Try again shortly.' } } })
    renderPage()
    await openFailed()
    const calls = api.getSocialPublications.mock.calls.length
    fireEvent.click(within(await waitFor(() => card('r2'))).getAllByRole('button', { name: 'Retry' })[0])
    await waitFor(() => expect(api.publishSocialPublication).toHaveBeenCalledWith('proj-1', 'r2'))
    expect(await screen.findByText(/rate-limiting requests for this Page/, { selector: 'div' })).toBeInTheDocument()
    await waitFor(() => expect(api.getSocialPublications.mock.calls.length).toBeGreaterThan(calls))
    expect(screen.queryByText('Post published.')).not.toBeInTheDocument()
  })

  it('a successful Retry moves the post to Published after the refetch (no reload)', async () => {
    seed([failed({ id: 'r3', failureCode: 'FACEBOOK_RATE_LIMITED', canRetry: true })])
    api.publishSocialPublication.mockImplementation(async (_p, id) => {
      store.rows = store.rows.map((r) => (r.id === id ? { ...r, status: 'published', publishedAt: '2099-03-10T05:00:00Z', failureCode: null, canRetry: false } : r))
      return { success: true, data: { publication: {} } }
    })
    renderPage()
    await openFailed()
    fireEvent.click(within(await waitFor(() => card('r3'))).getAllByRole('button', { name: 'Retry' })[0])
    expect(await screen.findByText('Post published.')).toBeInTheDocument()
    await waitFor(() => expect(tab('Failed')).toHaveTextContent('Failed (0)'))
    expect(tab('Published')).toHaveTextContent('Published (1)')
  })

  it('a backend REFUSAL of a retry (409 reconciliation pending) shows the backend\'s own message', async () => {
    seed([failed({ id: 'r4', failureCode: 'FACEBOOK_RATE_LIMITED', canRetry: true })])
    api.publishSocialPublication.mockRejectedValue(apiError('Odito is still verifying whether the previous attempt already published this post. Please try again in a few minutes.', { code: 'RECONCILIATION_PENDING', status: 409 }))
    renderPage()
    await openFailed()
    fireEvent.click(within(await waitFor(() => card('r4'))).getAllByRole('button', { name: 'Retry' })[0])
    expect(await screen.findByText(/still verifying whether the previous attempt already published/)).toBeInTheDocument()
  })

  it('Discard asks for confirmation, then deletes through the backend', async () => {
    seed([failed({ id: 'd1', failureCode: 'FACEBOOK_PUBLISH_FAILED', canRetry: false })])
    api.deleteSocialPublication.mockImplementation(async (_p, id) => { store.rows = store.rows.filter((r) => r.id !== id); return { success: true } })
    renderPage()
    await openFailed()
    fireEvent.click(within(await waitFor(() => card('d1'))).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByText('Discard this post?')).toBeInTheDocument()
    expect(api.deleteSocialPublication).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Discard' }).find((b) => b.closest('[role="dialog"]')))
    await waitFor(() => expect(api.deleteSocialPublication).toHaveBeenCalledWith('proj-1', 'd1', { historyOnly: false }))
    await waitFor(() => expect(tab('Failed')).toHaveTextContent('Failed (0)'))
  })

  it('discarding an UNKNOWN-outcome post warns to check the page first', async () => {
    seed([failed({ id: 'd2', failureCode: 'PUBLISH_OUTCOME_UNKNOWN', outcomeUnknown: true })])
    renderPage()
    await openFailed()
    fireEvent.click(within(await waitFor(() => card('d2'))).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByText(/Only discard this if you have checked your page/)).toBeInTheDocument()
  })
})

describe('Scheduled Posts — schedule / reschedule / cancel / duplicate / view', () => {
  const open = async (id) => { await waitFor(() => expect(card(id)).toBeInTheDocument()) }

  it('the Confirm schedule panel is pre-filled from the real post, and Confirm is disabled until something changes', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', content: 'Edit me' })])
    renderPage()
    await open('a')
    await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue('2099-03-10'))
    expect(screen.getByLabelText('Time')).toHaveValue('10:00')
    expect(screen.getByRole('button', { name: 'Confirm schedule' })).toBeDisabled()
    expect(screen.getByTestId('schedule-hint')).toHaveTextContent('Change the date, time or timezone to reschedule.')
  })

  it('RESCHEDULE sends the exact UTC instant + timezone to the scheduler API, then shows the server\'s new time', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata' })])
    api.scheduleSocialPublication.mockImplementation(async (_p, id, scheduledAt, timezone) => {
      store.rows = store.rows.map((r) => (r.id === id ? { ...r, scheduledAt, timezone } : r))
      return { success: true, data: { publication: {} } }
    })
    renderPage()
    await open('a')
    await waitFor(() => expect(screen.getByLabelText('Time')).toHaveValue('10:00'))
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '11:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))
    await waitFor(() => expect(api.scheduleSocialPublication).toHaveBeenCalledWith('proj-1', 'a', '2099-03-10T06:00:00.000Z', 'Asia/Kolkata'))
    expect(await screen.findByText('Schedule updated.')).toBeInTheDocument()
    await waitFor(() => expect(within(card('a')).getByText(/11:30 AM/)).toBeInTheDocument())
  })

  it('a backend validation error (past date) is shown in the panel, the schedule is unchanged, and the list is re-read', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata' })])
    api.scheduleSocialPublication.mockRejectedValue(apiError('scheduledAt must be in the future. Pick a later time, or use Publish Now to post immediately.', { code: 'SCHEDULE_IN_PAST', status: 400 }))
    renderPage()
    await open('a')
    await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue('2099-03-10'))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2020-01-01' } })
    const calls = api.getSocialPublications.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('must be in the future')
    expect(within(card('a')).getByText(/10:00 AM/)).toBeInTheDocument()
    await waitFor(() => expect(api.getSocialPublications.mock.calls.length).toBeGreaterThan(calls))
  })

  it('the Confirm button is disabled while the request is in flight (no duplicate submissions)', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata' })])
    api.scheduleSocialPublication.mockReturnValue(new Promise(() => {}))
    renderPage()
    await open('a')
    await waitFor(() => expect(screen.getByLabelText('Time')).toHaveValue('10:00'))
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '12:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm schedule' }))
    const busy = await screen.findByRole('button', { name: 'Confirming…' })
    expect(busy).toBeDisabled()
    fireEvent.click(busy)
    expect(api.scheduleSocialPublication).toHaveBeenCalledTimes(1)
  })

  it('an invalid date/time never reaches the backend (UX validation only)', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata' })])
    renderPage()
    await open('a')
    await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue('2099-03-10'))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } })
    const confirm = screen.getByRole('button', { name: 'Confirm schedule' })
    expect(confirm).toBeDisabled()
    expect(screen.getByTestId('schedule-hint')).toHaveTextContent('Pick a date to schedule this post.')
    fireEvent.click(confirm)
    expect(api.scheduleSocialPublication).not.toHaveBeenCalled()
  })

  it('SAVE FOR LATER clears the schedule via PATCH (scheduledAt:null) and the post leaves the Scheduled list', async () => {
    seed([publication({ id: 'a', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata' })])
    api.updateSocialPublication.mockImplementation(async (_p, id) => { store.rows = store.rows.map((r) => (r.id === id ? { ...r, status: 'draft', scheduledAt: null } : r)); return { success: true } })
    renderPage()
    await open('a')
    fireEvent.click(await screen.findByRole('button', { name: 'Save for later' }))
    await waitFor(() => expect(api.updateSocialPublication).toHaveBeenCalledWith('proj-1', 'a', { scheduledAt: null }))
    expect(await screen.findByText(/Moved to drafts/)).toBeInTheDocument()
    await waitFor(() => expect(tab('Scheduled')).toHaveTextContent('Scheduled (0)'))
  })

  it('CANCEL asks first, calls POST /cancel, and the post disappears from the refetched list', async () => {
    seed([publication({ id: 'a' }), publication({ id: 'b', content: 'Keep me', scheduledAt: '2099-03-12T09:00:00Z' })])
    api.cancelSocialPublication.mockImplementation(async (_p, id) => { store.rows = store.rows.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)); return { success: true } })
    renderPage()
    await open('a')
    fireEvent.click(within(card('a')).getByRole('button', { name: 'Cancel schedule' }))
    expect(await screen.findByText('Cancel this schedule?')).toBeInTheDocument()
    expect(api.cancelSocialPublication).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel schedule' }).find((b) => b.closest('[role="dialog"]')))
    await waitFor(() => expect(api.cancelSocialPublication).toHaveBeenCalledWith('proj-1', 'a'))
    await waitFor(() => expect(screen.queryByTestId('post-a')).not.toBeInTheDocument())
    expect(card('b')).toBeInTheDocument()
  })

  it('cancelling a post the scheduler already took (409) shows the backend message and refreshes the real state', async () => {
    seed([publication({ id: 'a' })])
    api.cancelSocialPublication.mockImplementation(async (_p, id) => {
      store.rows = store.rows.map((r) => (r.id === id ? { ...r, status: 'published', publishedAt: '2099-03-10T04:30:05Z' } : r))
      throw apiError('That publication cannot be cancelled (it may already be published, failed, or not found).', { code: 'NOT_CANCELLABLE', status: 409 })
    })
    renderPage()
    await open('a')
    fireEvent.click(within(card('a')).getByRole('button', { name: 'Cancel schedule' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Cancel schedule' })).find((b) => b.closest('[role="dialog"]')))
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot be cancelled')
    // (an open dialog hides the page from role queries - close it, then check the refreshed truth)
    fireEvent.click(screen.getByRole('button', { name: 'Keep scheduled' }))
    await waitFor(() => expect(tab('Published')).toHaveTextContent('Published (1)'))
  })

  it('DUPLICATE creates a new draft through the API (never scheduled or published)', async () => {
    seed([publication({ id: 'a', content: 'Copy this', socialAccountId: 'acc-fb-1', media: [{ url: 'https://cdn.example.com/a.jpg', type: 'image' }] })])
    api.createSocialPublication.mockResolvedValue({ success: true })
    renderPage()
    await open('a')
    fireEvent.click(within(card('a')).getByRole('button', { name: 'Duplicate' }))
    await waitFor(() => expect(api.createSocialPublication).toHaveBeenCalled())
    const [pid, body] = api.createSocialPublication.mock.calls[0]
    expect(pid).toBe('proj-1')
    expect(body).toMatchObject({ platform: 'facebook', socialAccountId: 'acc-fb-1', content: 'Copy this', media: [{ url: 'https://cdn.example.com/a.jpg', type: 'image' }] })
    expect(body).not.toHaveProperty('scheduledAt')
    expect(body).not.toHaveProperty('publishNow')
    expect(await screen.findByText(/Duplicated as a draft/)).toBeInTheDocument()
  })

  it('View post shows the full real caption', async () => {
    seed([publication({ id: 'a', content: 'Line one\nLine two with the whole story' })])
    renderPage()
    await open('a')
    fireEvent.click(within(card('a')).getByRole('button', { name: 'View post' }))
    expect((await screen.findByTestId('post-view-content')).textContent).toBe('Line one\nLine two with the whole story')
  })

  it('deep link ?post=<id> opens the tab that contains the post and selects it', async () => {
    searchParams = new URLSearchParams('post=f1')
    seed([publication({ id: 'f1', status: 'failed', failureCode: 'FACEBOOK_PUBLISH_FAILED', content: 'Deep linked' }), publication({ id: 's1' })])
    renderPage()
    await waitFor(() => expect(card('f1')).toBeInTheDocument())
    expect(tab('Failed')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Scheduled Posts — connection state is shared with Connect Accounts', () => {
  it('an EXPIRED Instagram shows the real warning + per-post badge, and Reconnect starts the real OAuth flow', async () => {
    api.getSocialAccountsStatus.mockResolvedValue(statusResponse({ facebook: ACTIVE_FACEBOOK, instagram: EXPIRED('acme_ig') }))
    seed([publication({ id: 'ig1', platform: 'instagram', socialAccountId: 'acc-ig-1' }), publication({ id: 'fb1' })])
    api.getMetaConnectUrl.mockResolvedValue({ success: true, data: { url: 'https://www.facebook.com/dialog/oauth?z=1' } })
    renderPage()
    const warning = await screen.findByTestId('connection-warning')
    expect(warning).toHaveTextContent('1 scheduled post needs attention')
    expect(warning).toHaveTextContent('Instagram connection expired')
    expect(within(card('ig1')).getByText('Reconnect required')).toBeInTheDocument()
    expect(within(card('fb1')).queryByText('Reconnect required')).not.toBeInTheDocument()
    fireEvent.click(within(warning).getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(api.getMetaConnectUrl).toHaveBeenCalledWith('proj-1', 'social-media', true))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.facebook.com/dialog/oauth?z=1'))
  })

  it('healthy connections show no warning', async () => {
    seed([publication({ id: 'a' })])
    renderPage()
    await waitFor(() => expect(card('a')).toBeInTheDocument())
    expect(screen.queryByTestId('connection-warning')).not.toBeInTheDocument()
  })

  it('every request uses the active project id', async () => {
    seed([publication({ id: 'a' })])
    renderPage()
    await waitFor(() => expect(card('a')).toBeInTheDocument())
    for (const call of api.getSocialPublications.mock.calls) expect(call[0]).toBe('proj-1')
    for (const call of api.getSocialAccountsStatus.mock.calls) expect(call[0]).toBe('proj-1')
  })
})

describe('Scheduled Posts — content approval state (the backend decides)', () => {
  const scheduledManaged = (state, o = {}, a = {}) => managedPublication(state, { status: 'scheduled', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', ...o }, a)
  const openFailed = async () => { fireEvent.click(await screen.findByRole('button', { name: /^Failed \(/ })) }

  it('a scheduled post that is NOT fully approved says "Awaiting approval" (not a green "Scheduled") and links to the review', async () => {
    seed([scheduledManaged('content_review', { id: 'x1', content: 'Waiting on content' })])
    renderPage()
    const c = await waitFor(() => card('x1'))
    expect(within(c).getByText('Awaiting approval')).toBeInTheDocument()
    expect(within(c).getByText('Content in review')).toBeInTheDocument()
    expect(within(c).queryByText('Scheduled')).not.toBeInTheDocument()
    expect(within(c).getByTestId('awaiting-approval-note')).toHaveTextContent('will not be published until it is approved')
    expect(within(c).getByRole('link', { name: 'Review approval' })).toHaveAttribute('href', '/app/social-media/content-approvals?tab=content-review')
  })

  it('each unapproved stage is labelled from the backend state, and a design review links to the design tab', async () => {
    seed([
      scheduledManaged('content_approved', { id: 'x2', content: 'Design not sent' }),
      scheduledManaged('design_review', { id: 'x3', content: 'Design in review' }, { needsChanges: true, changesRequested: { stage: 'design', reason: 'crop', forVersion: 1 } }),
    ])
    renderPage()
    const a = await waitFor(() => card('x2'))
    expect(within(a).getByText('Content approved — design not submitted')).toBeInTheDocument()
    const b = card('x3')
    expect(within(b).getByText('Design changes requested')).toBeInTheDocument()
    expect(within(b).getByRole('link', { name: 'Review approval' })).toHaveAttribute('href', '/app/social-media/content-approvals?tab=design-review')
  })

  it('a FULLY approved scheduled post shows Scheduled + Approved; a post outside the workflow shows no approval badge at all', async () => {
    seed([
      scheduledManaged('design_approved', { id: 'ok1', content: 'All approved' }),
      publication({ id: 'legacy', content: 'Legacy post', scheduledAt: '2099-03-11T09:00:00.000Z', timezone: 'UTC' }),
    ])
    renderPage()
    const ok = await waitFor(() => card('ok1'))
    expect(within(ok).getByText('Scheduled')).toBeInTheDocument()
    expect(within(ok).getByText('Approved')).toBeInTheDocument()
    expect(within(ok).queryByTestId('awaiting-approval-note')).not.toBeInTheDocument()
    const legacy = card('legacy')
    expect(within(legacy).getByText('Scheduled')).toBeInTheDocument()
    expect(within(legacy).queryByText(/Approved|Awaiting approval/)).not.toBeInTheDocument()
  })

  it('APPROVAL_REQUIRED failure: "Approval required" + the backend\'s explanation; Retry only while the backend says canRetry', async () => {
    const failed = (o) => managedPublication('content_review', { status: 'failed', scheduledAt: KOLKATA_10AM, timezone: 'Asia/Kolkata', failureCode: 'APPROVAL_REQUIRED', failureReason: 'This post\'s content has not been approved yet.', ...o })
    seed([failed({ id: 'blocked', canRetry: false }), failed({ id: 'now-ok', canRetry: true })])
    renderPage()
    await openFailed()
    const blocked = await waitFor(() => card('blocked'))
    expect(within(blocked).getByText('Approval required')).toBeInTheDocument()
    expect(within(blocked).getByTestId('failure-info')).toHaveTextContent('not fully approved')
    expect(within(blocked).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(card('now-ok')).getAllByRole('button', { name: 'Retry' }).length).toBeGreaterThan(0)
  })
})

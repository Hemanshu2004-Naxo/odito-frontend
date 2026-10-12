import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { DateTime } from 'luxon'
import { renderWithClient, publication, managedPublication, installPublicationsApi, apiError } from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({ getSocialPublications: vi.fn(), getSocialContentCalendar: vi.fn(), getSocialContentCalendarStatus: vi.fn(), generateSocialContentCalendar: vi.fn(), getSocialAIContentStatus: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: [], setActiveProject: vi.fn() }),
}))
let mobile = false
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import ContentCalendarPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  project = { _id: 'proj-1', project_name: 'Acme' }
  mobile = false
  // the page opens on the content PLAN; these tests are about the scheduled / published view, which the helper opens
  api.getSocialAIContentStatus.mockResolvedValue({ success: true, data: { status: 'none', generation: null, publication: null } })
  api.getSocialContentCalendar.mockResolvedValue({ success: true, data: { status: 'none', calendar: null, items: [], generation: null, stale: null, strategy: { available: false }, connectedPlatforms: { facebook: false, instagram: false }, limits: { minDays: 7, maxDays: 184, minMonths: 1, maxMonths: 6, maxPostsPerWeek: 7, maxPosts: 200 } } })
})

// A day of the CURRENT week (the calendar opens on today's week), at midday UTC so the
// post's own-timezone date is the same calendar day for every runner timezone.
const weekday = (offsetDays) => DateTime.local().startOf('week').plus({ days: offsetDays }).toFormat('yyyy-LL-dd')
const at = (offsetDays, time = '12:00:00') => `${weekday(offsetDays)}T${time}.000Z`
const renderPage = () => {
  const view = renderWithClient(<ContentCalendarPage />)
  fireEvent.click(screen.getByRole('tab', { name: 'Scheduled & published' }))
  return view
}
const post = (id) => screen.getByTestId(`calendar-post-${id}`)

describe('Content Calendar — real scheduled posts', () => {
  it('LOADING: a calendar skeleton while the backend answers', () => {
    api.getSocialPublications.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument()
  })

  it('shows REAL posts of the current week with their real status, time and platform (no sample posts)', async () => {
    installPublicationsApi(api, [
      publication({ id: 'c1', content: 'Team photo day', scheduledAt: at(1), timezone: 'UTC', platform: 'facebook' }),
      publication({ id: 'c2', content: 'Reel launch', scheduledAt: at(3, '15:30:00'), timezone: 'UTC', platform: 'instagram', status: 'published', publishedAt: at(3, '15:31:00') }),
      publication({ id: 'c3', content: 'Failed one', scheduledAt: at(4), timezone: 'UTC', status: 'failed', failureCode: 'FACEBOOK_PUBLISH_FAILED' }),
    ])
    renderPage()
    await waitFor(() => expect(post('c1')).toBeInTheDocument())
    expect(within(post('c1')).getByText('Team photo day')).toBeInTheDocument()
    expect(within(post('c1')).getByText('12:00 PM')).toBeInTheDocument()
    expect(within(post('c1')).getByText('Scheduled')).toBeInTheDocument()
    expect(within(post('c2')).getByText('03:30 PM')).toBeInTheDocument()
    expect(within(post('c2')).getByText('Published')).toBeInTheDocument()
    expect(within(post('c3')).getByText('Failed')).toBeInTheDocument()
    expect(screen.queryByText(/Sapphire|Meet our team|Behind the scenes/)).not.toBeInTheDocument()
  })

  it('requests only the visible window, scoped to the active project, and again when the week changes', async () => {
    const store = installPublicationsApi(api, [])
    renderPage()
    await waitFor(() => expect(store.calls.length).toBeGreaterThan(0))
    const first = store.calls[0]
    expect(first.projectId).toBe('proj-1')
    expect(first.filters.from).toBeTruthy()
    expect(first.filters.to).toBeTruthy()
    const before = store.calls.length
    fireEvent.click(await screen.findByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(store.calls.length).toBeGreaterThan(before))
    const next = store.calls[store.calls.length - 1]
    expect(next.filters.from > first.filters.from).toBe(true)
  })

  it('only states the backend can produce are offered (publishing statuses + approval stages); there is no calendar "Draft"', async () => {
    installPublicationsApi(api, [])
    renderPage()
    await waitFor(() => expect(screen.getByText('Published')).toBeInTheDocument())
    for (const real of ['Scheduled', 'Publishing', 'Published', 'Failed', 'Content review', 'Design pending', 'Design review']) expect(screen.getAllByText(real).length).toBeGreaterThan(0)
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('APPROVAL: a scheduled post that is not fully approved shows its approval stage, not a green "Scheduled"', async () => {
    installPublicationsApi(api, [
      managedPublication('content_review', { id: 'a1', status: 'scheduled', scheduledAt: at(1), timezone: 'UTC', content: 'Needs content OK' }),
      managedPublication('content_approved', { id: 'a2', status: 'scheduled', scheduledAt: at(2), timezone: 'UTC', content: 'Needs design' }),
      managedPublication('design_review', { id: 'a3', status: 'scheduled', scheduledAt: at(3), timezone: 'UTC', content: 'Design in review' }),
      managedPublication('design_approved', { id: 'a4', status: 'scheduled', scheduledAt: at(4), timezone: 'UTC', content: 'All approved' }),
      publication({ id: 'a5', status: 'scheduled', scheduledAt: at(5), timezone: 'UTC', content: 'Legacy post' }),
    ])
    renderPage()
    await waitFor(() => expect(post('a1')).toBeInTheDocument())
    expect(within(post('a1')).getByText('Content review')).toBeInTheDocument()
    expect(within(post('a1')).queryByText('Scheduled')).not.toBeInTheDocument()
    expect(within(post('a2')).getByText('Design pending')).toBeInTheDocument()
    expect(within(post('a3')).getByText('Design review')).toBeInTheDocument()
    // fully approved and not-in-the-workflow posts are plain "Scheduled" — nothing is claimed that the backend did not say
    expect(within(post('a4')).getByText('Scheduled')).toBeInTheDocument()
    expect(within(post('a5')).getByText('Scheduled')).toBeInTheDocument()
  })

  it('unapproved DRAFTS (no schedule) are not on the calendar even when in review', async () => {
    installPublicationsApi(api, [
      managedPublication('content_review', { id: 'rev', status: 'draft' }),
      publication({ id: 'live', scheduledAt: at(1), timezone: 'UTC' }),
    ])
    renderPage()
    await waitFor(() => expect(post('live')).toBeInTheDocument())
    expect(screen.queryByTestId('calendar-post-rev')).not.toBeInTheDocument()
  })

  it('drafts and cancelled posts never appear on the calendar', async () => {
    installPublicationsApi(api, [
      publication({ id: 'live', scheduledAt: at(1), timezone: 'UTC' }),
      publication({ id: 'draft', status: 'draft', scheduledAt: null }),
      publication({ id: 'gone', status: 'cancelled', scheduledAt: at(2), timezone: 'UTC' }),
    ])
    renderPage()
    await waitFor(() => expect(post('live')).toBeInTheDocument())
    expect(screen.queryByTestId('calendar-post-draft')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-post-gone')).not.toBeInTheDocument()
  })

  it('EMPTY: says so honestly', async () => {
    installPublicationsApi(api, [])
    renderPage()
    expect(await screen.findByTestId('calendar-empty')).toHaveTextContent('No scheduled or published posts in this period.')
  })

  it('ERROR: an error with Try again that recovers', async () => {
    api.getSocialPublications.mockRejectedValue(apiError('Failed to load publications', { status: 500 }))
    renderPage()
    expect(await screen.findByTestId('posts-error')).toHaveTextContent('Failed to load publications')
    installPublicationsApi(api, [publication({ id: 'back', scheduledAt: at(2), timezone: 'UTC' })])
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(post('back')).toBeInTheDocument())
  })

  it('SELECTED post: real details (time, platform, format, caption), failure explanation, and a link to edit it in Scheduled Posts', async () => {
    installPublicationsApi(api, [
      publication({ id: 'sel', content: 'Caption of the selected post', scheduledAt: at(2), timezone: 'UTC', platform: 'instagram', media: [{ url: 'https://cdn.example.com/a.jpg', type: 'image' }] }),
      publication({ id: 'bad', content: 'Broken post', scheduledAt: at(3), timezone: 'UTC', status: 'failed', failureCode: 'FACEBOOK_TOKEN_INVALID', requiresReconnect: true, failureReason: 'Meta denied this request — reconnect.' }),
    ])
    renderPage()
    await waitFor(() => expect(post('sel')).toBeInTheDocument())
    expect(screen.queryByTestId('post-detail-panel')).not.toBeInTheDocument()
    fireEvent.click(post('sel'))
    const panel = await screen.findByTestId('post-detail-panel')
    expect(within(panel).getByText('Caption of the selected post', { selector: 'p' })).toBeInTheDocument()
    expect(within(panel).getByText('Photo')).toBeInTheDocument()
    expect(within(panel).getByText('Instagram')).toBeInTheDocument()
    expect(within(panel).queryByText(/Content pillar/i)).not.toBeInTheDocument()
    const link = within(panel).getByRole('link', { name: 'Open in Scheduled Posts' })
    expect(link).toHaveAttribute('href', '/app/social-media/scheduled-posts?tab=scheduled&post=sel')

    fireEvent.click(post('bad'))
    const failedPanel = await screen.findByTestId('post-detail-panel')
    expect(within(failedPanel).getByRole('note')).toHaveTextContent('Meta denied this request')
    expect(within(failedPanel).getByRole('link', { name: 'Open in Scheduled Posts' })).toHaveAttribute('href', expect.stringContaining('tab=failed'))
    fireEvent.click(within(failedPanel).getByLabelText('Close details'))
    await waitFor(() => expect(screen.queryByTestId('post-detail-panel')).not.toBeInTheDocument())
  })

  it('the platform filter hides/shows real posts by platform', async () => {
    installPublicationsApi(api, [
      publication({ id: 'fb', scheduledAt: at(1), timezone: 'UTC', platform: 'facebook' }),
      publication({ id: 'ig', scheduledAt: at(2), timezone: 'UTC', platform: 'instagram' }),
    ])
    renderPage()
    await waitFor(() => expect(post('fb')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }))
    expect(screen.queryByTestId('calendar-post-ig')).not.toBeInTheDocument()
    expect(post('fb')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }))
    expect(post('ig')).toBeInTheDocument()
  })

  it('the Month view lists the same real posts', async () => {
    installPublicationsApi(api, [publication({ id: 'm1', content: 'Monthly post', scheduledAt: at(1), timezone: 'UTC' })])
    renderPage()
    await waitFor(() => expect(post('m1')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() => expect(screen.getByTestId('calendar-post-m1')).toHaveTextContent('Monthly post'))
  })

  it('the scheduled view has no AI generation control (planning lives in the Content plan view), and no fake disabled button', async () => {
    installPublicationsApi(api, [])
    renderPage()
    await waitFor(() => expect(screen.getByTestId('calendar-empty')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Regenerate calendar|Generate calendar/ })).not.toBeInTheDocument()
    expect(api.generateSocialContentCalendar).not.toHaveBeenCalled()
  })

  it('on mobile the selected post opens in a bottom sheet', async () => {
    mobile = true
    installPublicationsApi(api, [publication({ id: 'mob', content: 'Mobile caption', scheduledAt: at(1), timezone: 'UTC' })])
    renderPage()
    await waitFor(() => expect(post('mob')).toBeInTheDocument())
    fireEvent.click(post('mob'))
    expect(await screen.findByTestId('post-detail-panel')).toHaveTextContent('Mobile caption')
  })

  it('with no project nothing is requested', () => {
    project = null
    renderPage()
    expect(screen.getByTestId('no-project')).toBeInTheDocument()
    expect(api.getSocialPublications).not.toHaveBeenCalled()
  })
})

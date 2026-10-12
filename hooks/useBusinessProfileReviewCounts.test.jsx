import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { renderHook, act, waitFor, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  getBusinessProfileReviewAnalytics: vi.fn(),
  syncBusinessProfileReviews: vi.fn(),
  syncBusinessProfile: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))

import {
  useBusinessProfileReviewAnalytics,
  useSyncBusinessProfileReviews,
  useSyncBusinessProfile,
} from './useDashboardQueries'
import ReviewsSummary, { reviewsTotals } from '@/components/dashboard/google-visibility/business-profile/reviews/ReviewsSummary'

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrapperFor = (client) => ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

beforeEach(() => vi.clearAllMocks())

describe('Insights range switching', () => {
  it('each project + location + range + timezone has its own cache entry', async () => {
    api.getBusinessProfileReviewAnalytics.mockImplementation(async (_p, { range }) => ({ data: { range: { key: range } } }))
    const client = newClient()
    const { result, rerender } = renderHook(({ range }) => useBusinessProfileReviewAnalytics('p1', { locationId: 'L1', range, tz: 'UTC' }), {
      wrapper: wrapperFor(client), initialProps: { range: '7d' },
    })
    await waitFor(() => expect(result.current.data?.data.range.key).toBe('7d'))
    rerender({ range: '12m' })
    await waitFor(() => expect(result.current.data?.data.range.key).toBe('12m'))

    const keys = client.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['business-profile', 'p1', 'review-analytics', 'L1', '7d', 'UTC'])
    expect(keys).toContainEqual(['business-profile', 'p1', 'review-analytics', 'L1', '12m', 'UTC'])
    expect(api.getBusinessProfileReviewAnalytics).toHaveBeenCalledTimes(2)

    // Going back to a range that was already loaded does not hit the API again (STANDARD stale time).
    rerender({ range: '7d' })
    await waitFor(() => expect(result.current.data?.data.range.key).toBe('7d'))
    expect(api.getBusinessProfileReviewAnalytics).toHaveBeenCalledTimes(2)
  })

  it('a slow response for an OLD range can never overwrite the newer range on screen', async () => {
    const pending = {}
    api.getBusinessProfileReviewAnalytics.mockImplementation((_p, { range }) => new Promise((resolve) => { pending[range] = () => resolve({ data: { range: { key: range } } }) }))
    const client = newClient()
    const { result, rerender } = renderHook(({ range }) => useBusinessProfileReviewAnalytics('p1', { locationId: 'L1', range, tz: 'UTC' }), {
      wrapper: wrapperFor(client), initialProps: { range: '7d' },
    })
    rerender({ range: '30d' })
    rerender({ range: '90d' })
    await waitFor(() => expect(Object.keys(pending)).toHaveLength(3))

    // Responses arrive out of order: 90d first, the stale 7d / 30d afterwards.
    await act(async () => { pending['90d']() })
    await waitFor(() => expect(result.current.data?.data.range.key).toBe('90d'))
    await act(async () => { pending['7d'](); pending['30d']() })
    expect(result.current.data.data.range.key).toBe('90d')
    expect(result.current.isPlaceholderData).toBe(false)
  })

  it('a different location is a different cache entry (no cross-location numbers)', async () => {
    api.getBusinessProfileReviewAnalytics.mockResolvedValue({ data: {} })
    const client = newClient()
    const wrapper = wrapperFor(client)
    renderHook(() => useBusinessProfileReviewAnalytics('p1', { locationId: 'L1', range: '30d', tz: 'UTC' }), { wrapper })
    renderHook(() => useBusinessProfileReviewAnalytics('p1', { locationId: 'L2', range: '30d', tz: 'UTC' }), { wrapper })
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(2))
  })
})

describe('a sync refreshes the Insights page too', () => {
  const setup = (hook) => {
    const client = newClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => hook('p1'), { wrapper: wrapperFor(client) })
    return { invalidate, result }
  }
  const ANALYTICS = ['business-profile', 'p1', 'review-analytics']

  it('"Sync reviews" invalidates the review list, the rating summary AND every cached analytics range', async () => {
    api.syncBusinessProfileReviews.mockResolvedValue({})
    const { invalidate, result } = setup(useSyncBusinessProfileReviews)
    await act(async () => { await result.current.mutateAsync() })
    const keys = invalidate.mock.calls.map((c) => c[0].queryKey)
    expect(keys).toContainEqual(['business-profile', 'p1', 'reviews'])
    expect(keys).toContainEqual(ANALYTICS)
  })

  it('full "Sync Now" invalidates the analytics too', async () => {
    api.syncBusinessProfile.mockResolvedValue({})
    const { invalidate, result } = setup(useSyncBusinessProfile)
    await act(async () => { await result.current.mutateAsync() })
    expect(invalidate.mock.calls.map((c) => c[0].queryKey)).toContainEqual(ANALYTICS)
  })
})

describe('Reviews list summary uses ONE population', () => {
  const rating = { averageRating: 4.9, totalReviewCount: 1063, syncedReviewCount: 1062, repliedCount: 1058, distribution: { 5: 987 } }

  it('Total Reviews is the stored count (the same as Insights lifetime); Google\'s count is a caption', () => {
    expect(reviewsTotals(rating)).toEqual({ total: 1062, caption: 'Google reports 1,063' })
    render(<ReviewsSummary rating={rating} loading={false} />)
    const tile = screen.getByText('Total Reviews').closest('div')
    expect(tile).toHaveTextContent('1,062')
    expect(tile).toHaveTextContent('Google reports 1,063')
    expect(screen.getByText('5★ Reviews').closest('div')).toHaveTextContent('987')
    expect(screen.getByText('Responded').closest('div')).toHaveTextContent('1,058')
  })

  it('no caption when Google and Odito agree', () => {
    expect(reviewsTotals({ totalReviewCount: 1062, syncedReviewCount: 1062 })).toEqual({ total: 1062, caption: null })
  })

  it('an older API response without syncedReviewCount falls back to Google\'s total (no regression)', () => {
    expect(reviewsTotals({ totalReviewCount: 1063 })).toEqual({ total: 1063, caption: null })
  })

  it('nothing loaded yet shows a dash, not 0', () => {
    expect(reviewsTotals(undefined)).toEqual({ total: null, caption: null })
    render(<ReviewsSummary rating={undefined} loading={false} />)
    expect(screen.getByText('Total Reviews').closest('div')).toHaveTextContent('—')
  })
})

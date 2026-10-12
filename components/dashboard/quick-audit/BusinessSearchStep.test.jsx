import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const api = vi.hoisted(() => ({
  searchBusinessCandidates: vi.fn(),
  performHomepageAudit: vi.fn(),
  performHomepagePageSpeed: vi.fn(),
  performAccessibilityAudit: vi.fn(),
  updateHomepageAuditSnapshot: vi.fn(),
}))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('@/components/dashboard/QuickAuditResult', () => ({ default: () => <div data-testid="audit-result" /> }))
vi.mock('@/components/ui/ThinProgressLoader', () => ({ default: () => null }))

import BusinessSearchStep, { SEARCH_DEBOUNCE_MS } from './BusinessSearchStep'
import QuickAuditHero from '@/components/new-landing/QuickAuditHero'

const biz = (id, name, addr = '1 Main St, Nashik') => ({
  placeId: id, name, formattedAddress: addr, address: addr,
  location: { latitude: 19.9, longitude: 73.7 }, businessStatus: 'OPERATIONAL', source: 'google_places',
})
const ok = (data) => ({ success: true, data })
const backendError = (status, code, message) => Object.assign(new Error(message), { status, code })

// A promise the test resolves/rejects by hand, to control response ordering.
const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const setup = (props = {}) => {
  const onConfirm = vi.fn()
  const onSkip = vi.fn()
  render(<BusinessSearchStep url="https://www.sapphiredigitalagency.com/" onConfirm={onConfirm} onSkip={onSkip} {...props} />)
  return { onConfirm, onSkip }
}
const input = () => screen.getByPlaceholderText(/search your business name/i)
const type = (value) => fireEvent.change(input(), { target: { value } })
const advance = (ms = SEARCH_DEBOUNCE_MS) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  api.searchBusinessCandidates.mockResolvedValue(ok([]))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BusinessSearchStep - search triggering', () => {
  it('debounces: no request until typing pauses, then exactly one with the trimmed query', async () => {
    setup()
    type('sapphire digital agency  ')
    expect(api.searchBusinessCandidates).not.toHaveBeenCalled()
    await advance(SEARCH_DEBOUNCE_MS - 50)
    expect(api.searchBusinessCandidates).not.toHaveBeenCalled()
    await advance(100)
    expect(api.searchBusinessCandidates).toHaveBeenCalledTimes(1)
    expect(api.searchBusinessCandidates.mock.calls[0][0]).toBe('sapphire digital agency')
    expect(api.searchBusinessCandidates.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal)
  })

  it('does not search for fewer than 2 characters', async () => {
    setup()
    type('s')
    await advance()
    expect(api.searchBusinessCandidates).not.toHaveBeenCalled()
  })

  it('shows a loading indicator while the request is in flight', async () => {
    const d = deferred()
    api.searchBusinessCandidates.mockReturnValue(d.promise)
    setup()
    type('sapphire')
    expect(screen.getByRole('status', { name: /searching/i })).toBeInTheDocument()
    await advance()
    expect(screen.getByRole('status', { name: /searching/i })).toBeInTheDocument()
    await act(async () => { d.resolve(ok([])) })
    expect(screen.queryByRole('status', { name: /searching/i })).not.toBeInTheDocument()
  })
})

describe('BusinessSearchStep - results', () => {
  it('renders each match with name and address, and never auto-selects', async () => {
    api.searchBusinessCandidates.mockResolvedValue(ok([biz('p1', 'Sapphire Digital Agency'), biz('p2', 'Sapphire Digital Studio', '9 Elm Rd, Pune')]))
    const { onConfirm } = setup()
    type('sapphire digital')
    await advance()
    expect(screen.getByText('Sapphire Digital Agency')).toBeInTheDocument()
    expect(screen.getByText('9 Elm Rd, Pune')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('selecting a result confirms with place ID, name, address and coordinates', async () => {
    api.searchBusinessCandidates.mockResolvedValue(ok([biz('p1', 'Sapphire Digital Agency')]))
    const { onConfirm } = setup()
    type('sapphire')
    await advance()
    fireEvent.click(screen.getByText('Sapphire Digital Agency'))
    expect(onConfirm).toHaveBeenCalledWith({
      url: 'https://www.sapphiredigitalagency.com/',
      businessName: 'Sapphire Digital Agency',
      location: '1 Main St, Nashik',
      source: 'search',
      placeId: 'p1',
      formattedAddress: '1 Main St, Nashik',
      coordinates: { latitude: 19.9, longitude: 73.7 },
    })
  })

  it('a successful search with zero matches shows "No results" (and no error)', async () => {
    api.searchBusinessCandidates.mockResolvedValue(ok([]))
    setup()
    type('zzzz nothing')
    await advance()
    expect(screen.getByText(/No results for/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BusinessSearchStep - errors are never shown as "No results"', () => {
  it('a failing API call shows an error with retry, not the empty state', async () => {
    api.searchBusinessCandidates.mockRejectedValue(backendError(503, 'PLACES_ACCESS_DENIED', 'Business search is not available right now.'))
    setup()
    type('sapphire digital agency')
    await advance()
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable right now/i)
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('a rate limit gets its own message', async () => {
    api.searchBusinessCandidates.mockRejectedValue(backendError(429, 'PLACES_RATE_LIMITED', 'x'))
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toHaveTextContent(/too many searches/i)
  })

  it('a timeout gets its own message', async () => {
    api.searchBusinessCandidates.mockRejectedValue(backendError(504, 'PLACES_TIMEOUT', 'x'))
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i)
  })

  it('a network failure (no HTTP status) is reported as a connection problem', async () => {
    api.searchBusinessCandidates.mockRejectedValue(new TypeError('Failed to fetch'))
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the server/i)
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument()
  })

  it('a malformed success payload is an error, not an empty list', async () => {
    api.searchBusinessCandidates.mockResolvedValue({ success: true, data: null })
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument()
  })

  it('"Try again" re-runs the search and clears the error on success', async () => {
    api.searchBusinessCandidates
      .mockRejectedValueOnce(backendError(502, 'PLACES_UNAVAILABLE', 'temporarily unavailable'))
      .mockResolvedValueOnce(ok([biz('p1', 'Sapphire Digital Agency')]))
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await advance()
    expect(api.searchBusinessCandidates).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Sapphire Digital Agency')).toBeInTheDocument()
  })

  it('typing again clears a previous error', async () => {
    api.searchBusinessCandidates.mockRejectedValueOnce(backendError(502, 'PLACES_UNAVAILABLE', 'x'))
    setup()
    type('sapphire')
    await advance()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    type('sapphire d')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BusinessSearchStep - stale requests', () => {
  it('rapid typing searches only the final value', async () => {
    setup()
    for (const v of ['sa', 'sap', 'sapp', 'sapphire']) {
      type(v)
      await advance(100)
    }
    await advance()
    expect(api.searchBusinessCandidates).toHaveBeenCalledTimes(1)
    expect(api.searchBusinessCandidates.mock.calls[0][0]).toBe('sapphire')
  })

  it('a slow older response can never overwrite a newer one, and the older request is aborted', async () => {
    const first = deferred()
    const second = deferred()
    api.searchBusinessCandidates.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    setup()

    type('sapphire')
    await advance()
    const firstSignal = api.searchBusinessCandidates.mock.calls[0][2].signal

    type('sapphire digital')
    await advance()
    expect(firstSignal.aborted).toBe(true)

    await act(async () => { second.resolve(ok([biz('new', 'Newer Result')])) })
    await act(async () => { first.resolve(ok([biz('old', 'Stale Result')])) })

    expect(screen.getByText('Newer Result')).toBeInTheDocument()
    expect(screen.queryByText('Stale Result')).not.toBeInTheDocument()
  })

  it('a stale failure cannot replace newer results with an error', async () => {
    const first = deferred()
    const second = deferred()
    api.searchBusinessCandidates.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    setup()
    type('sapphire')
    await advance()
    type('sapphire digital')
    await advance()

    await act(async () => { second.resolve(ok([biz('new', 'Newer Result')])) })
    await act(async () => { first.reject(backendError(503, 'PLACES_ACCESS_DENIED', 'x')) })

    expect(screen.getByText('Newer Result')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clearing the box drops in-flight results', async () => {
    const d = deferred()
    api.searchBusinessCandidates.mockReturnValue(d.promise)
    setup()
    type('sapphire')
    await advance()
    type('')
    await act(async () => { d.resolve(ok([biz('p1', 'Late Result')])) })
    expect(screen.queryByText('Late Result')).not.toBeInTheDocument()
  })
})

describe('BusinessSearchStep - manual entry and skip keep working', () => {
  it('Add Manually pre-fills the typed name and confirms with source "manual"', async () => {
    const { onConfirm } = setup()
    type('sapphire digital agency')
    await advance()
    fireEvent.click(screen.getByRole('button', { name: /add manually/i }))
    const name = screen.getByPlaceholderText(/ABC Roofing/i)
    expect(name).toHaveValue('sapphire digital agency')
    fireEvent.change(screen.getByPlaceholderText(/Nashik, Maharashtra/i), { target: { value: 'Nashik' } })
    fireEvent.click(screen.getByRole('button', { name: /continue audit/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      url: 'https://www.sapphiredigitalagency.com/',
      businessName: 'sapphire digital agency',
      location: 'Nashik',
      source: 'manual',
    })
  })

  it('Skip starts the audit without business context', () => {
    const { onSkip, onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: /skip business setup/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('after a FAILED search, manual entry and skip both still work', async () => {
    api.searchBusinessCandidates.mockRejectedValue(backendError(503, 'PLACES_ACCESS_DENIED', 'x'))
    const { onConfirm, onSkip } = setup()
    type('sapphire digital agency')
    await advance()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add manually/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue audit/i }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ businessName: 'sapphire digital agency', source: 'manual' }))

    fireEvent.click(screen.getByRole('button', { name: /skip business setup/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})

describe('QuickAuditHero - a failed location search does not block the SEO audit', () => {
  beforeEach(() => {
    api.performHomepageAudit.mockResolvedValue({ data: { _audit_id: 'a1', sections: {} } })
    api.performHomepagePageSpeed.mockReturnValue(new Promise(() => {}))
    api.performAccessibilityAudit.mockReturnValue(new Promise(() => {}))
    api.searchBusinessCandidates.mockRejectedValue(backendError(503, 'PLACES_ACCESS_DENIED', 'x'))
    localStorage.clear()
  })

  const reachSearchStep = async () => {
    render(<QuickAuditHero />)
    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'https://www.sapphiredigitalagency.com/' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    type('sapphire digital agency')
    await advance()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  }

  it('Skip after a search failure still runs the audit for the URL', async () => {
    await reachSearchStep()
    fireEvent.click(screen.getByRole('button', { name: /skip business setup/i }))
    await advance(0)
    expect(api.performHomepageAudit).toHaveBeenCalledWith('https://www.sapphiredigitalagency.com/')
  })

  it('manual entry after a search failure still runs the audit for the URL', async () => {
    await reachSearchStep()
    fireEvent.click(screen.getByRole('button', { name: /add manually/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue audit/i }))
    await advance(0)
    expect(api.performHomepageAudit).toHaveBeenCalledWith('https://www.sapphiredigitalagency.com/')
  })
})

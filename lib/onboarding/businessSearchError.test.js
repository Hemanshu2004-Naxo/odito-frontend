import { describe, it, expect } from 'vitest'
import { classifyBusinessSearchError } from './businessSearchError'

const err = (status, code, message = 'raw upstream text with an API key') =>
  Object.assign(new Error(message), { ...(status !== undefined && { status }), ...(code && { code }) })

describe('classifyBusinessSearchError', () => {
  it.each([
    ['network failure (no HTTP status)', new TypeError('Failed to fetch'), 'network', true],
    ['429', err(429), 'rate_limited', true],
    ['rate-limit code', err(502, 'RATE_LIMIT_EXCEEDED'), 'rate_limited', true],
    ['504', err(504), 'timeout', true],
    ['408', err(408), 'timeout', true],
    ['timeout code', err(500, 'PLACES_TIMEOUT'), 'timeout', true],
    ['403 permission denied', err(403), 'config', true],
    ['503 + access-denied code', err(503, 'PLACES_ACCESS_DENIED'), 'config', true],
    ['legacy API_CONFIGURATION_ERROR', err(503, 'API_CONFIGURATION_ERROR'), 'config', true],
    ['billing', err(503, 'PLACES_BILLING_REQUIRED'), 'config', true],
    ['500', err(500), 'unavailable', true],
    ['502', err(502, 'SEARCH_UNAVAILABLE'), 'unavailable', true],
    ['503 without a code', err(503), 'unavailable', true],
    ['400 invalid', err(400, 'INVALID_REQUEST'), 'invalid_request', true],
    ['401 session expired', err(401), 'auth', false],
  ])('%s -> %s (retryable=%s)', (_label, error, kind, retryable) => {
    const r = classifyBusinessSearchError(error)
    expect(r.kind).toBe(kind)
    expect(r.retryable).toBe(retryable)
  })

  it('never surfaces raw upstream error text, keys, or "API key" wording', () => {
    for (const e of [err(403), err(500), err(503, 'PLACES_KEY_INVALID'), new TypeError('boom')]) {
      const { message } = classifyBusinessSearchError(e)
      expect(message).not.toMatch(/raw upstream|api key|google cloud|PERMISSION_DENIED/i)
    }
  })

  it('handles missing/odd input without throwing', () => {
    expect(classifyBusinessSearchError(undefined).kind).toBe('network')
    expect(classifyBusinessSearchError(null).kind).toBe('network')
    expect(classifyBusinessSearchError({}).kind).toBe('network')
  })
})

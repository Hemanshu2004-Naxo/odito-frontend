import { describe, it, expect } from 'vitest'
import { periodEndDate, dayCount, DURATION_OPTIONS, MIN_MONTHS, MAX_MONTHS, defaultStartDate, estimatePosts, describeQuota } from './contentCalendar'

/**
 * The client shows the end date at once, before the server's preview arrives, so it follows the SAME rule as the server
 * (odito_backend calendarPlanner.periodEndDate): start inclusive, start + N months exclusive, end date = the last day (inclusive),
 * a start day missing from the target month clamped to its last day. These are the same cases the backend tests pin; if one
 * side changes, one of the two suites fails.
 */
describe('periodEndDate (mirrors the server rule)', () => {
  it.each([
    ['2026-10-13', 1, '2026-11-12'],
    ['2026-10-01', 1, '2026-10-31'],
    ['2026-01-01', 3, '2026-03-31'],
    ['2026-07-01', 6, '2026-12-31'],
    ['2026-10-13', 6, '2027-04-12'],
    ['2026-12-15', 2, '2027-02-14'],
    ['2026-01-31', 1, '2026-02-27'],
    ['2026-03-31', 1, '2026-04-29'],
    ['2026-08-31', 6, '2027-02-27'],
    ['2026-08-31', 2, '2026-10-30'],
    ['2028-01-31', 1, '2028-02-28'],
    ['2028-02-01', 1, '2028-02-29'],
    ['2028-02-29', 6, '2028-08-28'],
    ['2027-08-31', 6, '2028-02-28'],
    ['2026-03-08', 1, '2026-04-07'],
  ])('%s + %i month(s) ends %s', (start, months, end) => {
    expect(periodEndDate(start, months)).toBe(end)
  })

  it('gives an empty string for a bad input, never a wrong date', () => {
    for (const [d, m] of [['2026-02-30', 1], ['', 1], [null, 1], ['2026-10-13', 0], ['2026-10-13', 1.5], ['2026-10-13', '2']]) expect(periodEndDate(d, m)).toBe('')
  })

  it('is not moved by the time zone of the machine (calendar dates, UTC)', () => {
    // the date maths never goes through a local midnight, so a DST change cannot shift it
    expect(periodEndDate('2026-03-08', 1)).toBe('2026-04-07')
    expect(periodEndDate('2026-10-25', 1)).toBe('2026-11-24')
  })
})

describe('duration and counts', () => {
  it('offers exactly 1 to 6 months', () => {
    expect(DURATION_OPTIONS.map((o) => o.months)).toEqual([1, 2, 3, 4, 5, 6])
    expect(DURATION_OPTIONS[0].label).toBe('1 month')
    expect(DURATION_OPTIONS[5].label).toBe('6 months')
    expect([MIN_MONTHS, MAX_MONTHS]).toEqual([1, 6])
  })

  it('counts the days of a period, inclusive of both ends', () => {
    expect(dayCount('2026-10-13', periodEndDate('2026-10-13', 1))).toBe(31)
    expect(dayCount('2026-02-01', periodEndDate('2026-02-01', 1))).toBe(28)
    expect(dayCount('2028-02-01', periodEndDate('2028-02-01', 1))).toBe(29)
    expect(dayCount('2026-07-01', periodEndDate('2026-07-01', 6))).toBe(184)
    expect(dayCount('2026-10-13', '2026-10-01')).toBe(0)
  })

  it('the default start is tomorrow, as a plain calendar date', () => {
    expect(defaultStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('the fallback estimate is only a rough number (the server\'s preview is exact)', () => {
    expect(estimatePosts(3, 31)).toBe(13)
    expect(estimatePosts(0, 31)).toBe(0)
  })
})

describe('describeQuota (what the form says about this month\'s allowance)', () => {
  const base = { period: '2026-10', resetsAt: '2026-11-01T00:00:00.000Z' }

  it('says nothing when no limit applies (or there is no data)', () => {
    expect(describeQuota(null)).toBeNull()
    expect(describeQuota(undefined)).toBeNull()
    expect(describeQuota({ ...base, user: { limit: null, used: 0, committed: 0, reserved: 0 }, project: { limit: null } })).toBeNull()
  })

  it('reports what was really generated, and keeps posts held by a running calendar apart', () => {
    const quota = { ...base, user: { limit: 150, used: 52, committed: 40, reserved: 12, remaining: 98 }, project: { limit: 60, used: 52, committed: 40, reserved: 12, remaining: 8 } }
    expect(describeQuota(quota)).toBe('This month you have used 40 of 150 calendar posts on your account (12 more are held for a calendar being generated) and 40 of 60 calendar posts on this project (12 more are held for a calendar being generated). The allowance resets on Sun 1 Nov 2026.')
    expect(describeQuota({ ...base, user: { limit: 20, used: 9, committed: 8, reserved: 1 } })).toContain('(1 more is held for a calendar being generated)')
  })

  it('does not mention a hold when nothing is held, and works with a server that only sends used', () => {
    expect(describeQuota({ ...base, user: { limit: 30, used: 8, committed: 8, reserved: 0 } })).toBe('This month you have used 8 of 30 calendar posts on your account. The allowance resets on Sun 1 Nov 2026.')
    expect(describeQuota({ ...base, user: { limit: 30, used: 8 } })).toBe('This month you have used 8 of 30 calendar posts on your account. The allowance resets on Sun 1 Nov 2026.')
  })

  it('a project-only limit is described on its own', () => {
    expect(describeQuota({ ...base, user: { limit: null }, project: { limit: 25, used: 5, committed: 5, reserved: 0 } })).toBe('This month you have used 5 of 25 calendar posts on this project. The allowance resets on Sun 1 Nov 2026.')
  })
})

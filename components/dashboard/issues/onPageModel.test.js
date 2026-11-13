import { describe, it, expect } from 'vitest'
import {
  buildIssueRows, severityStats, quickWin, filterIssueRows, categoriesOf, buildPageRows, filterPageRows,
  pageNameFromUrl, pathOf, normalizeSeverity, percentOf,
} from './onPageModel'

const issues = [
  { issue_code: 'images_missing_alt_text', title: 'Images missing alt text', severity: 'high', category: 'Images', pages_affected: 4, page_urls: ['https://a.com/', 'https://a.com/x', 'https://a.com/y', 'https://a.com/z'] },
  { issue_code: 'title_too_long', title: 'Page title too long', severity: 'medium', category: 'Meta tags', pages_affected: 2, page_urls: ['https://a.com/', 'https://a.com/x'] },
  { issue_code: 'thin_content', title: 'Thin content', severity: 'low', category: 'Content', pages_affected: 1, page_urls: ['https://a.com/z'] },
]
const auto = new Set(['images_missing_alt_text', 'title_too_long'])

describe('onPageModel', () => {
  const rows = buildIssueRows(issues, auto)

  it('normalizes severities, anything unknown is low', () => {
    expect(normalizeSeverity('critical')).toBe('high')
    expect(normalizeSeverity('warning')).toBe('medium')
    expect(normalizeSeverity('info')).toBe('low')
    expect(normalizeSeverity(undefined)).toBe('low')
  })

  it('sorts by pages affected and marks who fixes', () => {
    expect(rows.map((r) => r.code)).toEqual(['images_missing_alt_text', 'title_too_long', 'thin_content'])
    expect(rows.map((r) => r.who)).toEqual(['auto', 'auto', 'you'])
  })

  it('sums stats per severity', () => {
    const s = severityStats(rows, 5)
    expect(s.all).toEqual({ issues: 7, types: 3 })
    expect(s.high).toEqual({ issues: 4, types: 1 })
    expect(s.low).toEqual({ issues: 1, types: 1 })
  })

  it('quick win counts the top issues and how many are auto-fixable', () => {
    expect(quickWin(rows, 2)).toEqual({ count: 2, cleared: 6, total: 7, percent: 86, autoCount: 2 })
    expect(quickWin([], 5).percent).toBe(0)
  })

  it('filters by severity, category, who and search', () => {
    expect(filterIssueRows(rows, { severity: 'high' })).toHaveLength(1)
    expect(filterIssueRows(rows, { category: 'Content' })).toHaveLength(1)
    expect(filterIssueRows(rows, { who: 'you' }).map((r) => r.code)).toEqual(['thin_content'])
    expect(filterIssueRows(rows, { query: 'TITLE' }).map((r) => r.code)).toEqual(['title_too_long'])
    expect(categoriesOf(rows)).toEqual(['Content', 'Images', 'Meta tags'])
  })

  it('flips issue->pages into page->issues, worst page first', () => {
    const pages = buildPageRows(rows)
    expect(pages[0]).toMatchObject({ url: 'https://a.com/', high: 1, medium: 1, low: 0, total: 2 })
    expect(pages.map((p) => p.url)).toEqual(['https://a.com/', 'https://a.com/x', 'https://a.com/z', 'https://a.com/y'])
    expect(pages[0].issues.map((i) => i.code)).toEqual(['images_missing_alt_text', 'title_too_long'])
    expect(filterPageRows(pages, 'x')).toHaveLength(1)
  })

  it('names pages from their URL', () => {
    expect(pageNameFromUrl('https://a.com/')).toBe('Home')
    expect(pageNameFromUrl('https://a.com/eye-specialist-in-mumbai')).toBe('Eye Specialist In Mumbai')
    expect(pathOf('https://a.com/events?post_type=events')).toBe('/events?post_type=events')
  })

  it('percentOf is safe with no pages', () => {
    expect(percentOf(5, 0)).toBe(0)
    expect(percentOf(161, 161)).toBe(100)
  })
})

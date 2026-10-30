import { describe, it, expect } from 'vitest'
import { shouldPersistQuery } from './queryPersistence'

const q = (queryKey, data = { x: 1 }, status = 'success') => ({ queryKey, state: { status, data } })

describe('persisted query cache filter', () => {
  it('never persists the volatile social lists (publishing, AI post / design generation state)', () => {
    expect(shouldPersistQuery(q(['social', 'publishing', 'p1', 'all', { status: 'scheduled' }]))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'publishing', 'p1', 'approval-summary']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'ai-content', 'p1']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'ai-design', 'p1', 'pub-1']))).toBe(false)
  })

  it('never persists Creative Studio state: a reload must show the server\'s selected design, not a copy from before it was chosen', () => {
    expect(shouldPersistQuery(q(['social', 'studio', 'p1', 'pub-1']))).toBe(false)
  })

  it('never persists the content calendar (its generation progress changes on the server): not the calendar, its status poll, options or preview', () => {
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1', 'status']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1', 'preview', '2026-10-13', 3, 3]))).toBe(false)
  })

  it('never persists AI Visibility state: question sets (approval is server-decided), runs, progress, and stored answers / evidence', () => {
    expect(shouldPersistQuery(q(['ai-visibility-questions', 'p1', 'list']))).toBe(false)
    expect(shouldPersistQuery(q(['ai-visibility-questions', 'p1', 'set', 's1']))).toBe(false)
    expect(shouldPersistQuery(q(['google-aio-visibility', 'p1', 'summary']))).toBe(false)
    expect(shouldPersistQuery(q(['google-aio-visibility', 'p1', 'evidence-item', 'r1', 'q1']))).toBe(false)
  })

  it('never persists Organic Keywords pages or the 1,000-row export (each page / sort / filter is its own query; they would fill localStorage), but keeps the small domain-overview queries', () => {
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'keywords', { limit: 50, offset: 0, order_by: 'x,desc', filters: [] }]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'keywords', { limit: 1000, offset: 0, order_by: 'x,desc', filters: [] }]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'ranked-keywords', 'v2']))).toBe(true)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'history', 'v2', 12]))).toBe(true)
  })

  it('never persists Backlinks pages (every tab / sort / filter / page is its own query, with big rows)', () => {
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'backlinks-list', { status: 'live', mode: 'as_is', limit: 50, offset: 0, order_by: ['rank,desc'], filters: [] }]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'backlinks', 'v2', { status: 'live', dofollow: false }]))).toBe(true) // the small summary still is
  })

  it('never persists Anchors pages, the 1,000-row anchor profile, or the saved anchor settings (they decide every anchor\'s type)', () => {
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'anchors', { status: 'live', limit: 50, offset: 0, order_by: 'referring_domains,desc', filters: [] }]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'anchor-profile']))).toBe(false)
    expect(shouldPersistQuery(q(['anchor-settings', 'p1']))).toBe(false)
  })

  it('never persists Top Pages: the pages, the profile counts, the Fix first list or the traffic join', () => {
    for (const section of ['domain-pages', 'tp-counts', 'tp-fix-first', 'top-pages-traffic']) {
      expect(shouldPersistQuery(q(['domain-overview', 'p1', section, { status: 'live', limit: 50, offset: 0, filters: [] }])), section).toBe(false)
    }
  })

  it('never persists Referring Domains pages,the two profile cards, or the saved disavow / reviewed lists', () => {
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'referring-domains', { status: 'live', dofollow: false, limit: 50, offset: 0, order_by: 'rank,desc', filters: [] }]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'referring-domains', 'fill', ['a.com']]))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'rd-rank-buckets']))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'rd-toxic-count']))).toBe(false)
    expect(shouldPersistQuery(q(['domain-lists', 'p1']))).toBe(false)
  })

  it('persists only the DEFAULT competitors view (the dashboard card\'s query); other pages / sorts / toggles and the saved competitor lists stay in memory', () => {
    const def = { limit: 50, offset: 0, order_by: 'intersections,desc', filters: [], exclude_top_domains: true, max_rank_group: 100 }
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'competitors', 'v2', 'x0', def]))).toBe(true)
    for (const changed of [{ offset: 50 }, { limit: 25 }, { order_by: 'avg_position,asc' }, { exclude_top_domains: false }, { max_rank_group: 10 }, { filters: ['intersections', '>=', 5] }]) {
      expect(shouldPersistQuery(q(['domain-overview', 'p1', 'competitors', 'v2', 'x0', { ...def, ...changed }]))).toBe(false)
    }
    expect(shouldPersistQuery(q(['competitor-settings', 'p1']))).toBe(false)
    expect(shouldPersistQuery(q(['domain-overview', 'p1', 'bulk-traffic', 'a.com,b.com']))).toBe(true)
  })

  it('still persists ordinary successful queries (existing behaviour) and nothing without data', () => {
    expect(shouldPersistQuery(q(['projects']))).toBe(true)
    expect(shouldPersistQuery(q(['social', 'business-profile', 'p1']))).toBe(true)
    expect(shouldPersistQuery(q(['projects'], null))).toBe(false)
    expect(shouldPersistQuery(q(['projects'], { x: 1 }, 'error'))).toBe(false)
  })
})

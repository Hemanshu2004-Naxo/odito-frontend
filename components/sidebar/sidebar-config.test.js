import { describe, it, expect } from 'vitest'
import { sidebarSections } from './sidebar-config'

const section = (id) => sidebarSections.find((s) => s.id === id)
const flat = (s) => s.items.map((i) => [i.label, i.href])

describe('sidebar config: the SEO flow', () => {
  it('has the groups in order, with an "SEO" parent heading on the first', () => {
    expect(sidebarSections.slice(0, 5).map((s) => s.label)).toEqual([
      'Site audit', 'Rankings & traffic', 'Off-page', 'AI search', 'Google data',
    ])
    expect(sidebarSections[0].parentLabel).toBe('SEO')
  })

  it('Site audit: Overview, On-Page, Technical, Accessibility, Performance, Keywords', () => {
    expect(flat(section('site-audit'))).toEqual([
      ['Overview', '/app/dashboard'],
      ['On-Page', '/app/onpage'],
      ['Technical', '/app/technicalchecks'],
      ['Accessibility', '/app/accessibility'],
      ['Performance', '/app/pagespeed'],
      ['Keywords', '/app/keywords'],
    ])
  })

  it('Rankings & traffic: Domain overview, Traffic, Keyword ranking > All keywords, Competitors', () => {
    const items = section('domain-overview').items
    expect(items.map((i) => i.label)).toEqual(['Domain overview', 'Traffic', 'Keyword ranking', 'Competitors'])
    expect(items[0].href).toBe('/app/domain-overview')
    expect(items[2].children.map((c) => [c.label, c.href])).toEqual([['All keywords', '/app/organic-keywords']])
  })

  it('Off-page: five backlink pages on their unchanged routes', () => {
    expect(flat(section('off-page'))).toEqual([
      ['Backlink overview', '/app/backlinks/overview'],
      ['Backlinks', '/app/backlinks/list'],
      ['Anchors', '/app/backlinks/anchors'],
      ['Linking sites', '/app/referring-domains'],
      ['Top linked pages', '/app/backlinks/top-pages'],
    ])
  })

  it('AI search: AI Visibility (dropdown of the Google AI Overview pages), AEO, AISO, GEO', () => {
    const items = section('ai-search').items
    expect(items.map((i) => [i.label, i.href])).toEqual([
      ['AI Visibility', '/app/google-ai-overview'],
      ['AEO', '/app/aeo-hub'],
      ['AISO', '/app/aiso'],
      ['GEO', '/app/geo-hub'],
    ])
    expect(items[0].children.map((c) => [c.label, c.href])).toEqual([
      ['Overview', '/app/google-ai-overview'],
      ['Questions', '/app/google-ai-overview/questions'],
      ['Answers & citations', '/app/google-ai-overview/results'],
      ['History', '/app/google-ai-overview/history'],
    ])
  })

  it('Google data: Search Console, Analytics, Business Profile (with its sub-pages)', () => {
    const items = section('google-data').items
    expect(items.map((i) => i.label)).toEqual(['Search Console', 'Analytics', 'Business Profile'])
    expect(items[2].children.map((c) => c.label)).toEqual(['Overview', 'Reviews', 'Posts'])
  })

  it('every item has an icon, and ids and hrefs are unique', () => {
    const items = sidebarSections.flatMap((s) => s.items)
    for (const i of items) expect(i.icon, i.id).toBeTruthy()
    const sids = sidebarSections.map((s) => s.id)
    expect(new Set(sids).size).toBe(sids.length)
    const ids = sidebarSections.flatMap((s) => s.items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)]))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('hidden sections', () => {
  it('Leads and Social Media are marked hidden', () => {
    expect(section('leads')?.hidden).toBe(true)
    expect(section('social-media')?.hidden).toBe(true)
  })
})

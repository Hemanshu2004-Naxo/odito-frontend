import { describe, it, expect } from 'vitest'
import { sidebarSections } from './sidebar-config'

const section = (id) => sidebarSections.find((s) => s.id === id)

describe('sidebar config: Domain Overview', () => {
  it('is the very first item in the sidebar, above every group, and points at its page', () => {
    const first = sidebarSections[0]
    expect(first.id).toBe('domain-overview')
    expect(first.items[0]).toMatchObject({ id: 'domain-overview', label: 'Domain Overview', href: '/app/domain-overview' })
    expect(first.items[0].icon).toBeTruthy()
    const ids = sidebarSections.map((s) => s.id)
    expect(ids.indexOf('domain-overview')).toBeLessThan(ids.indexOf('audit'))
    expect(ids).not.toContain('off-page') // the backlink pages live in the top group now
  })

  it('lists Traffic History under Domain Overview, Organic Keywords under Traffic History, Competitors under Organic Keywords, and the Off-Page group under Competitors', () => {
    const items = section('domain-overview').items
    expect(items.slice(0, 5).map((i) => [i.id, i.label, i.href])).toEqual([
      ['domain-overview', 'Domain Overview', '/app/domain-overview'],
      ['traffic-history', 'Traffic History', '/app/traffic-history'],
      ['organic-keywords', 'Organic Keywords', '/app/organic-keywords'],
      ['competitors', 'Competitors', '/app/competitors'],
      ['off-page', 'Off-Page', '/app/backlinks/overview'],
    ])
    expect(items[1].icon).toBeTruthy()
    expect(items[2].icon).toBeTruthy()
    expect(items[3].icon).toBeTruthy()
    expect(items[4].icon).toBeTruthy()
    expect(sidebarSections.flatMap((s) => s.items.map((i) => i.href)).filter((h) => h === '/app/competitors')).toHaveLength(1)
    const hrefs = sidebarSections.flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs.filter((h) => h === '/app/traffic-history')).toHaveLength(1)
    expect(hrefs.filter((h) => h === '/app/organic-keywords')).toHaveLength(1)
  })

  it('has no heading of its own (it is a home link) but keeps an accessible name for its navigation landmark', () => {
    expect(section('domain-overview').label).toBeNull()
    expect(section('domain-overview').ariaLabel).toBe('Domain overview')
  })

  it('does not disturb the audit group', () => {
    expect(section('audit').items.map((i) => i.id)).toEqual([
      'pre-audit', 'overview', 'onpage', 'accessibility', 'technical-checks', 'pagespeed', 'keywords',
    ])
    expect(section('audit').items.find((i) => i.id === 'overview').href).toBe('/app/dashboard')
  })
})

describe('sidebar config: the Off-Page group (the five backlink pages)', () => {
  it('is ONE collapsible group in the top section, after Competitors, with no group of its own section', () => {
    expect(sidebarSections.some((s) => s.id === 'off-page')).toBe(false)
    const items = section('domain-overview').items
    const group = items.find((i) => i.id === 'off-page')
    expect(group).toMatchObject({ label: 'Off-Page', href: '/app/backlinks/overview' })
    expect(group.icon).toBeTruthy()
    expect(items.at(-1).id).toBe('off-page')
  })

  it('lists Overview, Backlinks, Anchors, Referring Domains and Top Pages in that order, on their unchanged routes', () => {
    const group = section('domain-overview').items.find((i) => i.id === 'off-page')
    expect(group.children.map((c) => [c.label, c.href])).toEqual([
      ['Overview', '/app/backlinks/overview'],
      ['Backlinks', '/app/backlinks/list'],
      ['Anchors', '/app/backlinks/anchors'],
      ['Referring Domains', '/app/referring-domains'],
      ['Top Pages', '/app/backlinks/top-pages'],
    ])
  })

  it('no longer lists the five pages as separate items, anywhere', () => {
    const items = section('domain-overview').items
    for (const id of ['backlink-overview', 'anchors', 'referring-domains', 'top-pages']) expect(items.some((i) => i.id === id)).toBe(false)
    const topLevel = sidebarSections.flatMap((s) => s.items.map((i) => i.href))
    expect(topLevel.filter((h) => h === '/app/referring-domains')).toHaveLength(0)
  })

  it('does not list Referring Domains under Audit, and lists every backlink route exactly once in the group', () => {
    expect(section('audit').items.some((i) => i.id === 'referring-domains')).toBe(false)
    const childHrefs = sidebarSections.flatMap((s) => s.items.flatMap((i) => (i.children ?? []).map((c) => c.href)))
    for (const href of ['/app/backlinks/overview', '/app/backlinks/list', '/app/backlinks/anchors', '/app/referring-domains', '/app/backlinks/top-pages']) {
      expect(childHrefs.filter((h) => h === href), href).toHaveLength(1)
    }
  })

  it('keeps every section id and item id unique (they are used as React keys)', () => {
    const sectionIds = sidebarSections.map((s) => s.id)
    expect(new Set(sectionIds).size).toBe(sectionIds.length)
    const itemIds = sidebarSections.flatMap((s) => s.items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)]))
    expect(new Set(itemIds).size).toBe(itemIds.length)
  })
})

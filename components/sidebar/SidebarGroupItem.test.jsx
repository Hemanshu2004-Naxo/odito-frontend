import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { sidebarSections } from './sidebar-config'

let mockPathname = '/app/google-visibility/business-profile'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import { SidebarGroupItem } from './SidebarGroupItem'

const item = sidebarSections
  .find((s) => s.id === 'google-visibility')
  .items.find((i) => i.id === 'google-visibility-business-profile')

const toggle = () => screen.getByRole('button', { name: /business profile menu/i })

describe('SidebarGroupItem (Business Profile)', () => {
  beforeEach(() => { mockPathname = '/app/google-visibility/business-profile' })

  it('config exposes Overview + Reviews + Posts children under the existing parent href', () => {
    expect(item.href).toBe('/app/google-visibility/business-profile')
    expect(item.children.map((c) => [c.label, c.href])).toEqual([
      ['Overview', '/app/google-visibility/business-profile'],
      ['Reviews', '/app/google-visibility/business-profile/reviews'],
      ['Posts', '/app/google-visibility/business-profile/posts'],
    ])
  })

  it('parent label links to the overview page; the chevron is a separate button', () => {
    render(<SidebarGroupItem item={item} />)
    const parent = screen.getAllByRole('link', { name: 'Business Profile' })[0]
    expect(parent).toHaveAttribute('href', '/app/google-visibility/business-profile')
    expect(parent.contains(toggle())).toBe(false)
  })

  it('is expanded on the overview route and marks the parent as the current page', () => {
    render(<SidebarGroupItem item={item} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Business Profile' })).toHaveAttribute('aria-current', 'page')
  })

  it('auto-expands on a child route; the Reviews child (not the parent) is the current page', () => {
    mockPathname = '/app/google-visibility/business-profile/reviews'
    render(<SidebarGroupItem item={item} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Business Profile' })).not.toHaveAttribute('aria-current')
  })

  it('is collapsed on unrelated routes and the chevron toggles without navigating', () => {
    mockPathname = '/app/google-visibility/search-console'
    render(<SidebarGroupItem item={item} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveAttribute('aria-controls')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SidebarGroupItem (Off-Page: the five backlink pages)', () => {
  const offPage = sidebarSections.find((s) => s.id === 'domain-overview').items.find((i) => i.id === 'off-page')
  const offToggle = () => screen.getByRole('button', { name: /off-page menu/i })

  it.each([
    ['/app/backlinks/overview', 'Overview'],
    ['/app/backlinks/list', 'Backlinks'],
    ['/app/backlinks/anchors', 'Anchors'],
    ['/app/referring-domains', 'Referring Domains'],
    ['/app/backlinks/top-pages', 'Top Pages'],
  ])('opens by itself on %s, and that page is the current one', (path, label) => {
    mockPathname = path
    render(<SidebarGroupItem item={offPage} />)
    expect(offToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('link', { name: label }).some((l) => l.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('stays closed on an unrelated route (including the other dashboard pages) and the chevron opens it without navigating', () => {
    for (const path of ['/app/domain-overview', '/app/organic-keywords', '/app/competitors', '/app/dashboard']) {
      mockPathname = path
      const { unmount } = render(<SidebarGroupItem item={offPage} />)
      expect(offToggle()).toHaveAttribute('aria-expanded', 'false')
      unmount()
    }
    mockPathname = '/app/domain-overview'
    render(<SidebarGroupItem item={offPage} />)
    fireEvent.click(offToggle())
    expect(offToggle()).toHaveAttribute('aria-expanded', 'true')
  })
})

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
  .find((s) => s.id === 'google-data')
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

describe('SidebarGroupItem (Keyword ranking > All keywords)', () => {
  const group = sidebarSections.find((s) => s.id === 'domain-overview').items.find((i) => i.id === 'keyword-ranking')
  const kToggle = () => screen.getByRole('button', { name: /keyword ranking menu/i })

  it('opens by itself on the keywords page, and All keywords is the current page', () => {
    mockPathname = '/app/organic-keywords'
    render(<SidebarGroupItem item={group} />)
    expect(kToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'All keywords' })).toHaveAttribute('aria-current', 'page')
  })

  it('stays closed on an unrelated route and the chevron opens it', () => {
    mockPathname = '/app/competitors'
    render(<SidebarGroupItem item={group} />)
    expect(kToggle()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(kToggle())
    expect(kToggle()).toHaveAttribute('aria-expanded', 'true')
  })
})

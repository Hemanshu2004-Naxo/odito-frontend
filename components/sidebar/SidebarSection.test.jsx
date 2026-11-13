import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { sidebarSections } from './sidebar-config'

let mockPathname = '/app/domain-overview'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock('framer-motion', () => ({
  motion: { div: ({ children }) => <div>{children}</div>, span: ({ children, className }) => <span className={className}>{children}</span> },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import { SidebarSection } from './SidebarSection'

const section = (id) => sidebarSections.find((s) => s.id === id)

describe('SidebarSection: the Rankings & traffic group', () => {
  it('renders the link under its group heading, in a landmark named after it', () => {
    render(<SidebarSection section={section('domain-overview')} />)
    expect(screen.getByRole('navigation', { name: 'Rankings & traffic' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Domain overview/ })
    expect(link).toHaveAttribute('href', '/app/domain-overview')
    expect(link).toHaveAttribute('aria-current', 'page') // it is the active page on its own route
    expect(screen.getByText('Rankings & traffic')).toBeInTheDocument()
  })

  it('is not marked active on another route', () => {
    mockPathname = '/app/dashboard'
    render(<SidebarSection section={section('domain-overview')} />)
    expect(screen.getByRole('link', { name: /Domain overview/ })).not.toHaveAttribute('aria-current')
    mockPathname = '/app/domain-overview'
  })

  it('shows the SEO parent heading on the first group', () => {
    render(<SidebarSection section={section('site-audit')} />)
    expect(screen.getByText('SEO')).toBeInTheDocument()
    expect(screen.getByText('Site audit')).toBeInTheDocument()
  })

  it('groups that do have a label still show it and name their landmark after it', () => {
    render(<SidebarSection section={section('leads')} />)
    expect(screen.getByText('Leads')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Leads' })).toBeInTheDocument()
  })
})

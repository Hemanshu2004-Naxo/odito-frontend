import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({ default: ({ href, children, ...p }) => <a href={href} {...p}>{children}</a> }))
vi.mock('@/hooks/useDashboardQueries', () => ({
  useIssueUrls: () => ({ data: { data: [{ url: 'https://a.com/', issue_message: '12 images without alt text' }] }, isLoading: false }),
}))

import OnPageIssuesView from './OnPageIssuesView'

const issues = [
  { issue_code: 'images_missing_alt_text', title: 'Images missing alt text', severity: 'high', category: 'Images', pages_affected: 4, page_urls: ['https://a.com/', 'https://a.com/x'] },
  { issue_code: 'thin_content', title: 'Thin content', severity: 'low', category: 'Content', pages_affected: 1, page_urls: ['https://a.com/x'] },
]
const summary = { total_pages_analyzed: 5 }
const setup = (props = {}) => {
  const onOpenIssue = vi.fn()
  render(<OnPageIssuesView issues={issues} summary={summary} projectId="p" autoFixIds={new Set(['images_missing_alt_text'])} onOpenIssue={onOpenIssue} {...props} />)
  return onOpenIssue
}

describe('OnPageIssuesView', () => {
  it('shows the cards, quick win and the issue list', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'On-Page issues' })).toBeInTheDocument()
    expect(screen.getByText('High priority')).toBeInTheDocument()
    expect(screen.getByText(/Quick win/)).toBeInTheDocument()
    expect(screen.getByText('Images missing alt text')).toBeInTheDocument()
  })

  it('filters by severity card and by who fixes', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /High priority/ }))
    expect(screen.queryByText('Thin content')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /All issues/ }))
    fireEvent.click(screen.getByRole('button', { name: 'You' }))
    expect(screen.queryByText('Images missing alt text')).toBeNull()
    expect(screen.getByText('Thin content')).toBeInTheDocument()
  })

  it('expands a row to its pages and opens the fix workspace with the page', () => {
    const open = setup()
    fireEvent.click(screen.getByText('Images missing alt text'))
    expect(screen.getByText('12 images without alt text')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    expect(open).toHaveBeenCalledWith('images_missing_alt_text', 'https://a.com/')
  })

  it('Fix with AI opens the issue; By page lists pages worst first', () => {
    const open = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Fix with AI' }))
    expect(open).toHaveBeenCalledWith('images_missing_alt_text')
    fireEvent.click(screen.getByRole('tab', { name: 'By page' }))
    expect(screen.getByText('2 of 2 pages shown')).toBeInTheDocument()
  })
})

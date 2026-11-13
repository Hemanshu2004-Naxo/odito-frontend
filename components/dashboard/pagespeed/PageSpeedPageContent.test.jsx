import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import fs from 'fs'
import path from 'path'

const device = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../lib/pagespeed/__fixtures__/lh13-mobile.json'), 'utf8'))
let response

vi.mock('@/contexts/ProjectContext', () => ({ useProject: () => ({ activeProjectId: 'p1', isLoading: false }) }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }) }))
vi.mock('@/hooks/useDashboardQueries', () => ({
  usePageSpeedData: () => ({ data: response, isLoading: false }),
  usePageSpeedStatus: () => ({ data: { data: { scan_status: 'completed' } }, isLoading: false }),
  usePageSpeedRescan: () => ({ mutate: vi.fn(), isPending: false }),
}))

import PageSpeedPageContent from './PageSpeedPageContent'

beforeEach(() => {
  response = { success: true, data: { mobile: device, desktop: null, domain: 'asgeyehospital.com' } }
  Element.prototype.scrollIntoView = vi.fn()
})

describe('PageSpeedPageContent explainer', () => {
  it('explains the score and lists the fix plan from real data', () => {
    render(<PageSpeedPageContent />)
    expect(screen.getByRole('heading', { name: `Why your mobile score is ${device.performance_score}` })).toBeTruthy()
    expect(screen.getByText(/Real Chrome visitors on this page fail/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Your fix plan' })).toBeTruthy()
    expect(screen.getByText('WORDPRESS + ELEMENTOR DETECTED')).toBeTruthy()
    expect(screen.queryByText(/traffic loss/i)).toBeNull()
    expect(screen.queryByText(/This result is from an older scan/)).toBeNull()
  })

  it('opens a fix with steps, WordPress steps and real evidence', () => {
    render(<PageSpeedPageContent />)
    const btn = screen.getByRole('button', { name: /Third-party services are slowing the page/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const item = btn.closest('.psx-item')
    expect(within(item).getByText('How to fix it')).toBeTruthy()
    expect(within(item).getByText('On WordPress + Elementor')).toBeTruthy()
    expect(within(item).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('metric row explains itself and jumps to its causes', () => {
    render(<PageSpeedPageContent />)
    const tbt = screen.getByRole('button', { name: /^TBT/ })
    fireEvent.click(tbt)
    expect(screen.getByText(/worth 30 of 100 points/)).toBeTruthy()
    const cause = screen.getAllByRole('button', { name: 'JavaScript keeps the phone busy' })[0]
    fireEvent.click(cause)
    const planBtn = document.querySelector('#psx-item-bootup-time > button')
    expect(planBtn.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows the rescan notice for scans saved before this change', () => {
    const old = JSON.parse(JSON.stringify(device))
    delete old.audits; delete old.field_data; delete old.score_weights; delete old.lab_environment
    response = { success: true, data: { mobile: old, desktop: null, domain: 'asgeyehospital.com' } }
    render(<PageSpeedPageContent />)
    expect(screen.getByText(/This result is from an older scan/)).toBeTruthy()
    expect(screen.getByText(/Rescan to load real-visitor data/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Why your mobile score is/ })).toBeTruthy()
  })
})

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { renderWithClient, apiError, businessProfileData } from '@/test-utils/socialMediaAI'

const api = vi.hoisted(() => ({ getSocialApprovalSettings: vi.fn(), updateSocialApprovalSettings: vi.fn(), getSocialBusinessProfile: vi.fn(), updateSocialBusinessProfile: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))

let project = { _id: 'proj-1', project_name: 'Acme' }
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())
let searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }))
vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({ activeProject: project, activeProjectId: project ? project._id : null, projects: [], setActiveProject: vi.fn() }),
}))

import SocialMediaSettingsPage from './page'

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  project = { _id: 'proj-1', project_name: 'Acme' }
  searchParams = new URLSearchParams()
  api.getSocialBusinessProfile.mockResolvedValue(businessProfileData({ google: true }))
})

const settings = (o = {}) => ({ success: true, data: { settings: { contentApprovalRequired: true, designApprovalRequired: true, ...o } } })
const sw = (name) => screen.getByRole('switch', { name })

describe('Settings — approval rules are saved by the backend', () => {
  it('the two approval switches show the BACKEND values (not the hardcoded defaults)', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings({ contentApprovalRequired: false, designApprovalRequired: true }))
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Content approval required')).toHaveAttribute('data-state', 'unchecked'))
    expect(sw('Design approval required')).toHaveAttribute('data-state', 'checked')
    expect(api.getSocialApprovalSettings).toHaveBeenCalledWith('proj-1')
  })

  it('switches are disabled until the backend values are known (no toggling a guess)', async () => {
    api.getSocialApprovalSettings.mockReturnValue(new Promise(() => {}))
    renderWithClient(<SocialMediaSettingsPage />)
    expect(sw('Content approval required')).toBeDisabled()
    expect(sw('Design approval required')).toBeDisabled()
  })

  it('toggling saves the opposite value through the API and shows the saved state from the backend', async () => {
    api.getSocialApprovalSettings.mockResolvedValueOnce(settings())
    api.updateSocialApprovalSettings.mockResolvedValue(settings({ contentApprovalRequired: false }))
    api.getSocialApprovalSettings.mockResolvedValue(settings({ contentApprovalRequired: false }))
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Content approval required')).not.toBeDisabled())
    fireEvent.click(sw('Content approval required'))
    await waitFor(() => expect(api.updateSocialApprovalSettings).toHaveBeenCalledWith('proj-1', { contentApprovalRequired: false }))
    await waitFor(() => expect(sw('Content approval required')).toHaveAttribute('data-state', 'unchecked'))
    expect(await screen.findByText('Approval setting saved.')).toBeInTheDocument()
  })

  it('a save failure is reported and the switch keeps the backend value', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    api.updateSocialApprovalSettings.mockRejectedValue(apiError('Could not save', { status: 500 }))
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Design approval required')).not.toBeDisabled())
    fireEvent.click(sw('Design approval required'))
    expect(await screen.findByText('Could not save')).toBeInTheDocument()
    await waitFor(() => expect(sw('Design approval required')).toHaveAttribute('data-state', 'checked'))
  })

  it('the rules that have no backend yet are labelled as preview-only; the two real ones are not', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Content approval required')).not.toBeDisabled())
    expect(screen.getByTestId('rule-unsaved-autoPublishApproved')).toHaveTextContent('Preview only')
    expect(screen.queryByTestId('rule-unsaved-contentApprovalRequired')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rule-unsaved-designApprovalRequired')).not.toBeInTheDocument()
  })
})

describe('Settings — application configuration plus the Brand kit (business information lives in Business Profile)', () => {
  const tabNames = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => ['Publishing', 'Team & approvals', 'Notifications', 'Business profile', 'Brand kit'].includes(t))

  it('the tabs are Publishing, Team & approvals, Notifications and Brand kit — no Business profile tab — and Publishing is the default', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    expect(tabNames()).toEqual(['Publishing', 'Team & approvals', 'Notifications', 'Brand kit'])
    expect(await screen.findByText('Default publishing platforms')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publishing' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the Brand kit tab shows the full Brand Kit (logo, identity, strategy, messaging, colours, fonts, preview) — and no business information', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Brand kit' }))
    const kit = await screen.findByTestId('brand-kit')
    for (const id of ['brand-logo', 'editor-identity', 'editor-strategy', 'editor-messaging', 'editor-brand', 'brand-preview']) {
      expect(within(kit).getAllByTestId(id), id).toHaveLength(1)
    }
    expect(within(kit).getByLabelText('Heading font')).toBeInTheDocument()
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument()
    expect(screen.queryByTestId('editor-overrides')).not.toBeInTheDocument()
    expect(api.getSocialBusinessProfile).toHaveBeenCalledWith('proj-1')
  })

  it('?tab=brand-kit opens the Brand kit tab directly (the link other pages use); an unknown tab falls back to Publishing', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    searchParams = new URLSearchParams('tab=brand-kit')
    const view = renderWithClient(<SocialMediaSettingsPage />)
    expect(await screen.findByTestId('brand-kit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Brand kit' })).toHaveAttribute('aria-pressed', 'true')
    view.unmount()

    searchParams = new URLSearchParams('tab=nope')
    renderWithClient(<SocialMediaSettingsPage />)
    expect(screen.getByRole('button', { name: 'Publishing' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the business profile is requested only once the Brand kit tab is opened', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Content approval required')).not.toBeDisabled())
    expect(api.getSocialBusinessProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Brand kit' }))
    await screen.findByTestId('brand-kit')
    expect(api.getSocialBusinessProfile).toHaveBeenCalledTimes(1)
  })

  it('no business, brand, services, products or Google information is shown or editable in the other tabs, and none is requested', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    for (const name of ['Publishing', 'Team & approvals', 'Notifications']) {
      fireEvent.click(screen.getByRole('button', { name }))
      for (const id of ['business-model', 'resolved-facts', 'editor-overrides', 'editor-strategy', 'editor-identity', 'editor-messaging', 'editor-brand', 'brand-logo', 'brand-preview', 'services', 'product-catalog', 'gbp-status', 'fact-name']) {
        expect(screen.queryByTestId(id), `${id} in ${name}`).not.toBeInTheDocument()
      }
      expect(screen.queryByText(/What type of business/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/as Social AI sees/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Heading font')).not.toBeInTheDocument()
    }
    expect(api.getSocialBusinessProfile).not.toHaveBeenCalled()
    expect(api.updateSocialBusinessProfile).not.toHaveBeenCalled()
  })

  it('the approval rules appear once (they used to be repeated under the Brand kit tab) and a link says where the business details went', async () => {
    api.getSocialApprovalSettings.mockResolvedValue(settings())
    renderWithClient(<SocialMediaSettingsPage />)
    await waitFor(() => expect(sw('Content approval required')).not.toBeDisabled())
    expect(screen.getAllByRole('switch', { name: 'Content approval required' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Business Profile' })).toHaveAttribute('href', '/app/social-media/business-profile')
  })
})

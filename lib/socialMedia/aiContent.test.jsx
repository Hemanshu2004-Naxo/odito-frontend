import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

// apiService reads NEXT_PUBLIC_API_URL at import time via apiConfig.
vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.test.local/api')

import { generatorOptions, approvalTabFor, reviewHref, approvalNote } from './aiContent'
import { mapPublicationToPost, mapPublicationToApprovalPost } from './postMapper'
import { strategyResponse, strategyDoc, managedPublication, publication } from '@/test-utils/socialMediaAI'
import { ApprovalPostItem } from '@/components/social-media/ApprovalPostItem'
import { PostBrief } from '@/components/social-media/PostBrief'

const { default: apiService } = await import('../apiService')

let fetchMock
beforeEach(() => {
  localStorage.setItem('token', 'jwt-123')
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: {} }), headers: new Headers() }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('apiService - single-post AI content', () => {
  it('generate POSTs only projectId + platform + contentPillar + objective to /social/ai-content/generate', async () => {
    await apiService.generateSocialAIContent('proj-1', { platform: 'facebook', contentPillar: 'Dental tips', objective: 'educational', connected: true, content: 'forged', socialAccountId: 'x' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test.local/api/social/ai-content/generate')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ projectId: 'proj-1', platform: 'facebook', contentPillar: 'Dental tips', objective: 'educational' })
  })

  it('status GETs /social/ai-content/status with the project (and the generation id when given)', async () => {
    await apiService.getSocialAIContentStatus('proj-1')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test.local/api/social/ai-content/status?projectId=proj-1')
    await apiService.getSocialAIContentStatus('proj-1', 'gen-9')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test.local/api/social/ai-content/status?projectId=proj-1&generationId=gen-9')
  })
})

describe('generator option helpers', () => {
  const state = (profile) => strategyResponse({ status: 'ready', strategy: strategyDoc(), profile }).data

  it('are derived from the stored strategy and the server\'s connection report only', () => {
    const o = generatorOptions(state({ connectedPlatforms: { facebook: true, instagram: true } }))
    expect(o.platforms).toEqual([{ value: 'facebook', label: 'Facebook', connected: true }, { value: 'instagram', label: 'Instagram', connected: true }])
    expect(o.pillars.map((p) => p.value)).toEqual(['Dental tips', 'Meet the team'])
    expect(o.objectives.map((x) => x.value)).toEqual(['educational', 'behind_the_scenes', 'soft_sell'])
  })

  it('a missing connection report means NOT connected (never assumed), and a zero-percent mix type is not offered', () => {
    const base = state({ connectedPlatforms: undefined })
    const o = generatorOptions({ ...base, profile: { ...base.profile, connectedPlatforms: undefined } })
    expect(o.platforms.every((p) => p.connected === false)).toBe(true)
    const doc = strategyDoc({ strategy: { contentMix: [{ type: 'educational', percentage: 100, rationale: '' }, { type: 'hard_sell', percentage: 0, rationale: '' }] } })
    expect(generatorOptions(strategyResponse({ status: 'ready', strategy: doc }).data).objectives.map((x) => x.value)).toEqual(['educational'])
  })

  it('no strategy -> nothing to offer', () => {
    expect(generatorOptions(null)).toEqual({ platforms: [], pillars: [], objectives: [] })
    expect(generatorOptions(strategyResponse({ status: 'none' }).data)).toEqual({ platforms: [], pillars: [], objectives: [] })
  })

  it('"Review content" targets the EXISTING approvals tab the draft really sits in', () => {
    expect(approvalTabFor('content_review')).toBe('content-review')
    expect(approvalTabFor('content_approved')).toBe('approved')
    expect(approvalTabFor('design_review')).toBe('design-review')
    expect(approvalTabFor(null)).toBe('drafts')
    expect(reviewHref('content_review')).toBe('/app/social-media/content-approvals?tab=content-review')
    expect(approvalNote('content_review')).toBe('Waiting for content review')
    expect(approvalNote(null)).toBe('Saved as a draft')
  })
})

describe('AI provenance in the existing approvals UI', () => {
  const aiMeta = { source: 'ai', type: 'social_content', strategyVersion: 3, contentPillar: 'Dental tips', objective: 'soft_sell' }

  it('the mapper carries AI provenance through, and is null for every post that is not AI-made (or a spoofed source)', () => {
    expect(mapPublicationToPost(managedPublication('content_review', { generation: aiMeta })).generation).toEqual(aiMeta)
    expect(mapPublicationToPost(publication()).generation).toBeNull()
    expect(mapPublicationToPost(publication({ generation: null })).generation).toBeNull()
    expect(mapPublicationToPost(publication({ generation: { source: 'human' } })).generation).toBeNull()
    expect(mapPublicationToApprovalPost(managedPublication('content_review', { generation: aiMeta })).approvalTabs).toEqual(['content-review'])
  })

  it('an AI draft is listed in Content review like any other post and carries an "AI-generated" badge; others do not', () => {
    const ai = mapPublicationToApprovalPost(managedPublication('content_review', { generation: aiMeta }))
    const plain = mapPublicationToApprovalPost(managedPublication('content_review'))
    const { unmount } = render(<ApprovalPostItem post={ai} selected={false} onSelect={() => {}} />)
    expect(screen.getByTestId('ai-badge')).toHaveTextContent('AI-generated')
    unmount()
    render(<ApprovalPostItem post={plain} selected={false} onSelect={() => {}} />)
    expect(screen.queryByTestId('ai-badge')).not.toBeInTheDocument()
  })

  it('the post brief shows the pillar at once, and source, objective and strategy version under Details for an AI draft - and nothing extra for others', () => {
    const ai = mapPublicationToApprovalPost(managedPublication('content_review', { generation: aiMeta }))
    const { container, unmount } = render(<PostBrief post={ai} />)
    expect(container.textContent).toContain('Dental tips')
    expect(container.textContent).not.toContain('AI-generated')
    fireEvent.click(screen.getByTestId('brief-details-toggle'))
    const text = container.textContent
    expect(text).toContain('AI-generated')
    expect(text).toContain('Dental tips')
    expect(text).toContain('Soft sell')
    expect(within(container).getByText('Strategy version').parentElement).toHaveTextContent('3')
    unmount()
    const plain = render(<PostBrief post={mapPublicationToApprovalPost(managedPublication('content_review'))} />)
    fireEvent.click(screen.getByTestId('brief-details-toggle'))
    expect(plain.container.textContent).not.toContain('AI-generated')
    expect(plain.container.textContent).not.toContain('Strategy version')
  })
})

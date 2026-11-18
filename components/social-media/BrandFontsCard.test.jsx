import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithClient } from '@/test-utils/socialMediaAI'
import { studioState } from '@/test-utils/socialStudio'

const api = vi.hoisted(() => ({ uploadSocialBrandFont: vi.fn(), deleteSocialBrandFont: vi.fn() }))
vi.mock('@/lib/apiService', () => ({ default: api }))
vi.mock('next/link', async () => (await import('@/test-utils/socialMediaAI')).nextLinkMock())

import { BrandFontsCard, fontFileProblem } from './BrandFontsCard'
import { ConceptStudio } from './studio/ConceptStudio'

const FONTS = { heading: { regular: null, bold: { family: 'DM Sans', format: 'ttf', size: 74_000, uploadedAt: '2026-11-17T10:00:00.000Z' } }, body: { regular: null, bold: null } }
const fontFile = (name = 'Brand-Bold.ttf', size = 70_000) => new File([new Uint8Array(size)], name, { type: 'font/ttf' })

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()) })

describe('Brand fonts (Brand Kit)', () => {
  it('shows what is uploaded per role and weight, and warns about a named font without a file', () => {
    renderWithClient(<BrandFontsCard projectId="proj-1" fonts={FONTS} names={{ heading: 'DM Sans', body: 'Gotham' }} />)
    expect(screen.getByTestId('brand-font-heading-bold')).toHaveTextContent('DM Sans · TTF · 72 KB')
    expect(screen.getByTestId('brand-font-heading-regular')).toHaveTextContent('Not uploaded')
    expect(screen.queryByTestId('brand-font-heading-fallback')).toBeNull()
    expect(screen.getByTestId('brand-font-body-fallback')).toHaveTextContent('Gotham')
  })

  it('uploads a font for the chosen role and weight; a non-font file is refused before upload', async () => {
    api.uploadSocialBrandFont.mockResolvedValue({ success: true, data: null })
    renderWithClient(<BrandFontsCard projectId="proj-1" fonts={FONTS} names={{}} />)
    fireEvent.click(screen.getByLabelText('Upload body font regular'))
    fireEvent.change(screen.getByTestId('brand-font-input'), { target: { files: [fontFile('logo.png')] } })
    expect(await screen.findByText('Upload a TTF, OTF or WOFF2 font file.')).toBeInTheDocument()
    expect(api.uploadSocialBrandFont).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Upload body font regular'))
    fireEvent.change(screen.getByTestId('brand-font-input'), { target: { files: [fontFile('Body-Regular.otf')] } })
    await waitFor(() => expect(api.uploadSocialBrandFont).toHaveBeenCalledWith('proj-1', expect.any(File), { role: 'body', weight: 'regular' }, undefined))
  })

  it('removes an uploaded font', async () => {
    api.deleteSocialBrandFont.mockResolvedValue({ success: true, data: null })
    renderWithClient(<BrandFontsCard projectId="proj-1" fonts={FONTS} names={{}} />)
    fireEvent.click(screen.getByLabelText('Remove heading font bold'))
    await waitFor(() => expect(api.deleteSocialBrandFont).toHaveBeenCalledWith('proj-1', { role: 'heading', weight: 'bold' }))
  })

  it('checks extension and size in the browser', () => {
    expect(fontFileProblem(fontFile('a.woff2'))).toBeNull()
    expect(fontFileProblem(fontFile('a.woff'))).toMatch(/TTF, OTF or WOFF2/)
    expect(fontFileProblem(fontFile('a.ttf', 6 * 1024 * 1024))).toMatch(/5 MB/)
  })
})

describe('Creative Studio says when a brand font cannot be used', () => {
  it('names the unavailable font and links to the Brand Kit', () => {
    const studio = studioState({ pipeline: 'concept', formats: { single: { allowed: true }, carousel: { allowed: false, points: 0, reason: 'x' } }, costs: { post: { usd: 0 }, month: { usd: 0 } }, brand: { ...studioState().brand, fonts: { heading: 'Gotham', body: null, unavailable: ['Gotham'] } } })
    renderWithClient(<ConceptStudio projectId="proj-1" publicationId="pub-1" studio={studio} />)
    expect(screen.getByTestId('brand-font-unavailable')).toHaveTextContent('“Gotham” is not available to the designer')
    expect(screen.getByRole('link', { name: /Upload the font file in Brand Kit/ })).toHaveAttribute('href', '/app/social-media/business-profile')
  })
})

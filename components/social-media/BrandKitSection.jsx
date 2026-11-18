"use client"

import { BrandLogoCard } from './BrandLogoCard'
import { BrandFontsCard } from './BrandFontsCard'
import { SocialBusinessProfileEditor } from './SocialBusinessProfileEditor'
import { SocialMediaImage } from './SocialMediaImage'
import { hasValue } from '@/lib/socialMedia/businessProfile'

/**
 * A live preview built ONLY from real data: the brand (or business) name, description and logo, and the colours /
 * fonts / tagline the user saved. With nothing saved it falls back to neutral styling, not invented brand values.
 */
function BrandPreview({ resolvedProfile }) {
  const { business, media, brand } = resolvedProfile
  const name = brand.name || business.name.value || 'Your business'
  const descriptionSource = brand.description || (hasValue(business.description) ? business.description.value : null)
  const description = descriptionSource ? String(descriptionSource).slice(0, 160) : null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="brand-preview">
      <h3 className="text-base font-bold text-slate-900">Brand preview</h3>
      <p className="mt-1 text-sm text-slate-500">Your brand name and logo with the colours, fonts and tagline you saved.</p>
      <div className="mt-4 rounded-xl border border-slate-200 p-5" style={{ fontFamily: brand.fontBody || undefined }}>
        <div className="flex items-center gap-3">
          {hasValue(media.logo) ? (
            <SocialMediaImage src={media.logo.value} alt="Business logo" className="h-10 w-10 shrink-0 rounded-lg" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500" aria-hidden>{name.charAt(0).toUpperCase()}</span>
          )}
          <p className="text-lg font-extrabold leading-tight" data-testid="brand-preview-name" style={{ color: brand.primaryColor || undefined, fontFamily: brand.fontHeading || undefined }}>{name}</p>
        </div>
        <span className="mt-3 block h-1 w-12 rounded-full bg-slate-200" data-testid="brand-preview-accent" style={brand.accentColor ? { background: brand.accentColor } : undefined} />
        {brand.tagline && <p className="mt-3 text-sm font-semibold italic text-slate-700" data-testid="brand-preview-tagline">{brand.tagline}</p>}
        {description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
    </div>
  )
}

/**
 * The Brand Kit — everything the user defines about the brand, in one section of Business Profile: logo (their own
 * upload, falling back to the Google / website logo), identity, audience & strategy, messaging, colours and fonts,
 * with a live preview. Presentational: Business Profile owns the query. Every form saves only its own fields, and
 * every field lives in exactly one form.
 */
export function BrandKitSection({ projectId, resolvedProfile, editableProfile }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" data-testid="brand-kit">
      <div className="space-y-5">
        <BrandLogoCard projectId={projectId} logo={resolvedProfile.media.logo} />
        <BrandFontsCard projectId={projectId} fonts={editableProfile?.brand?.fonts} names={{ heading: editableProfile?.brand?.fontHeading || null, body: editableProfile?.brand?.fontBody || null }} />
        <SocialBusinessProfileEditor projectId={projectId} section="identity" profile={editableProfile} />
        <SocialBusinessProfileEditor projectId={projectId} section="strategy" profile={editableProfile} />
        <SocialBusinessProfileEditor projectId={projectId} section="messaging" profile={editableProfile} />
        <SocialBusinessProfileEditor projectId={projectId} section="brand" profile={editableProfile} />
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <BrandPreview resolvedProfile={resolvedProfile} />
      </div>
    </div>
  )
}

export default BrandKitSection

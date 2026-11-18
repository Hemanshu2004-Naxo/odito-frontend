"use client"

import { BrandKitSection } from './BrandKitSection'
import { SocialBusinessProfileBoundary } from './SocialBusinessProfileBoundary'
import { useSocialBusinessProfile } from '@/hooks/useSocialMediaAI'

/**
 * Settings → Brand kit tab: the Brand Kit (logo, identity, audience & strategy, messaging, colours, fonts, preview).
 * Mounted only while the tab is open, so the business profile is requested only then. It reads the same
 * React Query entry as Business Profile, so saves here show up there and vice versa.
 */
export function BrandKitSettings({ projectId }) {
  const query = useSocialBusinessProfile(projectId)
  return (
    <section aria-labelledby="brand-kit-heading" data-testid="settings-brand-kit">
      <div className="mb-4">
        <h2 id="brand-kit-heading" className="text-lg font-bold tracking-tight text-slate-900">Brand Kit</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your brand and audience: logo, voice, messaging, colours and fonts.</p>
      </div>
      <SocialBusinessProfileBoundary projectId={projectId} query={query}>
        {({ resolvedProfile, editableProfile }) => (
          <BrandKitSection key={projectId} projectId={projectId} resolvedProfile={resolvedProfile} editableProfile={editableProfile} />
        )}
      </SocialBusinessProfileBoundary>
    </section>
  )
}

export default BrandKitSettings

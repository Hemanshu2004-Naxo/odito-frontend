"use client"

import Link from 'next/link'
import { BusinessModelSelector } from './BusinessModelSelector'
import { ProductCatalog } from './ProductCatalog'
import { ResolvedBusinessFacts } from './ResolvedBusinessFacts'
import { ServicesEditor } from './ServicesEditor'
import { SocialBusinessProfileEditor } from './SocialBusinessProfileEditor'
import { SocialBusinessProfileBoundary } from './SocialBusinessProfileBoundary'
import { useProject } from '@/contexts/ProjectContext'
import { useSocialBusinessProfile } from '@/hooks/useSocialMediaAI'
import { googleConnectionLabel, formatDateTime } from '@/lib/socialMedia/businessProfile'

function SectionHeader({ id, number, title, description }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{number}</span>
      <div>
        <h2 id={id} className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

/** Where the data came from, in one read-only line, with the way to manage the connection (it is managed in Connect Accounts). */
function DataSources({ googleStatus, meta }) {
  const usable = !!meta?.hasGoogleBusinessProfile
  const syncedAt = formatDateTime(meta?.lastGoogleSyncAt)
  return (
    <p className="mt-3 text-sm text-slate-500" data-testid="data-sources">
      Data sources, in order of priority: <span className="font-medium text-slate-700">your own values</span>, then{' '}
      <span className="font-medium text-slate-700">Google Business Profile</span> ({usable ? `${googleConnectionLabel(googleStatus)}${syncedAt ? `, last synced ${syncedAt}` : ''}` : googleConnectionLabel(googleStatus)}), then your{' '}
      <span className="font-medium text-slate-700">project and website</span>. Manage the Google connection in{' '}
      <Link href="/app/social-media/connect-accounts" className="font-medium text-violet-600 hover:text-violet-700">Connect Accounts</Link>.
    </p>
  )
}

/**
 * Business Profile — the ONE place to manage a project's business and brand for Social AI:
 *   1 Business type · 2 Business information · 3 Services or Products · 4 How Social AI sees it.
 * Server state lives in React Query (useSocialBusinessProfile, the same entry Connect Accounts reads for the Google
 * connection, so one request serves both pages); there is no local copy. The business type is the user's own answer
 * and decides whether Services or the Product Catalog is offered.
 */
export function BusinessProfileScreen() {
  const { activeProjectId } = useProject()
  const query = useSocialBusinessProfile(activeProjectId)

  return (
    <SocialBusinessProfileBoundary projectId={activeProjectId} query={query}>
      {({ resolvedProfile, editableProfile, googleStatus }) => {
        const model = editableProfile.businessModel
        return (
          <div className="space-y-10" key={activeProjectId} data-testid="business-profile-page">
            <nav aria-label="Business Profile sections" className="flex flex-wrap gap-2 text-sm">
              {[
                ['#business-type', 'Business type'], ['#business-information', 'Business information'],
                ['#offerings', model === 'product' ? 'Products' : model === 'service' ? 'Services' : 'Services or products'], ['#social-ai-view', 'How Social AI sees it'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">{label}</a>
              ))}
            </nav>

            <section aria-labelledby="business-type" className="scroll-mt-20">
              <SectionHeader id="business-type" number="1" title="Business type" description="Tell Odito what kind of business this is. It decides whether you manage Services or a Product Catalog below." />
              <BusinessModelSelector projectId={activeProjectId} value={model} fact={resolvedProfile.business.businessModel} />
            </section>

            <section aria-labelledby="business-information" className="scroll-mt-20">
              <SectionHeader id="business-information" number="2" title="Business information" description="What Social AI knows about your business. Each field shows where its value comes from; type your own to use it instead." />
              <SocialBusinessProfileEditor projectId={activeProjectId} section="overrides" profile={editableProfile} resolved={resolvedProfile} />
            </section>

            <section aria-labelledby="offerings" className="scroll-mt-20">
              <SectionHeader
                id="offerings"
                number="3"
                title={model === 'product' ? 'Products' : model === 'service' ? 'Services' : 'Services or products'}
                description={model === 'product' ? 'The products you sell, with their details and images.' : model === 'service' ? 'The services you provide.' : 'What you offer — shown once you choose your business type.'}
              />
              {model === 'service' && <ServicesEditor projectId={activeProjectId} services={editableProfile.services} />}
              {model === 'product' && <ProductCatalog projectId={activeProjectId} />}
              {!model && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center" data-testid="catalog-choose-model">
                  <p className="text-sm font-semibold text-slate-700">Choose your business type to add what you offer.</p>
                  <p className="mt-1 text-sm text-slate-400">Service-based businesses list their services; product-based businesses build a product catalog with images.</p>
                </div>
              )}
            </section>

            <section aria-labelledby="social-ai-view" className="scroll-mt-20">
              <SectionHeader id="social-ai-view" number="4" title="How Social AI sees your business" description="A read-only preview of the resolved profile your strategy, content and designs are built from." />
              <ResolvedBusinessFacts resolvedProfile={resolvedProfile} />
              <DataSources googleStatus={googleStatus} meta={resolvedProfile.meta} />
            </section>
          </div>
        )
      }}
    </SocialBusinessProfileBoundary>
  )
}

export default BusinessProfileScreen

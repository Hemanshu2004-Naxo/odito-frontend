import { Building2, CheckCircle2, Circle } from 'lucide-react'
import { formatDateTime, PLATFORM_LABELS } from '@/lib/socialMedia/aiStrategy'
import { businessModelLabel } from '@/lib/socialMedia/businessProfile'

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0" data-testid={`context-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-right text-sm ${value ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{value || 'Not set'}</span>
    </div>
  )
}

/**
 * "What this strategy was based on": the exact profile snapshot the AI was given when the strategy was
 * generated (stored with the strategy), not the live profile — so it stays true even after the profile changes.
 */
export function StrategyBusinessContext({ snapshot }) {
  const d = snapshot?.data
  if (!d) return null
  const loc = d.business.location || {}
  const place = [loc.city, loc.region, loc.country].filter(Boolean).join(', ') || loc.address
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="strategy-context">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Building2 className="h-5 w-5" /></span>
        <div>
          <h3 className="text-base font-bold text-slate-900">Based on your Business profile</h3>
          <p className="mt-0.5 text-sm text-slate-600">{formatDateTime(snapshot.generatedAt) ? `As it was on ${formatDateTime(snapshot.generatedAt)}` : 'The profile this strategy was generated from'}</p>
        </div>
      </div>
      <div className="mt-3">
        <Row label="Business" value={d.business.name} />
        <Row label="Business type" value={businessModelLabel(d.businessModel)} />
        <Row label="Category" value={d.business.category} />
        <Row label="Location" value={place} />
        <Row label="Audience" value={d.audience.primary} />
        <Row label="Tone of voice" value={d.toneOfVoice.primary} />
        <Row label="Goals" value={d.goals.length ? `${d.goals.length} defined` : null} />
        <Row label="Unique selling points" value={d.uniqueSellingPoints.length ? `${d.uniqueSellingPoints.length} defined` : null} />
        {/* only for what the stored snapshot actually contains: a strategy made before the catalog existed shows neither row */}
        {d.businessModel === 'service' && <Row label="Services" value={d.services?.length ? `${d.services.length} listed` : null} />}
        {d.businessModel === 'product' && <Row label="Products" value={d.products?.length ? `${d.productCount || d.products.length} listed` : null} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3" data-testid="context-platforms">
        {['facebook', 'instagram'].map((p) => (
          <span key={p} className={`inline-flex items-center gap-1.5 text-sm ${d.connectedPlatforms[p] ? 'text-slate-800' : 'text-slate-600'}`}>
            {d.connectedPlatforms[p] ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
            {PLATFORM_LABELS[p]}{d.connectedPlatforms[p] ? ' connected' : ' not connected'}
          </span>
        ))}
      </div>
    </div>
  )
}

export default StrategyBusinessContext

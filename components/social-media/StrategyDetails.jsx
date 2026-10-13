"use client"

import { useId, useState } from 'react'
import { ChevronDown, Lightbulb, ShieldCheck } from 'lucide-react'
import { StrategyCard, Bullets, Labelled } from './StrategyParts'
import {
  BrandAnalysis, Positioning, TrendingTopics, Hooks, Competitors, Platforms, Cta, Hashtags, Tone, BrandRules, Pillars, Mix,
} from './AIStrategySections'

/** One collapsible area: a title, a one-line preview, and an explicit button. The content is not rendered while it is closed. */
function Panel({ id, title, preview, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const region = useId()
  return (
    <section className="rounded-2xl border border-slate-200 bg-white" data-testid={`details-${id}`}>
      <h3>
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={region} data-testid={`details-toggle-${id}`}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">{title}</span>
            {preview && !open && <span className="mt-0.5 block truncate text-xs text-slate-500" data-testid={`details-preview-${id}`}>{preview}</span>}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-600">{open ? 'Hide' : 'View details'}<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
        </button>
      </h3>
      {open && <div id={region} role="region" aria-label={title} className="space-y-4 border-t border-slate-100 p-4 sm:p-5">{children}</div>}
    </section>
  )
}

const first = (...values) => values.find((v) => (Array.isArray(v) ? v.length : !!v)) || null
const joinPreview = (list, n = 2) => (list || []).slice(0, n).join(' · ')

function PlanOutlook({ o }) {
  return (
    <div className="space-y-4" data-testid="section-outlook">
      {o.seasonalThemes?.length > 0 && (
        <Labelled label="Seasonal themes for your planning period">
          <ul className="flex flex-col gap-2">
            {o.seasonalThemes.map((t) => <li key={t.theme} className="text-sm text-slate-600"><span className="font-semibold text-slate-800">{t.theme}</span>{t.timing ? <span className="text-slate-400"> · {t.timing}</span> : null}<span className="block text-xs text-slate-500">{t.idea}</span></li>)}
          </ul>
        </Labelled>
      )}
      {o.campaignIdeas?.length > 0 && (
        <Labelled label="Campaign ideas">
          <ul className="flex flex-col gap-2" data-testid="campaign-ideas">
            {o.campaignIdeas.map((c) => <li key={c.name} className="text-sm text-slate-600"><span className="font-semibold text-slate-800">{c.name}</span><span className="block text-xs text-slate-500">{c.idea}</span></li>)}
          </ul>
        </Labelled>
      )}
    </div>
  )
}

/**
 * Everything the strategy stores that the main view leaves out, kept one click away. Nothing is dropped: every field the schema stores is
 * reachable here (or in the main view), and a section with no data is simply not offered.
 */
export function StrategyDetails({ strategy: s, basedOn = null }) {
  const outlook = s.planOutlook
  const hasOutlook = outlook && (outlook.seasonalThemes?.length || outlook.campaignIdeas?.length)
  const brand = s.brandAnalysis
  const hasBrand = brand && [brand.strengths, brand.opportunities, brand.risks, brand.weaknesses, brand.differentiators, brand.personality].some((l) => l?.length)
  const t = s.toneAndVoice
  const rules = s.brandRules
  const hasRules = rules && (rules.prohibitedPhrases?.length || rules.messagingRules?.length || rules.visualGuidelines?.length)
  return (
    <section className="space-y-2.5" aria-label="Detailed insights" data-testid="strategy-details">
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900">Detailed insights</h2>
        <p className="text-xs text-slate-500">The full thinking behind the strategy. Open only what you need.</p>
      </div>

      {hasOutlook && (
        <Panel id="outlook" title="Campaign ideas and seasonal themes" preview={first(joinPreview(outlook.campaignIdeas?.map((c) => c.name)), joinPreview(outlook.seasonalThemes?.map((x) => x.theme)))}>
          <PlanOutlook o={outlook} />
        </Panel>
      )}
      <Panel id="content" title="Detailed content recommendations" preview={joinPreview(s.contentPillars.map((p) => p.name), 3)}>
        <Pillars pillars={s.contentPillars} />
        <Mix mix={s.contentMix} />
        {s.trendingTopics && <TrendingTopics topics={s.trendingTopics} />}
        {s.workingHooks?.length > 0 && <Hooks hooks={s.workingHooks} />}
      </Panel>
      <Panel id="voice" title="Brand voice and messaging" preview={first(t.primaryTone, s.positioning?.messagingAngle)}>
        <Tone t={t} />
        <Positioning p={s.positioning} />
      </Panel>
      <Panel id="platforms" title="Platform-specific guidance" preview={joinPreview(s.platformStrategy.map((p) => p.role), 1)}>
        <Platforms platforms={s.platformStrategy} />
        <Cta c={s.ctaStrategy} />
      </Panel>
      <Panel id="hashtags" title="Hashtag guidance" preview={s.hashtagStrategy.enabled ? first(s.hashtagStrategy.approach) : 'Hashtags are not recommended for this business.'}>
        <Hashtags h={s.hashtagStrategy} />
      </Panel>
      {s.competitorAnalysis && (
        <Panel id="competitors" title="Competitor analysis" preview={s.competitorAnalysis.hasCompetitorData ? joinPreview(s.competitorAnalysis.differentiationOpportunities, 1) : 'No competitor data provided.'}>
          <Competitors c={s.competitorAnalysis} />
        </Panel>
      )}
      {hasBrand && (
        <Panel id="brand" title="Brand analysis" preview={joinPreview(brand.strengths, 2)}>
          <BrandAnalysis b={brand} />
        </Panel>
      )}
      {hasRules && (
        <Panel id="rules" title="Brand rules" preview={first(joinPreview(rules.messagingRules, 1), joinPreview(rules.prohibitedPhrases, 3))}>
          <BrandRules r={rules} />
        </Panel>
      )}
      {basedOn && <Panel id="basis" title="What this strategy is based on" preview="The business facts Odito used">{basedOn}</Panel>}
      {(s.recommendations.length > 0 || s.assumptions.length > 0) && (
        <Panel id="more" title="Additional recommendations and assumptions" preview={joinPreview(s.recommendations, 1)}>
          {s.recommendations.length > 0 && <StrategyCard icon={Lightbulb} title="Recommendations" testId="section-recommendations"><Bullets items={s.recommendations} /></StrategyCard>}
          {s.assumptions.length > 0 && <StrategyCard icon={ShieldCheck} title="Assumptions the AI made" subtitle="Check these against what you know about your business." testId="section-assumptions"><Bullets items={s.assumptions} /></StrategyCard>}
        </Panel>
      )}
    </section>
  )
}

export default StrategyDetails

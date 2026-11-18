"use client"

import { Lightbulb, ShieldCheck } from 'lucide-react'
// the Radix primitive itself: the shared ui/tabs wrapper carries dark-theme styles this light page must not inherit
import { Tabs as TabsPrimitive } from 'radix-ui'
import { StrategyCard, Bullets, Labelled } from './StrategyParts'
import {
  BrandAnalysis, Positioning, TrendingTopics, Hooks, Competitors, Platforms, Cta, Hashtags, Tone, BrandRules, Pillars, Mix,
} from './AIStrategySections'

function PlanOutlook({ o }) {
  return (
    <div className="space-y-4" data-testid="section-outlook">
      {o.seasonalThemes?.length > 0 && (
        <Labelled label="Seasonal themes for your planning period">
          <ul className="flex flex-col gap-2">
            {o.seasonalThemes.map((t) => <li key={t.theme} className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{t.theme}</span>{t.timing ? <span className="text-slate-600"> · {t.timing}</span> : null}<span className="block text-sm text-slate-700">{t.idea}</span></li>)}
          </ul>
        </Labelled>
      )}
      {o.campaignIdeas?.length > 0 && (
        <Labelled label="Campaign ideas">
          <ul className="flex flex-col gap-2" data-testid="campaign-ideas">
            {o.campaignIdeas.map((c) => <li key={c.name} className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{c.name}</span><span className="block text-sm text-slate-700">{c.idea}</span></li>)}
          </ul>
        </Labelled>
      )}
    </div>
  )
}

const TRIGGER = 'rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 data-[state=active]:bg-white data-[state=active]:text-violet-800 data-[state=active]:shadow-sm'

/**
 * Everything the strategy stores that the main view leaves out, in four groups (tabs: arrow keys move between them). Nothing is dropped: every
 * stored field is reachable here or in the main view. A section with no data is not offered - in particular there is no competitor analysis
 * when no competitors were supplied (that is listed under "Improve this strategy" instead).
 */
export function StrategyDetails({ strategy: s, basedOn = null }) {
  const outlook = s.planOutlook
  const hasOutlook = outlook && (outlook.seasonalThemes?.length || outlook.campaignIdeas?.length)
  const brand = s.brandAnalysis
  const hasBrand = brand && [brand.strengths, brand.opportunities, brand.risks, brand.weaknesses, brand.differentiators, brand.personality].some((l) => l?.length)
  const rules = s.brandRules
  const hasRules = rules && (rules.prohibitedPhrases?.length || rules.messagingRules?.length || rules.visualGuidelines?.length)
  const hasCompetitors = !!s.competitorAnalysis?.hasCompetitorData

  const groups = [
    {
      id: 'content', label: 'Content & campaigns',
      body: (
        <>
          {hasOutlook && <PlanOutlook o={outlook} />}
          <Pillars pillars={s.contentPillars} />
          <Mix mix={s.contentMix} />
          {s.trendingTopics && <TrendingTopics topics={s.trendingTopics} />}
          {s.workingHooks?.length > 0 && <Hooks hooks={s.workingHooks} />}
        </>
      ),
    },
    {
      id: 'voice', label: 'Brand voice & rules',
      body: (
        <>
          <Tone t={s.toneAndVoice} />
          <Positioning p={s.positioning} />
          {hasBrand && <BrandAnalysis b={brand} />}
          {hasRules && <BrandRules r={rules} />}
        </>
      ),
    },
    {
      id: 'platforms', label: 'Platforms & hashtags',
      body: (
        <>
          <Platforms platforms={s.platformStrategy} />
          <Cta c={s.ctaStrategy} />
          <Hashtags h={s.hashtagStrategy} />
        </>
      ),
    },
    {
      id: 'sources', label: 'Sources & assumptions',
      body: (
        <>
          {basedOn}
          {hasCompetitors && <Competitors c={s.competitorAnalysis} />}
          {s.recommendations.length > 0 && <StrategyCard icon={Lightbulb} title="Recommendations" testId="section-recommendations"><Bullets items={s.recommendations} /></StrategyCard>}
          {s.assumptions.length > 0 && <StrategyCard icon={ShieldCheck} title="Assumptions the AI made" subtitle="Check these against what you know about your business." testId="section-assumptions"><Bullets items={s.assumptions} /></StrategyCard>}
        </>
      ),
    },
  ]

  return (
    <section className="space-y-3" aria-labelledby="strategy-details-title" data-testid="strategy-details">
      <h2 id="strategy-details-title" className="text-base font-bold tracking-tight text-slate-900">Detailed insights</h2>
      <TabsPrimitive.Root defaultValue="content" className="flex flex-col gap-3">
        <TabsPrimitive.List aria-label="Detailed insights" className="flex w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit">
          {groups.map((g) => <TabsPrimitive.Trigger key={g.id} value={g.id} className={TRIGGER} data-testid={`details-tab-${g.id}`}>{g.label}</TabsPrimitive.Trigger>)}
        </TabsPrimitive.List>
        {groups.map((g) => (
          <TabsPrimitive.Content key={g.id} value={g.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:p-5" data-testid={`details-${g.id}`}>
            {g.body}
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </section>
  )
}

export default StrategyDetails

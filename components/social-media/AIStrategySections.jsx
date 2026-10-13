import Link from 'next/link'
import {
  Target, Users, MessageSquare, CalendarDays, Hash, Megaphone, Palette, Lightbulb, Layers, Share2, Compass, Info, Eye, Flame, Anchor, Swords, ShieldCheck, CalendarPlus,
} from 'lucide-react'
import {
  StrategyCard, Bullets, Chips, Labelled, Expandable, Group, Pill,
} from './StrategyParts'
import { MIX_LABELS, PLATFORM_LABELS, PRIORITY_LABELS, WEEKDAY_LABELS, sortedMix } from '@/lib/socialMedia/aiStrategy'
import { HOOK_CATEGORY_LABELS, OBJECTIVE_LABELS, recommendedLabel } from '@/lib/socialMedia/contentCalendar'

const FRESHNESS = { evergreen: 'Evergreen', seasonal: 'Seasonal', emerging: 'Emerging' }
const RELEVANCE_TONE = { high: 'green', medium: 'amber', low: 'slate' }

const hasAny = (...lists) => lists.some((l) => (Array.isArray(l) ? l.length > 0 : !!l))

function Overview({ s }) {
  const o = s.overview
  const firstAudience = s.audience?.primaryAudience
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5" data-testid="strategy-summary">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Target className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Strategy overview</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.summary}</p>
        </div>
      </div>
      {o && (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="overview-fields">
          {[
            ['Positioning', s.positioning?.brandPositioning],
            ['Primary audience', firstAudience || 'Not defined yet'],
            ['Primary objective', o.primaryObjective],
            ['Strongest opportunity', o.strongestOpportunity],
            ['Growth opportunity', o.growthOpportunity],
            ['Platform focus', o.platformFocus],
          ].map(([label, value]) => (
            <div key={label} data-testid={`overview-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

export function BrandAnalysis({ b }) {
  if (!b || !hasAny(b.strengths, b.opportunities, b.risks, b.weaknesses, b.differentiators, b.personality, b.communicationStyle)) return null
  return (
    <StrategyCard icon={Eye} title="Brand analysis" subtitle="Based on your business, brand and offer" testId="section-brand-analysis">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Labelled label="Strengths"><Bullets items={b.strengths} /></Labelled>
        <Labelled label="Opportunities"><Bullets items={b.opportunities} /></Labelled>
        <Labelled label="Risks"><Bullets items={b.risks} /></Labelled>
      </div>
      {hasAny(b.weaknesses, b.differentiators, b.personality, b.communicationStyle) && (
        <Expandable testId="brand-analysis-more">
          <Labelled label="Weaknesses"><Bullets items={b.weaknesses} /></Labelled>
          <Labelled label="Differentiators"><Bullets items={b.differentiators} /></Labelled>
          <Labelled label="Personality"><Chips items={b.personality} /></Labelled>
          <Labelled label="Communication style">{b.communicationStyle}</Labelled>
        </Expandable>
      )}
    </StrategyCard>
  )
}

function Audience({ a }) {
  const none = !a.primaryAudience
  return (
    <StrategyCard icon={Users} title="Audience" testId="section-audience">
      {none ? (
        <p className="text-sm text-slate-500" data-testid="audience-missing">No audience has been defined, so none is assumed. Add one in your <Link href="/app/social-media/business-profile#brand-kit" className="font-semibold text-violet-600 hover:text-violet-700">Business profile</Link>.</p>
      ) : (
        <>
          <Labelled label="Primary audience">{a.primaryAudience}</Labelled>
          {a.secondaryAudiences?.length > 0 && <div className="mt-3"><Labelled label="Also reaching"><Chips items={a.secondaryAudiences} /></Labelled></div>}
          {hasAny(a.painPoints, a.needs, a.motivations, a.buyingTriggers, a.objections, a.interests) && (
            <Expandable testId="audience-more">
              <Labelled label="Pain points"><Bullets items={a.painPoints} /></Labelled>
              <Labelled label="Needs"><Bullets items={a.needs} /></Labelled>
              <Labelled label="Motivations"><Bullets items={a.motivations} /></Labelled>
              <Labelled label="Buying triggers"><Bullets items={a.buyingTriggers} /></Labelled>
              <Labelled label="Objections"><Bullets items={a.objections} /></Labelled>
              <Labelled label="Interests"><Chips items={a.interests} /></Labelled>
            </Expandable>
          )}
        </>
      )}
    </StrategyCard>
  )
}

export function Positioning({ p }) {
  return (
    <StrategyCard icon={Compass} title="Positioning" testId="section-positioning">
      <div className="flex flex-col gap-3">
        <Labelled label="Positioning statement">{p.brandPositioning}</Labelled>
        <Labelled label="Value proposition">{p.valueProposition}</Labelled>
      </div>
      {hasAny(p.keyDifferentiators, p.whyCustomersChoose, p.messagingAngle) && (
        <Expandable testId="positioning-more">
          <Labelled label="Differentiators"><Bullets items={p.keyDifferentiators} /></Labelled>
          <Labelled label="Why customers choose this brand">{p.whyCustomersChoose}</Labelled>
          <Labelled label="Messaging angle">{p.messagingAngle}</Labelled>
        </Expandable>
      )}
    </StrategyCard>
  )
}

function Goals({ goals }) {
  return (
    <StrategyCard icon={Target} title="Goals" testId="section-goals">
      {goals.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {goals.map((g) => (
            <li key={g.goal} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
              <Pill className="mt-0.5">{PRIORITY_LABELS[g.priority]}</Pill>
              <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{g.goal}</p><p className="text-xs text-slate-500">{g.rationale}</p></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500" data-testid="goals-missing">No goals have been defined, so none are assumed. Add them in your Business profile.</p>
      )}
    </StrategyCard>
  )
}

export function Pillars({ pillars }) {
  return (
    <StrategyCard icon={Layers} title="Content pillars" subtitle="The themes to keep returning to, and each one's share of your content" testId="section-pillars">
      <ul className="flex flex-col gap-3">
        {pillars.map((p) => (
          <li key={p.name} data-testid="pillar-card">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{p.name}</span><span className="font-semibold text-violet-600">{p.suggestedPercentage}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${p.suggestedPercentage}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{p.purpose}</p>
            <Expandable label="Topics and formats" openLabel="Hide" testId={`pillar-more-${p.name}`}>
              <Labelled label="Example topics"><Bullets items={p.exampleTopics} /></Labelled>
              <Labelled label="Recommended formats"><Chips items={p.formats} /></Labelled>
              <Labelled label="About">{p.description}</Labelled>
            </Expandable>
          </li>
        ))}
      </ul>
    </StrategyCard>
  )
}

export function Mix({ mix }) {
  return (
    <StrategyCard icon={Layers} title="Content mix" subtitle="The balance of post types" testId="section-mix">
      <ul className="flex flex-col gap-2.5">
        {sortedMix(mix).map((m) => (
          <li key={m.type} data-testid={`mix-${m.type}`}>
            <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800">{MIX_LABELS[m.type] || m.type}</span><span className="font-semibold text-violet-600">{m.percentage}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${m.percentage}%` }} /></div>
            <p className="mt-0.5 text-xs text-slate-500">{m.rationale}</p>
          </li>
        ))}
      </ul>
    </StrategyCard>
  )
}

export function TrendingTopics({ topics }) {
  return (
    <StrategyCard
      icon={Flame}
      title="Recommended current topics"
      subtitle="Suggestions for what to talk about now. Odito has no live trend data, so these are not trend statistics."
      testId="section-trending"
    >
      {topics.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="trending-empty">No standout topics were identified for this business.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {topics.map((t) => (
            <li key={t.topic} className="py-2.5 first:pt-0 last:pb-0" data-testid="trending-topic">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{t.topic}</span>
                <Pill tone={RELEVANCE_TONE[t.relevance]}>{PRIORITY_LABELS[t.relevance]} relevance</Pill>
                <Pill>{FRESHNESS[t.freshness] || t.freshness}</Pill>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{t.whyItMatters}</p>
              <p className="mt-0.5 text-sm text-slate-700"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Angle </span>{t.angle}</p>
            </li>
          ))}
        </ul>
      )}
    </StrategyCard>
  )
}

export function Hooks({ hooks }) {
  const categories = [...new Set(hooks.map((h) => h.category))]
  return (
    <StrategyCard icon={Anchor} title="Working hooks" subtitle="Opening lines written for your business. Your calendar can use them." testId="section-hooks">
      <div className="flex flex-col gap-3">
        {categories.map((c) => (
          <div key={c} data-testid={`hooks-${c}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{HOOK_CATEGORY_LABELS[c] || c}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {hooks.filter((h) => h.category === c).map((h) => <li key={h.hook} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700" data-testid="hook">{h.hook}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </StrategyCard>
  )
}

export function Competitors({ c }) {
  const has = c?.hasCompetitorData
  return (
    <StrategyCard
      icon={Swords}
      title="Competitor analysis"
      subtitle={has ? `Based on the competitors you listed${c.competitorsConsidered?.length ? `: ${c.competitorsConsidered.join(', ')}` : ''}. Odito does not read their accounts.` : undefined}
      testId="section-competitors"
    >
      {!has ? (
        <div data-testid="competitors-none">
          <p className="text-sm text-slate-500">No competitor data provided.</p>
          <Link href="/app/social-media/business-profile#brand-kit" className="mt-1 inline-block text-sm font-semibold text-violet-600 hover:text-violet-700">Add competitors in Business Profile</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Labelled label="What to do differently"><Bullets items={c.differentiationOpportunities} /></Labelled>
          <Labelled label="Content gaps to fill"><Bullets items={c.contentGaps} /></Labelled>
          <Labelled label="Recommendations"><Bullets items={c.recommendations} /></Labelled>
        </div>
      )}
    </StrategyCard>
  )
}

export function Platforms({ platforms }) {
  return (
    <StrategyCard icon={Share2} title="Platform strategy" subtitle="Your platforms" testId="section-platforms">
      <ul className="flex flex-col gap-3">
        {platforms.map((p) => (
          <li key={p.platform} data-testid={`platform-${p.platform}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{PLATFORM_LABELS[p.platform]}</span>
              <Pill tone={p.connected ? 'green' : 'slate'}>{p.connected ? 'Connected' : 'Not connected'}</Pill>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{p.role}</p>
            <div className="mt-1.5"><Chips items={p.contentTypes} /></div>
            {hasAny(p.audienceBehavior, p.guidance) && (
              <Expandable label="Audience and guidance" openLabel="Hide" testId={`platform-more-${p.platform}`}>
                <Labelled label="Audience behaviour">{p.audienceBehavior}</Labelled>
                <Labelled label="Guidance"><Bullets items={p.guidance} /></Labelled>
              </Expandable>
            )}
          </li>
        ))}
      </ul>
    </StrategyCard>
  )
}

function Posting({ s }) {
  const p = s.postingStrategy
  const recommended = recommendedLabel({ range: p.postsPerWeekRange, postsPerWeek: p.postsPerWeek })
  const isV2 = !!p.postsPerWeekRange
  return (
    <StrategyCard
      icon={CalendarDays}
      title="Posting strategy"
      subtitle={isV2 ? 'A recommendation. You choose the real frequency when you create the calendar.' : undefined}
      testId="section-posting"
    >
      <div className="flex flex-col gap-3">
        <Labelled label="Recommended frequency"><span className="font-semibold" data-testid="recommended-frequency">{isV2 ? recommended : `${p.postsPerWeek} posts per week`}</span></Labelled>
        <Labelled label="Best days">{p.recommendedDays.length ? <Chips items={p.recommendedDays.map((d) => WEEKDAY_LABELS[d])} /> : null}</Labelled>
        <Labelled label="Time windows to test"><Bullets items={p.recommendedTimeWindows} /></Labelled>
      </div>
      <Link href="/app/social-media/content-calendar" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700" data-testid="create-calendar-link">
        <CalendarPlus className="h-4 w-4" /> Create content calendar
      </Link>
    </StrategyCard>
  )
}

export function Cta({ c }) {
  return (
    <StrategyCard icon={Megaphone} title="CTA strategy" testId="section-cta">
      <div className="flex flex-col gap-3">
        <Labelled label="Preferred CTAs"><Chips items={c.preferredCTAs} /></Labelled>
        {c.byObjective?.length > 0 && (
          <Labelled label="By objective">
            <ul className="flex flex-col gap-1" data-testid="cta-by-objective">
              {c.byObjective.map((e) => <li key={e.objective} className="text-sm text-slate-600"><span className="font-medium text-slate-800">{OBJECTIVE_LABELS[e.objective] || e.objective}:</span> {e.ctas.join(', ')}</li>)}
            </ul>
          </Labelled>
        )}
        {!c.byObjective?.length && <Labelled label="Objectives"><Bullets items={c.objectives} /></Labelled>}
      </div>
    </StrategyCard>
  )
}

export function Hashtags({ h }) {
  return (
    <StrategyCard icon={Hash} title="Hashtag strategy" testId="section-hashtags">
      {h.enabled ? (
        <div className="flex flex-col gap-3">
          <Labelled label="Approach">{h.approach}</Labelled>
          <Labelled label="Per post"><span className="font-semibold">{h.recommendedCount}</span></Labelled>
          <Labelled label="Categories">{h.categories.length ? <Chips items={h.categories} /> : null}</Labelled>
        </div>
      ) : <p className="text-sm text-slate-500">Hashtags are not recommended for this business.</p>}
    </StrategyCard>
  )
}

export function Tone({ t }) {
  return (
    <StrategyCard icon={MessageSquare} title="Tone & voice" testId="section-tone">
      <div className="flex flex-col gap-3">
        <Labelled label="Primary tone">{t.primaryTone}</Labelled>
        <Labelled label="Also">{t.secondaryTones.length ? <Chips items={t.secondaryTones} /> : null}</Labelled>
      </div>
      {hasAny(t.writingGuidelines, t.avoid) && (
        <Expandable testId="tone-more">
          <Labelled label="Writing guidelines"><Bullets items={t.writingGuidelines} /></Labelled>
          <Labelled label="Avoid"><Bullets items={t.avoid} /></Labelled>
        </Expandable>
      )}
    </StrategyCard>
  )
}

export function BrandRules({ r }) {
  return (
    <StrategyCard icon={Palette} title="Brand rules" testId="section-brand">
      <div className="flex flex-col gap-3">
        <Labelled label="Never use these phrases">{r.prohibitedPhrases.length ? <Chips items={r.prohibitedPhrases} /> : null}</Labelled>
        <Labelled label="Messaging rules"><Bullets items={r.messagingRules} /></Labelled>
        <Labelled label="Visual guidelines"><Bullets items={r.visualGuidelines} /></Labelled>
        {!r.visualGuidelines.length && !r.prohibitedPhrases.length && !r.messagingRules?.length && <p className="text-sm text-slate-500">No brand rules were set.</p>}
      </div>
    </StrategyCard>
  )
}

/**
 * Renders a READY strategy as a COMPACT strategic document: an overview, then grouped cards, each short by default
 * with secondary detail behind an expander. It shows exactly the fields the backend schema stores
 * (service/aiStrategy/strategyOutputSchema.js) and nothing else; a section with nothing in it is omitted rather
 * than filled with placeholder text. A strategy saved before schema version 2 has no brand analysis, topics, hooks or
 * competitor analysis: those sections are simply absent and a note says how to get them.
 */
export function AIStrategySections({ strategy: s }) {
  const goals = s.goals || []
  const v2 = s.schemaVersion >= 2
  return (
    <div className="space-y-6">
      <Overview s={s} />

      {!v2 && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600" data-testid="strategy-legacy-note">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          This strategy was created before brand analysis, recommended topics, working hooks and competitor analysis existed. Regenerate it to include them.
        </p>
      )}

      <Group title="Brand and audience" testId="group-brand">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BrandAnalysis b={s.brandAnalysis} />
          <Audience a={s.audience} />
          <Positioning p={s.positioning} />
          <Goals goals={goals} />
        </div>
      </Group>

      <Group title="Content strategy" description="What to talk about" testId="group-content">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Pillars pillars={s.contentPillars} />
          <Mix mix={s.contentMix} />
          {s.trendingTopics && <TrendingTopics topics={s.trendingTopics} />}
          {s.workingHooks?.length > 0 && <Hooks hooks={s.workingHooks} />}
        </div>
      </Group>

      {s.competitorAnalysis && (
        <Group title="Competitive intelligence" testId="group-competitors">
          <Competitors c={s.competitorAnalysis} />
        </Group>
      )}

      <Group title="Execution strategy" description="Where and how to publish" testId="group-execution">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Platforms platforms={s.platformStrategy} />
          <Posting s={s} />
          <Cta c={s.ctaStrategy} />
          <Hashtags h={s.hashtagStrategy} />
        </div>
      </Group>

      <Group title="Brand guardrails" testId="group-guardrails">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tone t={s.toneAndVoice} />
          <BrandRules r={s.brandRules} />
        </div>
      </Group>

      {(s.recommendations.length > 0 || s.assumptions.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {s.recommendations.length > 0 && <StrategyCard icon={Lightbulb} title="Recommendations" testId="section-recommendations"><Bullets items={s.recommendations} /></StrategyCard>}
          {s.assumptions.length > 0 && <StrategyCard icon={ShieldCheck} title="Assumptions the AI made" subtitle="Check these against what you know about your business." testId="section-assumptions"><Bullets items={s.assumptions} /></StrategyCard>}
        </div>
      )}
    </div>
  )
}

export default AIStrategySections

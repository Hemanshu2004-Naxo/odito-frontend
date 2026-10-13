"use client"

import Link from 'next/link'
import { Target, Users, Layers, CalendarDays, BarChart3, FileText, Info } from 'lucide-react'
import { StrategyCard, Chips, Pill } from './StrategyParts'
import { PLATFORM_LABELS, PRIORITY_LABELS, WEEKDAY_LABELS } from '@/lib/socialMedia/aiStrategy'
import { postsPerWeekLabel, monthsLabel, mixSummary } from '@/lib/socialMedia/strategyPlanning'

const MAX_GOALS = 3
const MAX_METRICS = 4

/**
 * Content pillars as a share of your posts. The numbers are the strategy's; the bars are decoration for them, so the same information is also
 * a plain sentence for screen readers. The percentages add up to 100 (the server corrects small rounding); if stored data ever does not, it says so.
 */
export function PillarMix({ pillars }) {
  const mix = mixSummary(pillars.map((p) => ({ name: p.name, suggestedPercentage: p.suggestedPercentage })))
  const byName = new Map(pillars.map((p) => [p.name, p]))
  return (
    <div data-testid="pillar-mix">
      <p className="sr-only" data-testid="pillar-mix-text">Share of your posts by topic: {mix.text}.</p>
      <ul className="flex flex-col gap-3">
        {mix.list.map((m) => (
          <li key={m.name} data-testid="pillar-card">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{m.name}</span><span className="font-semibold text-violet-600">{m.percent}%</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, m.percent)}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{byName.get(m.name)?.purpose}</p>
          </li>
        ))}
      </ul>
      {!mix.adds && <p className="mt-2 text-xs text-amber-700" data-testid="pillar-mix-warning">These shares add up to {mix.total}%, not 100%. Regenerate the strategy to fix this.</p>}
    </div>
  )
}

/** Up to three goals, each with its reason, in the strategy's own words. */
function Goals({ goals }) {
  const shown = goals.slice(0, MAX_GOALS)
  return (
    <StrategyCard icon={Target} title="Primary goals" subtitle="What this strategy is trying to achieve" testId="section-goals">
      {shown.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {shown.map((g) => (
            <li key={g.goal} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
              <Pill className="mt-0.5">{PRIORITY_LABELS[g.priority]}</Pill>
              <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{g.goal}</p><p className="text-xs text-slate-500">{g.rationale}</p></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500" data-testid="goals-missing">No goals have been defined, so none are assumed. Add them in your <Link href="/app/social-media/business-profile" className="font-semibold text-violet-600">Business profile</Link>.</p>
      )}
      {goals.length > MAX_GOALS && <p className="mt-2 text-xs text-slate-400">{goals.length - MAX_GOALS} more goal{goals.length - MAX_GOALS === 1 ? '' : 's'} in the strategy.</p>}
    </StrategyCard>
  )
}

function Audience({ a, positioning }) {
  if (!a.primaryAudience) {
    return (
      <StrategyCard icon={Users} title="Who you are talking to" testId="section-audience">
        <p className="text-sm text-slate-500" data-testid="audience-missing">No audience has been defined, so none is assumed. Add one in your <Link href="/app/social-media/business-profile#brand-kit" className="font-semibold text-violet-600 hover:text-violet-700">Business profile</Link>.</p>
      </StrategyCard>
    )
  }
  const needs = (a.needs?.length ? a.needs : a.painPoints || []).slice(0, 2)
  return (
    <StrategyCard icon={Users} title="Who you are talking to" subtitle="Your main audience and what to say to them" testId="section-audience">
      <p className="text-sm font-medium text-slate-800">{a.primaryAudience}</p>
      {a.secondaryAudiences?.length > 0 && <div className="mt-2"><Chips items={a.secondaryAudiences} /></div>}
      {needs.length > 0 && <p className="mt-2 text-xs text-slate-500"><span className="font-semibold text-slate-600">They care about: </span>{needs.join(' · ')}</p>}
      {positioning?.messagingAngle && <p className="mt-2 text-sm text-slate-600"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message </span>{positioning.messagingAngle}</p>}
    </StrategyCard>
  )
}

function PostingPlan({ s, planning }) {
  const p = s.postingStrategy
  const perWeek = planning?.postsPerWeek ?? p.postsPerWeek
  const platforms = (s.platformStrategy || []).filter((x) => x.postsPerWeek > 0)
  return (
    <StrategyCard icon={CalendarDays} title="Posting plan" subtitle={planning ? 'The rhythm you chose' : 'A suggestion - you choose the real rhythm when you create the calendar'} testId="section-posting">
      <p className="text-sm font-semibold text-slate-900" data-testid="recommended-frequency">
        {postsPerWeekLabel(perWeek)}{planning ? ` for ${monthsLabel(planning.months)}` : ''}
      </p>
      {planning?.estimatedPosts != null && <p className="text-xs text-slate-500">About {planning.estimatedPosts} planned posts. The exact number is set when you choose a start date.</p>}
      {platforms.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="posting-platforms">
          {platforms.map((x) => (
            <li key={x.platform} className="text-sm text-slate-600"><span className="font-medium text-slate-800">{PLATFORM_LABELS[x.platform]}</span> - {postsPerWeekLabel(x.postsPerWeek)}. {x.role}</li>
          ))}
        </ul>
      )}
      {p.recommendedDays?.length > 0 && <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Good days to post</p><div className="mt-1"><Chips items={p.recommendedDays.map((d) => WEEKDAY_LABELS[d])} /></div></div>}
    </StrategyCard>
  )
}

function SuccessMetrics({ metrics }) {
  return (
    <StrategyCard icon={BarChart3} title="How to tell it is working" subtitle="What to watch, and what good looks like" testId="section-metrics">
      {metrics.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {metrics.slice(0, MAX_METRICS).map((m) => (
            <li key={m.metric} className="py-2 first:pt-0 last:pb-0"><p className="text-sm font-medium text-slate-800">{m.metric}</p><p className="text-xs text-slate-500">{m.whatGoodLooks}</p></li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-sm text-slate-500" data-testid="metrics-missing"><Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />This strategy was made before success measures were included. Regenerate it to add them.</p>
      )}
    </StrategyCard>
  )
}

/**
 * The few things a business owner needs from a strategy, in plain language: the summary, up to three goals, the audience, the content mix, the
 * posting plan and how to tell it is working. Everything else lives in StrategyDetails, behind explicit "View details" buttons.
 */
export function StrategyHighlights({ strategy: s, planning }) {
  const metrics = s.planOutlook?.successMetrics || []
  return (
    <div className="space-y-4" data-testid="strategy-highlights">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5" data-testid="strategy-summary">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0"><h2 className="text-base font-bold text-slate-900">Strategy summary</h2><p className="mt-1 text-sm leading-relaxed text-slate-700">{s.summary}</p></div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Goals goals={s.goals || []} />
        <Audience a={s.audience} positioning={s.positioning} />
        <StrategyCard icon={Layers} title="What you will post about" subtitle="Your content pillars and each one's share of your posts" testId="section-pillars"><PillarMix pillars={s.contentPillars} /></StrategyCard>
        <PostingPlan s={s} planning={planning} />
        <div className="lg:col-span-2"><SuccessMetrics metrics={metrics} /></div>
      </div>
    </div>
  )
}

export default StrategyHighlights

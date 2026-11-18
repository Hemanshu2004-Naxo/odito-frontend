"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Target, Users, Layers, CalendarDays, BarChart3, FileText, Info } from 'lucide-react'
import { StrategyCard, Pill } from './StrategyParts'
import { PLATFORM_LABELS, PRIORITY_LABELS, WEEKDAY_LABELS } from '@/lib/socialMedia/aiStrategy'
import { postsPerWeekLabel, monthsLabel, mixSummary } from '@/lib/socialMedia/strategyPlanning'
import { PILLAR_COLORS } from '@/lib/socialMedia/contentCalendar'
import { pluralize } from '@/lib/pluralize'

const MAX_GOALS = 3
const MAX_METRICS = 4
const PRIORITY_TONE = { high: 'violet', medium: 'blue', low: 'slate' }
const TOGGLE = 'inline-flex items-center rounded text-sm font-semibold text-violet-700 hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'

/** A small uppercase label over body text: the one label style used inside every highlights card. */
function Field({ label, children, testId }) {
  return (
    <div data-testid={testId}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</h4>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

/**
 * Content pillars as a share of your posts, in the same colours the Content Calendar uses for them. The bars are decoration for the
 * numbers, so the same information is also a plain sentence for screen readers. If stored shares do not add up to 100, it says so.
 */
export function PillarMix({ pillars }) {
  const mix = mixSummary(pillars.map((p) => ({ name: p.name, suggestedPercentage: p.suggestedPercentage })))
  const byName = new Map(pillars.map((p, i) => [p.name, { ...p, color: PILLAR_COLORS[i % PILLAR_COLORS.length] }]))
  return (
    <div data-testid="pillar-mix">
      <p className="sr-only" data-testid="pillar-mix-text">Share of your posts by topic: {mix.text}.</p>
      <ul className="flex flex-col gap-3">
        {mix.list.map((m) => {
          const p = byName.get(m.name)
          return (
            <li key={m.name} data-testid="pillar-card">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p?.color.dot || 'bg-violet-500'}`} aria-hidden="true" />{m.name}</span>
                <span className="font-semibold text-slate-900">{m.percent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${p?.color.bar || 'bg-violet-500'}`} style={{ width: `${Math.min(100, m.percent)}%` }} /></div>
              {p?.purpose && <p className="mt-1 text-sm text-slate-700">{p.purpose}</p>}
            </li>
          )
        })}
      </ul>
      {!mix.adds && <p className="mt-2 text-sm text-amber-800" data-testid="pillar-mix-warning">These shares add up to {mix.total}%, not 100%. Regenerate the strategy to fix this.</p>}
    </div>
  )
}

/** The goals, each with its reason. A priority badge only when the goals' priorities actually differ; "Show all goals" for the rest. */
function Goals({ goals }) {
  const [all, setAll] = useState(false)
  const shown = all ? goals : goals.slice(0, MAX_GOALS)
  const ranked = new Set(goals.map((g) => g.priority)).size > 1
  return (
    <StrategyCard icon={Target} title="Primary goals" testId="section-goals">
      {shown.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {shown.map((g) => (
            <li key={g.goal} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
              {ranked && <Pill tone={PRIORITY_TONE[g.priority]} className="mt-0.5">{PRIORITY_LABELS[g.priority]}</Pill>}
              <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{g.goal}</p>{g.rationale && <p className="mt-0.5 text-sm text-slate-700">{g.rationale}</p>}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-700" data-testid="goals-missing">No goals have been defined, so none are assumed. Add them in your <Link href="/app/social-media/settings?tab=brand-kit" className="font-semibold text-violet-700 underline-offset-2 hover:underline">Brand kit</Link>.</p>
      )}
      {goals.length > MAX_GOALS && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`mt-3 ${TOGGLE}`} data-testid="goals-toggle">
          {all ? 'Show fewer goals' : `Show all goals (${goals.length})`}
        </button>
      )}
    </StrategyCard>
  )
}

function Audience({ a, positioning }) {
  if (!a.primaryAudience) {
    return (
      <StrategyCard icon={Users} title="Who you are talking to" testId="section-audience">
        <p className="text-sm text-slate-700" data-testid="audience-missing">No audience has been defined, so none is assumed. Add one in your <Link href="/app/social-media/settings?tab=brand-kit" className="font-semibold text-violet-700 underline-offset-2 hover:underline">Brand kit</Link> (Settings).</p>
      </StrategyCard>
    )
  }
  const needs = (a.needs?.length ? a.needs : a.painPoints || []).slice(0, 3)
  return (
    <StrategyCard icon={Users} title="Who you are talking to" testId="section-audience">
      <div className="flex flex-col gap-4">
        <Field label="Main audience"><p className="font-medium text-slate-900">{a.primaryAudience}</p></Field>
        {a.secondaryAudiences?.length > 0 && (
          <Field label="Also reaching" testId="audience-segments">
            <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">{a.secondaryAudiences.map((s) => <li key={s}>{s}</li>)}</ul>
          </Field>
        )}
        {needs.length > 0 && (
          <Field label="They care about">
            <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">{needs.map((n) => <li key={n}>{n}</li>)}</ul>
          </Field>
        )}
        {positioning?.messagingAngle && <Field label="Message"><p>{positioning.messagingAngle}</p></Field>}
      </div>
    </StrategyCard>
  )
}

function PostingPlan({ s, planning }) {
  const p = s.postingStrategy
  const perWeek = planning?.postsPerWeek ?? p.postsPerWeek
  const platforms = (s.platformStrategy || []).filter((x) => x.postsPerWeek > 0)
  return (
    <StrategyCard icon={CalendarDays} title="Posting plan" testId="section-posting">
      <div className="flex flex-col gap-4">
        <Field label="Rhythm">
          <p className="font-semibold text-slate-900" data-testid="recommended-frequency">{postsPerWeekLabel(perWeek)}{planning ? ` for ${monthsLabel(planning.months)}` : ''}</p>
          {!planning && <p className="mt-0.5 text-slate-700">A suggestion: you choose the real rhythm when you create the calendar.</p>}
        </Field>
        {platforms.length > 0 && (
          <Field label="By platform">
            <ul className="flex flex-col gap-2" data-testid="posting-platforms">
              {platforms.map((x) => (
                <li key={x.platform}>
                  <span className="font-semibold text-slate-900">{PLATFORM_LABELS[x.platform]} · {pluralize(x.postsPerWeek, 'post')} a week</span>
                  {x.role && <span className="block text-slate-700">{x.role}</span>}
                </li>
              ))}
            </ul>
          </Field>
        )}
        {p.recommendedDays?.length > 0 && (
          <Field label="Posting days">
            <p data-testid="posting-days">{p.recommendedDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}</p>
            <p className="mt-0.5 text-xs text-slate-600">Your content calendar places every post on these days.</p>
          </Field>
        )}
      </div>
    </StrategyCard>
  )
}

function SuccessMetrics({ metrics }) {
  return (
    <StrategyCard icon={BarChart3} title="How to tell it's working" testId="section-metrics">
      {metrics.length ? (
        <ul className="flex flex-col divide-y divide-slate-100">
          {metrics.slice(0, MAX_METRICS).map((m) => (
            <li key={m.metric} className="py-2.5 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-slate-900">{m.metric}</p><p className="mt-0.5 text-sm text-slate-700">{m.whatGoodLooks}</p></li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-sm text-slate-700" data-testid="metrics-missing"><Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />This strategy was made before success measures were included. Regenerate it to add them.</p>
      )}
    </StrategyCard>
  )
}

/**
 * The few things a business owner needs from a strategy, in plain language: the summary, then what would improve it (`improve`, the gaps
 * card), then two balanced columns - goals and the content pillars on one side; audience, posting plan and how to tell it is working on the
 * other. Everything else lives in StrategyDetails.
 */
export function StrategyHighlights({ strategy: s, planning, improve = null }) {
  const metrics = s.planOutlook?.successMetrics || []
  return (
    <div className="space-y-4" data-testid="strategy-highlights">
      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5" data-testid="strategy-summary" aria-labelledby="strategy-summary-title">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700" aria-hidden="true"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0"><h2 id="strategy-summary-title" className="text-base font-bold text-slate-900">Strategy summary</h2><p className="mt-1 text-sm leading-relaxed text-slate-800">{s.summary}</p></div>
        </div>
      </section>
      {improve}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Goals goals={s.goals || []} />
          <StrategyCard icon={Layers} title="What you will post about" testId="section-pillar-mix"><PillarMix pillars={s.contentPillars} /></StrategyCard>
        </div>
        <div className="flex flex-col gap-4">
          <Audience a={s.audience} positioning={s.positioning} />
          <PostingPlan s={s} planning={planning} />
          <SuccessMetrics metrics={metrics} />
        </div>
      </div>
    </div>
  )
}

export default StrategyHighlights

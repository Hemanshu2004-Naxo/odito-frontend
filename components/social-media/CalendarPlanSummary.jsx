"use client"

import Link from 'next/link'
import { AlertTriangle, CalendarClock, Info } from 'lucide-react'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { formatPlanDate, platformsLabel, platformBreakdown, pillarColorMap, mixOffTarget, MIX_TOLERANCE_POINTS, splitWarning } from '@/lib/socialMedia/contentCalendar'
import { pluralize } from '@/lib/pluralize'

/** "13 posts · 8 Facebook only · 5 Instagram only · 0 both": every post counted once (a cross-post is never counted twice). */
export function PlatformCounts({ items, platforms }) {
  const b = platformBreakdown(items)
  const parts = [pluralize(b.total, 'post')]
  if ((platforms || []).length > 1) {
    parts.push(`${b.facebookOnly} Facebook only`, `${b.instagramOnly} Instagram only`, `${b.both} on both`)
  }
  return <span data-testid="platform-counts">{parts.join(' · ')}</span>
}

/**
 * What the calendar holds: provenance, size and range, the platform split (each post counted once), the pillar mix planned vs the strategy's
 * target (a pillar more than 5 points off is highlighted), and every adjustment Odito made, each on its own line with its reason.
 */
export function CalendarPlanSummary({ calendar, items }) {
  const { plan, config } = calendar
  const colors = pillarColorMap(plan.pillarDistribution)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="plan-summary-card" aria-labelledby="plan-summary-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="plan-summary-title" className="text-base font-bold text-slate-900">Your content plan</h2>
        <p className="text-xs text-slate-600" data-testid="plan-provenance">
          From Strategy v{calendar.strategy.version} · Calendar v{calendar.version}{calendar.generatedAt ? ` · ${formatDateTime(calendar.generatedAt)}` : ''}
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-700" data-testid="plan-facts">
        <strong className="text-slate-900"><PlatformCounts items={items} platforms={config.platforms} /></strong>
        <span className="block sm:inline"><span className="hidden sm:inline"> · </span>{formatPlanDate(config.startDate, { year: true })} to {formatPlanDate(config.endDate, { year: true })}{config.months ? ` (${pluralize(config.months, 'month')})` : ''} · {config.postsPerWeek} per week · {platformsLabel(config.platforms)}</span>
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Content mix: planned vs target</h3>
        <ul className="mt-2 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="pillar-distribution">
          {plan.pillarDistribution.map((d) => {
            const off = mixOffTarget(d)
            const c = colors.get(d.pillar)
            return (
              <li key={d.pillar} data-testid={`distribution-${d.pillar}`} data-off-target={off ? 'true' : 'false'} className={off ? 'rounded-lg bg-amber-50 px-2 py-1.5 ring-1 ring-amber-200' : ''}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
                    <span className="truncate" title={d.pillar}>{d.pillar}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-700">
                    <span className="font-semibold">{d.plannedPercent}%</span> of {d.targetPercent}% target · {pluralize(d.plannedCount, 'post')}
                  </span>
                </div>
                {/* planned bar with a tick at the target */}
                <div className="relative mt-1.5 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, d.plannedPercent)}%` }} />
                  <span className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-slate-700" style={{ left: `calc(${Math.min(100, d.targetPercent)}% - 1px)` }} />
                </div>
                {off && <p className="mt-1 text-xs font-medium text-amber-800">More than {MIX_TOLERANCE_POINTS} points {d.plannedPercent > d.targetPercent ? 'above' : 'below'} target</p>}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-600">The coloured dot marks each pillar on the posts below. The dark tick on each bar is the target.</p>
      </div>

      {plan.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="plan-warnings">
          <h3 className="text-sm font-semibold text-slate-900">Odito adjusted {pluralize(plan.warnings.length, 'thing')} in this plan</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {plan.warnings.map((w) => {
              const { date, text } = splitWarning(w)
              return (
                <li key={w} className="flex items-start gap-2 text-sm text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span>{date && <strong className="font-semibold text-slate-900">{date}: </strong>}{text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

/** "Your strategy has changed since this calendar was generated." The calendar is never changed behind the user's back. */
export function CalendarStaleBanner({ stale, calendarStrategyVersion, onRegenerate, busy }) {
  if (!stale || (!stale.strategyChanged && !stale.profileChanged)) return null
  return (
    <div role="alert" data-testid="calendar-stale" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {stale.strategyChanged ? 'Your strategy has changed since this calendar was generated.' : 'Your business profile has changed since this calendar was generated.'}
          </p>
          <p className="mt-0.5 text-sm text-amber-900">
            {stale.strategyChanged ? `This calendar was planned from Strategy v${calendarStrategyVersion}; the current strategy is v${stale.currentStrategyVersion}.` : 'The plan below is unchanged.'} Nothing was regenerated automatically.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {stale.profileChanged && !stale.strategyChanged && <Link href="/app/social-media/ai-strategy" className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">Review strategy</Link>}
        <button type="button" onClick={onRegenerate} disabled={busy} className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-60">Regenerate calendar</button>
      </div>
    </div>
  )
}

/** The calendar does not follow its strategy (made before the planner enforced the strategy's days and split, or edited since). */
export function CalendarConformanceBanner({ conformance, onRegenerate, busy, ended = false }) {
  if (!conformance || conformance.follows || !conformance.issues?.length) return null
  return (
    <div role="status" data-testid="calendar-conformance" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-900">This calendar does not follow your strategy</p>
          <ul className="mt-0.5 list-disc pl-5 text-sm text-amber-900">
            {conformance.issues.map((i) => <li key={i.code}>{i.message}</li>)}
          </ul>
          <p className="mt-0.5 text-sm text-amber-900">{ended ? 'Your next plan will follow it.' : 'Regenerating plans every post on your strategy\'s days and platform split.'}</p>
        </div>
      </div>
      {!ended && <button type="button" onClick={onRegenerate} disabled={busy} className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:opacity-60">Regenerate calendar</button>}
    </div>
  )
}

/** "This plan ended on Fri 13 Nov 2026." with the one action that matters next. Shown on the calendar and the strategy page. */
export function PlanEndedBanner({ endDate, onPlanNext, planNextHref = null, busy = false }) {
  const action = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:opacity-60'
  return (
    <div role="status" data-testid="plan-ended" className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-slate-900">This plan ended on {formatPlanDate(endDate, { year: true })}</p>
          <p className="mt-0.5 text-sm text-slate-700">Its posts stay here for reference. Plan the next month to keep posting.</p>
        </div>
      </div>
      {planNextHref
        ? <Link href={planNextHref} className={action} data-testid="plan-next">Plan next month</Link>
        : <button type="button" onClick={onPlanNext} disabled={busy} className={action} data-testid="plan-next">Plan next month</button>}
    </div>
  )
}

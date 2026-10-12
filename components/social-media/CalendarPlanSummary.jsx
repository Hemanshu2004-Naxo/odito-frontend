"use client"

import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { formatPlanDate, platformsLabel } from '@/lib/socialMedia/contentCalendar'
import { Expandable } from './StrategyParts'

/** "Planned from Strategy v3" and what the calendar holds: size, range, the pillar mix against the strategy's, platforms, and anything Odito adjusted. */
export function CalendarPlanSummary({ calendar, strategyVersion }) {
  const { plan, config } = calendar
  const platformCounts = Object.entries(plan.platformCounts || {})
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-testid="plan-summary-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-slate-900">Your content plan</h2>
        <p className="text-xs text-slate-500" data-testid="plan-provenance">
          Generated from Strategy v{calendar.strategy.version} · Calendar v{calendar.version}{calendar.generatedAt ? ` · ${formatDateTime(calendar.generatedAt)}` : ''}
        </p>
      </div>
      <p className="mt-1 text-sm text-slate-600" data-testid="plan-facts">
        <strong>{plan.totalItems} posts</strong> · {formatPlanDate(config.startDate, { year: true })} to {formatPlanDate(config.endDate, { year: true })}{config.months ? ` (${config.months} month${config.months === 1 ? '' : 's'})` : ''} · {config.postsPerWeek} per week · {platformsLabel(config.platforms)}
        {platformCounts.length > 0 && <span className="text-slate-400"> ({platformCounts.map(([p, n]) => `${p === 'facebook' ? 'Facebook' : 'Instagram'} ${n}`).join(', ')})</span>}
      </p>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Content mix: planned vs your strategy</p>
        <ul className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="pillar-distribution">
          {plan.pillarDistribution.map((d) => (
            <li key={d.pillar} data-testid={`distribution-${d.pillar}`}>
              <div className="flex items-center justify-between text-sm"><span className="truncate font-medium text-slate-700">{d.pillar}</span><span className="shrink-0 text-xs text-slate-500">{d.plannedCount} posts · {d.plannedPercent}% <span className="text-slate-400">(target {d.targetPercent}%)</span></span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, d.plannedPercent)}%` }} /></div>
            </li>
          ))}
        </ul>
      </div>

      {plan.warnings.length > 0 && (
        <Expandable label={`Odito adjusted ${plan.warnings.length} thing${plan.warnings.length === 1 ? '' : 's'}`} openLabel="Hide adjustments" testId="plan-warnings">
          <ul className="flex flex-col gap-1">{plan.warnings.map((w) => <li key={w} className="flex items-start gap-2 text-sm text-slate-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{w}</li>)}</ul>
        </Expandable>
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
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {stale.strategyChanged ? 'Your strategy has changed since this calendar was generated.' : 'Your business profile has changed since this calendar was generated.'}
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            {stale.strategyChanged ? `This calendar was planned from Strategy v${calendarStrategyVersion}; the current strategy is v${stale.currentStrategyVersion}.` : 'The plan below is unchanged.'} Nothing was regenerated automatically.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {stale.profileChanged && !stale.strategyChanged && <Link href="/app/social-media/ai-strategy" className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">Review strategy</Link>}
        <button type="button" onClick={onRegenerate} disabled={busy} className="rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60">Regenerate calendar</button>
      </div>
    </div>
  )
}

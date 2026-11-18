"use client"

import Link from 'next/link'
import { CalendarPlus, Check, Pencil, RefreshCw, Loader2, Sparkles, CalendarCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { postsPerWeekLabel, monthsLabel, platformList } from '@/lib/socialMedia/strategyPlanning'
import { formatPlanDate, planHasEnded } from '@/lib/socialMedia/contentCalendar'
import { pluralize } from '@/lib/pluralize'

const CALENDAR_HREF = '/app/social-media/content-calendar'
// the existing calendar is from an older strategy: go straight to the (prefilled) form that makes a calendar from THIS one
const NEW_CALENDAR_HREF = `${CALENDAR_HREF}?plan=new`
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'

function Stat({ label, value, hint, testId }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3" data-testid={testId}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-600">{hint}</dd>}
    </div>
  )
}

/**
 * The top of the strategy page: the ONE place that says the strategy is ready (with its date), what it plans, and what to do next. Four
 * facts only: platforms, posts per week, planning period and planned posts - the real count and dates once a calendar exists for it.
 *
 * A strategy saved before the planning wizard has no frequency or duration; it says so and offers to set them (a new version) instead of inventing numbers.
 */
export function StrategyOverview({ strategy, businessName, calendar, busy, onEdit, onRegenerate }) {
  const planning = strategy.planning
  const s = strategy.strategy
  const platforms = planning?.platforms?.length ? planning.platforms : (s.platformStrategy || []).map((p) => p.platform)
  const calendarForThis = calendar && calendar.strategy?.id === strategy.id && ['ready', 'archived'].includes(calendar.status) ? calendar : null
  const olderCalendar = !calendarForThis && calendar && ['ready', 'archived'].includes(calendar.status) ? calendar : null
  const ended = calendarForThis && planHasEnded(calendarForThis.config)
  const name = `${businessName || 'Your business'} social strategy`
  const generated = formatDateTime(strategy.generatedAt)

  const plannedPosts = calendarForThis
    ? { value: pluralize(calendarForThis.plan?.totalItems ?? 0, 'post'), hint: `${formatPlanDate(calendarForThis.config.startDate)} – ${formatPlanDate(calendarForThis.config.endDate, { year: true })}${ended ? ' · ended' : ''}` }
    : { value: planning?.estimatedPosts != null ? `About ${planning.estimatedPosts}` : '—', hint: planning ? 'Exact once you create the calendar' : null }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 sm:p-5" data-testid="strategy-overview" aria-labelledby="strategy-ready-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true"><Check className="h-5 w-5" strokeWidth={3} /></span>
          <div className="min-w-0">
            <h2 id="strategy-ready-title" className="text-lg font-bold tracking-tight text-slate-900" data-testid="strategy-ready-title">Your AI strategy is ready</h2>
            <p className="text-sm text-slate-700" data-testid="strategy-name">{name} · version {strategy.version}{generated ? ` · generated ${generated}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="strategy-actions">
          <button type="button" onClick={onEdit} disabled={busy} data-testid="edit-strategy" className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 ${FOCUS_RING}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit strategy
          </button>
          <button type="button" onClick={onRegenerate} disabled={busy} data-testid="regenerate-strategy" className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 ${FOCUS_RING}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />} Regenerate strategy
          </button>
          {calendarForThis ? (
            <Link href={CALENDAR_HREF} data-testid="create-calendar-cta" className={ended
              ? `inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 ${FOCUS_RING}`
              : `inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 ${FOCUS_RING}`}
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" /> View content calendar
            </Link>
          ) : (
            <Link href={olderCalendar ? NEW_CALENDAR_HREF : CALENDAR_HREF} data-testid="create-calendar-cta" aria-disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 ${FOCUS_RING}`}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Generate Content Calendar
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4" data-testid="strategy-stats">
        <Stat label="Platforms" value={platformList(platforms) || '—'} testId="stat-platforms" />
        <Stat label="Posts per week" value={planning ? String(planning.postsPerWeek) : 'Not set'} hint={planning ? null : 'Set it with Edit strategy'} testId="stat-frequency" />
        <Stat label="Planning period" value={planning ? monthsLabel(planning.months) : 'Not set'} testId="stat-duration" />
        <Stat label="Planned posts" value={plannedPosts.value} hint={plannedPosts.hint} testId="stat-posts" />
      </dl>

      {!planning ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-700" data-testid="no-planning-note">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />
          This strategy was made before you could choose a posting frequency and period. It still works; choose them when you create the calendar, or use Edit strategy to build a new version around them.
        </p>
      ) : !calendarForThis && (
        <p className="mt-3 text-sm text-slate-700" data-testid="calendar-handoff-note">
          Your calendar starts from {postsPerWeekLabel(planning.postsPerWeek)} for {monthsLabel(planning.months)} on {platformList(planning.platforms)}. You only choose a start date.{olderCalendar ? ` Your current calendar was made from strategy version ${olderCalendar.strategy?.version}; this creates a new one and keeps the old one in history.` : ''}
        </p>
      )}
    </section>
  )
}

export default StrategyOverview

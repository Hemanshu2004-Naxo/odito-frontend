"use client"

import Link from 'next/link'
import { CalendarPlus, Check, Pencil, RefreshCw, Loader2, Sparkles, CalendarCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { postsPerWeekLabel, monthsLabel, platformList } from '@/lib/socialMedia/strategyPlanning'

const CALENDAR_HREF = '/app/social-media/content-calendar'
// the existing calendar is from an older strategy: go straight to the (prefilled) form that makes a calendar from THIS one
const NEW_CALENDAR_HREF = `${CALENDAR_HREF}?plan=new`

function Stat({ label, value, hint, testId }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3" data-testid={testId}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/**
 * The top of the strategy page: what this strategy is and what to do next, in one compact block. Only the saved facts are shown (strategy
 * name, platforms, posting frequency, planning duration, planned posts, status, date) - never the detailed recommendations.
 *
 * A strategy saved before the planning wizard has no frequency or duration; it says so and offers to set them (a new version) instead of inventing numbers.
 */
export function StrategyOverview({ strategy, businessName, calendar, busy, onEdit, onRegenerate }) {
  const planning = strategy.planning
  const s = strategy.strategy
  const platforms = planning?.platforms?.length ? planning.platforms : (s.platformStrategy || []).map((p) => p.platform)
  const calendarForThis = calendar && calendar.strategy?.id === strategy.id && ['ready', 'archived'].includes(calendar.status) ? calendar : null
  const olderCalendar = !calendarForThis && calendar && ['ready', 'archived'].includes(calendar.status) ? calendar : null
  const name = `${businessName || 'Your business'} social strategy`

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 sm:p-5" data-testid="strategy-overview" aria-label="Strategy overview">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-5 w-5" strokeWidth={3} /></span>
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-slate-900" data-testid="strategy-ready-title">Your AI strategy is ready.</p>
            <p className="text-sm text-slate-600" data-testid="strategy-name">{name} · version {strategy.version}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="strategy-actions">
          <button type="button" onClick={onEdit} disabled={busy} data-testid="edit-strategy" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <Pencil className="h-4 w-4" /> Edit strategy
          </button>
          <button type="button" onClick={onRegenerate} disabled={busy} data-testid="regenerate-strategy" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate strategy
          </button>
          {calendarForThis ? (
            <Link href={CALENDAR_HREF} data-testid="create-calendar-cta" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">
              <CalendarCheck className="h-4 w-4" /> View content calendar
            </Link>
          ) : (
            <Link href={olderCalendar ? NEW_CALENDAR_HREF : CALENDAR_HREF} data-testid="create-calendar-cta" aria-disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">
              <CalendarPlus className="h-4 w-4" /> Generate Content Calendar
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5" data-testid="strategy-stats">
        <Stat label="Platforms" value={platformList(platforms) || '—'} testId="stat-platforms" />
        <Stat label="Posts per week" value={planning ? String(planning.postsPerWeek) : 'Not set'} hint={planning ? null : 'Set it with Edit strategy'} testId="stat-frequency" />
        <Stat label="Planning period" value={planning ? monthsLabel(planning.months) : 'Not set'} testId="stat-duration" />
        <Stat label="Planned posts" value={planning?.estimatedPosts != null ? `about ${planning.estimatedPosts}` : '—'} hint={planning ? 'Exact when you pick a start date' : null} testId="stat-posts" />
        <Stat label="Status" value={`Ready · ${formatDateTime(strategy.generatedAt) || 'just now'}`} testId="stat-status" />
      </dl>

      {planning ? (
        <p className="mt-3 text-sm text-slate-600" data-testid="calendar-handoff-note">
          {calendarForThis
            ? `A content calendar already exists for this strategy (${calendarForThis.config?.months ? monthsLabel(calendarForThis.config.months) : 'planned'}, ${calendarForThis.config?.postsPerWeek ? postsPerWeekLabel(calendarForThis.config.postsPerWeek) : ''}). Open it to review, or create another one there.`
            : `Your calendar starts from ${postsPerWeekLabel(planning.postsPerWeek)} for ${monthsLabel(planning.months)} on ${platformList(planning.platforms)}. You only choose a start date, unless you want to change something.${olderCalendar ? ` Your current calendar was made from strategy version ${olderCalendar.strategy?.version}; this creates a new one and keeps the old one in history.` : ''}`}
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-600" data-testid="no-planning-note">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          This strategy was made before you could choose a posting frequency and period. It still works; choose them when you create the calendar, or use Edit strategy to build a new version around them.
        </p>
      )}
    </section>
  )
}

export default StrategyOverview

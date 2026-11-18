"use client"

import { useMemo } from 'react'
import Link from 'next/link'
import { ShieldAlert, Package, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  FORMAT_LABELS, formatPlanDate, platformsLabel, statusGroupOf, monthGrid, monthLabel, todayDate,
} from '@/lib/socialMedia/contentCalendar'
import { CALENDAR_PLATFORM_META } from '@/lib/socialMediaAIDummyData'
import { pluralize } from '@/lib/pluralize'
import { Pill } from './StrategyParts'

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1'

/** Platforms as small brand icons (with their names for screen readers and on hover). */
export function PlatformIcons({ platforms, size = 'sm' }) {
  const box = size === 'xs' ? 'h-4 w-4' : 'h-5 w-5'
  const icon = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  return (
    <span className="flex shrink-0 items-center gap-1" data-testid="item-platforms" title={platformsLabel(platforms)}>
      <span className="sr-only">{platformsLabel(platforms)}</span>
      {(platforms || []).map((p) => {
        const meta = CALENDAR_PLATFORM_META[p]
        if (!meta) return null
        const Icon = meta.icon
        return <span key={p} aria-hidden="true" className={`flex ${box} items-center justify-center rounded-full ${meta.badgeClass}`}><Icon className={icon} /></span>
      })}
    </span>
  )
}

/** Draft / In approval / Approved / Scheduled / Published, from the post's ONE effective status. */
export function StatusBadge({ item }) {
  const g = statusGroupOf(item)
  return <Pill tone={g.tone} className="leading-4">{g.label}</Pill>
}

const FormatTag = ({ format }) => (
  <span className="inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-medium leading-4 text-slate-700" data-testid="item-format">
    {FORMAT_LABELS[format] || format}
  </span>
)

const focusOf = (item) => item.productName || item.serviceName || null
const FocusIcon = ({ item }) => (item.productId ? <Package className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden /> : item.serviceId ? <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden /> : null)

/**
 * One planned post as a card: pillar colour on the left edge, platform icons, status, the title (clamped to three lines, the full title on
 * hover and for screen readers) and the format. Past posts are muted.
 */
export function PostCard({ item, color, selected, onSelect, today = todayDate(), compact = false, testIdPrefix = 'plan-chip' }) {
  const past = item.date < today
  const status = statusGroupOf(item)
  // a real post made outside the plan opens where it is managed; a planned post opens its planning window
  const Comp = item.href ? Link : 'button'
  const how = item.href ? { href: item.href } : { type: 'button', onClick: () => onSelect(item.id), 'aria-pressed': selected }
  return (
    <Comp
      {...how}
      title={item.topic}
      aria-label={`${formatPlanDate(item.date)}, ${platformsLabel(item.platforms)}, ${FORMAT_LABELS[item.format] || item.format}, ${item.contentPillar}, ${status.label}: ${item.topic}. Open details`}
      data-testid={`${testIdPrefix}-${item.id}`}
      data-past={past ? 'true' : 'false'}
      className={`block w-full rounded-lg border border-l-4 bg-white px-2 py-1.5 text-left shadow-sm transition-colors hover:border-violet-300 ${color.border} ${selected ? 'border-violet-400 ring-1 ring-violet-300' : 'border-slate-200'} ${past ? 'opacity-60 hover:opacity-100' : ''} ${FOCUS_RING}`}
    >
      <span className="flex items-center justify-between gap-1">
        <PlatformIcons platforms={item.platforms} size="xs" />
        <StatusBadge item={item} />
      </span>
      <span className={`mt-1 block font-medium text-slate-900 line-clamp-3 ${compact ? 'text-xs' : 'text-sm'}`}>{item.topic}</span>
      <span className="mt-1 flex items-center gap-1"><FormatTag format={item.format} />{item.requiresReview && <ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-label="Needs a careful review" />}</span>
    </Comp>
  )
}

/**
 * The plan as a list: one row per post. Upcoming posts first in date order; posts whose date has passed are grouped after them and muted, so
 * what is still ahead is never mixed with what is over.
 */
export function CalendarPlanTable({ items, selectedId, onSelect, colors, today = todayDate() }) {
  const upcoming = items.filter((i) => i.date >= today)
  const past = items.filter((i) => i.date < today)
  const group = (title, list, muted) => list.length > 0 && (
    <li key={title}>
      <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title} · {list.length}</h3>
      <ul className="divide-y divide-slate-100">
        {list.map((item) => {
          const c = colors.get(item.contentPillar)
          const Row = item.href ? Link : 'button'
          const how = item.href ? { href: item.href } : { type: 'button', onClick: () => onSelect(item.id), 'aria-pressed': selectedId === item.id }
          return (
            <li key={item.id}>
              <Row
                {...how}
                aria-label={`${formatPlanDate(item.date)}: ${item.topic}. Open details`}
                data-testid={`plan-row-${item.id}`}
                data-past={muted ? 'true' : 'false'}
                className={`grid w-full grid-cols-1 gap-1.5 border-l-4 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-violet-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 xl:grid-cols-[120px_64px_90px_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)_110px] xl:items-center xl:gap-3 ${c.border} ${selectedId === item.id ? 'bg-violet-50/60' : ''} ${muted ? 'text-slate-500 opacity-70' : ''}`}
              >
                <span className="text-sm font-semibold text-slate-900" data-testid="item-date">{formatPlanDate(item.date)}</span>
                <PlatformIcons platforms={item.platforms} />
                <span><FormatTag format={item.format} /></span>
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700" data-testid="item-pillar"><span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" /><span className="truncate" title={item.contentPillar}>{item.contentPillar}</span></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 line-clamp-2 xl:line-clamp-1" title={item.topic} data-testid="item-topic">{item.topic}</span>
                  {item.hook && <span className="block truncate text-xs text-slate-600" title={item.hook} data-testid="item-hook">&ldquo;{item.hook}&rdquo;</span>}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700" data-testid="item-focus">
                  <FocusIcon item={item} />
                  <span className="truncate">{focusOf(item) || <span className="text-slate-500">Brand</span>}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <StatusBadge item={item} />
                  {item.requiresReview && <ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-label="Needs a careful review" />}
                </span>
              </Row>
            </li>
          )
        })}
      </ul>
    </li>
  )
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="plan-table">
      <div className="hidden grid-cols-[120px_64px_90px_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)_110px] gap-3 border-b border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 xl:grid" data-testid="plan-table-head" aria-hidden="true">
        <span>Date</span><span>Platform</span><span>Format</span><span>Pillar</span><span>Topic and hook</span><span>Service / product</span><span>Status</span>
      </div>
      <ul>
        {group('Upcoming', upcoming, false)}
        {group('Past', past, true)}
      </ul>
    </div>
  )
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month navigation: previous / next / Today, and the visible range. */
export function CalendarNav({ month, onMonth, onToday, canPrev = true, canNext = true }) {
  const btn = `inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`
  return (
    <div className="flex items-center gap-2" data-testid="calendar-nav">
      <button type="button" className={btn} onClick={() => onMonth(-1)} disabled={!canPrev} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" className={btn} onClick={() => onMonth(1)} disabled={!canNext} aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" className={btn} onClick={onToday}>Today</button>
      <h3 className="ml-1 text-base font-bold text-slate-900" aria-live="polite" data-testid="calendar-month">{monthLabel(month)}</h3>
    </div>
  )
}

/**
 * The plan as a month: Monday-first weeks, every cell numbered (empty ones too), today marked, days outside the plan's period greyed out.
 * Below `md` the grid becomes a day-by-day agenda, so cards never squash.
 */
export function CalendarPlanGrid({ items, selectedId, onSelect, colors, month, range, today = todayDate() }) {
  const weeks = useMemo(() => monthGrid(month, { range, today }), [month, range, today])
  const byDate = useMemo(() => {
    const map = new Map()
    for (const item of items) map.set(item.date, [...(map.get(item.date) || []), item])
    return map
  }, [items])
  const inMonth = weeks.flat().filter((c) => c.inMonth && byDate.has(c.date))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white" data-testid="plan-grid">
      {/* md and up: the month grid */}
      <div className="hidden md:block" role="grid" aria-label={`${monthLabel(month)} content plan`}>
        <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold uppercase tracking-wide text-slate-600" role="row">
          {DOW.map((d) => <span key={d} className="py-2" role="columnheader">{d}</span>)}
        </div>
        {weeks.map((week) => (
          <div key={week[0].date} className="grid grid-cols-7 border-b border-slate-100 last:border-0" role="row" data-testid={`plan-week-${week[0].date}`}>
            {week.map((cell) => {
              const posts = byDate.get(cell.date) || []
              const muted = !cell.inRange || !cell.inMonth
              return (
                <div
                  key={cell.date}
                  role="gridcell"
                  aria-label={`${formatPlanDate(cell.date)}${cell.isToday ? ', today' : ''}${!cell.inRange ? ', outside the plan' : ''}: ${pluralize(posts.length, "post")}`}
                  data-testid={`plan-day-${cell.date}`}
                  data-in-range={cell.inRange ? 'true' : 'false'}
                  className={`min-h-[112px] border-r border-slate-100 p-1.5 last:border-r-0 ${muted ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <span className={`mb-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-xs font-semibold ${cell.isToday ? 'bg-violet-600 text-white' : muted ? 'text-slate-400' : 'text-slate-700'}`} aria-hidden="true">
                    {cell.day}
                  </span>
                  {cell.isToday && <span className="sr-only">Today</span>}
                  <div className="flex flex-col gap-1">
                    {posts.map((item) => <PostCard key={item.id} item={item} color={colors.get(item.contentPillar)} selected={selectedId === item.id} onSelect={onSelect} today={today} compact />)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* below md: an agenda of the month's posting days */}
      <ul className="divide-y divide-slate-100 md:hidden" data-testid="plan-agenda">
        {inMonth.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-600">No posts planned in {monthLabel(month)}.</li>}
        {inMonth.map((cell) => (
          <li key={cell.date} className="flex gap-3 px-3 py-3">
            <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-center ${cell.isToday ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
              <span className="text-[10px] font-semibold uppercase leading-none">{DOW[(new Date(`${cell.date}T00:00:00Z`).getUTCDay() + 6) % 7]}</span>
              <span className="text-sm font-bold leading-tight">{cell.day}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {byDate.get(cell.date).map((item) => <PostCard key={item.id} item={item} color={colors.get(item.contentPillar)} selected={selectedId === item.id} onSelect={onSelect} today={today} testIdPrefix="plan-agenda-chip" />)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

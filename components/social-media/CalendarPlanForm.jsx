"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DateTime } from 'luxon'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { PLATFORM_LABELS } from '@/lib/socialMedia/aiStrategy'
import {
  POSTS_PER_WEEK_OPTIONS, DURATION_OPTIONS, MIN_MONTHS, MAX_MONTHS, DISTRIBUTION_OPTIONS, defaultStartDate, periodEndDate, dayCount, estimatePosts,
  defaultPostsPerWeek, recommendedLabel, formatPlanDate, platformsLabel,
} from '@/lib/socialMedia/contentCalendar'
import { useSocialContentCalendarPreview } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'

const ORDER = ['facebook', 'instagram']
const INPUT = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-60'

/**
 * The user's planning choices: start date, how many months (1-6), posts per week, platforms and how posts are shared between
 * platforms. These — and only these — are what the client sends; the strategy, profile and catalog the plan is built from are
 * always loaded by the server, and so is the END date: it is derived from the start and the number of months (start inclusive,
 * start + N months exclusive, month ends clamped), so a person never types a date range that could disagree with the length.
 * "Posts per week" is the TOTAL number of posts, not a number per platform. The exact number of posts comes from the server's
 * preview (no AI involved) before anything is generated. Only platforms that are connected AND covered by the strategy can be chosen.
 */
export function CalendarPlanForm({ projectId, strategy, connectedPlatforms, limits, pending = false, submitLabel = 'Generate calendar', onSubmit, onCancel = null, error = null }) {
  const available = useMemo(() => ORDER.filter((p) => (strategy?.platforms || []).includes(p) && connectedPlatforms?.[p]), [strategy, connectedPlatforms])
  const [postsPerWeek, setPostsPerWeek] = useState(() => defaultPostsPerWeek(strategy?.recommended))
  const [platforms, setPlatforms] = useState(() => new Set(available))
  const [startDate, setStartDate] = useState(() => defaultStartDate())
  const [months, setMonths] = useState(MIN_MONTHS)
  const [mode, setMode] = useState('ai_optimized')

  const minMonths = limits?.minMonths ?? MIN_MONTHS
  const maxMonths = limits?.maxMonths ?? MAX_MONTHS
  const endDate = periodEndDate(startDate, months)
  const days = dayCount(startDate, endDate)
  const today = DateTime.local().toFormat('yyyy-LL-dd')
  const selected = ORDER.filter((p) => platforms.has(p))
  const problems = []
  if (!selected.length) problems.push('Choose at least one platform.')
  if (!days) problems.push('Choose a valid start date.')
  if (months < minMonths || months > maxMonths) problems.push(`Choose between ${minMonths} and ${maxMonths} months.`)
  if (startDate && startDate < DateTime.local().minus({ days: 1 }).toFormat('yyyy-LL-dd')) problems.push('The calendar cannot start in the past.')

  // the server's exact answer (end date, days, post count); only asked once the local checks pass
  const preview = useSocialContentCalendarPreview(projectId, { startDate, months, postsPerWeek }, { enabled: problems.length === 0 })
  const previewData = preview.data
  const previewError = preview.isError ? describeApiError(preview.error, 'Could not work out this calendar.').message : null
  if (previewError && !preview.isFetching) problems.push(previewError)

  const togglePlatform = (p) => setPlatforms((prev) => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next })
  const rec = recommendedLabel(strategy?.recommended)
  const exact = previewData?.totalPosts ?? null
  const posts = exact ?? estimatePosts(postsPerWeek, days)
  const partialWeeks = previewData?.partialWeeks || []
  const calculating = preview.isFetching && !previewError

  function submit(e) {
    e.preventDefault()
    if (pending || problems.length) return
    onSubmit({ startDate, months, postsPerWeek, platforms: selected, distributionMode: selected.length === 1 ? 'balanced' : mode })
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-testid="calendar-plan-form" aria-label="Plan a content calendar">
      <h2 className="text-base font-bold text-slate-900">Plan your content calendar</h2>
      <p className="mt-0.5 text-sm text-slate-500">Choose how much to post and where. Odito plans and writes every post from your strategy: topic, hook, caption, hashtags, call to action and creative direction, with a version for each platform. Nothing is published.</p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">How many posts per week?</legend>
          <p className="mt-0.5 text-xs text-slate-500">Total posts, not per platform.{rec ? ` Your strategy recommends ${rec}.` : ''}</p>
          <div role="radiogroup" aria-label="Posts per week" className="mt-2 flex flex-wrap gap-2" data-testid="posts-per-week">
            {POSTS_PER_WEEK_OPTIONS.map((n) => (
              <label key={n} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-violet-200 ${postsPerWeek === n ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <input type="radio" name="posts-per-week" value={n} checked={postsPerWeek === n} onChange={() => setPostsPerWeek(n)} className="sr-only" aria-label={`${n} post${n === 1 ? '' : 's'} per week`} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">Which platforms?</legend>
          <p className="mt-0.5 text-xs text-slate-500">Only connected platforms can be planned.</p>
          <div className="mt-2 flex flex-col gap-2" data-testid="platforms">
            {ORDER.map((p) => {
              const inStrategy = (strategy?.platforms || []).includes(p)
              const connected = !!connectedPlatforms?.[p]
              const usable = inStrategy && connected
              return (
                <label key={p} className={`flex items-center gap-2.5 text-sm ${usable ? 'cursor-pointer text-slate-800' : 'cursor-not-allowed text-slate-400'}`}>
                  <input type="checkbox" checked={usable && platforms.has(p)} disabled={!usable} onChange={() => togglePlatform(p)} className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
                  <span className="font-medium">{PLATFORM_LABELS[p]}</span>
                  {!connected && <span className="text-xs">Not connected · <Link href="/app/social-media/connect-accounts" className="font-semibold text-violet-600 hover:text-violet-700">Connect</Link></span>}
                  {connected && !inStrategy && <span className="text-xs">Not in your strategy. Regenerate the strategy to include it.</span>}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="lg:col-span-2">
          <legend className="text-sm font-semibold text-slate-800">How long should the calendar run?</legend>
          <p className="mt-0.5 text-xs text-slate-500">Whole calendar months, counted from your start date.</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div role="radiogroup" aria-label="Calendar length in months" className="flex flex-wrap gap-2" data-testid="duration-months">
              {DURATION_OPTIONS.filter((o) => o.months >= minMonths && o.months <= maxMonths).map((o) => (
                <label key={o.months} className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-violet-200 ${months === o.months ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                  <input type="radio" name="duration-months" value={o.months} checked={months === o.months} onChange={() => setMonths(o.months)} className="sr-only" aria-label={o.label} />
                  {o.label}
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Start date
              <input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} className={INPUT} aria-label="Start date" />
            </label>
            {endDate && <p className="pb-2 text-sm text-slate-600" data-testid="plan-period">Runs {formatPlanDate(startDate, { year: true })} to {formatPlanDate(previewData?.endDate || endDate, { year: true })} ({previewData?.days || days} days)</p>}
          </div>
        </fieldset>

        {selected.length > 1 && (
          <fieldset className="lg:col-span-2">
            <legend className="text-sm font-semibold text-slate-800">How should posts be shared between platforms?</legend>
            <div role="radiogroup" aria-label="Distribution" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="distribution">
              {DISTRIBUTION_OPTIONS.map((o) => (
                <label key={o.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-violet-200 ${mode === o.value ? 'border-violet-400 bg-violet-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="radio" name="distribution" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="sr-only" />
                  <span className="text-sm font-semibold text-slate-800">{o.label}</span>
                  <span className="text-xs text-slate-500">{o.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="plan-summary" aria-live="polite">
        {posts && selected.length ? (
          <>
            <p>
              <strong>{exact !== null ? `${exact} posts` : `About ${posts} posts`}</strong> over {months} month{months === 1 ? '' : 's'} ({days} days) · {postsPerWeek} per week · {platformsLabel(selected)}
              {calculating && <span className="text-slate-400"> · checking…</span>}
              {selected.length > 1 && mode === 'ai_optimized' ? '. A post can be planned for both platforms, so it may become more than one publication.' : '.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {exact !== null ? 'This is the exact number: Odito sets the dates, so every full week gets your chosen number of posts.' : 'The exact number is confirmed once the dates are worked out.'}
              {partialWeeks.length > 0 && ` The ${partialWeeks.length === 1 ? 'week' : 'weeks'} at the ${partialWeeks.length === 1 ? 'edge' : 'edges'} of the period that only partly fall inside it get a proportional share (${partialWeeks.map((w) => `${w.posts} for ${w.days} day${w.days === 1 ? '' : 's'}`).join(', ')}).`}
              {previewData?.steps > 1 && ` Long calendars are planned in ${previewData.steps} steps, so they take longer to finish; you can leave the page meanwhile.`}
            </p>
          </>
        ) : 'Choose your start date and platforms to see how many posts to expect.'}
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1" role="alert" data-testid="plan-problems">
          {problems.map((p) => <li key={p} className="text-sm text-red-600">{p}</li>)}
        </ul>
      )}
      {error && <p role="alert" data-testid="plan-start-error" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {onCancel && <button type="button" onClick={onCancel} disabled={pending} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">Cancel</button>}
        <button
          type="submit"
          disabled={pending || problems.length > 0}
          data-testid="generate-calendar-button"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          {pending ? 'Starting…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default CalendarPlanForm

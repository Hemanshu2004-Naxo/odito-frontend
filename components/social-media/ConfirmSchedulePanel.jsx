"use client"

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { SchedulePreview } from './SchedulePreview'
import { DateSelector } from './DateSelector'
import { TimeSelector } from './TimeSelector'
import { TimezoneSelector } from './TimezoneSelector'
import { CALENDAR_PLATFORM_META, SCHEDULE_TIMEZONE_OPTIONS } from '@/lib/socialMediaAIDummyData'
import { toScheduleFormValues, scheduleFormToUtcIso } from '@/lib/socialMedia/postMapper'
import { todayInTimezone } from '@/lib/scheduleTime'

/** The selectable zones: the module's list + this post's own zone + the viewer's, de-duplicated. */
function buildTimezoneOptions(postTimezone) {
  const options = [...SCHEDULE_TIMEZONE_OPTIONS]
  for (const zone of [postTimezone, DateTime.local().zoneName]) {
    if (zone && !options.some((o) => o.value === zone)) options.push({ value: zone, label: zone })
  }
  return options
}

/**
 * Right-side "Confirm schedule" panel for the currently selected, REAL
 * scheduled post. Confirm sends the chosen wall-clock time (interpreted in the
 * chosen timezone, converted to an explicit-offset UTC instant) to the
 * scheduler API; "Save for later" clears the schedule (post becomes a draft).
 * The backend is authoritative: its refusal (past date, bad timezone, post no
 * longer editable, ...) is shown verbatim in `error`. Keyed by post.id from the
 * parent, so every field resets to the newly selected post's own values.
 */
export function ConfirmSchedulePanel({ post, accountName, pendingAction = null, error = null, onConfirm, onSaveForLater, onClose = null, wide = false }) {
  const initial = useMemo(() => toScheduleFormValues(post), [post.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [localError, setLocalError] = useState(null)

  const timezoneOptions = useMemo(() => buildTimezoneOptions(post.timezone), [post.timezone])
  const platform = CALENDAR_PLATFORM_META[post.platform]
  const PlatformIcon = platform?.icon
  const pending = pendingAction !== null
  const unchanged = date === initial.date && time === initial.time && timezone === initial.timezone
  // a post that was never scheduled opens with an empty date/time: say so, instead of a silent grey button
  const missing = [!date && 'date', !time && 'time'].filter(Boolean)
  const neverScheduled = !initial.date || !initial.time
  const hint = missing.length
    ? `Pick a ${missing.join(' and ')} to schedule this post.`
    : unchanged && !neverScheduled ? 'Change the date, time or timezone to reschedule.' : null

  function handleConfirm() {
    if (pending) return
    const scheduledAt = scheduleFormToUtcIso({ date, time, timezone })
    if (!scheduledAt) { setLocalError('Enter a valid date and time.'); return }
    setLocalError(null)
    onConfirm({ scheduledAt, timezone })
  }

  const shownError = localError || error

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">Confirm schedule</h2>
      <p className="mt-1 text-sm text-slate-500">Review your post details and confirm the schedule.</p>

      <div className={wide ? 'mt-4 grid grid-cols-1 items-start gap-5 @min-[900px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_200px]' : ''} data-testid="confirm-schedule-body">
      <div className={wide ? '' : 'mt-4'}>
        <SchedulePreview post={post} accountName={accountName} />
      </div>

      <div className={wide ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'mt-5 flex flex-col gap-4'}>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Post to</p>
          {platform && (
            <span className="inline-flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${platform.badgeClass}`}>
                <PlatformIcon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium text-slate-700">{platform.label}</span>
            </span>
          )}
        </div>

        <DateSelector value={date} onChange={setDate} min={todayInTimezone(timezone)} disabled={pending} />
        <TimeSelector value={time} onChange={setTime} disabled={pending} />
        <TimezoneSelector options={timezoneOptions} value={timezone} onChange={setTimezone} />
      </div>

      {shownError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{shownError}</p>
      )}

      <div className={wide ? 'flex flex-col gap-2.5' : 'mt-5 flex flex-col gap-2.5'}>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending || unchanged || missing.length > 0}
          aria-describedby={hint ? 'schedule-hint' : undefined}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === 'confirm' && <Loader2 className="h-4 w-4 animate-spin" />}
          {pendingAction === 'confirm' ? 'Confirming…' : 'Confirm schedule'}
        </button>
        {hint && !pending && (
          <p id="schedule-hint" data-testid="schedule-hint" className="text-center text-xs text-slate-500">{hint}</p>
        )}

        {/* `onSaveForLater` omitted = the post is not scheduled yet, so there is nothing to "save for later" (Content Approvals). */}
        {onClose && !onSaveForLater && (
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
        )}
        {onSaveForLater && <button
          type="button"
          onClick={onSaveForLater}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pendingAction === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
          {pendingAction === 'save' ? 'Saving…' : 'Save for later'}
        </button>}
      </div>
      </div>
    </div>
  )
}

export default ConfirmSchedulePanel

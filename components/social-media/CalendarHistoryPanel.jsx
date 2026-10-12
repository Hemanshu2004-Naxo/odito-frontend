"use client"

import { useState } from 'react'
import { History, Loader2, RotateCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { useSocialCalendarHistory, useSocialCalendarVersion, useRestoreSocialCalendarVersion } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { formatPlanDate, platformsLabel, ITEM_STATUS_LABELS } from '@/lib/socialMedia/contentCalendar'

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What a version holds, in words: how many posts, and how many of them a person edited, approved or turned into real posts. */
export function versionFacts(counts) {
  const parts = [plural(counts.total, 'post')]
  if (counts.edited) parts.push(`${counts.edited} edited by you`)
  if (counts.approvedPlans) parts.push(`${plural(counts.approvedPlans, 'approved plan')}`)
  if (counts.withPosts) parts.push(`${plural(counts.withPosts, 'post')} created from it`)
  return parts.join(' · ')
}

function VersionPosts({ projectId, calendarId }) {
  const query = useSocialCalendarVersion(projectId, calendarId)
  if (query.isLoading) return <Skeleton className="h-20 rounded-lg bg-slate-200" aria-label="Loading this version" />
  if (query.isError) return <p role="alert" className="text-sm text-red-600">{describeApiError(query.error, 'Could not open this version.').message}</p>
  const items = query.data?.items || []
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white" data-testid={`version-posts-${calendarId}`}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
          <span className="w-28 shrink-0 font-medium text-slate-700">{formatPlanDate(item.date)}</span>
          <span className="shrink-0 text-xs text-slate-500">{platformsLabel(item.platforms)}</span>
          <span className="min-w-0 flex-1 truncate text-slate-800">{item.topic}</span>
          {item.editedFields?.length > 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Edited</span>}
          <span className="shrink-0 text-xs text-slate-400">{ITEM_STATUS_LABELS[item.effectiveStatus] || item.effectiveStatus}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Every version of the calendar that can be opened. Regenerating never deletes the calendar it replaces: it moves here with every edit and
 * approval intact. A version can be looked at (read-only) and restored whole (its own posts, edits and approvals; the current calendar
 * moves into this list instead of being lost). Nothing is merged between versions.
 */
export function CalendarHistoryPanel({ projectId, onClose, busy = false }) {
  const history = useSocialCalendarHistory(projectId)
  const restore = useRestoreSocialCalendarVersion(projectId)
  const [openId, setOpenId] = useState(null)
  const [confirm, setConfirm] = useState(null) // the version the person is being asked to restore

  const versions = history.data?.versions || []
  const current = versions.find((v) => v.isCurrent)

  function doRestore() {
    restore.mutate(confirm.id, { onSuccess: () => { setConfirm(null); onClose?.() } })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-testid="calendar-history" aria-label="Calendar version history">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><History className="h-4 w-4 text-violet-600" aria-hidden />Version history</h2>
          <p className="mt-0.5 text-sm text-slate-500">Every calendar you replaced is kept here, with your edits and approvals. Open one to read it, or restore it as your current calendar.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Close</button>}
      </div>

      {history.isLoading && <Skeleton className="mt-4 h-24 rounded-xl bg-slate-200" aria-label="Loading the history" />}
      {history.isError && <p role="alert" data-testid="history-error" className="mt-4 text-sm text-red-600">{describeApiError(history.error, 'Could not load the history.').message}</p>}
      {history.data && versions.length === 0 && <p className="mt-4 text-sm text-slate-400" data-testid="history-empty">There are no earlier versions yet.</p>}

      {versions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3" data-testid="history-list">
          {versions.map((v) => (
            <li key={v.id} className="rounded-xl border border-slate-200 p-3" data-testid={`history-version-${v.version}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    Version {v.version}
                    {v.isCurrent && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" data-testid="history-current">Current</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatPlanDate(v.config.startDate, { year: true })} to {formatPlanDate(v.config.endDate, { year: true })}
                    {v.config.months ? ` (${plural(v.config.months, 'month')})` : ''} · {v.config.postsPerWeek} per week · {platformsLabel(v.config.platforms)} · Strategy v{v.strategy.version}
                    {v.generatedAt ? ` · made ${formatDateTime(v.generatedAt)}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600" data-testid={`history-facts-${v.version}`}>{versionFacts(v.counts)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!v.isCurrent && (
                    <button type="button" onClick={() => setOpenId(openId === v.id ? null : v.id)} aria-expanded={openId === v.id} data-testid={`history-view-${v.version}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {openId === v.id ? 'Hide posts' : 'View posts'}
                    </button>
                  )}
                  {!v.isCurrent && (
                    <button type="button" onClick={() => { restore.reset(); setConfirm(v) }} disabled={busy} data-testid={`history-restore-${v.version}`} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60">
                      <RotateCcw className="h-3.5 w-3.5" />Restore
                    </button>
                  )}
                </div>
              </div>
              {openId === v.id && <div className="mt-3"><VersionPosts projectId={projectId} calendarId={v.id} /></div>}
            </li>
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title={confirm ? `Restore version ${confirm.version}?` : ''}
        description={confirm ? `Version ${confirm.version} becomes your current calendar again, exactly as you left it (${versionFacts(confirm.counts)}). ${current ? `Your current calendar, version ${current.version}, moves into this history; nothing in it is lost.` : ''} Posts that were already created from either version are not changed.` : ''}
        confirmLabel="Restore this version"
        cancelLabel="Keep the current calendar"
        pending={restore.isPending}
        error={restore.isError ? describeApiError(restore.error, 'Could not restore this version.').message : null}
        onConfirm={doRestore}
      />
      {restore.isPending && <span className="sr-only" role="status"><Loader2 className="inline h-3 w-3 animate-spin" /> Restoring…</span>}
    </section>
  )
}

export default CalendarHistoryPanel

"use client"

import { AlertTriangle, Loader2, PlayCircle, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'
import { formatPlanDate, platformsLabel } from '@/lib/socialMedia/contentCalendar'

/** How far a generation got, from the server's own counts (never an animation pretending to know). */
export function GenerationProgress({ progress, className = '' }) {
  const total = progress?.totalPosts || 0
  const planned = Math.min(progress?.plannedPosts || 0, total || Infinity)
  const percent = total ? Math.round((planned / total) * 100) : 0
  return (
    <div className={className} data-testid="generation-progress">
      <div className="h-2 overflow-hidden rounded-full bg-violet-100" role="progressbar" aria-label="Posts planned" aria-valuemin={0} aria-valuemax={total || 100} aria-valuenow={total ? planned : 0}>
        <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-600" data-testid="generation-progress-text">
        {total ? `${planned} of ${total} posts planned` : 'Getting started…'}
        {progress?.totalBatches > 1 && total ? ` · step ${Math.min(progress.completedBatches + 1, progress.totalBatches)} of ${progress.totalBatches}` : ''}
      </p>
    </div>
  )
}

/** A generation that is running (or waiting to retry): progress, what it is waiting for, and a way to stop it. */
export function GeneratingBanner({ generation, onStop, stopping = false }) {
  const retry = generation?.retry
  return (
    <div role="status" data-testid="plan-generating" className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Planning and writing your content calendar from your strategy…</p>
        <p className="mt-0.5 text-sm text-slate-600">
          This runs on the server and can take a while for a long calendar. You can leave this page: every batch is saved as soon as it is checked, so nothing is lost.
          {generation?.startedAt ? ` Started ${formatDateTime(generation.startedAt)}.` : ''}
        </p>
        <GenerationProgress progress={generation?.progress} className="mt-3" />
        {retry && (
          <p className="mt-2 text-sm text-amber-800" data-testid="plan-retrying">
            {retry.code === 'AI_TIMEOUT' ? 'The AI took too long to answer.' : retry.code === 'AI_UNREACHABLE' ? 'Odito could not reach the AI service.' : 'The AI service is busy.'}
            {' '}Odito will carry on by itself{retry.at ? ` around ${formatDateTime(retry.at)}` : ' shortly'}; the posts already planned are kept.
          </p>
        )}
      </div>
      {onStop && (
        <button type="button" onClick={onStop} disabled={stopping} data-testid="stop-generation" className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      )}
    </div>
  )
}

/**
 * A calendar that stopped after saving some posts. It is NOT presented as finished: it says how far it got and why it stopped,
 * shows the posts that were saved (read-only), and offers the two honest choices - carry on from where it stopped (only the
 * missing posts are generated and charged) or discard it. The last ready calendar, if any, is untouched and shown below.
 */
export function PartialCalendarCard({ generation, partial, onResume, onDiscard, resuming = false, discarding = false, error = null, hasReadyCalendar = false }) {
  const progress = generation?.progress
  const items = partial?.items || []
  const busy = resuming || discarding
  return (
    <section role="alert" data-testid="plan-partial" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900" data-testid="plan-partial-title">
            Your new calendar stopped after {progress?.plannedPosts ?? items.length} of {progress?.totalPosts ?? '?'} posts.
          </p>
          <p className="mt-0.5 text-sm text-amber-800" data-testid="plan-partial-message">
            {generation?.failure?.message || 'Generation was interrupted.'} The posts below were saved and checked; resuming only plans the ones that are missing.
            {hasReadyCalendar ? ' Your previous calendar is unchanged and shown underneath.' : ''}
          </p>
          <GenerationProgress progress={progress} className="mt-3" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onResume} disabled={busy} data-testid="resume-generation" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60">
              {resuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {resuming ? 'Resuming…' : 'Resume generation'}
            </button>
            <button type="button" onClick={onDiscard} disabled={busy} data-testid="discard-generation" className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
              <Trash2 className="h-4 w-4" /> {discarding ? 'Discarding…' : 'Discard these posts'}
            </button>
          </div>
          {error && <p role="alert" data-testid="plan-partial-error" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white" data-testid="partial-items">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 font-medium text-slate-700">{formatPlanDate(item.date)}</span>
              <span className="shrink-0 text-xs text-slate-500">{platformsLabel(item.platforms)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{item.topic}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

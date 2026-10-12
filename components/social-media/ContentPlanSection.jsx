"use client"

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, History, List, Loader2, Plus, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { CalendarPlanForm } from './CalendarPlanForm'
import { CalendarPlanTable, CalendarPlanGrid } from './CalendarPlanItems'
import { CalendarItemModal } from './CalendarItemModal'
import { CalendarPlanSummary, CalendarStaleBanner } from './CalendarPlanSummary'
import { GeneratingBanner, PartialCalendarCard } from './CalendarGenerationStatus'
import { CalendarHistoryPanel, versionFacts } from './CalendarHistoryPanel'
import { useSocialContentCalendar, useGenerateSocialContentCalendar, useResumeSocialContentCalendar, useCancelSocialContentCalendar, useCalendarContentGenerationSync, useSocialCalendarOptions } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { formatDateTime } from '@/lib/socialMedia/aiStrategy'

const VIEWS = [{ id: 'table', label: 'Table', icon: List }, { id: 'calendar', label: 'Calendar', icon: CalendarDays }]

/**
 * The Content Calendar PLAN: the user picks posts per week, platforms and dates; the server plans what each post is
 * about from the stored AI strategy. Server state only (React Query): generation is asynchronous, the page polls the
 * cheap status endpoint while the server says "generating", and every number shown (counts, mix, dates) was computed
 * by the server — nothing here is a sample. A calendar is never changed behind the user's back: when the strategy or
 * profile changes it is flagged, and regenerating is an explicit, confirmed action that keeps the old version.
 *
 * Every post in the plan arrives fully written (caption, hashtags, per-platform copy). Still, nothing here creates a design,
 * a publication or a schedule: those come later, through approval.
 */
export function ContentPlanSection({ projectId }) {
  const query = useSocialContentCalendar(projectId)
  const generate = useGenerateSocialContentCalendar(projectId)
  const resume = useResumeSocialContentCalendar(projectId)
  const cancel = useCancelSocialContentCalendar(projectId)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingChoices, setPendingChoices] = useState(null) // choices waiting for the "replace current calendar" confirmation
  const [view, setView] = useState('table')
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false) // the "add a post to the plan" window (a manual item)
  const [historyOpen, setHistoryOpen] = useState(false)
  // when a post written from a plan item finishes, the calendar (status, linked drafts) is refetched even if its window was closed
  useCalendarContentGenerationSync(projectId)
  // the editor's options (strategy pillars, live catalog, connections) are fetched as soon as a calendar exists, so a post opens instantly
  useSocialCalendarOptions(projectId, { enabled: !!query.data?.calendar })
  // set synchronously on the first click so a fast double-click can never send two requests before React re-renders the disabled button
  const startInFlight = useRef(false)

  const state = query.data
  const items = useMemo(() => state?.items || [], [state])
  // what a regeneration would move into the history - said before the person confirms, from the posts on screen
  const replaced = useMemo(() => ({
    total: items.length,
    edited: items.filter((i) => (i.editedFields || []).length > 0).length,
    approvedPlans: items.filter((i) => !!i.planApprovedAt).length,
    withPosts: items.filter((i) => (i.publications || []).length > 0).length,
  }), [items])
  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId])

  if (query.isLoading) {
    return (
      <div className="space-y-4" data-testid="plan-loading" aria-busy="true">
        <Skeleton className="h-40 rounded-2xl bg-slate-200" aria-label="Loading content plan" />
        <Skeleton className="h-64 rounded-2xl bg-slate-200" />
      </div>
    )
  }

  if (query.isError && !state) {
    return (
      <div role="alert" data-testid="plan-error" className="flex flex-col items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-red-700">Couldn&apos;t load your content plan</p>
        <p className="max-w-md text-sm text-red-600/90">{describeApiError(query.error, 'The request to Odito failed. Nothing was changed.').message}</p>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="mt-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-70">
          {query.isFetching ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    )
  }
  if (!state) return null

  const { calendar, generation, stale, strategy, connectedPlatforms, limits } = state
  const serverGenerating = state.status === 'generating'
  const busy = generate.isPending || serverGenerating
  const failed = state.status === 'failed' ? generation : null
  const startError = generate.isError ? describeApiError(generate.error, 'Could not start the calendar generation.').message : null
  const anyConnected = Object.values(connectedPlatforms || {}).some(Boolean)

  function start(choices) {
    if (startInFlight.current || busy) return
    startInFlight.current = true
    generate.mutate(choices, {
      onSuccess: () => { setFormOpen(false); setPendingChoices(null) },
      onSettled: () => { startInFlight.current = false },
    })
  }

  // a calendar already exists: replacing it is deliberate, so ask first (the old version is kept in history)
  const submit = (choices) => (calendar ? setPendingChoices(choices) : start(choices))
  const openRegenerate = () => { generate.reset(); setFormOpen(true) }

  if (!strategy?.available) {
    return (
      <div data-testid="plan-no-strategy" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Sparkles className="h-6 w-6" /></span>
        <p className="text-base font-semibold text-slate-800">Create your AI strategy first</p>
        <p className="max-w-md text-sm text-slate-500">The content calendar is planned from your strategy: what to talk about, who to talk to and which formats work.</p>
        <Link href="/app/social-media/ai-strategy" className="mt-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700">Go to AI Strategy</Link>
      </div>
    )
  }

  const form = (
    <CalendarPlanForm
      key={calendar ? `v${calendar.version}` : 'new'}
      projectId={projectId}
      strategy={strategy}
      connectedPlatforms={connectedPlatforms}
      limits={limits}
      pending={busy}
      submitLabel={calendar ? 'Regenerate calendar' : 'Generate calendar'}
      onSubmit={submit}
      onCancel={calendar ? () => setFormOpen(false) : null}
      error={startError}
    />
  )

  return (
    <div className="space-y-5" data-testid="content-plan">
      {serverGenerating && <GeneratingBanner generation={generation} onStop={() => cancel.mutate()} stopping={cancel.isPending} />}

      {state.status === 'partial' && (
        <PartialCalendarCard
          generation={generation}
          partial={state.partial}
          hasReadyCalendar={!!calendar}
          onResume={() => { resume.reset(); resume.mutate() }}
          onDiscard={() => { cancel.reset(); cancel.mutate() }}
          resuming={resume.isPending}
          discarding={cancel.isPending}
          error={resume.isError ? describeApiError(resume.error, 'Could not resume the calendar.').message : (cancel.isError ? describeApiError(cancel.error, 'Could not discard the calendar.').message : null)}
        />
      )}

      {failed && (
        <div role="alert" data-testid="plan-failed" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-800">The last attempt to plan a calendar failed.</p>
            <p className="mt-0.5 text-sm text-red-700" data-testid="plan-failed-message">{failed.failure?.message}</p>
            {calendar && <p className="mt-0.5 text-sm text-red-700">Your previous calendar (version {calendar.version}) is shown below and is unchanged.</p>}
          </div>
        </div>
      )}

      {calendar && !serverGenerating && <CalendarStaleBanner stale={stale} calendarStrategyVersion={calendar.strategy.version} onRegenerate={openRegenerate} busy={busy} />}

      {!anyConnected && !calendar && (
        <p role="status" data-testid="plan-no-platforms" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Facebook or Instagram to plan content for it. <Link href="/app/social-media/connect-accounts" className="font-semibold underline">Connect accounts</Link>
        </p>
      )}

      {!calendar && !serverGenerating && state.status !== 'partial' && form}
      {calendar && formOpen && !serverGenerating && form}

      {calendar && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Plan view">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" onClick={() => setView(v.id)} aria-pressed={view === v.id} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${view === v.id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <v.icon className="h-4 w-4" />{v.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setAdding(true)} disabled={busy} data-testid="add-plan-item" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add post to plan
              </button>
              <button type="button" onClick={() => setHistoryOpen((open) => !open)} aria-expanded={historyOpen} data-testid="open-history" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                <History className="h-4 w-4" /> Version history
              </button>
              {!formOpen && (
                <button type="button" onClick={openRegenerate} disabled={busy} data-testid="regenerate-calendar" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw className="h-4 w-4" /> Regenerate calendar
                </button>
              )}
            </div>
          </div>

          {historyOpen && <CalendarHistoryPanel projectId={projectId} onClose={() => setHistoryOpen(false)} busy={busy} />}

          <CalendarPlanSummary calendar={calendar} strategyVersion={strategy.version} />

          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400" data-testid="plan-empty">This calendar has no posts.</p>
          ) : view === 'table' ? (
            <CalendarPlanTable items={items} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <CalendarPlanGrid items={items} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </>
      )}

      {/* one planned post: a centered modal workspace (never a drawer). Keyed by id so another post starts from a clean form. */}
      {selected && <CalendarItemModal key={selected.id} projectId={projectId} item={selected} onClose={() => setSelectedId(null)} />}
      {adding && calendar && <CalendarItemModal key="new-item" projectId={projectId} item={null} onClose={() => setAdding(false)} />}

      <ConfirmActionDialog
        open={!!pendingChoices}
        onOpenChange={(open) => { if (!open) setPendingChoices(null) }}
        title="Regenerate the content calendar?"
        description={calendar ? `This plans a new calendar (version ${calendar.version + 1}) from your current strategy and makes it the current one.${state.status === 'partial' ? ' The unfinished calendar below is discarded.' : ''} Version ${calendar.version} moves into Version history with everything in it (${versionFacts(replaced)}), and you can restore it later. Posts already created from it are not changed.` : ''}
        confirmLabel="Regenerate calendar"
        cancelLabel="Keep current calendar"
        pending={busy}
        error={pendingChoices ? startError : null}
        onConfirm={() => start(pendingChoices)}
      />
    </div>
  )
}

export default ContentPlanSection

"use client"

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DateTime } from 'luxon'
import { CalendarDays, ChevronDown, History, List, MoreHorizontal, PenLine, Plus, RefreshCw, Sparkles, Wand2, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { CalendarPlanForm } from './CalendarPlanForm'
import { CalendarPlanTable, CalendarPlanGrid, CalendarNav } from './CalendarPlanItems'
import { CalendarItemModal } from './CalendarItemModal'
import { CalendarPlanSummary, CalendarStaleBanner, CalendarConformanceBanner, PlanEndedBanner } from './CalendarPlanSummary'
import { GeneratingBanner, PartialCalendarCard } from './CalendarGenerationStatus'
import { CalendarHistoryPanel, versionFacts } from './CalendarHistoryPanel'
import { SingleAIPostGenerator } from './SingleAIPostGenerator'
import {
  useSocialContentCalendar, useGenerateSocialContentCalendar, useResumeSocialContentCalendar, useCancelSocialContentCalendar, useCalendarContentGenerationSync,
  useSocialCalendarOptions, useSocialAIStrategy, useCalendarPosts,
} from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import {
  STATUS_GROUPS, statusGroupOf, pillarColorMap, planHasEnded, nextPlanStart, todayDate, monthOf, shiftMonth, formatPlanDate,
} from '@/lib/socialMedia/contentCalendar'
import { pluralize } from '@/lib/pluralize'

const VIEWS = [{ id: 'calendar', label: 'Calendar', icon: CalendarDays }, { id: 'list', label: 'List', icon: List }]
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'
const SECONDARY = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`
const MENU = 'border-slate-200 bg-white text-slate-800 shadow-lg'
const MENU_ITEM = 'cursor-pointer text-slate-800 focus:bg-violet-50 focus:text-violet-800 data-[disabled]:opacity-50'
const PRIMARY = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`

const PUBLICATION_TAB = { scheduled: 'scheduled', publishing: 'scheduled', published: 'published', failed: 'failed' }

/** A real scheduled / published post that is not part of the plan (made in Creative Studio, say), shaped like a plan card. */
function publicationCard(post) {
  return {
    id: `pub:${post.id}`,
    publicationId: post.id,
    publicationStatus: post.status,
    external: true,
    date: post.date,
    platforms: [post.platform],
    topic: post.title,
    format: post.contentFormat || 'post',
    contentPillar: null,
    effectiveStatus: post.status === 'publishing' ? 'scheduled' : post.status,
    // opened where a real post is managed (reschedule, retry, cancel)
    href: `/app/social-media/scheduled-posts?tab=${PUBLICATION_TAB[post.status] || 'scheduled'}&post=${encodeURIComponent(post.id)}`,
  }
}

/**
 * The Content Calendar: ONE calendar of every post on its date - the plan Odito wrote from the strategy, and the real scheduled / published
 * posts made elsewhere - filterable by status. Server state only (React Query): generation is asynchronous, the page polls the cheap status
 * endpoint while the server says "generating", and every number shown was computed by the server or counted from its items. A calendar is
 * never changed behind the user's back: a newer strategy, a calendar that does not follow its strategy, or a plan that has ended are each said
 * plainly, and regenerating is explicit, confirmed and keeps the old version.
 */
export function ContentPlanSection({ projectId }) {
  const query = useSocialContentCalendar(projectId)
  const generate = useGenerateSocialContentCalendar(projectId)
  const resume = useResumeSocialContentCalendar(projectId)
  const cancel = useCancelSocialContentCalendar(projectId)
  // ?plan=new (a newer strategy) or ?plan=next (the plan ended) open the prefilled form at once
  const [planParam] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null))
  const [formOpen, setFormOpen] = useState(() => planParam === 'new' || planParam === 'next')
  const [planNext, setPlanNext] = useState(() => planParam === 'next')
  const [pendingChoices, setPendingChoices] = useState(null) // choices waiting for the "replace current calendar" confirmation
  const [view, setView] = useState('calendar')
  const [status, setStatus] = useState('all')
  const [month, setMonth] = useState(null) // null = follow the plan (its current month, or its first month)
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false) // the "plan a post" window (a manual item)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  useCalendarContentGenerationSync(projectId)
  useSocialCalendarOptions(projectId, { enabled: !!query.data?.calendar })
  const strategyState = useSocialAIStrategy(projectId)
  const startInFlight = useRef(false)

  const state = query.data
  const calendar = state?.calendar || null
  const items = useMemo(() => state?.items || [], [state])
  const today = todayDate()
  const ended = planHasEnded(calendar?.config, today)

  // the month on screen: the person's choice, else today's month when it is inside the plan, else the plan's first month
  const planMonth = calendar ? (today >= calendar.config.startDate && today <= calendar.config.endDate ? monthOf(today) : monthOf(calendar.config.startDate)) : monthOf(today)
  const shownMonth = month || planMonth
  const fetchRange = useMemo(() => {
    const start = DateTime.fromISO(shownMonth, { zone: 'utc' })
    return { from: start.minus({ days: 9 }).toFormat('yyyy-LL-dd'), to: start.plus({ months: 1, days: 9 }).toFormat('yyyy-LL-dd') }
  }, [shownMonth])
  const realPosts = useCalendarPosts(projectId, fetchRange)

  // posts made outside the plan: the plan's own posts already show their publication's status
  const linked = useMemo(() => new Set(items.flatMap((i) => i.publicationIds || [])), [items])
  const others = useMemo(() => realPosts.posts.filter((p) => !linked.has(p.id)).map(publicationCard), [realPosts.posts, linked])
  const colors = useMemo(() => pillarColorMap(calendar?.plan?.pillarDistribution), [calendar])
  const filtered = useMemo(() => {
    const all = [...items, ...others].sort((a, b) => a.date.localeCompare(b.date))
    return status === 'all' ? all : all.filter((i) => statusGroupOf(i).id === status)
  }, [items, others, status])
  const counts = useMemo(() => {
    const map = new Map(STATUS_GROUPS.map((g) => [g.id, 0]))
    for (const i of [...items, ...others]) map.set(statusGroupOf(i).id, map.get(statusGroupOf(i).id) + 1)
    return map
  }, [items, others])

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
        <p className="max-w-md text-sm text-red-700">{describeApiError(query.error, 'The request to Odito failed. Nothing was changed.').message}</p>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`mt-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-70 ${FOCUS_RING}`}>
          {query.isFetching ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    )
  }
  if (!state) return null

  const { generation, stale, strategy, connectedPlatforms, limits } = state
  const serverGenerating = state.status === 'generating'
  const busy = generate.isPending || serverGenerating
  const failed = state.status === 'failed' ? generation : null
  const startError = generate.isError ? describeApiError(generate.error, 'Could not start the calendar generation.').message : null
  const anyConnected = Object.values(connectedPlatforms || {}).some(Boolean)

  function start(choices) {
    if (startInFlight.current || busy) return
    startInFlight.current = true
    generate.mutate(choices, {
      onSuccess: () => { setFormOpen(false); setPendingChoices(null); setPlanNext(false); setMonth(null) },
      onSettled: () => { startInFlight.current = false },
    })
  }

  // a calendar already exists: replacing it is deliberate, so ask first (the old version is kept in history)
  const submit = (choices) => (calendar ? setPendingChoices(choices) : start(choices))
  const openRegenerate = () => { generate.reset(); setPlanNext(false); setFormOpen(true) }
  const openPlanNext = () => { generate.reset(); setPlanNext(true); setFormOpen(true) }
  const onSelect = (id) => setSelectedId(id)

  if (!strategy?.available) {
    return (
      <div data-testid="plan-no-strategy" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Sparkles className="h-6 w-6" aria-hidden="true" /></span>
        <p className="text-base font-semibold text-slate-900">Create your AI strategy first</p>
        <p className="max-w-md text-sm text-slate-700">The content calendar is planned from your strategy: what to talk about, who to talk to and which formats work.</p>
        <Link href="/app/social-media/ai-strategy" className={`mt-2 ${PRIMARY}`}>Go to AI Strategy</Link>
      </div>
    )
  }

  const form = (
    <CalendarPlanForm
      key={calendar ? `v${calendar.version}${planNext ? '-next' : ''}` : 'new'}
      projectId={projectId}
      strategy={strategy}
      connectedPlatforms={connectedPlatforms}
      platformStates={state.platformStates}
      limits={limits}
      pending={busy}
      initialStartDate={planNext && calendar ? nextPlanStart(calendar.config, today) : undefined}
      initialMonths={planNext ? 1 : undefined}
      title={planNext ? 'Plan your next month' : undefined}
      submitLabel={calendar ? (planNext ? 'Plan next month' : 'Regenerate calendar') : 'Generate calendar'}
      onSubmit={submit}
      onCancel={calendar ? () => { setFormOpen(false); setPlanNext(false) } : null}
      error={startError}
    />
  )

  const rangeLabel = calendar ? `${formatPlanDate(calendar.config.startDate, { year: true })} – ${formatPlanDate(calendar.config.endDate, { year: true })}` : ''

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
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-red-800">The last attempt to plan a calendar failed.</p>
            <p className="mt-0.5 text-sm text-red-800" data-testid="plan-failed-message">{failed.failure?.message}</p>
            {calendar && <p className="mt-0.5 text-sm text-red-800">Your previous calendar (version {calendar.version}) is shown below and is unchanged.</p>}
          </div>
        </div>
      )}

      {calendar && !serverGenerating && ended && !formOpen && <PlanEndedBanner endDate={calendar.config.endDate} onPlanNext={openPlanNext} busy={busy} />}
      {calendar && !serverGenerating && !ended && <CalendarStaleBanner stale={stale} calendarStrategyVersion={calendar.strategy.version} onRegenerate={openRegenerate} busy={busy} />}
      {calendar && !serverGenerating && <CalendarConformanceBanner conformance={state.conformance} onRegenerate={openRegenerate} busy={busy} ended={ended} />}

      {!anyConnected && !calendar && (
        <p role="status" data-testid="plan-no-platforms" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Facebook or Instagram to plan content for it. <Link href="/app/social-media/connect-accounts" className="font-semibold underline">Connect accounts</Link>
        </p>
      )}

      {!calendar && !serverGenerating && state.status !== 'partial' && form}
      {calendar && formOpen && !serverGenerating && form}

      {calendar && (
        <>
          <CalendarPlanSummary calendar={calendar} items={items} />

          {/* toolbar: view, status filter, and the actions (one primary, the rest in a menu) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid="plan-toolbar">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Plan view">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" onClick={() => setView(v.id)} aria-pressed={view === v.id} data-testid={`view-${v.id}`} className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${FOCUS_RING} ${view === v.id ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <v.icon className="h-4 w-4" aria-hidden="true" />{v.label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="plan-status-filter">Show posts by status</label>
              <select id="plan-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="status-filter" className={`h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm ${FOCUS_RING}`}>
                <option value="all">All posts ({items.length + others.length})</option>
                {STATUS_GROUPS.filter((g) => counts.get(g.id) > 0 || g.id !== 'failed').map((g) => <option key={g.id} value={g.id}>{g.label} ({counts.get(g.id)})</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={PRIMARY} disabled={busy} data-testid="add-post"><Plus className="h-4 w-4" aria-hidden="true" />Add post<ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`w-64 ${MENU}`}>
                  <DropdownMenuItem onSelect={() => setAdding(true)} data-testid="add-plan-item" className={`flex items-start gap-2 py-2 ${MENU_ITEM}`}>
                    <PenLine className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden="true" />
                    <span><span className="block text-sm font-semibold text-slate-900">Plan a post</span><span className="block text-xs text-slate-600">Add your own post to this plan</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setGeneratorOpen(true)} data-testid="add-ai-post" className={`flex items-start gap-2 py-2 ${MENU_ITEM}`}>
                    <Wand2 className="mt-0.5 h-4 w-4 text-violet-600" aria-hidden="true" />
                    <span><span className="block text-sm font-semibold text-slate-900">Generate a post with AI</span><span className="block text-xs text-slate-600">One post from your strategy, sent for review</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem asChild>
                    <Link href="/app/social-media/creative-studio" className={`flex items-center gap-2 py-2 text-sm font-semibold ${MENU_ITEM}`}><Sparkles className="h-4 w-4 text-slate-600" aria-hidden="true" />Open Creative Studio</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={SECONDARY} aria-label="More calendar actions" data-testid="more-actions"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`w-56 ${MENU}`}>
                  <DropdownMenuItem onSelect={() => setHistoryOpen(true)} data-testid="open-history" className={MENU_ITEM}><History className="h-4 w-4" aria-hidden="true" />Version history</DropdownMenuItem>
                  <DropdownMenuItem onSelect={openRegenerate} disabled={busy} data-testid="regenerate-calendar" className={MENU_ITEM}><RefreshCw className="h-4 w-4" aria-hidden="true" />Regenerate calendar</DropdownMenuItem>
                  {ended && <DropdownMenuItem onSelect={openPlanNext} disabled={busy} className={MENU_ITEM}><CalendarDays className="h-4 w-4" aria-hidden="true" />Plan next month</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {historyOpen && <CalendarHistoryPanel projectId={projectId} onClose={() => setHistoryOpen(false)} busy={busy} />}

          {view === 'calendar' && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CalendarNav month={shownMonth} onMonth={(n) => setMonth(shiftMonth(shownMonth, n))} onToday={() => setMonth(monthOf(today))} />
              <p className="text-sm text-slate-700" data-testid="plan-range">Plan: {rangeLabel}{ended ? ' (ended)' : ''}</p>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-700" data-testid="plan-empty">
              {items.length === 0 ? 'This calendar has no posts.' : `No ${STATUS_GROUPS.find((g) => g.id === status)?.label.toLowerCase() || ''} posts.`}
            </p>
          ) : view === 'list' ? (
            <CalendarPlanTable items={filtered} selectedId={selectedId} onSelect={onSelect} colors={colors} today={today} />
          ) : (
            <CalendarPlanGrid items={filtered} selectedId={selectedId} onSelect={onSelect} colors={colors} month={shownMonth} range={calendar.config} today={today} />
          )}
          {others.length > 0 && <p className="text-xs text-slate-600">Also shown: {pluralize(others.length, 'scheduled or published post')} made outside this plan (grey edge). Open one to manage it in Scheduled Posts.</p>}
        </>
      )}

      {/* one planned post: a centered modal workspace (never a drawer). Keyed by id so another post starts from a clean form. */}
      {selected && <CalendarItemModal key={selected.id} projectId={projectId} item={selected} onClose={() => setSelectedId(null)} />}
      {adding && calendar && <CalendarItemModal key="new-item" projectId={projectId} item={null} onClose={() => setAdding(false)} />}

      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-200 bg-white p-3 text-slate-900 sm:max-w-2xl" data-testid="ai-post-dialog">
          <DialogTitle className="sr-only">Generate a post with AI</DialogTitle>
          <DialogDescription className="sr-only">Generate one post from your AI strategy. It is saved as a draft and goes to Content Approvals.</DialogDescription>
          {strategyState.data ? <SingleAIPostGenerator projectId={projectId} strategyState={strategyState.data} /> : <Skeleton className="h-48 rounded-2xl bg-slate-200" />}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!pendingChoices}
        onOpenChange={(open) => { if (!open) setPendingChoices(null) }}
        title={planNext ? 'Plan the next month?' : 'Regenerate the content calendar?'}
        description={calendar ? `This plans a new calendar (version ${calendar.version + 1}) from your current strategy and makes it the current one.${state.status === 'partial' ? ' The unfinished calendar below is discarded.' : ''} Version ${calendar.version} moves into Version history with everything in it (${versionFacts(replaced)}), and you can restore it later. Posts already created from it are not changed.` : ''}
        confirmLabel={planNext ? 'Plan next month' : 'Regenerate calendar'}
        cancelLabel="Keep current calendar"
        pending={busy}
        error={pendingChoices ? startError : null}
        onConfirm={() => start(pendingChoices)}
      />
    </div>
  )
}

export default ContentPlanSection

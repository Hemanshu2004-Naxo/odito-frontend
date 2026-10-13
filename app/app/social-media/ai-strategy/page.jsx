"use client"

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles, XCircle, RefreshCw } from 'lucide-react'
import { StrategyStatusCard } from '@/components/social-media/StrategyStatusCard'
import { StrategyProfileChangedBanner } from '@/components/social-media/StrategyProfileChangedBanner'
import { StrategyBusinessContext } from '@/components/social-media/StrategyBusinessContext'
import { StrategyGapsCard } from '@/components/social-media/StrategyGapsCard'
import { StrategyOverview } from '@/components/social-media/StrategyOverview'
import { StrategyHighlights } from '@/components/social-media/StrategyHighlights'
import { StrategyDetails } from '@/components/social-media/StrategyDetails'
import { StrategyWizard } from '@/components/social-media/StrategyWizard'
import { SingleAIPostGenerator } from '@/components/social-media/SingleAIPostGenerator'
import { Skeleton } from '@/components/ui/skeleton'
import { useProject } from '@/contexts/ProjectContext'
import { useSocialAIStrategy, useGenerateSocialAIStrategy, useSocialContentCalendar } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { statusView, formatDateTime } from '@/lib/socialMedia/aiStrategy'

/**
 * Social Media AI — AI Strategy, driven entirely by the backend.
 *
 * Creating a strategy starts with a short wizard (platforms, posting frequency, planning duration, review). Nothing is generated until the
 * last step is confirmed; the choice is validated and counted by the server's calendar planner, saved with the strategy version, sent to the
 * AI, and becomes the default of the first content calendar. Editing or regenerating re-opens the same wizard and creates the NEXT version -
 * the strategy that exists, and any calendar made from it, are never modified.
 *
 * The page shows a short overview and the few things a business owner needs (summary, goals, audience, content mix, posting plan, success
 * measures); everything else the strategy stores is one click away under "Detailed insights". Generation is asynchronous: the server owns
 * the state (this page polls a cheap status endpoint while it says "generating"). There is no client-side progress and no sample data. If
 * generation fails, the last good strategy stays visible, the real failure is shown, and "Try again" re-opens the wizard with the same choices.
 */
export default function AIStrategyPage() {
  const { activeProject, activeProjectId } = useProject()
  const query = useSocialAIStrategy(activeProjectId)
  const calendarQuery = useSocialContentCalendar(activeProjectId)
  const generate = useGenerateSocialAIStrategy(activeProjectId)
  const [wizard, setWizard] = useState(null) // null | 'create' | 'edit' | 'regenerate'
  // Set synchronously on the first confirmation, so a fast double-click can never start two requests before React re-renders the disabled button.
  const startInFlight = useRef(false)

  const header = (view) => (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Strategy</h1>
        <p className="mt-1 text-sm text-slate-500">Your brand&apos;s strategy: who you are, who you talk to and what you say. The calendar turns it into a plan.</p>
      </div>
      {view && <StrategyStatusCard view={view} />}
    </div>
  )

  if (!activeProjectId) {
    return (
      <div className="flex-1 space-y-6 pb-16">
        {header(null)}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm" data-testid="no-project">
          <p className="text-sm font-semibold text-slate-700">No project selected</p>
          <p className="mt-1 text-sm text-slate-400">Select or create a project to generate its social strategy.</p>
        </div>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex-1 space-y-6 pb-16">
        {header(null)}
        <div className="space-y-4" data-testid="strategy-loading" aria-busy="true">
          <Skeleton className="h-28 rounded-2xl bg-slate-200" aria-label="Loading AI strategy" />
          <Skeleton className="h-64 rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  if (query.isError && !query.data) {
    return (
      <div className="flex-1 space-y-6 pb-16">
        {header(null)}
        <div role="alert" data-testid="strategy-error" className="flex flex-col items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-red-700">Couldn&apos;t load your AI strategy</p>
          <p className="max-w-md text-sm text-red-600/90">{describeApiError(query.error, 'The request to Odito failed. Nothing was changed.').message}</p>
          <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="mt-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60">
            {query.isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    )
  }

  const state = query.data
  if (!state) return null
  const { strategy, generation, profile } = state
  const serverGenerating = state.status === 'generating'
  const busy = generate.isPending || serverGenerating
  const failedAttempt = state.status === 'failed' ? generation : null
  const blockers = profile?.blockers || []
  const canGenerate = profile?.canGenerate !== false
  const startError = generate.isError ? describeApiError(generate.error, 'Could not start the strategy generation.').message : null
  const businessName = strategy?.profileSnapshot?.data?.business?.name || activeProject?.project_name || ''
  const calendar = calendarQuery.data?.calendar ? { ...calendarQuery.data.calendar } : null

  const openWizard = (mode) => { if (busy || !canGenerate) return; generate.reset(); setWizard(mode) }

  function handleConfirm(options) {
    if (startInFlight.current || busy || !canGenerate) return
    startInFlight.current = true
    generate.mutate(options, {
      onSuccess: () => setWizard(null),
      onSettled: () => { startInFlight.current = false },
    })
  }

  const wizardMode = wizard
  const retryChoice = wizard === 'regenerate' && failedAttempt?.planning ? failedAttempt.planning : null

  return (
    <div className="flex-1 space-y-6 pb-16">
      {header(statusView(state))}

      {profile?.changed && strategy && (
        <StrategyProfileChangedBanner changes={profile.changes} busy={busy} onRegenerate={() => openWizard('regenerate')} />
      )}

      {serverGenerating && (
        <div role="status" data-testid="strategy-generating" className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Generating your strategy from your Business profile…</p>
            <p className="mt-0.5 text-sm text-slate-600">
              This runs on the server and usually takes a minute or two. You can leave this page — it will be here when it&apos;s done.
              {generation?.startedAt ? ` Started ${formatDateTime(generation.startedAt)}.` : ''}
            </p>
          </div>
        </div>
      )}

      {failedAttempt && (
        <div role="alert" data-testid="strategy-failed" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-red-800">The last attempt to generate a strategy failed.</p>
              <p className="mt-0.5 text-sm text-red-700" data-testid="strategy-failed-message">{failedAttempt.failure?.message}</p>
              {strategy && <p className="mt-0.5 text-sm text-red-700">Your previous strategy (version {strategy.version}) is shown below and is unchanged.</p>}
              {failedAttempt.planning && <p className="mt-0.5 text-sm text-red-700" data-testid="strategy-failed-choice">Your choices were kept: {failedAttempt.planning.postsPerWeek} posts per week for {failedAttempt.planning.months} month{failedAttempt.planning.months === 1 ? '' : 's'}.</p>}
            </div>
          </div>
          <button type="button" onClick={() => openWizard('regenerate')} disabled={busy || !canGenerate} data-testid="retry-strategy" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-60">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {!canGenerate && (
        <div role="status" data-testid="strategy-blocked" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {blockers.map((b) => <p key={b.field}>{b.reason}</p>)}
          <Link href="/app/social-media/business-profile" className="mt-1 inline-block font-semibold underline">Open Business profile</Link>
        </div>
      )}

      {strategy ? (
        <>
          {!serverGenerating && <StrategyOverview strategy={strategy} businessName={businessName} calendar={calendar} busy={busy} onEdit={() => openWizard('edit')} onRegenerate={() => openWizard('regenerate')} />}
          <StrategyHighlights strategy={strategy.strategy} planning={strategy.planning} />
          <StrategyDetails strategy={strategy.strategy} basedOn={<StrategyBusinessContext snapshot={strategy.profileSnapshot} />} />
          {!serverGenerating && <SingleAIPostGenerator projectId={activeProjectId} strategyState={state} />}
          <StrategyGapsCard gaps={strategy.strategyGaps} title="Gaps in this strategy" subtitle="Information that was missing when this strategy was generated." />
        </>
      ) : (
        !serverGenerating && (
          <>
            <div data-testid="strategy-empty" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Sparkles className="h-6 w-6" /></span>
              <p className="text-base font-semibold text-slate-800">You don&apos;t have an AI strategy yet</p>
              <p className="max-w-md text-sm text-slate-500">Odito will use your Business profile — what it knows about your business, audience, goals and brand — to propose what to publish. First you choose how often to post and for how long.</p>
              <button
                type="button" onClick={() => openWizard('create')} disabled={busy || !canGenerate} data-testid="generate-button"
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? 'Generating…' : 'Create AI Strategy'}
              </button>
            </div>
            <StrategyGapsCard gaps={profile?.gaps} title="Make your strategy more specific" subtitle="These details are missing from your Business profile. You can generate without them, but the strategy will be more generic." />
          </>
        )
      )}

      <StrategyWizard
        open={!!wizard}
        onOpenChange={(open) => { if (!open) setWizard(null) }}
        projectId={activeProjectId}
        businessName={businessName}
        connectedPlatforms={profile?.connectedPlatforms}
        current={strategy?.planning || null}
        currentVersion={strategy?.version || 0}
        retryChoice={retryChoice}
        mode={wizardMode || 'create'}
        pending={generate.isPending}
        error={startError}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

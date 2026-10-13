"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Sparkles, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useStrategyPlanPreview } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { formatPlanDate } from '@/lib/socialMedia/contentCalendar'
import {
  FREQUENCY_OPTIONS, OTHER_FREQUENCIES, DURATION_VALUES, DURATION_TAGS, postsPerWeekLabel, monthsLabel, platformList, platformStateView, newRequestId,
} from '@/lib/socialMedia/strategyPlanning'

const PLATFORMS = ['facebook', 'instagram']
const PLATFORM_NAME = { facebook: 'Facebook', instagram: 'Instagram' }
const STEPS = ['Business and platforms', 'Posting frequency', 'Planning duration', 'Review']
const TONE = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200', slate: 'bg-slate-100 text-slate-600 ring-slate-200' }

const CARD = (selected) => `flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-violet-300 ${selected ? 'border-violet-400 bg-violet-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`

/**
 * The strategy setup wizard: business and platforms -> posting frequency -> planning duration -> review. Nothing is generated until the last
 * step is confirmed. The number of planned posts is NEVER computed here: it comes from the server's calendar planner (plan-preview), and so does
 * every statement about what is supported. The choices live in this component, so a refused or failed start keeps them on screen.
 *
 * `mode`: 'create' (first strategy) | 'edit' (change the frequency / duration of an existing strategy: opens on step 2) | 'regenerate' (same
 * choices, new version: opens on the review step). Editing never changes the strategy that exists: confirming creates the NEXT version.
 */
export function StrategyWizard({
  open, onOpenChange, projectId, businessName, connectedPlatforms = {}, current = null, currentVersion = 0, retryChoice = null, mode = 'create', pending = false, error = null, onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto border-slate-200 bg-white p-4 text-slate-800 sm:p-6" data-testid="strategy-wizard">
        {open && (
          <WizardBody
            projectId={projectId} businessName={businessName} connectedPlatforms={connectedPlatforms} current={current} currentVersion={currentVersion}
            retryChoice={retryChoice} mode={mode} pending={pending} error={error} onConfirm={onConfirm} onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function WizardBody({ projectId, businessName, connectedPlatforms, current, currentVersion, retryChoice, mode, pending, error, onConfirm, onCancel }) {
  const start = retryChoice || current
  const [step, setStep] = useState(mode === 'edit' ? 1 : mode === 'regenerate' && start ? 3 : 0)
  const [postsPerWeek, setPostsPerWeek] = useState(start?.postsPerWeek || 3)
  const [months, setMonths] = useState(start?.months || 3)
  const [platforms, setPlatforms] = useState(() => {
    if (start?.platforms?.length) return start.platforms
    const connected = PLATFORMS.filter((p) => connectedPlatforms?.[p])
    return connected.length ? connected : ['facebook']
  })
  const requestId = useRef(newRequestId())
  const heading = useRef(null)

  const choice = useMemo(() => ({ postsPerWeek, months, platforms: PLATFORMS.filter((p) => platforms.includes(p)) }), [postsPerWeek, months, platforms])
  const preview = useStrategyPlanPreview(projectId, choice, { enabled: choice.platforms.length > 0 })
  const data = preview.data
  const previewError = preview.isError ? describeApiError(preview.error, 'Odito could not work out this plan.').message : null
  const settling = preview.isFetching

  // a new step moves keyboard and screen-reader focus to its heading
  useEffect(() => { heading.current?.focus() }, [step])
  // changing the choices means a new confirmation: the idempotency key is per confirmed choice, not per dialog
  useEffect(() => { requestId.current = newRequestId() }, [postsPerWeek, months, platforms])

  const problems = []
  if (!choice.platforms.length) problems.push('Choose at least one platform.')
  if (previewError && !settling) problems.push(previewError)
  const canNext = step === 0 ? choice.platforms.length > 0 : true
  const last = step === STEPS.length - 1
  const ready = !!data && !settling && !previewError && choice.platforms.length > 0
  const changed = !!current && (current.postsPerWeek !== postsPerWeek || current.months !== months || [...current.platforms].sort().join() !== [...choice.platforms].sort().join())

  const togglePlatform = (p) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  const stateOf = (p) => data?.platformStates?.[p] || (connectedPlatforms?.[p] ? 'connected' : 'none')
  const confirm = () => { if (ready && !pending) onConfirm({ planning: choice, expectedVersion: currentVersion, requestId: requestId.current }) }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader className="space-y-1 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600" data-testid="wizard-step-label">Step {step + 1} of {STEPS.length}</p>
        <DialogTitle ref={heading} tabIndex={-1} className="text-xl text-slate-900 outline-none" data-testid="wizard-title">
          {step === 0 && 'Which business and platforms is this for?'}
          {step === 1 && 'How often do you want to post?'}
          {step === 2 && 'How many months do you want to plan for?'}
          {step === 3 && 'Review and confirm'}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-500">
          {step === 0 && 'Odito uses your saved business profile. Check the platforms the strategy should cover.'}
          {step === 1 && 'These are suggestions. Pick the rhythm you can realistically keep.'}
          {step === 2 && 'Your strategy and your first content calendar will use this period.'}
          {step === 3 && 'Nothing is created until you press the button below.'}
        </DialogDescription>
      </DialogHeader>

      <ol className="flex gap-1.5" aria-label="Progress" data-testid="wizard-progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i < step ? 'bg-violet-500' : i === step ? 'bg-violet-400' : 'bg-slate-200'}`} />
            <span className="sr-only">{label}{i < step ? ' (done)' : i === step ? ' (current)' : ''}</span>
          </li>
        ))}
      </ol>

      {mode === 'edit' && step < 3 && current && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="wizard-current">
          Currently: {postsPerWeekLabel(current.postsPerWeek)} for {monthsLabel(current.months)} on {platformList(current.platforms)}.
        </p>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" data-testid="wizard-business">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Business</p>
            <p className="text-base font-semibold text-slate-900">{businessName || 'Your business'}</p>
            <Link href="/app/social-media/business-profile" className="text-xs font-semibold text-violet-600 hover:text-violet-700">Review business profile</Link>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Platforms</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const view = platformStateView(stateOf(p))
                const on = choice.platforms.includes(p)
                return (
                  <label key={p} className={CARD(on)} data-testid={`wizard-platform-${p}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-violet-600" checked={on} onChange={() => togglePlatform(p)} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{PLATFORM_NAME[p]}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONE[view.tone]}`} data-testid={`wizard-platform-state-${p}`}>{view.label}</span></span>
                      {view.note && <span className="mt-0.5 block text-xs text-slate-500">{view.note}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">You do not need a connected account to create a strategy. A connection is only needed to publish.</p>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <fieldset>
          <legend className="sr-only">Posts per week</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Posts per week">
            {FREQUENCY_OPTIONS.map((o) => (
              <label key={o.value} className={CARD(postsPerWeek === o.value)} data-testid={`wizard-frequency-${o.value}`}>
                <input type="radio" name="frequency" className="mt-1 h-4 w-4 accent-violet-600" checked={postsPerWeek === o.value} onChange={() => setPostsPerWeek(o.value)} />
                <span><span className="block text-sm font-semibold">{postsPerWeekLabel(o.value)} <span className="font-normal text-slate-500">- {o.title}</span></span><span className="mt-0.5 block text-xs text-slate-500">{o.hint}</span></span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            Something else
            <select
              data-testid="wizard-frequency-other" value={OTHER_FREQUENCIES.includes(postsPerWeek) ? postsPerWeek : ''}
              onChange={(e) => { if (e.target.value) setPostsPerWeek(Number(e.target.value)) }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              <option value="">Choose…</option>
              {OTHER_FREQUENCIES.map((n) => <option key={n} value={n}>{postsPerWeekLabel(n)}</option>)}
            </select>
          </label>
        </fieldset>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <fieldset>
            <legend className="sr-only">Planning duration</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Months to plan">
              {DURATION_VALUES.map((n) => (
                <label key={n} className={CARD(months === n)} data-testid={`wizard-months-${n}`}>
                  <input type="radio" name="months" className="mt-1 h-4 w-4 accent-violet-600" checked={months === n} onChange={() => setMonths(n)} />
                  <span><span className="block text-sm font-semibold">{monthsLabel(n)}</span>{DURATION_TAGS[n] && <span className="block text-xs text-slate-500">{DURATION_TAGS[n]}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Estimate data={data} loading={settling && !data} previewError={previewError} postsPerWeek={postsPerWeek} months={months} stale={settling && !!data} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4" data-testid="wizard-review">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <Row label="Business" value={businessName || 'Your business'} testId="review-business" />
            <Row label="Platforms" value={platformList(choice.platforms)} testId="review-platforms" />
            <Row label="Posting frequency" value={postsPerWeekLabel(postsPerWeek)} testId="review-frequency" />
            <Row label="Planning duration" value={monthsLabel(months)} testId="review-months" />
            <Row label="Estimated total posts" value={data ? `${data.estimatedPosts} planned posts` : (settling ? 'Working it out…' : '—')} testId="review-posts" />
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Accounts</dt>
              <dd className="mt-0.5 space-y-0.5 text-sm" data-testid="review-accounts">
                {choice.platforms.map((p) => <p key={p}>{PLATFORM_NAME[p]}: {platformStateView(stateOf(p)).label}</p>)}
              </dd>
            </div>
          </dl>
          <Estimate data={data} loading={settling && !data} previewError={previewError} postsPerWeek={postsPerWeek} months={months} stale={settling && !!data} compact />
          {data?.quotaCheck && !data.quotaCheck.fits && (
            <p role="note" data-testid="review-quota" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{data.quotaCheck.message} You can still create the strategy; the calendar needs this to fit.</span>
            </p>
          )}
          {mode !== 'create' && (
            <p role="note" data-testid="review-version-note" className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              {changed ? 'These settings differ from your current strategy. ' : 'This creates a fresh version with the same settings. '}
              Confirming creates strategy version {currentVersion + 1}. Version {currentVersion} and any content calendar you already made stay exactly as they are. Approvals and scheduled posts are not touched. Your next calendar starts from these settings.
            </p>
          )}
        </div>
      )}

      {problems.length > 0 && <ul role="alert" data-testid="wizard-problems" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{problems.map((m) => <li key={m}>{m}</li>)}</ul>}
      {error && <p role="alert" data-testid="wizard-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-2">
        <button type="button" onClick={step === 0 ? onCancel : () => setStep(step - 1)} disabled={pending} data-testid="wizard-back" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {last ? (
          <button type="button" onClick={confirm} disabled={!ready || pending} data-testid="wizard-generate" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {mode === 'create' ? 'Generate AI Strategy' : 'Generate new strategy version'}
          </button>
        ) : (
          <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext} data-testid="wizard-next" className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            Next
          </button>
        )}
      </DialogFooter>
    </div>
  )
}

function Row({ label, value, testId }) {
  return (
    <div data-testid={testId}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}

/** The planner's answer for the chosen frequency and duration. The sentence is built from the values and the server's number: nothing is a literal. */
function Estimate({ data, loading, previewError, postsPerWeek, months, stale, compact = false }) {
  if (loading) return <Skeleton className="h-16 rounded-xl bg-slate-200" data-testid="wizard-estimate-loading" aria-label="Working out the number of posts" />
  if (previewError && !data) return null
  if (!data) return null
  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/60 px-4 ${compact ? 'py-2.5' : 'py-3'} transition-opacity ${stale ? 'opacity-60' : ''}`} data-testid="wizard-estimate" aria-live="polite">
      <p className="text-sm font-semibold text-slate-900">{postsPerWeekLabel(postsPerWeek)} × {monthsLabel(months)} = {data.estimatedPosts} planned posts</p>
      <p className="mt-0.5 text-xs text-slate-600">
        Counted by Odito&apos;s calendar planner for a calendar that starts {formatPlanDate(data.basis?.startDate, { year: true })}.
        {data.basis?.partialWeeks?.length ? ' Weeks that are only partly inside the period count in proportion.' : ''} The exact number is confirmed when you choose the real start date.
      </p>
    </div>
  )
}

export default StrategyWizard

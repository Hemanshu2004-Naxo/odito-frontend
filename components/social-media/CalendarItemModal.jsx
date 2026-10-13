"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { CalendarRegenerateDialog } from './CalendarRegenerateDialog'
import { Field, TextInput, TextArea, SelectInput, Section, HashtagInput } from './CalendarItemFields'
import { Pill } from './StrategyParts'
import {
  useSocialCalendarOptions, useUpdateSocialCalendarItem, useCreateSocialCalendarItem, useSocialCalendarItemApproval, useRegenerateSocialCalendarItem,
  useGenerateSocialCalendarItemContent, useSocialAIContent,
} from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { FORMAT_LABELS, OBJECTIVE_LABELS, KPI_LABELS, ASSET_LABELS, ITEM_STATUS_LABELS, ITEM_STATUS_TONE, formatPlanDate, weekdayName, plannedCopyFor } from '@/lib/socialMedia/contentCalendar'
import {
  PLATFORM_LABEL, itemToForm, newItemForm, formToPatch, isDirty, validateForm, serverFieldErrors, supportedFormats, textLength, hookIndexOf,
} from '@/lib/socialMedia/calendarItemForm'

/**
 * The planning workspace of ONE calendar item, as a centered modal (never a drawer). It lets a person review, edit, approve
 * the PLAN of, regenerate and hand off one planned post:
 *
 *   edit      Save is one atomic request carrying only what changed plus the revision that was seen. If it fails the modal stays
 *             open with the user's changes intact; a stale revision shows what changed elsewhere and offers the latest version.
 *   approve   approves the PLAN only (a planning status). It never creates, approves or schedules a publication.
 *   generate  starts the existing post generator for one platform of an approved plan; the draft goes to Content Approvals and is
 *             linked back here. The status shown is the publication's own once content exists.
 *   regenerate  re-plans chosen fields of this post with AI; fields the user edited are never replaced without an explicit choice.
 *
 * `item` null = a NEW manual item (the same model, added to the current calendar). The server owns every rule; the checks here
 * only save a round trip and the server's own messages are shown on the field they belong to.
 */

const DIALOG = 'flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-slate-200 bg-white p-0 text-slate-800 sm:h-auto sm:max-h-[90vh] sm:w-[calc(100vw-2rem)] sm:max-w-[1100px] sm:rounded-2xl'

export function StatusBadge({ status }) {
  return <Pill tone={ITEM_STATUS_TONE[status] || 'slate'}>{ITEM_STATUS_LABELS[status] || status}</Pill>
}

const blank = itemToForm({ date: '', platforms: [], format: '', contentPillar: '', objective: '', primaryKpi: '', platformContent: [] })

function ModalShell({ onClose, title, description, children }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className={DIALOG} data-testid="item-modal">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg font-bold text-slate-900" data-testid="item-modal-title">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Loads the editor's options (the real strategy / catalog / connections), then hands over to the editor. */
export function CalendarItemModal({ projectId, item = null, onClose }) {
  const options = useSocialCalendarOptions(projectId)
  const mode = item ? 'edit' : 'create'
  const title = mode === 'edit' ? 'Edit content plan' : 'Add a post to the plan'

  if (options.isLoading) {
    return (
      <ModalShell onClose={onClose} title={title} description="Loading the planning options…">
        <div className="space-y-3 p-6" data-testid="item-loading" aria-busy="true"><Skeleton className="h-8 w-1/3 bg-slate-200" /><Skeleton className="h-40 bg-slate-100" /><Skeleton className="h-40 bg-slate-100" /></div>
      </ModalShell>
    )
  }
  if (options.isError || !options.data) {
    return (
      <ModalShell onClose={onClose} title={title} description="The planning options could not be loaded.">
        <div role="alert" data-testid="item-options-error" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <p className="max-w-md text-sm font-medium text-red-700">{describeApiError(options.error, 'Could not load the planning options.').message}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => options.refetch()} disabled={options.isFetching} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-70">{options.isFetching ? 'Retrying…' : 'Try again'}</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </ModalShell>
    )
  }
  return <ItemEditor projectId={projectId} item={item} options={options.data} onClose={onClose} />
}

function ItemEditor({ projectId, item, options, onClose }) {
  const mode = item ? 'edit' : 'create'
  const update = useUpdateSocialCalendarItem(projectId)
  const create = useCreateSocialCalendarItem(projectId)
  const approval = useSocialCalendarItemApproval(projectId)
  const regenerate = useRegenerateSocialCalendarItem(projectId)
  const generate = useGenerateSocialCalendarItemContent(projectId)
  const content = useSocialAIContent(projectId)

  const initial = useMemo(() => (item ? itemToForm(item) : newItemForm(options)), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(initial)
  const [base, setBase] = useState(initial)
  const formRef = useRef(form); formRef.current = form
  const baseRef = useRef(base); baseRef.current = base
  const baseRevision = useRef(item?.revision ?? 0)

  const [serverErrors, setServerErrors] = useState({})
  const [showAll, setShowAll] = useState(false)
  const [banner, setBanner] = useState(null) // { kind: 'error' | 'success' | 'info', text }
  const [changedElsewhere, setChangedElsewhere] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenError, setRegenError] = useState(null)
  const [platformTab, setPlatformTab] = useState('shared')
  const [aiConfirm, setAiConfirm] = useState(null) // the platform whose AI-written alternative the person is being asked to confirm

  const dirty = isDirty(form, base)
  const patch = useMemo(() => formToPatch(form, base), [form, base])
  const clientErrors = useMemo(() => validateForm(form, options, { base: mode === 'edit' ? base : null }), [form, options, base, mode])
  const locked = !!item?.locked
  const busy = update.isPending || create.isPending || approval.isPending || regenerate.isPending || generate.isPending

  // the item changed under the editor (another tab, a finished generation, an AI regeneration): follow it if nothing is unsaved, else say so
  useEffect(() => {
    if (!item || item.revision === baseRevision.current) return
    if (!isDirty(formRef.current, baseRef.current)) {
      const next = itemToForm(item)
      baseRevision.current = item.revision
      setBase(next); setForm(next); setChangedElsewhere(false)
    } else setChangedElsewhere(true)
  }, [item])

  // keep the platform tab valid when platforms are unticked
  useEffect(() => { if (platformTab !== 'shared' && !form.platforms.includes(platformTab)) setPlatformTab('shared') }, [form.platforms, platformTab])

  const set = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setServerErrors((prev) => { if (!(name in prev)) return prev; const { [name]: _gone, ...rest } = prev; return rest })
    setBanner(null)
  }
  const setPlatformCopy = (platform, key, value) => {
    setForm((prev) => ({ ...prev, platformContent: { ...prev.platformContent, [platform]: { ...prev.platformContent[platform], [key]: value } } }))
    setServerErrors((prev) => { const k = `platformContent.${platform}.${key}`; if (!(k in prev)) return prev; const { [k]: _gone, ...rest } = prev; return rest })
    setBanner(null)
  }

  // an error is shown once the user touched that field (or tried to save): a fresh form is not covered in red
  const touched = new Set(Object.keys(patch))
  const errorFor = (field) => {
    const topLevel = field.split('.')[0]
    return serverErrors[field] || (showAll || touched.has(topLevel) || touched.has(field) ? clientErrors[field] : undefined)
  }
  // The shared caption / hashtags are what a platform uses when it has no copy of its own, so that platform's problem (too long for
  // Instagram, too many hashtags for Facebook) is shown where the user is typing the shared text, not only on the platform tab.
  const sharedError = (kind) => {
    const own = errorFor(kind)
    if (own) return own
    const visible = showAll || touched.has(kind)
    return form.platforms
      .filter((p) => !(kind === 'caption' ? form.platformContent[p]?.caption : form.platformContent[p]?.hashtags?.length))
      .map((p) => serverErrors[`platformContent.${p}.${kind}`] || (visible ? clientErrors[`platformContent.${p}.${kind}`] : undefined))
      .find(Boolean)
  }

  const togglePlatform = (platform) => {
    const has = form.platforms.includes(platform)
    const info = options.platforms.find((p) => p.platform === platform)
    if (!has && !(info?.connected && info?.inStrategy)) return // a platform that is not connected (or not in the strategy) can never be added, whatever the control does
    const platforms = ['facebook', 'instagram'].filter((p) => (p === platform ? !has : form.platforms.includes(p)))
    setForm((prev) => {
      const formats = supportedFormats(platforms, options)
      return { ...prev, platforms, format: platforms.length && !formats.includes(prev.format) ? (formats[0] || prev.format) : prev.format }
    })
    setServerErrors((prev) => { const { platforms: _p, format: _f, ...rest } = prev; return rest })
    setBanner(null)
  }

  const setObjective = (value) => {
    const objective = options.objectives.find((o) => o.value === value)
    setForm((prev) => ({ ...prev, objective: value, primaryKpi: objective && !objective.kpis.includes(prev.primaryKpi) ? objective.kpis[0] : prev.primaryKpi }))
    setBanner(null)
  }

  const setProduct = (productId) => setForm((prev) => ({ ...prev, productId, selectedMediaIds: [] }))
  const toggleList = (name, value) => set(name, form[name].includes(value) ? form[name].filter((v) => v !== value) : [...form[name], value])

  const reloadLatest = () => {
    if (!item) return
    const next = itemToForm(item)
    baseRevision.current = item.revision
    setBase(next); setForm(next); setChangedElsewhere(false); setServerErrors({}); setBanner(null); setShowAll(false)
  }

  const failMessage = (error, fallback) => {
    const { message, code } = describeApiError(error, fallback)
    setServerErrors(serverFieldErrors(error))
    setBanner({ kind: 'error', text: message, code })
    return code
  }

  function save() {
    setShowAll(true)
    if (Object.keys(clientErrors).length) { setBanner({ kind: 'error', text: 'Fix the highlighted fields before saving.' }); return }
    setBanner(null)
    if (mode === 'create') {
      create.mutate(formToPatch(form, blank), {
        onSuccess: () => onClose(),
        onError: (error) => failMessage(error, 'Could not add the post.'),
      })
      return
    }
    if (!dirty) return
    update.mutate({
      itemId: item.id, expectedRevision: item.revision, ...patch,
      // set BEFORE the cache learns the new revision, so the follow-the-item effect never mistakes our own save for someone else's
      onResponse: (res) => {
        const saved = res?.data?.item
        if (!saved) return
        const next = itemToForm(saved)
        baseRevision.current = saved.revision
        setBase(next); setForm(next); setServerErrors({}); setShowAll(false); setChangedElsewhere(false)
        setBanner({ kind: 'success', text: res.data.approvalRevoked ? 'Saved. This plan needs approving again.' : 'Changes saved.' })
      },
    }, { onError: (error) => failMessage(error, 'Could not save the changes. Your edits are still here.') })
  }

  function approve(revoke = false) {
    setBanner(null)
    approval.mutate({ itemId: item.id, expectedRevision: item.revision, revoke }, {
      onSuccess: () => setBanner({ kind: 'success', text: revoke ? 'Approval withdrawn.' : 'Plan approved. You can now create the content from it.' }),
      onError: (error) => failMessage(error, revoke ? 'Could not withdraw the approval.' : 'Could not approve the plan.'),
    })
  }

  /**
   * mode 'plan': the post is made from the caption in this plan, exactly as written (no AI, answered at once).
   * mode 'ai':   the AI writes a NEW caption as a separate draft; this plan's caption is not changed.
   */
  function startContent(platform, mode) {
    setBanner(null)
    generate.mutate({ itemId: item.id, platform, mode, expectedRevision: item.revision }, {
      onSuccess: (res) => {
        setAiConfirm(null)
        if (res?.data?.mode === 'plan') setBanner({ kind: 'success', text: `The ${PLATFORM_LABEL[platform]} post was created from this plan. Its caption is exactly what is written here. It is waiting in Content Approvals.` })
      },
      onError: (error) => { setAiConfirm(null); failMessage(error, 'Could not create the post.') },
    })
  }

  function confirmRegenerate({ fields, overwriteEdited }) {
    setRegenError(null)
    regenerate.mutate({ itemId: item.id, expectedRevision: item.revision, fields, overwriteEdited }, {
      onSuccess: (res) => {
        setRegenOpen(false)
        const data = res?.data || {}
        const warnings = data.warnings || []
        const count = (data.regenerated || []).length
        // say what happened to the approval - the person approved the OLD words
        const lead = data.unchanged
          ? `The AI wrote the same words as before, so nothing changed.${data.approvalStatus === 'approved' ? ' The plan stays approved.' : ''}`
          : `Regenerated: ${count} field${count === 1 ? '' : 's'} rewritten.${data.approvalRevoked ? ' The approval was withdrawn: review the new plan and approve it again before creating a post from it.' : ''}`
        setBanner({ kind: 'success', text: `${lead}${warnings.length ? ` ${warnings.join(' ')}` : ''}` })
      },
      onError: (error) => setRegenError(describeApiError(error, 'Could not regenerate the plan.').message),
    })
  }

  const requestClose = () => { if (busy) return; if (dirty) setConfirmDiscard(true); else onClose() }

  // ── derived view of the item ──
  const status = item?.effectiveStatus
  const publications = item?.publications || []
  const generating = content.data?.status === 'generating'
  const generatingForThis = generating && content.data?.generation?.calendarItemId === item?.id
  const failedForThis = content.data?.status === 'failed' && content.data?.generation?.calendarItemId === item?.id ? content.data.generation.failure?.message : null
  const pendingPlatforms = item ? item.platforms.filter((p) => !publications.some((pub) => pub.platform === p)) : []
  // a plan item has a DAY; the time of day is chosen when the post is scheduled (after its approvals), in the account's own time zone
  const sched = options?.scheduling
  const dateHint = `This is the day it is planned for, not a posting time: you choose the exact time when the post is scheduled${sched?.timezone ? ` (in your time zone, ${sched.timezone})` : ''}.${sched?.timeWindows?.length ? ` Your strategy suggests: ${sched.timeWindows.join('; ')}.` : ''}`
  const canGenerate = mode === 'edit' && ['plan_approved', 'content_generated'].includes(item.status) && !locked && pendingPlatforms.length > 0
  const canApprove = mode === 'edit' && !locked && ['planned', 'edited', 'draft'].includes(item.status)
  const canRevoke = mode === 'edit' && !locked && item.status === 'plan_approved' && publications.length === 0

  const formats = supportedFormats(form.platforms, options)
  const objective = options.objectives.find((o) => o.value === form.objective)
  const businessModel = options.businessModel
  const showServices = businessModel !== 'product' && options.services.length > 0
  const showProducts = businessModel !== 'service' && options.products.length > 0
  const product = options.products.find((p) => p.id === form.productId)
  const ctaSuggestions = [...new Set([...(options.ctas?.byObjective || []).filter((e) => e.objective === form.objective).flatMap((e) => e.ctas), ...(options.ctas?.preferred || [])])]
  const hookIndex = hookIndexOf(form.hook, options)
  const readOnly = locked
  const caps = options.limits?.caption || {}
  const tagCaps = options.limits?.hashtags || {}
  const title = mode === 'edit' ? 'Edit content plan' : 'Add a post to the plan'

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
        <DialogContent className={DIALOG} data-testid="item-modal">
          {/* sticky header */}
          <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left sm:px-6">
            <DialogTitle className="text-lg font-bold text-slate-900" data-testid="item-modal-title">{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-500">
                {mode === 'edit' ? (
                  <>
                    <span className="max-w-full truncate font-semibold text-slate-800" title={item.topic}>{item.topic}</span>
                    <span data-testid="item-date-label">{formatPlanDate(item.date, { year: true })}</span>
                    <span data-testid="item-content-id" className="font-mono text-xs text-slate-400">{item.contentId}</span>
                    <span data-testid="item-status"><StatusBadge status={status} /></span>
                    <span className="flex gap-1">{item.platforms.map((p) => <span key={p} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{PLATFORM_LABEL[p]}</span>)}</span>
                    {item.requiresReview && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><ShieldAlert className="h-3.5 w-3.5" />Needs careful review</span>}
                  </>
                ) : <span>Plan a post yourself. It is added to the current calendar and goes through the same steps as the AI-planned posts.</span>}
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="item-modal-body">
            {banner && (
              <div role={banner.kind === 'error' ? 'alert' : 'status'} data-testid="item-banner" className={`mx-5 mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm sm:mx-6 ${banner.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {banner.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{banner.text}</span>
              </div>
            )}
            {changedElsewhere && (
              <div role="alert" data-testid="item-changed-elsewhere" className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:mx-6">
                <span>This post was changed somewhere else. Your edits below are not saved yet.</span>
                <button type="button" onClick={reloadLatest} className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">Discard my edits and load the latest</button>
              </div>
            )}
            {locked && (
              <p role="status" data-testid="item-locked" className="mx-5 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:mx-6">
                Content from this plan is already scheduled or published, so the plan is read-only.
              </p>
            )}

            <fieldset disabled={readOnly} className="min-w-0 border-0 p-0">
              {/* A — overview */}
              <Section id="overview" title="Post overview" description="When and where this post is planned. The date is a planning date, not a publishing schedule.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {mode === 'edit' && (
                    <>
                      <div><p className="mb-1 text-xs font-semibold text-slate-600">Content ID</p><p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600">{item.contentId}</p></div>
                      <div><p className="mb-1 text-xs font-semibold text-slate-600">Day</p><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="item-day">{weekdayName(form.date) || '—'}</p></div>
                    </>
                  )}
                  <Field label="Planned date" error={errorFor('date')} hint={dateHint}>
                    {(p) => <TextInput {...p} type="date" value={form.date} min={options.calendar.startDate} max={options.calendar.endDate} onChange={(e) => set('date', e.target.value)} error={errorFor('date')} />}
                  </Field>
                  <Field label="Format" error={errorFor('format')} hint={form.platforms.length ? 'Only formats every selected platform supports.' : null}>
                    {(p) => (
                      <SelectInput {...p} value={form.format} onChange={(e) => set('format', e.target.value)} error={errorFor('format')}>
                        {formats.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>)}
                        {!formats.includes(form.format) && form.format && <option value={form.format}>{FORMAT_LABELS[form.format] || form.format}</option>}
                      </SelectInput>
                    )}
                  </Field>
                </div>

                <fieldset className="mt-4" data-testid="platforms">
                  <legend className="mb-1 text-xs font-semibold text-slate-600">Platforms</legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {options.platforms.map((info) => {
                      const usable = info.connected && info.inStrategy
                      const checked = form.platforms.includes(info.platform)
                      return (
                        <label key={info.platform} className={`flex items-center gap-2 text-sm ${usable || checked ? 'cursor-pointer text-slate-800' : 'cursor-not-allowed text-slate-400'}`}>
                          <input type="checkbox" data-testid={`platform-${info.platform}`} checked={checked} disabled={!usable && !checked} onChange={() => togglePlatform(info.platform)} className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
                          <span className="font-medium">{PLATFORM_LABEL[info.platform]}</span>
                          {!info.connected && <span className="text-xs">Not connected · <Link href="/app/social-media/connect-accounts" className="font-semibold text-violet-600 hover:text-violet-700">Connect</Link></span>}
                          {info.connected && !info.inStrategy && <span className="text-xs">Not in your strategy</span>}
                        </label>
                      )
                    })}
                  </div>
                  {errorFor('platforms') && <p role="alert" className="mt-1 text-xs font-medium text-red-600" data-testid="platforms-error">{errorFor('platforms')}</p>}
                  {form.platforms.length > 1 && <p className="mt-1 text-xs text-slate-400">One idea for both platforms. Each can have its own caption, call to action and hashtags below.</p>}
                </fieldset>
              </Section>

              {/* B — plan */}
              <Section id="plan" title="Content plan" description="What the post is about, who it is for and why.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Content pillar" error={errorFor('contentPillar')} hint="One of your strategy's pillars.">
                    {(p) => (
                      <SelectInput {...p} value={form.contentPillar} onChange={(e) => set('contentPillar', e.target.value)} error={errorFor('contentPillar')}>
                        {options.pillars.map((pillar) => <option key={pillar.name} value={pillar.name}>{pillar.name}</option>)}
                        {!options.pillars.some((x) => x.name === form.contentPillar) && form.contentPillar && <option value={form.contentPillar}>{form.contentPillar}</option>}
                      </SelectInput>
                    )}
                  </Field>
                  <Field label="Objective" error={errorFor('objective')}>
                    {(p) => <SelectInput {...p} value={form.objective} onChange={(e) => setObjective(e.target.value)}>{options.objectives.map((o) => <option key={o.value} value={o.value}>{OBJECTIVE_LABELS[o.value] || o.value}</option>)}</SelectInput>}
                  </Field>
                  <Field label="Target audience" error={errorFor('targetAudience')} optional>
                    {(p) => <TextInput {...p} value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value)} placeholder="Who this post is for" error={errorFor('targetAudience')} />}
                  </Field>
                  {(showServices || showProducts) && (
                    <Field label={showProducts && !showServices ? 'Product' : showServices && !showProducts ? 'Service' : 'Service or product'} error={errorFor('serviceId') || errorFor('productId')} optional hint="From your catalog. Leave empty for brand-level content.">
                      {(p) => (
                        <SelectInput
                          {...p}
                          value={form.productId ? `product:${form.productId}` : form.serviceId ? `service:${form.serviceId}` : ''}
                          onChange={(e) => {
                            const [kind, id] = e.target.value.split(':')
                            setServerErrors((prev) => { const { serviceId: _s, productId: _p, ...rest } = prev; return rest })
                            setForm((prev) => ({ ...prev, serviceId: kind === 'service' ? id : '', productId: kind === 'product' ? id : '', selectedMediaIds: kind === 'product' && id === prev.productId ? prev.selectedMediaIds : [] }))
                          }}
                        >
                          <option value="">Brand-level (no specific {showProducts && !showServices ? 'product' : 'service'})</option>
                          {showServices && options.services.map((s) => <option key={s.id} value={`service:${s.id}`}>{s.name}</option>)}
                          {showProducts && options.products.map((pr) => <option key={pr.id} value={`product:${pr.id}`}>{pr.name}</option>)}
                        </SelectInput>
                      )}
                    </Field>
                  )}
                  <Field label="Occasion / trigger" error={errorFor('occasion')} optional>
                    {(p) => <TextInput {...p} value={form.occasion} onChange={(e) => set('occasion', e.target.value)} placeholder="A real occasion or season, if one applies" error={errorFor('occasion')} />}
                  </Field>
                  <Field label="Topic" error={errorFor('topic')} className="md:col-span-2">
                    {(p) => <TextInput {...p} value={form.topic} onChange={(e) => set('topic', e.target.value)} error={errorFor('topic')} />}
                  </Field>
                  <Field label="Angle" error={errorFor('angle')} className="md:col-span-2" optional>
                    {(p) => <TextInput {...p} value={form.angle} onChange={(e) => set('angle', e.target.value)} error={errorFor('angle')} />}
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Hook" error={errorFor('hook')} hint={hookIndex >= 0 ? 'From your strategy\'s working hooks.' : form.hook ? 'Your own hook (not one of the strategy hooks).' : null} optional>
                      {(p) => <TextInput {...p} value={form.hook} onChange={(e) => set('hook', e.target.value)} placeholder="The opening line" error={errorFor('hook')} />}
                    </Field>
                    {options.hooks.length > 0 && (
                      <div className="mt-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="hook-picker">Use a working hook from your strategy</label>
                        <SelectInput id="hook-picker" value={hookIndex >= 0 ? String(hookIndex) : ''} onChange={(e) => { if (e.target.value !== '') set('hook', options.hooks[Number(e.target.value)].hook) }}>
                          <option value="">Choose a hook…</option>
                          {options.hooks.map((h) => <option key={h.index} value={h.index}>{h.hook}</option>)}
                        </SelectInput>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* C — content */}
              <Section id="content" title="Content" description="The words for this post, written with the plan: caption, hashtags and a version for each platform. Edit anything, or regenerate it.">
                {mode === 'edit' && publications.length > 0 && (
                  <ul className="mb-4 flex flex-col gap-2" data-testid="item-publications">
                    {publications.map((pub) => (
                      <li key={pub.id} className="rounded-lg border border-violet-200 bg-violet-50/50 p-3" data-testid={`publication-${pub.platform}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{PLATFORM_LABEL[pub.platform]} draft</p>
                          <span className="flex items-center gap-3">
                            <Link href={`/app/social-media/creative-studio?publicationId=${encodeURIComponent(pub.id)}`} data-testid={`open-studio-${pub.platform}`} className="text-xs font-semibold text-violet-700 hover:text-violet-800">Open in Creative Studio</Link>
                            <Link href="/app/social-media/content-approvals" className="text-xs font-semibold text-violet-700 hover:text-violet-800">Open in Content Approvals</Link>
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">{pub.content || 'No text yet.'}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <div role="tablist" aria-label="Copy for" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" data-testid="copy-tabs">
                  {[{ id: 'shared', label: form.platforms.length > 1 ? 'Shared' : 'Content' }, ...form.platforms.map((p) => ({ id: p, label: PLATFORM_LABEL[p] }))].map((tab) => (
                    <button key={tab.id} type="button" role="tab" id={`copy-tab-${tab.id}`} aria-selected={platformTab === tab.id} data-testid={`copy-tab-${tab.id}`} onClick={() => setPlatformTab(tab.id)} className={`-mb-px border-b-2 px-3 pb-2 text-sm font-semibold ${platformTab === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{tab.label}</button>
                  ))}
                </div>

                {platformTab === 'shared' ? (
                  <div className="grid grid-cols-1 gap-4" role="tabpanel" aria-labelledby="copy-tab-shared">
                    {mode === 'edit' && !form.caption && !publications.length && <p className="text-sm text-slate-500" data-testid="caption-not-generated">Caption not generated yet. This calendar was planned before captions were written for every post: write one below, regenerate it with AI, or create a new calendar.</p>}
                    <Field label="Caption" error={sharedError('caption')} hint={form.platforms.length ? form.platforms.map((p) => `${PLATFORM_LABEL[p]} ${textLength(form, p)}/${caps[p] ?? '—'}`).join(' · ') : null} optional>
                      {(p) => <TextArea {...p} rows={6} value={form.caption} onChange={(e) => set('caption', e.target.value)} placeholder="The caption for this post" error={sharedError('caption')} />}
                    </Field>
                    <HashtagInput label="Hashtags" value={form.hashtags} onChange={(v) => set('hashtags', v)} max={form.platforms.length ? Math.min(...form.platforms.map((p) => tagCaps[p] ?? 30)) : 30} error={sharedError('hashtags')} testId="hashtags-shared" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Primary CTA" error={errorFor('primaryCta')} hint="Must suit the objective." optional>
                        {(p) => (<><TextInput {...p} list="cta-suggestions" value={form.primaryCta} onChange={(e) => set('primaryCta', e.target.value)} error={errorFor('primaryCta')} /><datalist id="cta-suggestions">{ctaSuggestions.map((c) => <option key={c} value={c} />)}</datalist></>)}
                      </Field>
                      <Field label="Engagement prompt" error={errorFor('engagementPrompt')} optional>
                        {(p) => <TextInput {...p} value={form.engagementPrompt} onChange={(e) => set('engagementPrompt', e.target.value)} placeholder="A question that invites a reply" error={errorFor('engagementPrompt')} />}
                      </Field>
                    </div>
                    <Field label="Caption direction" error={errorFor('captionDirection')} hint="Guidance for whoever (or whatever) writes the caption." optional>
                      {(p) => <TextArea {...p} rows={2} value={form.captionDirection} onChange={(e) => set('captionDirection', e.target.value)} error={errorFor('captionDirection')} />}
                    </Field>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4" role="tabpanel" aria-labelledby={`copy-tab-${platformTab}`} data-testid={`copy-panel-${platformTab}`}>
                    <p className="text-sm text-slate-500">Only for {PLATFORM_LABEL[platformTab]}. Leave a field empty to use the shared one.</p>
                    <Field label={`${PLATFORM_LABEL[platformTab]} caption`} error={errorFor(`platformContent.${platformTab}.caption`)} hint={`${textLength(form, platformTab)}/${caps[platformTab] ?? '—'} characters with hashtags`} optional>
                      {(p) => <TextArea {...p} rows={6} value={form.platformContent[platformTab].caption} onChange={(e) => setPlatformCopy(platformTab, 'caption', e.target.value)} placeholder={form.caption ? 'Uses the shared caption' : `The ${PLATFORM_LABEL[platformTab]} caption`} error={errorFor(`platformContent.${platformTab}.caption`)} />}
                    </Field>
                    <HashtagInput label={`${PLATFORM_LABEL[platformTab]} hashtags`} value={form.platformContent[platformTab].hashtags} onChange={(v) => setPlatformCopy(platformTab, 'hashtags', v)} max={tagCaps[platformTab]} placeholder={form.hashtags.length ? 'Uses the shared hashtags' : 'Add a hashtag'} error={errorFor(`platformContent.${platformTab}.hashtags`)} testId={`hashtags-${platformTab}`} />
                    <Field label={`${PLATFORM_LABEL[platformTab]} CTA`} error={errorFor(`platformContent.${platformTab}.primaryCta`)} optional>
                      {(p) => <TextInput {...p} value={form.platformContent[platformTab].primaryCta} onChange={(e) => setPlatformCopy(platformTab, 'primaryCta', e.target.value)} placeholder={form.primaryCta || 'Call to action'} error={errorFor(`platformContent.${platformTab}.primaryCta`)} />}
                    </Field>
                  </div>
                )}
              </Section>

              {/* D — creative */}
              <Section id="creative" title="Creative" description="Planning for the design. The design itself is created later.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Text on the creative" error={errorFor('onCreativeText')} hint="Appears on the image itself; not the caption." optional>
                    {(p) => <TextInput {...p} value={form.onCreativeText} onChange={(e) => set('onCreativeText', e.target.value)} error={errorFor('onCreativeText')} />}
                  </Field>
                  <Field label="Creative direction" error={errorFor('creativeDirection')} optional>
                    {(p) => <TextArea {...p} rows={2} value={form.creativeDirection} onChange={(e) => set('creativeDirection', e.target.value)} error={errorFor('creativeDirection')} />}
                  </Field>
                  <Field label="Content brief" error={errorFor('contentBrief')} hint="Slide / scene structure, talking points, key message." className="md:col-span-2" optional>
                    {(p) => <TextArea {...p} rows={4} value={form.contentBrief} onChange={(e) => set('contentBrief', e.target.value)} error={errorFor('contentBrief')} />}
                  </Field>
                </div>

                <fieldset className="mt-4">
                  <legend className="mb-1 text-xs font-semibold text-slate-600">Required assets</legend>
                  <div className="flex flex-wrap gap-2" data-testid="required-assets">
                    {options.assetTypes.map((asset) => {
                      const on = form.requiredAssets.includes(asset)
                      return (
                        <label key={asset} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleList('requiredAssets', asset)} aria-label={ASSET_LABELS[asset] || asset} />
                          {ASSET_LABELS[asset] || asset}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                {product && (
                  <div className="mt-4" data-testid="product-images">
                    <p className="mb-1 text-xs font-semibold text-slate-600">Product images for {product.name}</p>
                    {product.images.length === 0 ? <p className="text-sm text-slate-500">This product has no images yet. Add them in the Business Profile.</p> : (
                      <ul className="flex flex-wrap gap-2">
                        {product.images.map((image) => {
                          const on = form.selectedMediaIds.includes(image.mediaId)
                          return (
                            <li key={image.mediaId}>
                              <button type="button" aria-pressed={on} data-testid={`product-image-${image.mediaId}`} onClick={() => toggleList('selectedMediaIds', image.mediaId)} className={`relative block h-20 w-20 overflow-hidden rounded-lg border-2 ${on ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200 opacity-80 hover:opacity-100'}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={image.url} alt={image.altText || `${product.name} image`} className="h-full w-full object-cover" />
                                {image.isPrimary && <span className="absolute left-1 top-1 rounded bg-slate-900/70 px-1 text-[10px] font-semibold text-white">Primary</span>}
                                {on && <CheckCircle2 className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-white text-violet-600" />}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {errorFor('selectedMediaIds') && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errorFor('selectedMediaIds')}</p>}
                  </div>
                )}
              </Section>

              {/* E — measurement and compliance */}
              <Section id="compliance" title="Measurement and approval" description="How this post is judged, and what a reviewer must check. Approving the plan does not approve the content or design.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Primary KPI" error={errorFor('primaryKpi')}>
                    {(p) => (
                      <SelectInput {...p} value={form.primaryKpi} onChange={(e) => set('primaryKpi', e.target.value)} error={errorFor('primaryKpi')}>
                        {(objective?.kpis || [form.primaryKpi]).map((k) => <option key={k} value={k}>{KPI_LABELS[k] || k}</option>)}
                        {objective && !objective.kpis.includes(form.primaryKpi) && <option value={form.primaryKpi}>{KPI_LABELS[form.primaryKpi] || form.primaryKpi}</option>}
                      </SelectInput>
                    )}
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.requiresReview} onChange={(e) => set('requiresReview', e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
                    Needs a careful review before approval
                  </label>
                  <Field label="Approval / compliance notes" error={errorFor('approvalNotes')} className="md:col-span-2" optional>
                    {(p) => <TextArea {...p} rows={2} value={form.approvalNotes} onChange={(e) => set('approvalNotes', e.target.value)} placeholder="e.g. Doctor review required" error={errorFor('approvalNotes')} />}
                  </Field>
                  <Field label="Footer disclaimer" error={errorFor('footerDisclaimer')} hint="Only wording the business has approved." className="md:col-span-2" optional>
                    {(p) => <TextInput {...p} value={form.footerDisclaimer} onChange={(e) => set('footerDisclaimer', e.target.value)} error={errorFor('footerDisclaimer')} />}
                  </Field>
                </div>
                {mode === 'edit' && <p className="mt-4 text-xs text-slate-400" data-testid="item-provenance">Planned from Strategy v{item.strategyVersion}{item.isManual ? ' · added by you' : ''}</p>}
              </Section>
            </fieldset>
          </div>

          {/* sticky footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 sm:px-6" data-testid="item-footer">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {mode === 'edit' && !locked && (
                <button type="button" onClick={() => { setRegenError(null); setRegenOpen(true) }} disabled={busy || dirty} title={dirty ? 'Save or discard your changes first' : undefined} data-testid="item-regenerate" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw className="h-4 w-4" />Regenerate with AI
                </button>
              )}
              {generatingForThis && <span role="status" data-testid="item-generating" className="inline-flex items-center gap-2 text-sm text-violet-700"><Loader2 className="h-4 w-4 animate-spin" />Writing the post from this plan…</span>}
              {failedForThis && <span role="alert" data-testid="item-generation-failed" className="text-sm text-red-600">{failedForThis}</span>}
              {generating && !generatingForThis && <span className="text-xs text-slate-500">Another post is being written. Try again in a moment.</span>}
              {canGenerate && (
                <p className="basis-full text-xs text-slate-500" data-testid="item-generate-hint">
                  {pendingPlatforms.some((p) => plannedCopyFor(item, p).caption)
                    ? 'Creating the post uses the caption in this plan exactly as written: the AI does not rewrite it. You review it in Content Approvals before anything is used.'
                    : 'This plan has no caption yet, so the AI will write the post. You review it in Content Approvals before anything is used.'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={requestClose} disabled={busy} data-testid="item-cancel" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">{locked ? 'Close' : 'Cancel'}</button>
              {!locked && (
                <button type="button" onClick={save} disabled={busy || (mode === 'edit' && !dirty)} data-testid="item-save" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {(update.isPending || create.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'create' ? 'Add to plan' : 'Save changes'}
                </button>
              )}
              {canApprove && (
                <button type="button" onClick={() => approve(false)} disabled={busy || dirty} title={dirty ? 'Save your changes first' : 'Approve the plan (not the content or design)'} data-testid="item-approve" className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
                  {approval.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve plan
                </button>
              )}
              {canRevoke && (
                <button type="button" onClick={() => approve(true)} disabled={busy || dirty} data-testid="item-revoke" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">Withdraw approval</button>
              )}
              {canGenerate && pendingPlatforms.map((platform) => {
                const label = PLATFORM_LABEL[platform]
                const several = item.platforms.length > 1
                const working = generate.isPending && generate.variables?.platform === platform
                const hasCaption = !!plannedCopyFor(item, platform).caption
                const primary = 'inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
                return hasCaption ? (
                  <span key={platform} className="inline-flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => startContent(platform, 'plan')} disabled={busy || dirty || generating} title={dirty ? 'Save your changes first' : `Create the ${label} post with the caption written in this plan, exactly as it is`} data-testid={`item-generate-${platform}`} className={primary}>
                      {working && generate.variables?.mode === 'plan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {several ? `Create ${label} post from this plan` : 'Create post from this plan'}
                    </button>
                    <button type="button" onClick={() => setAiConfirm(platform)} disabled={busy || dirty || generating} title={dirty ? 'Save your changes first' : 'Have the AI write a different caption (this plan is not changed)'} data-testid={`item-generate-ai-${platform}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                      {working && generate.variables?.mode === 'ai' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {several ? `Write ${label} caption with AI instead` : 'Write with AI instead'}
                    </button>
                  </span>
                ) : (
                  <button key={platform} type="button" onClick={() => startContent(platform, 'ai')} disabled={busy || dirty || generating} title={dirty ? 'Save your changes first' : `This plan has no ${label} caption yet, so the AI will write the post`} data-testid={`item-generate-${platform}`} className={primary}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {several ? `Write ${label} post with AI` : 'Write post with AI'}
                  </button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {regenOpen && (
        <CalendarRegenerateDialog editedFields={item.editedFields} approved={item.status === 'plan_approved' && !publications.length} contentLinked={publications.length > 0} pending={regenerate.isPending} error={regenError} onCancel={() => setRegenOpen(false)} onConfirm={confirmRegenerate} />
      )}
      <ConfirmActionDialog
        open={!!aiConfirm}
        onOpenChange={(open) => { if (!open) setAiConfirm(null) }}
        title={`Have the AI write a different ${aiConfirm ? PLATFORM_LABEL[aiConfirm] : ''} caption?`}
        description="The AI writes a NEW caption as a separate draft in Content Approvals. The caption in this plan is not changed or replaced, and nothing is used until you approve it there."
        confirmLabel="Write with AI"
        cancelLabel="Keep my caption"
        pending={generate.isPending}
        onConfirm={() => startContent(aiConfirm, 'ai')}
      />
      <ConfirmActionDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="You have edits that are not saved. Closing now will lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
      />
    </>
  )
}

export default CalendarItemModal

"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, Info, Loader2, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2, Undo2 } from "lucide-react"
import {
  useApplySameAsFix, useRefreshSameAsDiscovery, useSameAsDiscovery, useSameAsPreview, useValidateSameAsUrls,
} from "@/hooks/useSameAsFix"
import { useReverifyWordPressFix, useRollbackWordPressFix } from "@/hooks/useWordPressSchemaFix"
import { getOrganizationFixModel } from "./organizationFix"
import { BODY, BTN, CARD, Chip, ErrorBox, LABEL, PRIMARY, VerificationRow } from "./FixPanelParts"
import {
  CONFIDENCE_LABEL, SAMEAS_STATES, buildEntries, confidenceTone, describeScope, describeSameAsError, describeSource, panelState,
  preselectedIds, quickCheckUrl, sameProfileUrl, selectedUrls,
} from "./sameAsFix"

const INPUT = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#7730ed]"

function CodeBlock({ text, label, testId }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard unavailable: the text is selectable */ }
  }
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <button type="button" className={BTN} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre data-testid={testId} className="max-h-72 overflow-auto rounded-lg border border-border bg-background/70 p-3 text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">{text}</pre>
    </div>
  )
}

function Row({ entry, busy, editing, onToggle, onEdit, onRemove, onEditChange, onEditSave, onEditCancel, editError, editBusy }) {
  const isEditing = editing?.key === entry.key
  return (
    <li data-testid={`sameas-entry-${entry.key}`} className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={entry.selected} disabled={busy} onChange={() => onToggle(entry.key)} aria-label={`Add ${entry.url}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-[12.5px] text-foreground">{entry.platformLabel}</strong>
            {entry.confidence && <Chip tone={confidenceTone(entry.confidence)}>{CONFIDENCE_LABEL[entry.confidence]}</Chip>}
            <Chip tone={entry.source === "manual" ? "info" : entry.source === "edited" ? "info" : "muted"}>{entry.source === "manual" ? "Added by you" : entry.source === "edited" ? "Edited by you" : "Discovered"}</Chip>
          </div>
          {isEditing ? (
            <div className="mt-2">
              <input className={INPUT} value={editing.value} onChange={(e) => onEditChange(e.target.value)} aria-label="Edit profile link" />
              {editError && <p role="alert" className="mt-1 text-[11.5px] text-[#ff6080]">{editError}</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" className={BTN} disabled={editBusy} onClick={onEditSave}>{editBusy ? "Checking…" : "Save link"}</button>
                <button type="button" className={BTN} onClick={onEditCancel}>Cancel</button>
              </div>
            </div>
          ) : (
            <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all text-[12px] text-[#00dfff] hover:underline">
              {entry.url} <ExternalLink size={11} className="shrink-0" />
            </a>
          )}
          <p className="mt-1 text-[11.5px] text-muted-foreground">{describeSource(entry)}</p>
          {entry.reasons.length > 0 && (
            <details className="mt-1"><summary className="cursor-pointer text-[11px] text-muted-foreground">Why Odito suggests this</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{entry.reasons.map((r, i) => <li key={i} className="text-[11.5px] text-muted-foreground">{r}</li>)}</ul>
            </details>
          )}
          {entry.warnings.map((w) => <p key={w.code} className="mt-1 text-[11.5px] text-[#ffb703]">{w.message}</p>)}
          <p className="mt-1 text-[10.5px] text-muted-foreground">Odito does not open this link from its servers, so it has not checked that the page loads — open it yourself to be sure.</p>
        </div>
        {!isEditing && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <button type="button" className={BTN} disabled={busy} onClick={() => onEdit(entry)} aria-label={`Edit ${entry.url}`}><Pencil size={11} className="inline" /></button>
            <button type="button" className={BTN} disabled={busy} onClick={() => onRemove(entry)} aria-label={`Remove ${entry.url}`}><Trash2 size={11} className="inline" /></button>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Organization sameAs: discover → review/edit/add → exact preview → approve → apply → verify (saved + the public page) → roll back.
 * Everything that matters is decided by the server; this panel never writes anything itself and never marks a fix applied until
 * WordPress confirmed it, nor verified until the saved state and the public page agree. Discovery and preview need no task; applying does.
 */
const SameAsFixPanel = memo(function SameAsFixPanel({ projectId, pageUrl, task, hasRecommendation, recommendationLinked, onCreateTask, isCreatingTask }) {
  const taskId = task?._id
  const discoveryQ = useSameAsDiscovery(projectId, pageUrl)
  const refreshDiscovery = useRefreshSameAsDiscovery(projectId, pageUrl)
  const validate = useValidateSameAsUrls(projectId, pageUrl)
  const discovery = discoveryQ.data || null

  const [manual, setManual] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [dismissed, setDismissed] = useState(() => new Set())
  const [edits, setEdits] = useState({})
  const [removals, setRemovals] = useState(() => new Set())
  const [noLinks, setNoLinks] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newError, setNewError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editError, setEditError] = useState(null)
  const [approved, setApproved] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  const [showBefore, setShowBefore] = useState(false)
  const manualSeq = useRef(0)
  const submitting = useRef(false)
  const initializedFor = useRef(null)

  // The links Odito is confident about start selected — once per discovery result, and never again over the person's own choices.
  useEffect(() => {
    if (!discovery || initializedFor.current === discovery.generatedAt) return
    initializedFor.current = discovery.generatedAt
    setSelected((prev) => new Set([...prev, ...preselectedIds(discovery)]))
  }, [discovery])

  const entries = useMemo(() => buildEntries({ discovery, manual, edits, dismissed, selected }), [discovery, manual, edits, dismissed, selected])
  const urls = useMemo(() => selectedUrls(entries), [entries])
  const removeUrls = useMemo(() => [...removals], [removals])
  const selection = useMemo(() => ({ urls, removeUrls }), [urls, removeUrls])

  const hasSelection = urls.length + removeUrls.length > 0
  // Two views of the server's plan, deliberately separate:
  //   environment — the plan for an EMPTY selection: what this site / SEO plugin allows at all, and (with a task) the ledger record of
  //                 the fix. Its key never changes, so a recorded fix does not flicker while the person edits the selection.
  //   preview     — the plan for the CURRENT selection. While a new selection is being planned there is no plan on screen at all
  //                 (never the previous selection's plan with its fingerprint).
  const environment = useSameAsPreview(projectId, pageUrl, taskId, { urls: [], removeUrls: [] }, { enabled: true })
  const preview = useSameAsPreview(projectId, pageUrl, taskId, selection, { enabled: hasSelection })
  const apply = useApplySameAsFix(projectId, taskId)
  const reverify = useReverifyWordPressFix(projectId, taskId)
  const rollback = useRollbackWordPressFix(projectId, taskId)
  const model = getOrganizationFixModel(hasSelection ? preview.data : null)
  const recordModel = getOrganizationFixModel(environment.data)
  const extras = hasSelection ? (preview.data?.sameAs || null) : null

  useEffect(() => { setApproved(false) }, [model.fingerprint])
  const busy = apply.isPending || reverify.isPending || rollback.isPending
  const state = panelState({
    discoveryLoading: discoveryQ.isLoading, discovery, selectionCount: urls.length + removeUrls.length,
    preview: hasSelection ? preview.data : null, record: environment.data?.record, environment: environment.data,
    previewLoading: hasSelection && preview.isFetching && !preview.data, noLinksChosen: noLinks,
  })
  const stateInfo = SAMEAS_STATES[state] || SAMEAS_STATES.looking
  const previewError = hasSelection && preview.isError ? describeSameAsError(preview.error) : null
  const actionError = describeSameAsError(apply.error || reverify.error || rollback.error)
  const canApply = !!(taskId && recommendationLinked)
  // Once a fix is recorded (applied / verified / failed) the Result card is the truth; the plan of the same selection would only say
  // "already published".
  const showPlan = hasSelection && model.loaded && !recordModel.alreadyDone
  const unsupportedView = state === "unsupported_source" ? ((hasSelection && preview.data?.plan?.status === "unsupported") ? preview.data : environment.data) : null
  const existingUrls = discovery?.entity?.existing?.urls || []
  const removable = new Set(environment.data?.sameAs?.additionalSameAs || [])

  const toggle = (key) => { setNoLinks(false); setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  const refresh = () => { apply.reset(); reverify.reset(); rollback.reset(); setApproved(false); preview.refetch(); environment.refetch() }
  const checkStatus = () => { if (!reverify.isPending) reverify.mutate() }
  const lookAgain = () => { refreshDiscovery.mutate() }

  const addManual = async () => {
    setNewError(null)
    const quick = quickCheckUrl(newUrl, { siteUrl: pageUrl })
    if (quick) { setNewError(quick); return }
    try {
      const result = await validate.mutateAsync([newUrl.trim()])
      if (!result.valid) { setNewError(result.errors?.[0]?.message || "This link is not valid."); return }
      const item = result.items[0]
      const taken = entries.some((e) => sameProfileUrl(e.url, item.url)) || existingUrls.some((u) => sameProfileUrl(u, item.url))
      if (taken) { setNewError("This profile is already in the list."); return }
      manualSeq.current += 1
      const key = `manual:${manualSeq.current}`
      setManual((m) => [...m, { key, url: item.url, platformLabel: item.platformLabel, kind: item.kind, warnings: item.warnings || [] }])
      setNoLinks(false)
      setSelected((prev) => new Set(prev).add(key))
      setNewUrl("")
    } catch (e) {
      setNewError(e?.message || "The link could not be checked.")
    }
  }

  const remove = (entry) => {
    if (entry.source === "manual") setManual((m) => m.filter((x) => x.key !== entry.key))
    else setDismissed((d) => new Set(d).add(entry.key))
    setSelected((prev) => { const next = new Set(prev); next.delete(entry.key); return next })
  }
  const restore = (id) => setDismissed((d) => { const next = new Set(d); next.delete(id); return next })

  const saveEdit = async () => {
    setEditError(null)
    const quick = quickCheckUrl(editing.value, { siteUrl: pageUrl })
    if (quick) { setEditError(quick); return }
    try {
      const result = await validate.mutateAsync([editing.value.trim()])
      if (!result.valid) { setEditError(result.errors?.[0]?.message || "This link is not valid."); return }
      const item = result.items[0]
      if (entries.some((e) => e.key !== editing.key && sameProfileUrl(e.url, item.url))) { setEditError("This profile is already in the list."); return }
      if (editing.key.startsWith("manual:")) setManual((m) => m.map((x) => (x.key === editing.key ? { ...x, url: item.url, platformLabel: item.platformLabel, kind: item.kind, warnings: item.warnings || [] } : x)))
      else setEdits((prev) => ({ ...prev, [editing.key]: { url: item.url, platformLabel: item.platformLabel } }))
      setEditing(null)
    } catch (e) {
      setEditError(e?.message || "The link could not be checked.")
    }
  }

  const submit = () => {
    if (submitting.current || busy || !approved || !preview.data?.selection) return
    submitting.current = true
    // The approval is spent the moment it is used; the exact selection the plan was made from is what is sent back.
    apply.mutate(
      { expectedPlanFingerprint: model.fingerprint, urls: preview.data.selection.urls, removeUrls: preview.data.selection.removeUrls },
      { onSettled: () => { submitting.current = false; setApproved(false) } },
    )
  }

  if (!pageUrl) return null
  const discoveryError = discoveryQ.isError ? describeSameAsError(discoveryQ.error) : null
  const sources = discovery?.sources
  const inspected = (sources?.pages || []).filter((p) => p.status === "ok").length

  return (
    <section className="mt-3 space-y-3" aria-labelledby="sameas-title" data-testid="sameas-panel">
      <div className={CARD}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 id="sameas-title" className={LABEL}>Organization profile links (sameAs)</h3>
          <Chip tone={stateInfo.tone} data-testid="sameas-state" data-state={state}>{stateInfo.label}</Chip>
        </div>
        <p className={BODY} data-testid="sameas-state-text">{stateInfo.text}</p>
        {discovery && (
          <p className="mt-2 text-[11px] text-muted-foreground" data-testid="sameas-discovery-summary">
            Looked at {inspected} page{inspected === 1 ? "" : "s"} of your site{sources?.schema?.crawledPages ? `, the structured data of ${sources.schema.crawledPages} crawled pages` : ""}
            {discovery.entity?.name ? ` · Organization: ${discovery.entity.name}` : ""}
            {discovery.entity?.state === "absent" ? " · it has no sameAs yet" : discovery.entity?.state === "empty" ? " · its sameAs is empty" : discovery.entity?.state === "populated" ? ` · it lists ${existingUrls.length} profile${existingUrls.length === 1 ? "" : "s"}` : ""}
          </p>
        )}
        <div className="mt-2">
          <button type="button" className={BTN} disabled={refreshDiscovery.isPending || discoveryQ.isLoading} onClick={lookAgain}>
            <RefreshCw size={11} className={`mr-1 inline ${refreshDiscovery.isPending ? "animate-spin" : ""}`} />{refreshDiscovery.isPending ? "Looking again…" : "Look again"}
          </button>
        </div>
      </div>

      {discoveryQ.isLoading && (
        <div className={`${CARD} flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="sameas-loading">
          <Loader2 size={14} className="animate-spin" /> Checking your site for organization profile links…
        </div>
      )}
      {discoveryError && <ErrorBox info={discoveryError} onRetry={() => discoveryQ.refetch()} />}

      {discovery && discovery.entity?.state === "multiple_entities" && (
        <div className={`${CARD} border-[rgba(255,183,3,0.25)]`} data-testid="sameas-multiple-entities">
          <p className={BODY}>Your site publishes more than one Organization entity. Odito will not guess which one to edit or merge them. Resolve the duplicate first, then add the profile links to the one that remains.</p>
        </div>
      )}

      {/* ── candidates + links the person added ─────────────────────────────────────────────────────────────── */}
      {(discovery || discoveryError) && (
        <div className={CARD} data-testid="sameas-candidates">
          <h4 className={`${LABEL} mb-2`}>Profile links to add</h4>
          {entries.length > 0 ? (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <Row key={entry.key} entry={entry} busy={busy} editing={editing}
                  onToggle={toggle} onRemove={remove}
                  onEdit={(e) => { setEditError(null); setEditing({ key: e.key, value: e.url }) }}
                  onEditChange={(value) => setEditing((cur) => ({ ...cur, value }))} onEditSave={saveEdit} onEditCancel={() => setEditing(null)}
                  editError={editError} editBusy={validate.isPending} />
              ))}
            </ul>
          ) : (
            <p className={BODY} data-testid="sameas-no-candidates">{discovery?.state === "existing_present" ? "Nothing new was found." : "No candidate links to review."}</p>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <label className={`${LABEL} mb-1 block`} htmlFor="sameas-new-url">Add a profile link</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="sameas-new-url" className={INPUT} value={newUrl} placeholder="https://www.linkedin.com/company/your-company" inputMode="url" autoComplete="off"
                onChange={(e) => { setNewUrl(e.target.value); setNewError(null) }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual() } }} />
              <button type="button" className={BTN} disabled={busy || validate.isPending || !newUrl.trim()} onClick={addManual}><Plus size={12} className="mr-1 inline" />{validate.isPending ? "Checking…" : "Add"}</button>
            </div>
            {newError && <p role="alert" data-testid="sameas-new-error" className="mt-1 text-[11.5px] text-[#ff6080]">{newError}</p>}
            <p className="mt-1 text-[10.5px] text-muted-foreground">Only the https address of an official profile of your organization — a company page, not a personal one. Nothing is fetched from it.</p>
          </div>

          {[...dismissed].length > 0 && (
            <div className="mt-3" data-testid="sameas-dismissed">
              <h5 className={`${LABEL} mb-1`}>Removed from the list</h5>
              <ul className="space-y-1">
                {(discovery?.candidates || []).filter((c) => dismissed.has(c.id)).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                    <span className="break-all">{c.url}</span>
                    <button type="button" className={BTN} onClick={() => restore(c.id)}><Undo2 size={11} className="mr-1 inline" />Restore</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(discovery?.conflicts || []).length > 0 && (
            <p className="mt-3 text-[11.5px] text-[#ffb703]" data-testid="sameas-conflicts">More than one profile was found on {(discovery.conflicts || []).map((c) => c.platform).join(", ")}. Select only the one that is your organization&apos;s.</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!noLinks
              ? <button type="button" className={BTN} disabled={busy} onClick={() => { setNoLinks(true); setSelected(new Set()); setRemovals(new Set()); setApproved(false) }} data-testid="sameas-no-links">Continue without adding links</button>
              : <button type="button" className={BTN} onClick={() => setNoLinks(false)}>Undo</button>}
            <span className="text-[11px] text-muted-foreground">sameAs is optional. Odito never adds an empty list or an example link to clear this finding.</span>
          </div>
        </div>
      )}

      {existingUrls.length > 0 && (
        <div className={CARD} data-testid="sameas-existing">
          <h4 className={`${LABEL} mb-1`}>Already published — kept as they are</h4>
          <ul className="space-y-1">
            {existingUrls.map((u) => {
              const stored = [...removable].find((r) => sameProfileUrl(r, u))
              return (
                <li key={u} className="flex items-center justify-between gap-2 text-[12px] text-foreground">
                  <span className="break-all">{u}</span>
                  {stored && (
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <input type="checkbox" checked={removals.has(stored)} disabled={busy} onChange={() => { setNoLinks(false); setRemovals((prev) => { const next = new Set(prev); if (next.has(stored)) next.delete(stored); else next.add(stored); return next }) }} /> Remove
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-[10.5px] text-muted-foreground">Links Rank Math builds from its Facebook and Twitter settings cannot be removed here.</p>
        </div>
      )}

      {(discovery?.rejected || []).length > 0 && (
        <details className={CARD} data-testid="sameas-rejected">
          <summary className="cursor-pointer text-[12px] font-semibold text-foreground">Links Odito did not suggest ({discovery.rejected.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {discovery.rejected.map((r) => <li key={r.url} className="text-[11.5px] text-muted-foreground"><span className="break-all text-foreground/80">{r.url}</span> — {r.message}</li>)}
          </ul>
        </details>
      )}

      {unsupportedView && (
        <div className={`${CARD} border-[rgba(255,183,3,0.25)]`} data-testid="sameas-unsupported">
          <h4 className="mb-1 text-[12.5px] font-bold text-foreground">Cannot be applied automatically</h4>
          <p className={BODY}>{unsupportedView.plan?.message}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">{(unsupportedView.sameAs?.manual?.steps || []).map((s, i) => <li key={i} className={BODY}>{s}</li>)}</ol>
        </div>
      )}

      {/* ── the exact change ────────────────────────────────────────────────────────────────────────────────── */}
      {hasSelection && preview.isLoading && !recordModel.alreadyDone && (
        <div className={`${CARD} flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="sameas-preview-loading">
          <Loader2 size={14} className="animate-spin" /> Checking your selection against WordPress…
        </div>
      )}
      {previewError && <ErrorBox info={previewError} onRefresh={refresh} onRetry={refresh} />}

      {showPlan && (
        <>
          {model.changes.length > 0 && (
            <div className={CARD} data-testid="sameas-changes">
              <h4 className={`${LABEL} mb-2`}>Exact change ({model.changes.length})</h4>
              <ul className="space-y-1.5">
                {model.changes.map((c) => (
                  <li key={`${c.kind}:${c.after || c.before}`} data-testid={`sameas-change-${c.kind}`} className="text-[12px]">
                    <Chip tone={c.kind === "remove" ? "warn" : "ok"}>{c.kind === "remove" ? "Remove" : "Add"}</Chip>{" "}
                    <span className="break-all text-foreground">{c.kind === "remove" ? c.before : c.after}</span>
                  </li>
                ))}
              </ul>
              {preview.data?.plan?.changes?.[0]?.rankMathOption && <p className="mt-2 text-[11px] text-muted-foreground">Written to: {extras?.target?.label || preview.data.plan.changes[0].rankMathOption}. Nothing else is touched.</p>}
              {extras?.scope && <p className="mt-1 text-[11px] text-muted-foreground" data-testid="sameas-scope">{describeScope(extras.scope)}</p>}
            </div>
          )}

          {((extras?.alreadyPresent || []).length > 0 || model.preserved.length > 0 || (extras?.warnings || []).length > 0 || (model.blocked.length > 0)) && (
            <div className={CARD} data-testid="sameas-notes">
              {(extras?.alreadyPresent || []).length > 0 && <p className={BODY}>Already published, so not added again: {(extras.alreadyPresent).map((a) => a.url).join(", ")}.</p>}
              {model.preserved.length > 0 && <p className={`${BODY} mt-1`}>{model.preserved.length} existing profile{model.preserved.length === 1 ? " is" : "s are"} kept exactly as {model.preserved.length === 1 ? "it is" : "they are"}.</p>}
              {(extras?.warnings || []).map((w) => <p key={w.code + w.message} className="mt-1 text-[12px] text-[#ffb703]">{w.message}</p>)}
              {model.blocked.map((b) => <p key={b.code} className="mt-1 text-[12px] text-[#ffb703]" data-testid="sameas-blocked">{b.message}</p>)}
            </div>
          )}

          {model.planStatus === "nothing_to_change" && (
            <div className={CARD} data-testid="sameas-nothing"><p className={BODY}><Info size={13} className="mr-1 inline" />{model.planMessage}</p></div>
          )}

          {extras?.recommendedJsonLd && model.validation.valid && (
            <div className={CARD} data-testid="sameas-jsonld">
              <h4 className={`${LABEL} mb-1`}>Recommended structured data</h4>
              <p className={BODY}>Your existing Organization with only <code>sameAs</code> changed. Do not add it as a second Organization — update the one you already publish.</p>
              <CodeBlock text={extras.recommendedJsonLd} label="After" testId="sameas-jsonld-after" />
              <button type="button" className={`${BTN} mt-2`} onClick={() => setShowBefore((v) => !v)}>{showBefore ? "Hide current markup" : "Show current markup"}</button>
              {showBefore && extras.beforeJsonLd && <CodeBlock text={extras.beforeJsonLd} label="Now" testId="sameas-jsonld-before" />}
            </div>
          )}

          {model.changes.length > 0 && (
            <div className={CARD} data-testid="sameas-validation">
              <h4 className={`${LABEL} mb-1 flex items-center gap-1.5`}><ShieldCheck size={12} /> Validation</h4>
              {model.validation.valid
                ? <p className={BODY}>The structured data passed validation: one Organization, the same @id, only sameAs changed, no empty list and no duplicate profile.</p>
                : <ul className="list-disc pl-4">{model.validation.errors.map((e, i) => <li key={i} className="text-[12px] text-[#ff6080]">{e}</li>)}</ul>}
            </div>
          )}

          {model.canApprove && (
            <div className={CARD} data-testid="sameas-approval">
              {canApply ? (
                <>
                  <label className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <input type="checkbox" className="mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} disabled={busy} />
                    <span>I approve adding exactly the profile links listed above to my Organization in WordPress.</span>
                  </label>
                  <p className="mt-2 text-[11px] text-muted-foreground" data-testid="sameas-not-applied">Nothing has been changed yet. After applying, Odito reads the saved value back and checks your public page right away; the finding is re-checked on the next recrawl.</p>
                  <button type="button" className={`${PRIMARY} mt-3`} disabled={!approved || busy} onClick={submit}>{apply.isPending ? "Applying to WordPress…" : "Approve and apply"}</button>
                </>
              ) : (
                <>
                  <p className={BODY} data-testid="sameas-needs-task">
                    {!hasRecommendation ? "Generate the AI recommendation above first, then create a task to apply this change."
                      : !taskId ? "Create a task for this page to apply this change. Nothing is written until you approve it."
                        : "Linking the task to its recommendation…"}
                  </p>
                  {hasRecommendation && !taskId && <button type="button" className={`${BTN} mt-2`} disabled={isCreatingTask} onClick={onCreateTask}>{isCreatingTask ? "Creating…" : "Create task"}</button>}
                </>
              )}
            </div>
          )}

          {model.concurrency === "read_then_write" && state !== "unsupported_source" && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-[#ffb703]" data-testid="sameas-concurrency-note"><Info size={12} className="mt-0.5 shrink-0" /> Each profile is added with a check-then-write, so an edit made in that split second by someone else is not guaranteed to be caught. Odito reads the result back to confirm it.</p>
          )}
        </>
      )}

      {actionError && <ErrorBox info={actionError} onRefresh={refresh} onRetry={apply.error ? refresh : undefined} onCheck={checkStatus} checking={reverify.isPending} />}

      {recordModel.fix && (
        <div className={CARD} data-testid="sameas-result">
          <h4 className={`${LABEL} mb-2`}>Result</h4>
          <p className={`${BODY} mb-2`} role="status" data-testid="sameas-result-summary">
            {recordModel.fix.status === "rolled_back" ? "The previous profile list was restored."
              : recordModel.fix.status === "apply_uncertain" ? "WordPress did not confirm whether the change was saved. Nothing was repeated or undone — check the status."
                : recordModel.fix.status === "verified" ? "WordPress holds the change and your public page shows it. The finding is closed by the next recrawl."
                  : recordModel.fix.status === "verification_failed" ? "WordPress accepted the change, but it is not verified — see below. The finding stays open."
                    : ["conflict_detected", "apply_failed", "permission_denied"].includes(recordModel.fix.status) ? "The change was not applied." + (recordModel.fix.rollback?.restoredFields?.length ? " Profiles already written were put back." : "")
                      : "WordPress accepted the change. It is not verified until your public page shows it."}
          </p>
          <ul className="space-y-2">
            <VerificationRow testId="verify-saved" title="Saved in WordPress (profile list read back)" status={recordModel.verification.saved} code={recordModel.verification.savedCode} reasons={recordModel.fix.verification?.saved?.reasons} />
            <VerificationRow testId="verify-rendered" title="Shown on your public page (checked just now)" status={recordModel.verification.rendered} code={recordModel.verification.renderedCode} reasons={recordModel.fix.verification?.rendered?.reasons}
              extra={recordModel.fix.verification?.rendered?.checkedAt ? `Checked ${new Date(recordModel.fix.verification.rendered.checkedAt).toLocaleString()}` : null} />
          </ul>
          {recordModel.fix.verification?.rendered?.fields?.length > 0 && (
            <ul className="mt-2 space-y-0.5" data-testid="verify-rendered-checks">
              {recordModel.fix.verification.rendered.fields.map((f) => <li key={f.field} className={`text-[11px] ${f.ok ? "text-muted-foreground" : "text-[#ff6080]"}`}>{f.ok ? "✓" : "✗"} {String(f.field).replace(/_/g, " ")}{f.ok ? "" : ` — ${f.actual}`}</li>)}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">A saved setting can still be missing from the page because of a cache, the theme, or another plugin — which is why these are checked separately. Your audit finding is only closed by the next recrawl of the page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recordModel.canReverify && <button type="button" className={BTN} disabled={busy} onClick={checkStatus}>{reverify.isPending ? (recordModel.uncertain ? "Checking…" : "Re-verifying…") : (recordModel.uncertain ? "Check status" : "Re-verify")}</button>}
            {recordModel.canRollback && !confirmRollback && <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(true)}><RotateCcw size={11} className="mr-1 inline" />Roll back</button>}
          </div>
          {recordModel.canRollback && confirmRollback && (
            <div className="mt-3 rounded-lg border border-border bg-background/50 p-3" data-testid="rollback-confirm">
              <p className="text-[12px] text-foreground">Remove only the profile links Odito added (and put back any it removed)? Anything changed by someone else since stays as they left it.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={BTN} disabled={busy} onClick={() => { rollback.mutate(undefined, { onSettled: () => setConfirmRollback(false) }) }}>{rollback.isPending ? "Rolling back…" : "Yes, roll back"}</button>
                <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(false)}>Cancel</button>
              </div>
            </div>
          )}
          {rollback.data?.message && <p className="mt-2 text-[12px] text-muted-foreground" role="status" data-testid="rollback-message">{rollback.data.message}</p>}
          {recordModel.rollbackStage && <p className="mt-2 text-[12px] text-muted-foreground" data-testid="rollback-stage">Rollback: {recordModel.rollbackStage.label}.</p>}
        </div>
      )}
    </section>
  )
})

export default SameAsFixPanel

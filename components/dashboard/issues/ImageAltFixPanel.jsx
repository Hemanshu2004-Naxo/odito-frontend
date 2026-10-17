"use client"

import { memo, useEffect, useRef, useState } from "react"
import { AlertTriangle, Info, Loader2, RotateCcw } from "lucide-react"
import {
  useApplyImageAltFix, useImageAltImages, useImageAltPreview, useReverifyImageAltFix, useRollbackImageAltFix,
} from "@/hooks/useImageAltFix"
import { verifyLabel } from "./organizationFix"
import { describeAltError, describeAltItem, describeAltSummary, describeIgnored, describeManualFix, describeResultSummary, getImageAltModel } from "./imageAltFix"
import { clearDraft, getDraft, prefillMarker, saveDraft, shouldPrefill } from "./altDraftStore"

const LABEL = "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
const CARD = "rounded-xl border border-border bg-card/60 p-4"
const BODY = "text-[12.5px] leading-[1.65] text-foreground/80"
const BTN = "rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
const PRIMARY = "w-full rounded-xl border-none bg-gradient-to-r from-[#7730ed] to-[#00dfff] py-3 text-[13px] font-bold text-white shadow-[0_0_20px_rgba(119,48,237,0.2)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
const TONES = {
  ok: "text-[#00f5a0] bg-[rgba(0,245,160,0.08)] border-[rgba(0,245,160,0.18)]",
  info: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
  warn: "text-[#ffb703] bg-[rgba(255,183,3,0.08)] border-[rgba(255,183,3,0.25)]",
  bad: "text-[#ff6080] bg-[rgba(255,56,96,0.08)] border-[rgba(255,56,96,0.22)]",
  muted: "text-muted-foreground bg-muted border-border",
}

const Chip = ({ tone = "muted", children, ...rest }) => (
  <span {...rest} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[tone]}`}>{children}</span>
)

function ErrorBox({ info, onRefresh, onCheck, checking }) {
  if (!info) return null
  return (
    <div role="alert" data-testid="alt-error" className={`rounded-lg border p-3 text-[12px] leading-relaxed ${TONES[info.tone] || TONES.bad}`}>
      <div className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle size={13} /> {info.title}</div>
      <p>{info.message}</p>
      <div className="mt-2 flex gap-2">
        {info.refreshPreview && <button type="button" className={BTN} onClick={onRefresh}>Review refreshed preview</button>}
        {info.checkStatus && onCheck && <button type="button" className={BTN} disabled={checking} onClick={onCheck}>{checking ? "Checking…" : "Check status"}</button>}
      </div>
    </div>
  )
}

function VerificationRow({ testId, title, status, code, reasons, extra }) {
  const tone = status === "verified" ? "ok" : status === "failed" ? "bad" : status === "unverifiable" ? "warn" : "muted"
  return (
    <li data-testid={testId} className="flex flex-col gap-1 rounded-lg border border-border bg-background/50 p-2.5">
      <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold text-foreground">{title}</span><Chip tone={tone}>{verifyLabel(status, code)}</Chip></div>
      {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      {(reasons || []).map((r, i) => <span key={i} className="text-[11px] text-muted-foreground">{r}</span>)}
    </li>
  )
}

/**
 * Compact, final state for an image Odito cannot change (a Divi module or Theme Builder template): what it is, one sentence, the page and
 * the image, an optional copyable suggestion, and ONE subtle disclosure with the server's specific instructions. No text box, no
 * before/after, no approval, no apply.
 */
function ManualFixCard({ fix, src, pageUrl }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try { navigator.clipboard?.writeText(fix.suggestion)?.catch?.(() => {}) } catch { /* clipboard unavailable: the text is on screen */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className={CARD} data-testid="alt-manual-fix">
      <div className="flex items-start gap-3">
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded bg-muted object-cover" data-testid="alt-manual-image" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-[13px] font-bold text-foreground" data-testid="alt-manual-title">{fix.title}</h4>
            <Chip tone="warn">Manual fix</Chip>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/80" data-testid="alt-manual-message">{fix.message}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground" title={pageUrl} data-testid="alt-manual-page">{pageUrl}</p>
        </div>
      </div>
      {fix.suggestion && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2" data-testid="alt-manual-suggestion">
          <span className="min-w-0 flex-1 text-[12px] text-foreground"><span className="text-muted-foreground">Suggested alt text (not applied): </span><span data-testid="alt-manual-suggestion-text">{fix.suggestion}</span></span>
          <button type="button" className={BTN} data-testid="alt-manual-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
      {fix.instructions && (
        <details className="mt-2 text-[11.5px] text-muted-foreground" data-testid="alt-manual-instructions">
          <summary className="cursor-pointer select-none">View instructions</summary>
          <p className="mt-1 leading-relaxed">{fix.instructions}</p>
        </details>
      )}
    </div>
  )
}

const shortUrl = (u) => { try { const x = new URL(u); return `${x.host}${x.pathname}` } catch { return u } }

/**
 * Alt text for ONE image at a time, written to the WordPress media library. The panel never describes an image itself: a person
 * writes the text (the site's own caption/link text are offered as suggestions, never applied). Everything else — which
 * attachment it is, whether a library change can reach the page, the verdicts — is the server's.
 */
const ImageAltFixPanel = memo(function ImageAltFixPanel({ projectId, task, recommendationKey = null }) {
  const taskId = task?._id
  const images = useImageAltImages(projectId, taskId, { enabled: !!taskId })
  const [selected, setSelected] = useState(null)
  const [text, setText] = useState("")
  const [debounced, setDebounced] = useState("")
  const [informative, setInformative] = useState(false)
  const [approved, setApproved] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  // Set synchronously on click: a double click can never send two approvals before React re-renders.
  const submitting = useRef(false)

  useEffect(() => { const t = setTimeout(() => setDebounced(text), 450); return () => clearTimeout(t) }, [text])
  useEffect(() => { setApproved(false) }, [selected, debounced, informative])

  const preview = useImageAltPreview(projectId, taskId, { imageSrc: selected, proposedAlt: debounced.trim() || undefined, informative }, { enabled: !!selected })
  const apply = useApplyImageAltFix(projectId, taskId)
  const reverify = useReverifyImageAltFix(projectId, taskId)
  const rollback = useRollbackImageAltFix(projectId, taskId)

  const model = getImageAltModel(preview.data)
  const rec = model.recommendation
  const onText = (value) => { setText(value); if (selected) saveDraft(taskId, selected, { text: value, touched: true }) }
  const onInformative = (value) => { setInformative(value); if (selected) saveDraft(taskId, selected, { informative: value }) }
  // The AI recommendation already made for this page is REUSED, not regenerated: an exact-match proposal fills an EMPTY text box that the
  // person has not touched, once per recommendation. It never replaces anything the person typed, and a cleared box stays cleared.
  useEffect(() => {
    if (!selected || !rec) return
    const draft = getDraft(taskId, selected)
    if (!shouldPrefill(draft, rec, text)) return
    setText(rec.alt); setDebounced(rec.alt)
    saveDraft(taskId, selected, { text: rec.alt, touched: false, prefilledFrom: prefillMarker(rec) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rec?.recommendationId, rec?.alt, rec?.prefill])
  // A recommendation generated while the panel is open: re-read the images and the chosen preview so the new suggestions appear.
  const lastRecKey = useRef(recommendationKey)
  useEffect(() => {
    if (lastRecKey.current === recommendationKey) return
    lastRecKey.current = recommendationKey
    setApproved(false)
    images.refetch()
    if (selected) preview.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendationKey])
  // An approval is for exactly the plan that was on screen. A new plan (any refreshed preview) or a failed attempt clears it.
  useEffect(() => { setApproved(false) }, [model.fingerprint])
  const items = (images.data?.images || []).map(describeAltItem)
  const rollup = describeAltSummary(images.data?.summary)
  const ignoredNote = describeIgnored(images.data?.ignored)
  const busy = apply.isPending || reverify.isPending || rollback.isPending
  // The preview on screen belongs to an earlier text (the next one is loading): it may be shown, never approved.
  const stalePreview = preview.isPlaceholderData
  const typing = text.trim() !== debounced.trim() || stalePreview
  const listError = images.isError ? describeAltError(images.error) : null
  const previewError = preview.isError ? describeAltError(preview.error) : null
  const actionError = describeAltError(apply.error || reverify.error || rollback.error)
  const refresh = () => { apply.reset(); reverify.reset(); rollback.reset(); setApproved(false); images.refetch(); preview.refetch() }
  const checkStatus = () => { if (!reverify.isPending && selected) reverify.mutate({ imageSrc: selected }) }
  const submit = () => {
    if (submitting.current || busy || !approved || !selected) return
    submitting.current = true
    // The approval is spent the moment it is used, whatever the outcome: a retry needs a fresh look and a fresh tick.
    const src = selected
    apply.mutate({ imageSrc: src, proposedAlt: debounced.trim(), informative, expectedPlanFingerprint: model.fingerprint }, {
      // The draft is spent only when WordPress accepted the write; a failed attempt keeps what the person typed.
      onSuccess: () => clearDraft(taskId, src),
      onSettled: () => { submitting.current = false; setApproved(false) },
    })
  }

  if (!taskId) return null

  const choose = (src) => {
    // Re-opening an image restores what the person had typed (or accepted) for it.
    const draft = getDraft(taskId, src)
    setSelected(src); setText(draft?.text || ""); setDebounced(draft?.text || ""); setInformative(!!draft?.informative)
    setApproved(false); setConfirmRollback(false); apply.reset(); reverify.reset(); rollback.reset()
  }
  const decorativeSignals = model.loaded && model.classification?.decorative
  // An image drawn by a builder module / template Odito cannot edit: one compact card instead of the diagnosis, source and status cards.
  const manualFix = selected ? describeManualFix(model) : null

  return (
    <section className="mt-3 space-y-3" aria-labelledby="alt-fix-title" data-testid="image-alt-fix-panel">
      <div className={CARD}>
        <h3 id="alt-fix-title" className={`${LABEL} mb-2`}>Fix image alt text via WordPress</h3>
        <p className={BODY}>Odito changes only the alt text of one media-library image at a time, only after you approve the exact image and text. It cannot see the picture: any suggested text comes from the file name and the page, and you review and approve the exact text.</p>
      </div>

      {images.isLoading && <div className={`${CARD} flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="alt-loading"><Loader2 size={14} className="animate-spin" /> Loading this page&apos;s images…</div>}
      {listError && <ErrorBox info={listError} onRefresh={refresh} />}
      {images.isSuccess && items.length === 0 && <div className={CARD} data-testid="alt-empty"><p className={BODY}>No images on this page are currently flagged for missing alt text.</p></div>}
      {images.isSuccess && ignoredNote && <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground" data-testid="alt-ignored-note"><Info size={12} className="mt-0.5 shrink-0" /> {ignoredNote}</p>}

      {rollup && (
        <div className={CARD} data-testid="alt-rollup" role="status">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className={LABEL}>This page&apos;s alt-text fixes</h4>
            <Chip tone={rollup.tone} data-testid="alt-rollup-chip">{rollup.label}</Chip>
          </div>
          <ul className="flex flex-wrap gap-1.5">{rollup.counts.map((c) => <li key={c.key}><Chip tone="muted">{c.n} × {c.label}</Chip></li>)}</ul>
          {rollup.retryable.length > 0 && <p className="mt-2 text-[11.5px] text-muted-foreground" data-testid="alt-rollup-retry">{rollup.retryable.length} image{rollup.retryable.length === 1 ? "" : "s"} can be retried. Images that already succeeded are never written again.</p>}
          {rollup.recoverable.length > 0 && <p className="mt-1 text-[11.5px] text-[#ffb703]" data-testid="alt-rollup-recover">{rollup.recoverable.length} image{rollup.recoverable.length === 1 ? "" : "s"} need{rollup.recoverable.length === 1 ? "s" : ""} a status check before anything else is done to {rollup.recoverable.length === 1 ? "it" : "them"}.</p>}
          {rollup.remaining > 0 && <p className="mt-1 text-[11.5px] text-muted-foreground">{rollup.remaining} flagged image{rollup.remaining === 1 ? " has" : "s have"} not been changed.</p>}
        </div>
      )}

      {items.length > 0 && (
        <ul className={`${CARD} space-y-2`} data-testid="alt-image-list" aria-label="Images missing alt text">
          {items.map((it) => (
            <li key={it.src}>
              <button type="button" onClick={() => choose(it.src)} aria-pressed={selected === it.src} data-testid="alt-image-row"
                className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${selected === it.src ? "border-[#7730ed] bg-[rgba(119,48,237,0.06)]" : "border-border hover:bg-accent"}`}>
                {/* The person needs to SEE the image to describe it; it is loaded by their browser from their own site. */}
                <img src={it.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded object-cover bg-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-mono text-foreground" title={it.src}>{shortUrl(it.src)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone={it.altState === "missing" ? "warn" : "muted"} data-testid="alt-state-chip">{it.altStateLabel}</Chip>
                    {it.resourceLabel && <Chip tone="muted" data-testid="alt-resource-chip">{it.resourceLabel} — not editable here</Chip>}
                    {it.hasAiSuggestion && !it.statusLabel && !it.fix && <Chip tone="info" data-testid="alt-ai-chip">AI suggestion ready</Chip>}
                    {it.decorativeSignals && <Chip tone="muted">May be decorative</Chip>}
                    {it.statusLabel ? <Chip tone={it.statusTone} data-testid="alt-target-status">{it.statusLabel}</Chip>
                      : it.fix && <Chip tone={it.fix.status === "verified" ? "ok" : it.fix.status === "applied" ? "info" : "warn"}>{it.fixLabel}</Chip>}
                    {it.inFindings === false && <Chip tone="muted">No longer flagged</Chip>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          {preview.isLoading && <div className={`${CARD} flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="alt-preview-loading"><Loader2 size={14} className="animate-spin" /> Identifying the image in your media library…</div>}
          {previewError && <ErrorBox info={previewError} onRefresh={refresh} />}
        </>
      )}

      {selected && model.loaded && (
        <>
          {manualFix && <ManualFixCard fix={manualFix} src={selected} pageUrl={model.targetUrl} />}
          {!manualFix && <div className={CARD} data-testid="alt-identity">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className={LABEL}>Which image this is</h4>
              <Chip tone={model.identity.resolved ? (model.identity.confidence === "high" ? "ok" : "info") : "warn"} data-testid="alt-identity-chip">
                {model.identity.resolved ? model.identity.confidenceLabel : model.identity.status === "ambiguous_target" ? "Ambiguous" : "Cannot be identified"}
              </Chip>
            </div>
            {model.identity.resolved ? (
              <>
                <p className={BODY}>WordPress media attachment <strong className="text-foreground">#{model.identity.attachmentId}</strong>{model.identity.methodLabel ? ` — ${model.identity.methodLabel}` : ""}.</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">{model.identity.evidence.map((e, i) => <li key={i} className="text-[11.5px] text-muted-foreground">{e}</li>)}</ul>
              </>
            ) : <p className={BODY} data-testid="alt-identity-message">{model.identity.message}</p>}
            <p className="mt-2 break-all text-[11px] text-muted-foreground">Page: {model.targetUrl}</p>
          </div>}

          {!manualFix && <div className={CARD} data-testid="alt-plan-status">
            <div className="mb-1 flex items-center justify-between gap-2"><h4 className={LABEL}>Status</h4><Chip tone={model.planTone} data-testid="alt-plan-chip">{model.planLabel}</Chip></div>
            {model.planMessage && <p className={BODY} data-testid="alt-plan-message">{model.planMessage}</p>}
            {!model.writable && <p className="mt-1 text-[11.5px] text-muted-foreground" data-testid="alt-no-write">Odito offers no WordPress write for this image, and nothing was changed.</p>}
            {decorativeSignals && <p className="mt-1 text-[11.5px] text-muted-foreground">{model.classification.signals.join(" ")}</p>}
          </div>}

          {!manualFix && model.identity.resolved && model.diagnosis && (
            <div className={CARD} data-testid="alt-diagnosis">
              <h4 className={`${LABEL} mb-2`}>What the page and WordPress say</h4>
              <table className="w-full text-left text-[12px]">
                <tbody>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">On the page</td><td className="py-1 text-muted-foreground" data-testid="alt-diag-rendered">{model.diagnosis.renderedLabel}</td></tr>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">In the media library</td><td className="py-1 text-muted-foreground" data-testid="alt-diag-library">{model.diagnosis.libraryLabel}</td></tr>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">Drawn by</td><td className="py-1 text-muted-foreground" data-testid="alt-diag-source">{model.diagnosis.sourceText}</td></tr>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">Can Odito fix it?</td><td className="py-1 text-foreground" data-testid="alt-diag-fix">{model.diagnosis.fixText}</td></tr>
                </tbody>
              </table>
              {model.diagnosis.evidence.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4" data-testid="alt-diag-evidence">{model.diagnosis.evidence.map((e, i) => <li key={i} className="text-[11.5px] text-muted-foreground">{e}</li>)}</ul>}
            </div>
          )}

          {!manualFix && model.identity.resolved && model.source && (
            <div className={CARD} data-testid="alt-source">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className={LABEL}>{model.source.isManual ? "Where it has to be changed" : "Where the change is written"}</h4>
                <Chip tone={model.source.isManual ? "warn" : "info"} data-testid="alt-source-chip">{model.source.isManual ? model.source.stateText : model.source.label}</Chip>
              </div>
              {model.source.isManual ? (
                <p className={BODY} data-testid="alt-source-manual">{model.source.message}</p>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <tbody>
                    <tr><td className="py-1 pr-2 font-semibold text-foreground">Source</td><td className="py-1 text-muted-foreground" data-testid="alt-source-type">{model.source.label}</td></tr>
                    {model.source.identifier && <tr><td className="py-1 pr-2 font-semibold text-foreground">Identifier</td><td className="py-1 font-mono text-[11px] text-muted-foreground" data-testid="alt-source-id">{model.source.identifier}</td></tr>}
                    {model.source.isDivi && <tr><td className="py-1 pr-2 font-semibold text-foreground">Module</td><td className="py-1 text-muted-foreground" data-testid="alt-source-module">{model.source.moduleText}</td></tr>}
                    {model.source.isDivi && <tr><td className="py-1 pr-2 font-semibold text-foreground">Setting written</td><td className="py-1 font-mono text-[11px] text-muted-foreground" data-testid="alt-source-attr">{model.source.attributeText}</td></tr>}
                    {model.source.isDivi && <tr><td className="py-1 pr-2 font-semibold text-foreground">Stored in module</td><td className="py-1 text-muted-foreground" data-testid="alt-source-stored">{model.source.storedText}</td></tr>}
                    {model.source.isDivi && model.source.versionText && <tr><td className="py-1 pr-2 font-semibold text-foreground">Divi</td><td className="py-1 text-muted-foreground">{model.source.versionText}</td></tr>}
                    <tr><td className="py-1 pr-2 font-semibold text-foreground">Page</td><td className="py-1 break-all text-muted-foreground">{model.targetUrl}</td></tr>
                    <tr><td className="py-1 pr-2 font-semibold text-foreground">Image</td><td className="py-1 break-all text-muted-foreground">{shortUrl(selected)}{model.identity.attachmentId ? ` · attachment #${model.identity.attachmentId}` : ""}</td></tr>
                  </tbody>
                </table>
              )}
              {!model.source.isManual && model.source.writeTarget && <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground" data-testid="alt-source-target">{model.source.writeTarget}</p>}
              {!model.source.isManual && model.source.verification && <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground" data-testid="alt-source-verification"><strong className="text-foreground">Verification: </strong>{model.source.verification}</p>}
              {model.source.isDivi && model.source.evidenceNote && <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-muted-foreground" data-testid="alt-source-evidence"><Info size={12} className="mt-0.5 shrink-0" /> {model.source.evidenceNote}</p>}
              {model.source.isDivi && model.source.writeModeNote && <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-[#ffb703]" data-testid="alt-source-writemode"><Info size={12} className="mt-0.5 shrink-0" /> {model.source.writeModeNote}</p>}
            </div>
          )}

          {!manualFix && model.identity.resolved && !model.writable && rec && (rec.prefill || rec.offer) && (
            <div className="rounded-xl border border-border bg-card/60 p-4" data-testid="alt-ai-manual">
              <div className="mb-1 flex flex-wrap items-center gap-1.5"><Chip tone="info">AI suggestion</Chip><Chip tone="muted">For manual use — Odito cannot apply it here</Chip></div>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">Copy this text into the place named above. It is not written to WordPress.</p>
              <p className="mt-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground" data-testid="alt-ai-manual-text">{rec.alt}</p>
              <button type="button" className={`${BTN} mt-2`} data-testid="alt-ai-copy" onClick={() => { try { navigator.clipboard?.writeText(rec.alt)?.catch?.(() => {}) } catch { /* clipboard unavailable: the text is on screen */ } }}>Copy text</button>
            </div>
          )}

          {model.identity.resolved && model.contentEffect !== "embedded" && model.writable && (
            <div className={CARD}>
              {rec && (rec.prefill || rec.offer) && (
                <div className="mb-3 rounded-lg border border-[rgba(0,223,255,0.18)] bg-[rgba(0,223,255,0.05)] p-3" data-testid="alt-ai-suggestion">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone="info">AI suggestion</Chip>
                    {rec.confidenceText && <Chip tone={rec.confidence === "medium" ? "ok" : "warn"} data-testid="alt-ai-confidence">{rec.confidenceText}</Chip>}
                    <Chip tone="muted">Needs your review</Chip>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground" data-testid="alt-ai-message">{rec.message}</p>
                  {rec.evidence.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-4" data-testid="alt-ai-evidence">{rec.evidence.map((e, i) => <li key={i} className="text-[11px] text-muted-foreground">{e}</li>)}</ul>}
                  {text.trim() !== rec.alt && <button type="button" className={`${BTN} mt-2 text-left`} data-testid="alt-ai-use" disabled={busy} onClick={() => onText(rec.alt)}>{rec.offer ? "Use" : "Reset to"} “{rec.alt}”</button>}
                </div>
              )}
              {rec?.note && <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground" data-testid="alt-ai-note">{rec.note}</p>}
              <label htmlFor="alt-text" className={`${LABEL} mb-1 block`}>Alt text — what the image shows, and why it is on the page</label>
              <textarea id="alt-text" className="min-h-[72px] w-full rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground" value={text} onChange={(e) => onText(e.target.value)} disabled={busy} maxLength={1000} />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>{text.trim().length} characters (about 125 or fewer reads best)</span>{typing && <span role="status">Checking…</span>}</div>
              {model.suggestions.length > 0 && (
                <div className="mt-2" data-testid="alt-suggestions">
                  <p className="mb-1 text-[11px] text-muted-foreground">Text your site already published about this image (a starting point — review and edit it):</p>
                  {model.suggestions.map((s) => (
                    <button key={s.source} type="button" className={`${BTN} mb-1 mr-1 text-left`} onClick={() => setText(s.text)} title={s.label}>Use “{s.text}” <span className="font-normal text-muted-foreground">— {s.label}</span></button>
                  ))}
                </div>
              )}
              {(decorativeSignals || ["decorative", "needs_review"].includes(model.planStatus)) && (
                <label className="mt-2 flex items-start gap-2 text-[12px] text-foreground">
                  <input type="checkbox" className="mt-0.5" checked={informative} onChange={(e) => onInformative(e.target.checked)} disabled={busy} />
                  <span>This image carries meaning for the reader (it is not decorative).</span>
                </label>
              )}
              {model.validation.errors.length > 0 && <ul className="mt-2 list-disc pl-4" data-testid="alt-validation-errors">{model.validation.errors.map((e, i) => <li key={i} className="text-[12px] text-[#ff6080]">{e}</li>)}</ul>}
              {model.validation.warnings.length > 0 && <ul className="mt-2 list-disc pl-4" data-testid="alt-validation-warnings">{model.validation.warnings.map((e, i) => <li key={i} className="text-[12px] text-[#ffb703]">{e}</li>)}</ul>}
            </div>
          )}

          {model.identity.resolved && model.writable && !model.proposedAlt && (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground" data-testid="alt-no-change">No change is prepared yet. The exact before/after appears once there is alt text to review.</p>
          )}

          {model.identity.resolved && model.writable && !!model.proposedAlt && (
            <div className={CARD} data-testid="alt-change">
              <h4 className={`${LABEL} mb-2`}>Exact change</h4>
              <div className="mb-2 flex items-center gap-3" data-testid="alt-change-image">
                {/* The original image, so the person approves text against the picture it will describe. Loaded by their own browser. */}
                <img src={selected} alt="" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded object-cover bg-muted" />
                <span className="min-w-0 break-all text-[11px] text-muted-foreground">{shortUrl(selected)}</span>
              </div>
              <table className="w-full text-left text-[12px]">
                <tbody>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">Field</td><td className="py-1 text-muted-foreground">{model.setting}</td></tr>
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">{model.isDivi ? "Module now" : "Now"}</td><td className="py-1 text-muted-foreground" data-testid="alt-current">{model.currentAlt || (model.isDivi ? "(no alt attribute)" : "(no alt text)")}</td></tr>
                  {model.isDivi && model.currentRendered !== undefined && <tr><td className="py-1 pr-2 font-semibold text-foreground">Rendered now</td><td className="py-1 text-muted-foreground" data-testid="alt-rendered-now">{model.currentRendered ? `“${model.currentRendered}”` : 'alt="" (empty)'}</td></tr>}
                  <tr><td className="py-1 pr-2 font-semibold text-foreground">After</td><td className="py-1 text-foreground" data-testid="alt-proposed">{model.proposedAlt || "—"}</td></tr>
                </tbody>
              </table>
              {model.currentNote && <p className="mt-1 text-[11px] text-muted-foreground">{model.currentNote}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">Only this image&apos;s alt text changes — never its caption, title, description or file.</p>
            </div>
          )}

          {model.canApprove && !typing && (
            <div className={CARD} data-testid="alt-approval">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid="alt-approval-state">{busy && apply.isPending ? "Applying" : approved ? "Preview approved" : "Ready for review"}</p>
              <label className="flex items-start gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" className="mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} disabled={busy} />
                {model.isDivi
                  ? <span>I approve setting the alt text of the Divi module {model.source?.identifier} (attachment #{model.identity.attachmentId} on this page) to the text above.</span>
                  : <span>I approve setting attachment #{model.identity.attachmentId}&apos;s alt text to the text above.</span>}
              </label>
              <p className="mt-2 text-[11px] text-muted-foreground" data-testid="alt-not-applied">{model.isDivi
                ? "Nothing has been changed yet. Odito proves the change touches only that one setting, writes it, reads the page back and checks the live page. The audit finding is resolved only by the next successful analysis of the page."
                : "Nothing has been changed yet. Odito reads the value back right after the change and checks your live page after the next recrawl."}</p>
              <button type="button" className={`${PRIMARY} mt-3`} disabled={!approved || busy}
                onClick={submit}>
                {apply.isPending ? "Applying to WordPress…" : "Approve and apply"}
              </button>
            </div>
          )}

          {model.concurrency === "read_then_write" && !model.isDivi && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-[#ffb703]" data-testid="alt-concurrency-note"><Info size={12} className="mt-0.5 shrink-0" /> Odito SEO Bridge 1.5.0 is not installed, so this change is checked and then written in two separate steps. An edit made in that split second is not guaranteed to be caught. Install the current Bridge for a single conditional write.</p>
          )}

          {model.identity.resolved && model.creationWindow && model.concurrency !== "read_then_write" && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground" data-testid="alt-creation-note"><Info size={12} className="mt-0.5 shrink-0" /> This image has no alt-text record in WordPress yet. WordPress can only create a missing record in two steps (check that none exists, then add it), so Odito creates it only if it is still absent, never overwrites an existing value, and reads it back afterwards.</p>
          )}

          {actionError && <ErrorBox info={actionError} onRefresh={refresh} onCheck={checkStatus} checking={reverify.isPending} />}

          {model.fix && (
            <div className={CARD} data-testid="alt-result">
              <h4 className={`${LABEL} mb-2`}>Result</h4>
              <p className={`${BODY} mb-2`} role="status" data-testid="alt-result-summary">
                {describeResultSummary(model.fix, { isDivi: model.fixIsDivi, rollbackVerified: model.rollbackStage?.key === "verified" })}
              </p>
              <ul className="space-y-2">
                <VerificationRow testId="alt-verify-saved" title="Saved in WordPress (media library read back)" status={model.verification.saved} code={model.verification.savedCode} reasons={model.fix.verification?.saved?.reasons} />
                <VerificationRow testId="alt-verify-rendered" title="Rendered on your site (recrawled page)" status={model.verification.rendered} code={model.verification.renderedCode} reasons={model.fix.verification?.rendered?.reasons}
                  extra={model.fix.verification?.rendered?.crawledAt ? `Crawl from ${new Date(model.fix.verification.rendered.crawledAt).toLocaleString()}` : null} />
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.canReverify && <button type="button" className={BTN} disabled={busy} onClick={checkStatus}>{reverify.isPending ? (model.uncertain ? "Checking…" : "Re-verifying…") : (model.uncertain ? "Check status" : "Re-verify")}</button>}
                {model.canRollback && !confirmRollback && <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(true)}><RotateCcw size={11} className="mr-1 inline" />Roll back</button>}
              </div>
              {model.canRollback && confirmRollback && (
                <div className="mt-3 rounded-lg border border-border bg-background/50 p-3" data-testid="alt-rollback-confirm">
                  <p className="text-[12px] text-foreground">Restore this image&apos;s previous alt text? If someone edited it since, it is left as they set it.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={BTN} disabled={busy} onClick={() => rollback.mutate({ imageSrc: selected }, { onSettled: () => setConfirmRollback(false) })}>{rollback.isPending ? "Rolling back…" : "Yes, roll back"}</button>
                    <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(false)}>Cancel</button>
                  </div>
                </div>
              )}
              {model.rollbackStage && <p className="mt-2 text-[12px] text-muted-foreground" data-testid="alt-rollback-stage">Rollback: {model.rollbackStage.label}.</p>}
              {rollback.data?.message && <p className="mt-2 text-[12px] text-muted-foreground" role="status" data-testid="alt-rollback-message">{rollback.data.message}</p>}
            </div>
          )}
          {!manualFix && <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground" data-testid="alt-limits"><Info size={12} className="mt-0.5 shrink-0" /> WordPress does not distinguish a missing alt text from an empty one in the media library, and an image placed inside the page content keeps its own alt text there — those cannot be changed from here.</p>}
        </>
      )}
    </section>
  )
})

export default ImageAltFixPanel

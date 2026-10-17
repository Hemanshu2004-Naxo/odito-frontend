"use client"

import { memo, useEffect, useRef, useState } from "react"
import { Info, Loader2, RotateCcw } from "lucide-react"
import {
  useApplyWordPressSchemaFix, useReverifyWordPressFix, useRollbackWordPressFix, useWordPressFixPreview,
} from "@/hooks/useWordPressSchemaFix"
import { describeFixError, getOrganizationFixModel } from "./organizationFix"
import { BODY, BTN, CARD, Chip, ErrorBox, LABEL, PRIMARY, VerificationRow } from "./FixPanelParts"
import { BREADCRUMB_STATES, describeBreadcrumbPages, shortUrl } from "./breadcrumbFix"

/**
 * Applying the breadcrumb trail the owner confirmed, through WordPress: the exact setting, the trail Rank Math would build against the
 * confirmed one, the site-wide scope, approval, apply, then saved + public-page verification page by page, re-check and rollback.
 * Everything that matters is the server's verdict. Nothing is offered when the source is unsupported: the manual steps are shown instead,
 * and the finding is never marked fixed here — only a later recrawl closes it.
 */
const BreadcrumbFixCard = memo(function BreadcrumbFixCard({ projectId, task, recommendationLinked = false }) {
  const taskId = task?._id
  const preview = useWordPressFixPreview(projectId, taskId, { enabled: !!taskId })
  const apply = useApplyWordPressSchemaFix(projectId, taskId)
  const reverify = useReverifyWordPressFix(projectId, taskId)
  const rollback = useRollbackWordPressFix(projectId, taskId)
  const [approved, setApproved] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  const submitting = useRef(false)

  const model = getOrganizationFixModel(preview.data)
  const extras = preview.data?.breadcrumb || null
  useEffect(() => { setApproved(false) }, [model.fingerprint])
  const busy = apply.isPending || reverify.isPending || rollback.isPending
  const previewError = preview.isError ? describeFixError(preview.error) : null
  const actionError = describeFixError(apply.error || reverify.error || rollback.error)
  const refresh = () => { apply.reset(); reverify.reset(); rollback.reset(); setApproved(false); preview.refetch() }
  const checkStatus = () => { if (!reverify.isPending) reverify.mutate() }
  const submit = () => {
    if (submitting.current || busy || !approved) return
    submitting.current = true
    apply.mutate({ expectedPlanFingerprint: model.fingerprint }, { onSettled: () => { submitting.current = false; setApproved(false) } })
  }

  if (!taskId) return null
  if (preview.isLoading) {
    return <div className={`${CARD} mt-3 flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="breadcrumb-fix-loading"><Loader2 size={14} className="animate-spin" /> Checking what WordPress can do for this page…</div>
  }
  if (previewError) return <div className="mt-3"><ErrorBox info={previewError} onRetry={refresh} onRefresh={refresh} /></div>
  // Nothing confirmed yet: the trail panel above is where to start — no card, no noise.
  if (!model.loaded || !extras || extras.panelState === "needs_trail") return null

  const state = BREADCRUMB_STATES[extras.panelState] || BREADCRUMB_STATES.not_available
  const pages = describeBreadcrumbPages(model.fix?.verification?.rendered?.fields)
  const unsupported = extras.panelState === "unsupported_source"
  const canApply = model.canApprove && recommendationLinked

  return (
    <section className="mt-3 space-y-3" aria-labelledby="bc-fix-title" data-testid="breadcrumb-fix-card">
      <div className={CARD}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 id="bc-fix-title" className={LABEL}>Publish this trail — Apply via WordPress</h3>
          <Chip tone={state.tone} data-testid="breadcrumb-fix-state" data-state={extras.panelState}>{state.label}</Chip>
        </div>
        <p className={BODY} data-testid="breadcrumb-fix-text">{unsupported || extras.panelState === "already_valid" || extras.panelState === "blocked" ? (model.planMessage || state.text) : state.text}</p>
        {preview.isFetching && <p className="mt-1 text-[11px] text-muted-foreground" role="status">Refreshing from WordPress…</p>}
      </div>

      {unsupported && (
        <div className={`${CARD} border-[rgba(255,183,3,0.25)]`} data-testid="breadcrumb-fix-manual">
          <h4 className="mb-1 text-[12.5px] font-bold text-foreground">Cannot be applied automatically</h4>
          <ol className="list-decimal space-y-1 pl-5">{(extras.manual?.steps || []).map((s, i) => <li key={i} className={BODY}>{s}</li>)}</ol>
          <p className="mt-2 text-[11.5px] text-muted-foreground">The structured data above is exactly what to publish.</p>
        </div>
      )}

      {model.planStatus === "ready" && (
        <div className={CARD} data-testid="breadcrumb-fix-plan">
          <h4 className={`${LABEL} mb-2`}>Exact change</h4>
          <table className="w-full text-left text-[12px]"><tbody>
            <tr><td className="py-1 pr-2 font-semibold text-foreground">Setting</td><td className="py-1 text-muted-foreground">{extras.target?.label}</td></tr>
            <tr><td className="py-1 pr-2 font-semibold text-foreground">Now</td><td className="py-1 text-muted-foreground" data-testid="breadcrumb-fix-now">{extras.settingNow === "on" ? "On" : "Off"}</td></tr>
            <tr><td className="py-1 pr-2 font-semibold text-foreground">After</td><td className="py-1 text-foreground">On — Rank Math publishes a BreadcrumbList on each page</td></tr>
          </tbody></table>
          {extras.predicted?.predictable && (
            <div className="mt-2" data-testid="breadcrumb-fix-predicted">
              <p className="text-[11.5px] text-muted-foreground">Rank Math builds this page&apos;s trail from your WordPress page structure, and it matches the trail you confirmed:</p>
              <ol className="mt-1 space-y-0.5 text-[11.5px]">{extras.predicted.urls.map((u, i) => <li key={u} className="flex gap-2"><span className="text-muted-foreground">{i + 1}.</span><span className="break-all font-mono text-foreground/80">{shortUrl(u)}</span></li>)}</ol>
            </div>
          )}
          {(extras.warnings || []).map((w) => <p key={w.code} className="mt-2 flex items-start gap-1.5 text-[11.5px] text-[#ffb703]" data-testid={`breadcrumb-fix-warning-${w.code}`}><Info size={12} className="mt-0.5 shrink-0" /> {w.message}</p>)}
          {extras.scope?.affectedCount > 0 && (
            <p className="mt-2 text-[11.5px] text-muted-foreground" data-testid="breadcrumb-fix-scope">
              This site-wide setting can resolve this finding on {extras.scope.affectedCount} page{extras.scope.affectedCount === 1 ? "" : "s"}. After the change Odito checks up to six of them on your live site; each page&apos;s finding closes only when that page is re-analysed.
            </p>
          )}
        </div>
      )}

      {canApply && (
        <div className={CARD} data-testid="breadcrumb-fix-approval">
          <label className="flex items-start gap-2 text-[12.5px] text-foreground">
            <input type="checkbox" className="mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} disabled={busy} />
            <span>I approve switching on Rank Math breadcrumbs for my whole site, for the trail I confirmed above.</span>
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground" data-testid="breadcrumb-fix-not-applied">Nothing has been changed yet. After applying, Odito reads the setting back and checks your live pages right away.</p>
          <button type="button" className={`${PRIMARY} mt-3`} disabled={!approved || busy} onClick={submit}>{apply.isPending ? "Applying to WordPress…" : "Approve and apply"}</button>
        </div>
      )}
      {model.canApprove && !recommendationLinked && (
        <div className={CARD} data-testid="breadcrumb-fix-needs-task"><p className={BODY}>Create a task for this page (below) to apply this. Nothing is written until you approve it.</p></div>
      )}

      {actionError && <ErrorBox info={actionError} onRefresh={refresh} onRetry={apply.error ? refresh : undefined} onCheck={checkStatus} checking={reverify.isPending} />}

      {model.fix && (
        <div className={CARD} data-testid="breadcrumb-fix-result">
          <h4 className={`${LABEL} mb-2`}>Result</h4>
          <p className={`${BODY} mb-2`} role="status" data-testid="breadcrumb-fix-result-summary">
            {model.fix.status === "rolled_back" ? "Breadcrumbs were switched off again."
              : model.fix.status === "apply_uncertain" ? "WordPress did not confirm whether the change was saved. Nothing was repeated or undone — check the status."
                : model.fix.status === "verified" ? "WordPress holds the change and your live page publishes the trail you confirmed. The finding is closed by the next recrawl."
                  : model.fix.status === "verification_failed" ? "WordPress accepted the change, but your live page does not show the trail you confirmed — see below. The finding stays open."
                    : ["conflict_detected", "apply_failed", "permission_denied"].includes(model.fix.status) ? "The change was not applied."
                      : "WordPress accepted the change. It is not verified until your live page shows it."}
          </p>
          <ul className="space-y-2">
            <VerificationRow testId="verify-saved" title="Saved in WordPress (setting read back)" status={model.verification.saved} code={model.verification.savedCode} reasons={model.fix.verification?.saved?.reasons} />
            <VerificationRow testId="verify-rendered" title="Published on this page (checked just now)" status={model.verification.rendered} code={model.verification.renderedCode} reasons={model.fix.verification?.rendered?.reasons}
              extra={model.fix.verification?.rendered?.checkedAt ? `Checked ${new Date(model.fix.verification.rendered.checkedAt).toLocaleString()}` : null} />
          </ul>
          {pages.length > 0 && (
            <div className="mt-2" data-testid="breadcrumb-fix-pages">
              <h5 className={`${LABEL} mb-1`}>Other pages of this site-wide change</h5>
              <ul className="space-y-0.5">{pages.map((p) => <li key={p.url} className={`text-[11.5px] ${p.ok ? "text-muted-foreground" : "text-[#ff6080]"}`}>{p.ok ? "✓" : "✗"} <span className="break-all font-mono">{shortUrl(p.url)}</span>{p.ok ? "" : ` — ${p.detail}`}</li>)}</ul>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {model.canReverify && <button type="button" className={BTN} disabled={busy} onClick={checkStatus}>{reverify.isPending ? "Re-verifying…" : (model.uncertain ? "Check status" : "Re-verify")}</button>}
            {model.canRollback && !confirmRollback && <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(true)}><RotateCcw size={11} className="mr-1 inline" />Roll back</button>}
          </div>
          {model.canRollback && confirmRollback && (
            <div className="mt-3 rounded-lg border border-border bg-background/50 p-3" data-testid="breadcrumb-fix-rollback-confirm">
              <p className="text-[12px] text-foreground">Switch Rank Math breadcrumbs off again? This affects the whole site. If someone changed the setting since, it is left as they set it.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={BTN} disabled={busy} onClick={() => rollback.mutate(undefined, { onSettled: () => setConfirmRollback(false) })}>{rollback.isPending ? "Rolling back…" : "Yes, roll back"}</button>
                <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(false)}>Cancel</button>
              </div>
            </div>
          )}
          {model.rollbackStage && <p className="mt-2 text-[12px] text-muted-foreground" data-testid="breadcrumb-fix-rollback-stage">Rollback: {model.rollbackStage.label}.</p>}
        </div>
      )}
    </section>
  )
})

export default BreadcrumbFixCard

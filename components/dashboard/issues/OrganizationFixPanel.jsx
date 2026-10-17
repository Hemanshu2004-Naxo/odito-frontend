"use client"

import { memo, useEffect, useRef, useState } from "react"
import { Info, Loader2, RotateCcw, ShieldCheck } from "lucide-react"
import {
  useApplyWordPressSchemaFix, useReverifyWordPressFix, useRollbackWordPressFix, useWordPressFixPreview,
} from "@/hooks/useWordPressSchemaFix"
import { describeFixError, getOrganizationFixModel } from "./organizationFix"
import { BODY, BTN, CARD, Chip, ErrorBox, LABEL, PRIMARY, VerificationRow } from "./FixPanelParts"

/**
 * The full Organization fix workflow inside the existing issue view: why → exact change → validation → approval → apply
 * → saved-state vs rendered-page verification → re-verify → rollback. Every verdict is the server's; nothing here marks a
 * fix applied until WordPress confirmed the write, or verified until BOTH the saved settings and the crawled page agree.
 */
const OrganizationFixPanel = memo(function OrganizationFixPanel({ projectId, task }) {
  const taskId = task?._id
  const preview = useWordPressFixPreview(projectId, taskId, { enabled: !!taskId })
  const apply = useApplyWordPressSchemaFix(projectId, taskId)
  const reverify = useReverifyWordPressFix(projectId, taskId)
  const rollback = useRollbackWordPressFix(projectId, taskId)
  const [approved, setApproved] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  // Set synchronously on click: a double click (or a second tab key press) can never send two approvals before React re-renders.
  const submitting = useRef(false)

  const model = getOrganizationFixModel(preview.data)
  // An approval is for exactly the plan that was on screen. A refreshed (different) plan or a failed attempt clears it, so a stale
  // tick can never approve a plan the person has not seen.
  useEffect(() => { setApproved(false) }, [model.fingerprint])
  const busy = apply.isPending || reverify.isPending || rollback.isPending
  const previewError = preview.isError ? describeFixError(preview.error) : null
  const actionError = describeFixError(apply.error || reverify.error || rollback.error)

  const refresh = () => { apply.reset(); reverify.reset(); rollback.reset(); setApproved(false); preview.refetch() }
  const checkStatus = () => { if (!reverify.isPending) reverify.mutate() }
  const submit = () => {
    if (submitting.current || busy || !approved) return
    submitting.current = true
    // The approval is spent the moment it is used, whatever the outcome: a retry needs a fresh look and a fresh tick.
    apply.mutate({ expectedPlanFingerprint: model.fingerprint }, { onSettled: () => { submitting.current = false; setApproved(false) } })
  }

  if (!taskId) return null

  return (
    <section className="mt-3 space-y-3" aria-labelledby="org-fix-title" data-testid="organization-fix-panel">
      <div className={CARD}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 id="org-fix-title" className={LABEL}>Apply via WordPress — Organization schema</h3>
          {model.loaded && <Chip tone={model.tone} data-testid="fix-lifecycle">{model.lifecycleLabel}</Chip>}
        </div>
        <p className={BODY}>Odito changes only Rank Math&apos;s organization settings, only with details it verified, and only after you approve the exact change below.</p>
        {preview.isFetching && model.loaded && <p className="mt-1 text-[11px] text-muted-foreground" role="status">Refreshing from WordPress…</p>}
      </div>

      {preview.isLoading && (
        <div className={`${CARD} flex items-center gap-2 text-[12px] text-muted-foreground`} role="status" data-testid="fix-loading">
          <Loader2 size={14} className="animate-spin" /> Reading your WordPress settings…
        </div>
      )}

      {previewError && <ErrorBox info={previewError} onRetry={refresh} onRefresh={refresh} />}

      {model.loaded && (
        <>
          <div className={CARD} data-testid="fix-why">
            <h4 className={`${LABEL} mb-2`}>Why this change</h4>
            {model.intent && (
              <>
                <p className={BODY}>Recommended type: <strong className="text-foreground">{model.intent.type}</strong> ({model.intent.action === "generate" ? "markup will be generated" : model.intent.action})</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">{(model.intent.reasons || []).map((r, i) => <li key={i} className={BODY}>{r}</li>)}</ul>
              </>
            )}
            {model.provider && <p className="mt-2 text-[11px] text-muted-foreground">Source: {model.provider === "rank_math" ? "Rank Math" : model.provider} · Odito SEO Bridge {model.bridgeVersion || ""}</p>}
          </div>

          {model.nothingToApply && (
            <div className={`${CARD} ${model.planStatus === "unsupported" || model.planStatus === "blocked" || model.planStatus === "validation_failed" ? "border-[rgba(255,183,3,0.25)]" : ""}`} data-testid="fix-nothing">
              <h4 className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold text-foreground"><Info size={13} /> {model.planStatus === "nothing_to_change" ? "Nothing to change" : "Cannot be applied automatically"}</h4>
              <p className={BODY}>{model.planMessage}</p>
              {model.blocked.map((b) => <p key={b.code} className={`${BODY} mt-1`} data-testid="fix-blocked">{b.message}</p>)}
            </div>
          )}

          {model.changes.length > 0 && (
            <div className={CARD} data-testid="fix-changes">
              <h4 className={`${LABEL} mb-2`}>Exact changes ({model.changes.length})</h4>
              <table className="w-full text-left text-[12px]">
                <thead><tr className="text-muted-foreground"><th className="pb-1 font-semibold">Setting</th><th className="pb-1 font-semibold">Now</th><th className="pb-1 font-semibold">After</th></tr></thead>
                <tbody>
                  {model.changes.map((c) => (
                    <tr key={c.field} className="align-top" data-testid={`fix-change-${c.field}`}>
                      <td className="py-1 pr-2 font-semibold text-foreground">{c.label}<div className="font-mono text-[10px] font-normal text-muted-foreground">{c.setting}</div></td>
                      <td className="py-1 pr-2 text-muted-foreground break-all">{c.before || "(empty)"}</td>
                      <td className="py-1 break-all text-foreground">{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">Nothing else is touched. Existing values are never overwritten.</p>
            </div>
          )}

          {(model.preserved.length > 0 || model.notWritten.length > 0 || (model.blocked.length > 0 && !model.nothingToApply)) && (
            <div className={CARD} data-testid="fix-notes">
              {model.preserved.length > 0 && (
                <div className="mb-2"><h4 className={`${LABEL} mb-1`}>Kept as they are</h4>
                  <ul className="space-y-1">{model.preserved.map((p) => <li key={p.field} className="text-[12px] text-muted-foreground"><strong className="text-foreground">{p.field}</strong>: {p.current} — {p.reason}</li>)}</ul>
                </div>
              )}
              {model.blocked.length > 0 && !model.nothingToApply && (
                <div className="mb-2"><h4 className={`${LABEL} mb-1`}>Held back</h4>
                  <ul className="space-y-1">{model.blocked.map((b) => <li key={b.code} className="text-[12px] text-muted-foreground">{b.message}</li>)}</ul>
                </div>
              )}
              {model.notWritten.length > 0 && (
                <div><h4 className={`${LABEL} mb-1`}>Not written by Odito (set these in Rank Math)</h4>
                  <ul className="space-y-1">{model.notWritten.map((n) => <li key={n.field} className="text-[12px] text-muted-foreground"><strong className="text-foreground">{n.field}</strong> — {n.message}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {model.changes.length > 0 && (
            <div className={CARD} data-testid="fix-validation">
              <h4 className={`${LABEL} mb-1 flex items-center gap-1.5`}><ShieldCheck size={12} /> Validation</h4>
              {model.validation.valid
                ? <p className={BODY}>The organization markup these settings will publish passed validation against your verified evidence.</p>
                : <ul className="list-disc pl-4">{model.validation.errors.map((e, i) => <li key={i} className="text-[12px] text-[#ff6080]">{e}</li>)}</ul>}
            </div>
          )}

          {model.canApprove && (
            <div className={CARD} data-testid="fix-approval">
              <label className="flex items-start gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" className="mt-0.5" checked={approved} onChange={(e) => setApproved(e.target.checked)} disabled={busy} />
                <span>I approve changing the Rank Math settings listed above on my WordPress site.</span>
              </label>
              <p className="mt-2 text-[11px] text-muted-foreground" data-testid="fix-not-applied">Nothing has been changed yet. Approving writes only these fields; Odito checks the saved value straight away and your live page after the next recrawl.</p>
              <button type="button" className={`${PRIMARY} mt-3`} disabled={!approved || busy} onClick={submit}>
                {apply.isPending ? "Applying to WordPress…" : "Approve and apply"}
              </button>
            </div>
          )}

          {model.concurrency === "read_then_write" && (
            <p className="flex items-start gap-1.5 text-[11.5px] text-[#ffb703]" data-testid="fix-concurrency-note"><Info size={12} className="mt-0.5 shrink-0" /> Your Odito SEO Bridge is older than 1.5.0. It checks the current value before writing but cannot make the check and the write one step, so an edit made in that split second is not guaranteed to be caught. Update the plugin for database-level protection.</p>
          )}

          {actionError && <ErrorBox info={actionError} onRefresh={refresh} onRetry={apply.error ? refresh : undefined} onCheck={checkStatus} checking={reverify.isPending} />}

          {model.fix && (
            <div className={CARD} data-testid="fix-result">
              <h4 className={`${LABEL} mb-2`}>Result</h4>
              <p className={`${BODY} mb-2`} role="status" data-testid="fix-result-summary">
                {model.fix.status === "rolled_back" ? (model.rollbackStage?.key === "verified" ? "The previous values were restored and read back from WordPress." : "The previous values were restored. WordPress has not been read back yet to confirm it.")
                  : model.fix.status === "apply_uncertain" ? "WordPress did not confirm whether the change was saved. Nothing was repeated or undone — check the status."
                    : model.fix.status === "verified" ? "WordPress holds the change and your crawled page shows it."
                    : model.fix.status === "verification_failed" ? "WordPress accepted the change, but it is not verified — see below."
                      : ["conflict_detected", "apply_failed", "permission_denied"].includes(model.fix.status) ? "The change was not applied." + (model.fix.rollback?.restoredFields?.length ? " Fields already written were put back." : "")
                        : "WordPress accepted the change. It is not verified until the rendered page confirms it."}
              </p>
              <ul className="space-y-2">
                <VerificationRow testId="verify-saved" title="Saved in WordPress (settings read back)" status={model.verification.saved} code={model.verification.savedCode} reasons={model.fix.verification?.saved?.reasons} />
                <VerificationRow testId="verify-rendered" title="Rendered on your site (crawled page)" status={model.verification.rendered} code={model.verification.renderedCode} reasons={model.fix.verification?.rendered?.reasons}
                  extra={model.fix.verification?.rendered?.crawledAt ? `Crawl from ${new Date(model.fix.verification.rendered.crawledAt).toLocaleString()}` : null} />
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">A saved setting can still be missing from the page because of a cache, the theme, or another plugin — which is why these are checked separately.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.canReverify && <button type="button" className={BTN} disabled={busy} onClick={checkStatus}>{reverify.isPending ? (model.uncertain ? "Checking…" : "Re-verifying…") : (model.uncertain ? "Check status" : "Re-verify")}</button>}
                {model.canRollback && !confirmRollback && <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(true)}><RotateCcw size={11} className="mr-1 inline" />Roll back</button>}
              </div>
              {model.canRollback && confirmRollback && (
                <div className="mt-3 rounded-lg border border-border bg-background/50 p-3" data-testid="rollback-confirm">
                  <p className="text-[12px] text-foreground">Restore the previous values of only the fields Odito changed? A field someone edited since stays as they left it.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={BTN} disabled={busy} onClick={() => { rollback.mutate(undefined, { onSettled: () => setConfirmRollback(false) }) }}>{rollback.isPending ? "Rolling back…" : "Yes, roll back"}</button>
                    <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRollback(false)}>Cancel</button>
                  </div>
                </div>
              )}
              {rollback.data?.message && <p className="mt-2 text-[12px] text-muted-foreground" role="status" data-testid="rollback-message">{rollback.data.message}</p>}
              {model.rollbackStage && <p className="mt-2 text-[12px] text-muted-foreground" data-testid="rollback-stage">Rollback: {model.rollbackStage.label}.</p>}
              {model.rollback?.status === "partial_conflict" && <p className="mt-2 text-[12px] text-[#ffb703]" data-testid="rollback-conflict">Left as edited by someone else: {model.rollback.conflictFields.join(", ")}.</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
})

export default OrganizationFixPanel

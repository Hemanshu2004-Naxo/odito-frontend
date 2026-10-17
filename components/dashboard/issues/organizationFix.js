// Pure view-model helpers for the Organization WordPress fix panel. No React, no network.
//
// The server decides everything (the plan, the validation, the lifecycle, the verification verdicts). These helpers only
// translate that into what the panel shows and which actions are available — and they enforce the UX rules:
//   - "applied" is shown only when the server says the write happened;
//   - "verified" only when BOTH the saved WordPress state AND the rendered page were verified;
//   - nothing can be approved unless the server's plan is `ready` and its markup validation passed.

export const ORGANIZATION_FIX_ISSUE_ID = "organization_schema"

const FIELD_LABEL = { name: "Organization name", logo: "Logo URL", type: "Business type", address: "Business address" }

export const LIFECYCLE_LABEL = {
  proposed: "Proposed",
  validated: "Validated",
  awaiting_approval: "Awaiting your approval",
  approved: "Approved",
  applying: "Applying…",
  applied: "Applied — verification pending",
  verifying: "Verifying…",
  verified: "Verified",
  validation_failed: "Cannot be applied",
  permission_denied: "Permission denied",
  conflict_detected: "Conflict detected",
  apply_failed: "Apply failed",
  apply_uncertain: "Outcome unknown — check status",
  verification_failed: "Verification failed",
  unsupported: "Not supported",
  rolled_back: "Rolled back",
}

const TONE = {
  verified: "ok", applied: "info", awaiting_approval: "info", approved: "info", applying: "info", verifying: "info", proposed: "muted", validated: "muted",
  rolled_back: "muted", validation_failed: "warn", unsupported: "warn", conflict_detected: "warn", permission_denied: "bad", apply_failed: "bad", verification_failed: "bad",
  apply_uncertain: "warn",
}

export const statusTone = (s) => TONE[s] || "muted"

const part = (v) => v?.status || "pending"

/**
 * @returns {{saved: string, rendered: string, savedCode: string|null, renderedCode: string|null, overall: 'verified'|'failed'|'pending'}}
 * `*Code` says WHY a part is pending / cannot be checked (e.g. NO_POST_WRITE_CRAWL), so "wait for a recrawl" is never confused with "cannot be judged".
 */
export function verificationSummary(fix, preview) {
  const savedPart = fix?.verification?.saved || { status: preview?.verificationStatus?.saved }
  const renderedPart = fix?.verification?.rendered || { status: preview?.verificationStatus?.rendered }
  const saved = part(savedPart)
  const rendered = part(renderedPart)
  const overall = saved === "failed" || rendered === "failed" ? "failed" : saved === "verified" && rendered === "verified" ? "verified" : "pending"
  return { saved, rendered, savedCode: savedPart?.reasonCode || null, renderedCode: renderedPart?.reasonCode || null, overall }
}

const VERIFY_LABEL = { pending: "Not checked yet", verified: "Verified", failed: "Does not match", unverifiable: "Cannot be checked yet" }
const PENDING_BY_CODE = { NO_POST_WRITE_CRAWL: "Waiting for a recrawl", PAGE_NOT_CRAWLED: "Page not crawled yet" }
/** `code` is optional: records written before reason codes existed keep their original wording. */
export function verifyLabel(status, code = null) {
  if (status === "pending" && PENDING_BY_CODE[code]) return PENDING_BY_CODE[code]
  if (status === "unverifiable" && code) return "Cannot be checked"
  return VERIFY_LABEL[status] || VERIFY_LABEL.pending
}

/** The honest state of a rollback: requested -> applied (restored, not yet read back) -> verified. `rolled_back` is the legacy "restored" value. */
export function rollbackStage(rollback) {
  const s = rollback?.status || "none"
  if (s === "none") return null
  const stages = {
    requested: { key: "requested", label: "Rollback started — not finished", tone: "warn" },
    applied: { key: "applied", label: "Restored — not yet confirmed from WordPress", tone: "info" },
    verified: { key: "verified", label: "Restored and confirmed", tone: "ok" },
    rolled_back: { key: "verified", label: "Restored", tone: "ok" },
    partial_conflict: { key: "partial_conflict", label: "Partly restored — a field was edited since", tone: "warn" },
    failed: { key: "failed", label: "Not restored — it was edited since", tone: "warn" },
  }
  return stages[s] || null
}

/**
 * Everything the panel needs, from the preview response (`GET /tasks/:id/wordpress-fix/preview`).
 * `preview` may be null while loading.
 */
export function getOrganizationFixModel(preview) {
  if (!preview) return { loaded: false }
  const plan = preview.plan || {}
  const fix = preview.record || null
  const lifecycle = preview.lifecycle
  const validationOk = !!preview.validation?.valid
  const alreadyDone = !!fix && ["applying", "apply_uncertain", "applied", "verifying", "verified", "verification_failed"].includes(fix.status)
  const canApprove = plan.status === "ready" && validationOk && !alreadyDone
  const rolledBack = fix?.status === "rolled_back"
  const hasRollbackable = !!fix?.changes?.some((c) => c.applied && !c.restored) && !rolledBack && !["applying", "apply_uncertain"].includes(fix?.status)

  return {
    loaded: true,
    fixType: preview.fixType,
    targetUrl: preview.targetUrl,
    provider: preview.source?.provider || null,
    bridgeVersion: preview.source?.bridgeVersion || null,
    lifecycle,
    lifecycleLabel: LIFECYCLE_LABEL[lifecycle] || lifecycle,
    tone: statusTone(lifecycle),
    intent: preview.schemaIntent || null,
    evidence: preview.evidence || null,
    planStatus: plan.status,
    planMessage: plan.message || null,
    planCode: plan.code || null,
    fingerprint: plan.fingerprint,
    changes: (preview.proposedChanges || []).map((c) => ({
      field: c.field, label: c.label || FIELD_LABEL[c.field] || c.field, kind: c.kind, source: c.source || null,
      // The address is stored and compared as canonical JSON; the screen shows the readable form the server provides.
      before: (c.beforeLabel !== undefined ? c.beforeLabel : c.before) || "", after: (c.afterLabel !== undefined ? c.afterLabel : c.after) || "",
      setting: (plan.changes || []).find((p) => p.field === c.field)?.rankMathOption || null,
    })),
    preserved: plan.preserved || [],
    blocked: plan.blocked || [],
    notWritten: plan.notWritten || [],
    validation: { valid: validationOk, errors: preview.validation?.errors || [], warnings: preview.validation?.warnings || [] },
    expectedEntity: preview.expectedEntity || null,
    beforeState: preview.beforeState || null,
    expectedAfterState: preview.expectedAfterState || null,
    canApprove,
    alreadyDone,
    fix,
    verification: verificationSummary(fix, preview),
    // Re-verify also reconciles an uncertain apply, and re-checks a rollback that was applied but not yet confirmed.
    canReverify: !!fix && (["applied", "verifying", "verification_failed", "verified", "apply_uncertain"].includes(fix.status) || (rolledBack && fix.rollback?.status === "applied")),
    uncertain: fix?.status === "apply_uncertain",
    canRollback: hasRollbackable,
    rollback: fix?.rollback || null,
    rollbackStage: rollbackStage(fix?.rollback),
    // 'database_conditional' = each write is one conditional update; 'read_then_write' = an older Bridge checks and then writes.
    concurrency: preview.concurrency?.writes || null,
    nothingToApply: ["nothing_to_change", "unsupported", "validation_failed", "blocked"].includes(plan.status) && !alreadyDone,
  }
}

/**
 * What to tell the user about a failed request (preview/apply/reverify/rollback). `error` is the Error apiService throws
 * (.status / .code / .details / .message come from the backend). Never invents a cause; only chooses the remediation.
 */
export function describeFixError(error) {
  if (!error) return null
  const code = error.code
  const status = error.status
  const reason = error.details?.reason
  const base = { message: error.message || "Something went wrong while processing this fix.", retry: true, refreshPreview: false, tone: "bad", updatePlugin: false }

  if (code === "CONFLICT" && reason === "preview_stale") {
    return { ...base, tone: "warn", refreshPreview: true, retry: false, title: "Your settings changed since the preview", message: "WordPress or the page evidence changed after you reviewed this fix. Nothing was written. Review the refreshed preview and approve it again." }
  }
  if (code === "OUTCOME_UNKNOWN" || reason === "outcome_unknown") {
    return { ...base, tone: "warn", retry: false, checkStatus: true, title: "WordPress did not confirm the change", message: "WordPress did not say whether the change was saved, and it could not be re-read to find out. Nothing was repeated and nothing was undone. Check the status: Odito compares WordPress with what it tried to write before doing anything else." }
  }
  if (code === "CONFLICT" && reason === "fix_in_progress") {
    return { ...base, tone: "info", retry: false, title: "Already being applied", message: "This fix is already being applied. Wait for it to finish, then refresh." }
  }
  if (code === "CONFLICT" || status === 409) {
    const restored = error.details?.restoredFields?.length
    return { ...base, tone: "warn", refreshPreview: true, retry: false, title: "Conflict detected", message: `${error.message || "A setting changed while the fix was being applied."}${restored ? " Fields Odito had already written were put back." : ""} Nothing was overwritten.` }
  }
  if (code === "PERMISSION_DENIED" || status === 403) {
    return { ...base, retry: false, title: "Permission denied", message: error.message || "The WordPress account connected to Odito may not change site-wide SEO settings. Reconnect with an administrator account." }
  }
  if (code === "INVALID_CREDENTIALS" || status === 401) {
    return { ...base, retry: false, title: "WordPress rejected the connection", message: "The saved WordPress credentials are no longer valid. Reconnect WordPress, then try again." }
  }
  if (code === "FIELD_NOT_WRITABLE" && (reason === "bridge_outdated" || reason === "bridge_not_installed")) {
    return { ...base, retry: false, updatePlugin: true, tone: "warn", title: reason === "bridge_outdated" ? "Odito SEO Bridge needs updating" : "Odito SEO Bridge is not installed", message: error.message }
  }
  if (code === "FIELD_NOT_WRITABLE") return { ...base, retry: false, tone: "warn", title: "Not supported on this site", message: error.message }
  if (code === "RECOMMENDATION_REQUIRED") return { ...base, retry: false, tone: "warn", title: "Recommendation required", message: error.message }
  if (code === "VALIDATION_FAILED" || status === 422) return { ...base, retry: false, tone: "warn", title: "Cannot be applied", message: error.message }
  if (status === 429 || code === "RATE_LIMITED") return { ...base, title: "Too many attempts", message: "Please wait a moment and try again." }
  if (code === "TIMEOUT" || status === 504 || status === 502 || status >= 500) return { ...base, title: "WordPress did not respond", message: "WordPress or Odito had a temporary problem. Nothing is assumed to have been written — check the preview before retrying." }
  return { ...base, title: "Something went wrong" }
}

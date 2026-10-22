// View-model for the AI investigation panel: pure functions that turn the server's investigation object into what is shown.
// Nothing here decides eligibility or verification — it only labels what the server reported, and refuses to imply more.

export const ACTIVE_STATUSES = ["queued", "running"]
export const isActive = (status) => ACTIVE_STATUSES.includes(status)

const STAGE_LABELS = {
  queued: "Queued",
  validate: "Checking the request",
  gather_evidence: "Inspecting the page and site",
  capabilities: "Checking what can be fixed automatically",
  diagnose: "Diagnosing the cause",
  validate_output: "Validating the diagnosis",
  completed: "Done",
}
export const stageLabel = (stage) => STAGE_LABELS[stage] || "Working"

export const PIPELINE = ["gather_evidence", "capabilities", "diagnose", "validate_output"]

/** One row per pipeline stage: pending | running | done | failed | skipped, from the server's progress log. */
export function stageRows(progress = [], currentStage = null, status = "queued") {
  const last = {}
  for (const p of progress) last[p.stage] = p
  return PIPELINE.map((stage) => {
    const entry = last[stage]
    let state = "pending"
    if (entry) state = entry.status === "running" ? "running" : entry.status
    if (status === "completed" && state === "running") state = "done"
    if (isActive(status) && stage === currentStage && state === "pending") state = "running"
    return { stage, label: stageLabel(stage), state, note: entry?.note || null }
  })
}

const ISSUE_STATUS = {
  confirmed: { label: "Issue confirmed", tone: "bad" },
  already_resolved: { label: "Already resolved on the live page", tone: "ok" },
  partially_present: { label: "Partially present", tone: "warn" },
  uncertain: { label: "Not certain", tone: "warn" },
}
export const issueStatusInfo = (s) => ISSUE_STATUS[s] || { label: "Unknown", tone: "muted" }

const INVESTIGATION_STATUS = {
  complete: { label: "Complete", tone: "ok" },
  partial: { label: "Partial evidence", tone: "warn" },
  insufficient_evidence: { label: "Insufficient evidence", tone: "warn" },
  blocked: { label: "Page could not be inspected", tone: "bad" },
}
export const investigationStatusInfo = (s) => INVESTIGATION_STATUS[s] || { label: "Unknown", tone: "muted" }

const METHOD_LABEL = {
  automatic_fix: "Automatic fix (after your approval)",
  manual_code_change: "Code change by a developer",
  cms_configuration: "CMS / plugin setting",
  content_edit: "Content edit",
  server_configuration: "Server configuration",
  no_action: "No change needed",
  needs_more_information: "More information needed",
}
export const methodLabel = (m) => METHOD_LABEL[m] || "Recommended change"

const ELIGIBILITY_LABEL = {
  eligible: { label: "Odito has an approved adapter for this fix", tone: "ok" },
  requires_integration_setup: { label: "Needs setup before Odito can apply it", tone: "warn" },
  not_supported: { label: "Manual fix — no automatic option", tone: "muted" },
  unknown: { label: "Automatic-fix availability unknown", tone: "warn" },
}
export function eligibilityInfo(fix) {
  if (!fix) return ELIGIBILITY_LABEL.unknown
  // The model's own claim is irrelevant here; the server-computed `eligible` flag + capability state decide.
  if (fix.eligible) return ELIGIBILITY_LABEL.eligible
  if (fix.eligibility === "eligible") return { label: "Could be automated, but this proposal needs manual review", tone: "warn" }
  return ELIGIBILITY_LABEL[fix.eligibility] || ELIGIBILITY_LABEL.unknown
}

export const evidenceStatusTone = (s) => ({ ok: "ok", unavailable: "muted", blocked: "bad", error: "warn" }[s] || "muted")

export const EVIDENCE_KIND_LABEL = {
  detector: "Detector findings",
  crawl_page: "Stored crawl record",
  page: "Live page",
  rendering_comparison: "Raw HTML vs crawl",
  rendered_dom: "Rendered page",
  homepage: "Homepage / navigation",
  sibling: "Comparable page",
  robots_txt: "robots.txt",
  sitemap: "Sitemap",
  llms_txt: "llms.txt",
  response_headers: "Response headers & redirects",
}
export const evidenceKindLabel = (k) => EVIDENCE_KIND_LABEL[k] || k

/** "retrieved 3m ago" style freshness for an evidence row. */
export function describeFreshness(item, now = Date.now()) {
  const t = Date.parse(item?.retrievedAt || "")
  if (!Number.isFinite(t)) return item?.source === "crawl_data" ? "crawl time unknown" : "time unknown"
  const sec = Math.max(0, Math.round((now - t) / 1000))
  const age = sec < 90 ? `${sec}s ago` : sec < 5400 ? `${Math.round(sec / 60)}m ago` : sec < 129600 ? `${Math.round(sec / 3600)}h ago` : `${Math.round(sec / 86400)}d ago`
  return `${item.source === "crawl_data" ? "crawled" : "retrieved"} ${age}${item.fromCache ? " (reused)" : ""}`
}

/**
 * The four honest lifecycle steps. `done` only when the server says so; applying and verifying are never inferred.
 */
export function lifecycleSteps(lifecycle) {
  const l = lifecycle || {}
  const verification = l.verificationStatus || "not_started"
  return [
    { key: "generated", label: "Recommendation generated", done: !!l.recommendationGenerated },
    { key: "proposed", label: "Fix proposed", done: !!l.fixProposed },
    { key: "applied", label: l.userReportedImplemented && !l.fixApplied ? "Marked implemented by you (not applied by Odito)" : "Fix applied", done: !!l.fixApplied, note: l.appliedBy || null },
    {
      key: "verified",
      label: verification === "failed" ? "Verification failed — the issue is still detected" : verification === "pending" ? "Verification running" : "Independently verified",
      done: !!l.fixVerified,
      tone: verification === "failed" ? "bad" : verification === "pending" ? "info" : undefined,
    },
  ]
}

/** Why the result should be treated with care — shown above the diagnosis. */
export function cautionNotices(investigation) {
  const out = []
  const r = investigation?.result
  if (!r) return out
  if (r.investigationStatus === "blocked") out.push({ tone: "bad", text: "The page could not be inspected and no stored evidence was available. Nothing below is a diagnosis." })
  else if (r.investigationStatus === "partial") out.push({ tone: "warn", text: "Some evidence could not be retrieved, so this diagnosis is based on partial information." })
  else if (r.investigationStatus === "insufficient_evidence") out.push({ tone: "warn", text: "There was not enough evidence for a certain diagnosis. See what is missing below." })
  if (r.confidence?.label === "low" && r.investigationStatus !== "blocked") out.push({ tone: "warn", text: "Low confidence." })
  for (const w of (investigation.warnings || []).slice(0, 4)) out.push({ tone: "muted", text: w })
  return out
}

export const ERROR_MESSAGES = {
  INVESTIGATION_TIMEOUT: "The investigation took too long and was stopped. Try again.",
  CANCELLED: "The investigation was cancelled.",
  OUT_OF_SCOPE: "This page is not part of the project's website, so it cannot be inspected.",
  INVALID_REQUEST: "This issue or page could not be investigated.",
  RATE_LIMITED: "Too many investigations in a short time. Please wait a moment.",
  INVESTIGATION_INTERRUPTED: "The investigation was interrupted (the server restarted) and did not finish. Start it again.",
  NOT_ELIGIBLE: "Odito cannot apply this automatically right now. Follow the manual steps.",
  ISSUE_NOT_CONFIRMED: "The live page did not confirm this issue, so there is nothing to apply.",
  INVESTIGATION_NOT_COMPLETE: "The investigation has not finished yet.",
  STALE_INVESTIGATION: "A newer investigation exists for this page. Use that one.",
  ALREADY_RUNNING: "A verification is already running for this page.",
  TASK_STATE_CONFLICT: "This task has already moved on. Refresh the page.",
  TASK_UNAVAILABLE: "The task for this issue was removed. Recreate it from the issue list.",
  RECOMMENDATION_FAILED: "The recommendation needed for the fix could not be generated. Try again.",
}
export const errorMessage = (err) => ERROR_MESSAGES[err?.code] || err?.message || "The investigation failed. Try again."

const BASIS = {
  observed: { label: "Observed", tone: "ok", hint: "Seen directly in retrieved evidence" },
  corroborated: { label: "Corroborated", tone: "ok", hint: "Seen independently in two or more sources" },
  inferred: { label: "Inferred", tone: "warn", hint: "A reasonable conclusion, not shown by the evidence" },
  unknown: { label: "Unknown", tone: "bad", hint: "The evidence needed was unavailable or incomplete" },
}
export const basisInfo = (b) => BASIS[b] || BASIS.unknown

/** Server-verified checks that decide automatic application (never model confidence). */
export function safetySummary(checks = []) {
  const failed = checks.filter((c) => !c.passed)
  return { total: checks.length, failed, passed: checks.length - failed.length, allPassed: checks.length > 0 && failed.length === 0 }
}

const CHECK_LABELS = {
  live_page_inspected: "Live page inspected",
  rendered_state_known: "Rendered state known",
  issue_supported_by_evidence: "Issue supported by evidence",
  absence_claims_established: "\"Missing\" claims established",
  urls_backed_by_evidence: "URLs backed by evidence",
  markup_syntactically_valid: "Markup is valid (not proof it is safe)",
  no_duplicate_markup: "No duplicate markup",
  concrete_proposal_present: "Concrete proposal present",
  breadcrumb_hierarchy_verified: "Hierarchy verified",
  breadcrumb_urls_in_hierarchy: "Every URL is a verified level",
  breadcrumb_last_is_current_page: "Last item is this page",
  breadcrumb_length_matches_hierarchy: "Same number of levels",
  breadcrumb_parent_urls_reachable: "Parent URLs reachable",
  breadcrumb_labels_match_evidence: "Labels match the evidence",
}
export const checkLabel = (name) => CHECK_LABELS[name] || name.replace(/_/g, " ")

/** approval progress as the server reports it (lifecycle.approval) plus local prepare state */
export function approvalState({ lifecycle, prepared }) {
  const a = lifecycle?.approval || {}
  if (a.consumed) return { key: "used", label: "Approval used to apply the change", tone: "ok" }
  if (a.invalidated) return { key: "invalidated", label: "Approval voided because the page was investigated again", tone: "bad" }
  if (a.approved) return { key: "approved", label: "Approved — apply it from the apply step", tone: "ok" }
  if (prepared) return { key: "needs_approval", label: "Review, then approve this exact change", tone: "info" }
  return { key: "not_prepared", label: "Prepare the fix to continue", tone: "muted" }
}
Object.assign(ERROR_MESSAGES, {
  APPROVAL_REQUIRED: "Approve the exact proposed change before applying it.",
  APPROVAL_ALREADY_USED: "This approval was already used.",
  APPROVAL_INVALIDATED: "The approval was voided because the situation changed. Review and approve again.",
  APPROVAL_NOT_ALLOWED: "This proposal was already applied; run a new investigation.",
  PROPOSAL_CHANGED: "The proposal changed since you reviewed it. Reload and review it again.",
  FIX_NOT_PREPARED: "Prepare the fix first.",
  RECOMMENDATION_CHANGED: "The recommendation linked to the task changed after approval. Prepare and approve again.",
  NOTHING_TO_VERIFY: "Nothing has been applied for this investigation yet.",
})

Object.assign(ERROR_MESSAGES, {
  NOT_AN_ADDRESS_FINDING: "This investigation is not about a missing Organization address.",
  ADDRESS_INPUT_INVALID: "That address cannot be used. Enter a real street address and city.",
  PROPOSAL_NOT_PUBLISHABLE: "There is no publishable change yet. See what is missing below.",
  ADDRESS_CHANGED: "The confirmed address changed after this proposal was built. Investigate again.",
  ADDRESS_CONFIRMATION_MISSING: "The address confirmation behind this proposal is gone. Confirm it again.",
  CONFIRMATION_FOR_OTHER_WEBSITE: "The address was confirmed for a different website.",
})

// ── Checks: every check is shown with a name, a status, an explanation and (when it is not passing) an action ──────────────────
export const CHECK_STATUS_INFO = {
  passed: { label: "Passed", tone: "ok", mark: "✓" },
  failed: { label: "Failed", tone: "bad", mark: "✗" },
  blocked: { label: "Blocked", tone: "warn", mark: "!" },
  not_run: { label: "Not run", tone: "muted", mark: "–" },
}

/** Accepts the new records and the older {name, passed, detail} shape; drops junk; never yields an empty label or explanation. */
export function normalizeChecks(checks) {
  if (!Array.isArray(checks)) return []
  const out = []
  checks.forEach((c, i) => {
    if (!c || typeof c !== "object") return
    const id = String(c.id || c.name || "").trim()
    const status = CHECK_STATUS_INFO[c.status] ? c.status : c.passed === true ? "passed" : c.passed === false ? "failed" : "not_run"
    const label = String(c.label || "").trim() || (id ? checkLabel(id) : `Check ${i + 1}`)
    const fallback = status === "not_run" ? "This check was not run." : status === "passed" ? "No problem found." : "No explanation was recorded."
    out.push({ key: id || `check-${i}`, id, label, status, detail: String(c.detail || "").trim() || fallback, action: String(c.action || "").trim() || null })
  })
  return out
}

/** One summary computed from the same records that are listed, so it can never disagree with them. */
export function checksSummary(checks) {
  const list = normalizeChecks(checks)
  const n = (s) => list.filter((c) => c.status === s).length
  const parts = [`${n("passed")} passed`]
  if (n("failed")) parts.push(`${n("failed")} failed`)
  if (n("blocked")) parts.push(`${n("blocked")} blocked`)
  if (n("not_run")) parts.push(`${n("not_run")} not run`)
  return { total: list.length, passed: n("passed"), failed: n("failed"), blocked: n("blocked"), notRun: n("not_run"), text: list.length ? `${parts.join(" · ")} (of ${list.length})` : "No checks recorded" }
}

// ── Five-stage lifecycle derived only from the server's `lifecycle.stages` ─────────────────────────────────────────────────────
const STAGE_TEXT = {
  recommendation: { not_generated: ["Recommendation not generated", "muted"], generated: ["Recommendation generated", "ok"] },
  proposal: { none: ["No change proposed", "muted"], available: ["Proposal available", "ok"], blocked: ["Proposal blocked", "warn"], awaiting_information: ["Waiting for information from you", "warn"] },
  approval: { not_required: ["No approval needed", "muted"], blocked: ["Approval not possible yet", "muted"], awaiting: ["Awaiting your approval", "info"], approved: ["Approved", "ok"], invalidated: ["Approval voided", "bad"], used: ["Approval used", "ok"] },
  application: { not_started: ["Not applied", "muted"], applied: ["Applied to the website", "ok"], failed: ["Application failed", "bad"] },
  verification: { not_started: ["Not verified", "muted"], pending: ["Verification running", "info"], verified: ["Independently verified", "ok"], failed: ["Verification failed — issue still detected", "bad"] },
}
export function stageList(lifecycle) {
  const st = lifecycle?.stages
  if (!st) return null
  return ["recommendation", "proposal", "approval", "application", "verification"].map((key) => {
    const state = st[key]?.state
    const [label, tone] = STAGE_TEXT[key][state] || ["Unknown", "muted"]
    return { key, state: state || "unknown", label, tone, done: ["generated", "available", "approved", "used", "applied", "verified"].includes(state), blockers: st[key]?.blockers || [], failure: st[key]?.failure || null }
  })
}

// ── Address evidence provenance ───────────────────────────────────────────────────────────────────────────────────────────────
export const PROVENANCE = {
  observed: { label: "Observed", tone: "ok" },
  corroborated: { label: "Corroborated", tone: "ok" },
  user_confirmed: { label: "User-confirmed", tone: "info" },
  inferred: { label: "Inferred", tone: "warn" },
  unknown: { label: "Unknown", tone: "bad" },
}
export const provenanceInfo = (k) => PROVENANCE[k] || PROVENANCE.unknown

export function addressAnalysis(result) {
  const a = (Array.isArray(result?.analyses) ? result.analyses : []).find((x) => x?.data?.operation === "address")
  return a?.data || null
}

export function candidateBadge(c) {
  if (c?.usable) return { label: c.trustLabel || "Usable", tone: "ok" }
  return { label: c?.trustLabel || "Unverified — suggestion only", tone: "warn" }
}

export const GUIDANCE_LABELS = [
  ["auditRule", "Audit rule"],
  ["schemaOrg", "schema.org"],
  ["searchEngines", "Search engines"],
]

// ── Concise presentation layer (issue-agnostic; derived only from validated result fields) ────────────────────────────────────

/** First `sentences` sentences of a text, hard-capped at `max` characters. Never invents or rewrites content. */
export function conciseText(text, { sentences = 2, max = 280 } = {}) {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  const parts = t.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [t]
  let out = parts.slice(0, sentences).map((p) => p.trim()).join(" ").trim()
  if (out.length > max) out = `${out.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
  return out
}

const BLOCKER_RANK = { information: 0, safety: 1, capability: 2 }
/** Most actionable first: what the user can supply, then safety problems, then missing capabilities. */
export function sortBlockers(blockers) {
  return (Array.isArray(blockers) ? blockers : [])
    .filter((b) => b && (b.message || b.code))
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (BLOCKER_RANK[x.b.category] ?? 3) - (BLOCKER_RANK[y.b.category] ?? 3) || x.i - y.i)
    .map((x) => x.b)
}

export const humanizeIssueId = (id) => String(id || "Issue").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())

export function pagePath(url) {
  try { const u = new URL(url); return `${u.pathname === "/" ? "Home page" : u.pathname}${u.search}` } catch { return url || "" }
}

/**
 * Everything the concise default view shows, decided in one place: one status, one primary action, one notice.
 * The action is offered only when the server-reported state allows it (the backend re-checks every one of them).
 * @returns {{ status: {key:string,label:string,tone:string}, action: ({kind:'rerun'|'prepare'|'approve'|'verify',label:string}|null), notice: ({tone:string,text:string,code:string|null}|null), shownBlockerCode: string|null, found: string, fix: string, verifyHint: string, awaitingInformation: boolean }}
 */
export function presentResult(investigation, { prepared = null } = {}) {
  const r = investigation?.result || {}
  const l = r.lifecycle || {}
  const st = l.stages || null
  const blockers = sortBlockers(r.blockers)
  const top = blockers[0] || null
  const eligible = !!r.automaticFixEligibility?.eligible
  const appr = approvalState({ lifecycle: l, prepared })
  const canVerify = !!(l.fixApplied || l.userReportedImplemented)
  const limited = ["blocked", "partial", "insufficient_evidence"].includes(r.investigationStatus)
  const hasSteps = (r.implementationPlan?.length || 0) > 0 || (r.codeOrConfiguration?.length || 0) > 0
  const awaitingInformation = st?.proposal?.state === "awaiting_information" || (!eligible && top?.category === "information")
  const appState = st?.application?.state
  const verState = st?.verification?.state
  const topNotice = (tone = "warn") => (top ? { tone, text: conciseText([top.message, top.action && `${top.action}`].filter(Boolean).join(" "), { sentences: 3, max: 320 }), code: top.code || null } : null)

  const found = conciseText(r.summary, { sentences: 2, max: 280 })
  const fix = conciseText(r.recommendedSolution?.strategy, { sentences: 3, max: 400 })
  const first = r.validationPlan?.[0]
  const verifyHint = first?.check ? `${conciseText(first.check, { sentences: 1, max: 140 })}${first.expected ? ` → ${conciseText(first.expected, { sentences: 1, max: 100 })}` : ""}` : ""
  const out = (status, action, notice) => {
    // A limited investigation (page not inspected / partial / not enough evidence) always says so, whatever else the state is.
    const n = notice || (limited ? (() => { const c = cautionNotices(investigation)[0]; return c ? { tone: c.tone, text: c.text, code: null } : null })() : null)
    return { status, action, notice: n, shownBlockerCode: n?.code || null, found, fix, verifyHint, awaitingInformation }
  }

  if (l.fixVerified || verState === "verified") return out({ key: "verified", label: "Verified", tone: "ok" }, null, null)
  if (verState === "failed" || l.verificationStatus === "failed") return out({ key: "verification_failed", label: "Verification failed", tone: "bad" }, canVerify ? { kind: "verify", label: "Verify again" } : null, { tone: "bad", text: "The issue is still detected after the change.", code: null })
  if (verState === "pending" || l.verificationStatus === "pending") return out({ key: "verifying", label: "Verifying", tone: "info" }, null, null)
  if (appState === "applied" || l.fixApplied || l.userReportedImplemented) {
    return out({ key: "applied", label: l.userReportedImplemented && !l.fixApplied ? "Marked implemented" : "Applied", tone: "ok" }, canVerify ? { kind: "verify", label: "Verify fix" } : null, l.userReportedImplemented && !l.fixApplied ? { tone: "muted", text: "You marked this as implemented. Odito has not applied or verified it.", code: null } : null)
  }
  if (appState === "failed") return out({ key: "application_failed", label: "Application failed", tone: "bad" }, { kind: "rerun", label: "Retry" }, { tone: "bad", text: st.application.failure?.message || "Applying the change failed. Nothing was changed.", code: null })
  if (limited && (r.investigationStatus === "blocked" || !r.proposal?.hasProposal)) {
    const n = cautionNotices(investigation)[0]
    return out({ key: "needs_retry", label: r.investigationStatus === "blocked" ? "Page not inspected" : "Partial evidence", tone: r.investigationStatus === "blocked" ? "bad" : "warn" }, { kind: "rerun", label: "Retry investigation" }, n ? { tone: n.tone, text: n.text, code: null } : null)
  }
  if (r.issueStatus === "already_resolved") return out({ key: "resolved", label: "Already resolved", tone: "ok" }, null, null)
  if (appr.key === "approved" || appr.key === "used") return out({ key: "approved", label: "Approved", tone: "ok" }, null, { tone: "info", text: "Approved. Apply it from the apply step; nothing has changed on your website yet.", code: null })
  if (appr.key === "invalidated") return out({ key: "approval_voided", label: "Approval voided", tone: "bad" }, eligible ? { kind: "prepare", label: "Prepare fix" } : null, { tone: "bad", text: appr.label, code: null })
  if (eligible) {
    if (appr.key === "needs_approval") return out({ key: "needs_approval", label: "Approval needed", tone: "info" }, { kind: "approve", label: "Approve this exact change" }, { tone: "info", text: "This proposal requires your approval before it can be applied.", code: null })
    return out({ key: "recommended", label: "Recommended", tone: "ok" }, { kind: "prepare", label: "Prepare fix" }, null)
  }
  if (awaitingInformation) return out({ key: "action_required", label: "Action required", tone: "warn" }, null, topNotice("warn"))
  if (r.recommendedSolution?.method === "no_action") return out({ key: "no_change", label: "No change needed", tone: "ok" }, null, null)
  return out({ key: "manual", label: st?.proposal?.state === "blocked" ? "Blocked" : "Manual fix", tone: st?.proposal?.state === "blocked" ? "warn" : "muted" }, null, topNotice(top?.category === "safety" ? "warn" : "muted"))
}

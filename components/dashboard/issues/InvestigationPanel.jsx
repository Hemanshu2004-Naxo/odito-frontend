"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Circle, Copy, Check, Loader2, Search, ShieldCheck } from "lucide-react"
import { BODY, BTN, CARD, Chip, LABEL, PRIMARY } from "./FixPanelParts"
import { useInvestigation } from "@/hooks/useInvestigation"
import {
  approvalState, basisInfo,
  cautionNotices, describeFreshness, eligibilityInfo, errorMessage, evidenceKindLabel, evidenceStatusTone, investigationStatusInfo,
  isActive, issueStatusInfo, lifecycleSteps, methodLabel, stageRows,
  presentResult, sortBlockers, pagePath, humanizeIssueId,
  CHECK_STATUS_INFO, normalizeChecks, checksSummary, stageList, addressAnalysis, candidateBadge, provenanceInfo, GUIDANCE_LABELS,
} from "./investigationView"

/**
 * "Investigate with AI": the evidence-driven diagnosis that sits next to the existing AI recommendation.
 * It never changes the website. It shows what was inspected, what was verified, the cause, the proposed fix and — separately and only
 * as reported by the server — whether anything was applied or independently verified.
 */

function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(block.content); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard unavailable */ }
  }
  return (
    <div data-testid="investigation-code" className="rounded-lg border border-border bg-background/60">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-[11px] font-semibold text-foreground/80">{block.purpose || "Proposed code"} <span className="text-muted-foreground">· {block.language}</span></span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground" aria-label="Copy code">
          {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 text-[11.5px] leading-relaxed text-foreground/90">{block.content}</pre>
      {block.jsonLd && !block.jsonLd.valid && (
        <p className="border-t border-border px-3 py-2 text-[11px] text-[#ff6080]">This markup did not pass validation: {block.jsonLd.problems.join(" ")}</p>
      )}
      {(block.notes || []).filter((n) => !block.jsonLd || !block.jsonLd.problems.includes(n)).map((n, i) => (
        <p key={i} className="border-t border-border px-3 py-2 text-[11px] text-[#ffb703]">{n}</p>
      ))}
    </div>
  )
}

function Section({ title, children, testId }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-1.5">
      <div className={LABEL}>{title}</div>
      {children}
    </section>
  )
}

function ChecksList({ checks }) {
  const list = normalizeChecks(checks)
  if (!list.length) return null
  return (
    <ul data-testid="investigation-safety" className="flex flex-col gap-1.5 text-[11.5px] text-muted-foreground">
      {list.map((c) => {
        const info = CHECK_STATUS_INFO[c.status]
        return (
          <li key={c.key} data-testid="investigation-check" data-status={c.status} data-passed={c.status === "passed" ? "true" : "false"}>
            <span aria-hidden="true">{info.mark}</span> <span className="font-semibold text-foreground/85">{c.label}</span>{" "}
            <Chip tone={info.tone}>{info.label}</Chip>
            <div>{c.detail}</div>
            {c.action && <div className="text-[#ffb703]">What to do: {c.action}</div>}
          </li>
        )
      })}
    </ul>
  )
}

function Blockers({ blockers, requirements }) {
  const list = (Array.isArray(blockers) ? blockers : []).filter((b) => b && (b.message || b.code))
  const reqs = (Array.isArray(requirements) ? requirements : []).filter((q) => q && q.code)
  if (!list.length && !reqs.length) return null
  return (
    <Section title="Why this cannot be applied automatically yet" testId="investigation-blockers">
      {list.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {list.map((b, i) => (
            <li key={`${b.code}-${i}`} data-testid="investigation-blocker" data-code={b.code} className="text-[12px] text-foreground/85">
              <Chip tone="warn">{b.code}</Chip> {b.message}
              {b.action && <div className="text-[11.5px] text-[#ffb703]">What to do: {b.action}</div>}
            </li>
          ))}
        </ul>
      )}
      {reqs.length > 0 && (
        <details data-testid="investigation-requirements" className="text-[11.5px] text-muted-foreground">
          <summary className="cursor-pointer font-semibold">What Odito requires before it will apply a change ({reqs.filter((q) => q.met).length}/{reqs.length} met)</summary>
          <ul className="mt-1 flex flex-col gap-0.5">{reqs.map((q) => <li key={q.code} data-met={q.met ? "true" : "false"}>{q.met ? "✓" : "✗"} {q.label || q.code}{q.detail ? ` — ${q.detail}` : ""}</li>)}</ul>
        </details>
      )}
    </Section>
  )
}

const FIELD_LABELS = [["streetAddress", "Street address *"], ["addressLocality", "City *"], ["addressRegion", "State / region"], ["postalCode", "Postal code"], ["addressCountry", "Country"]]

function AddressPanel({ data, onConfirm, confirming, confirmError }) {
  const [form, setForm] = useState({ streetAddress: "", addressLocality: "", addressRegion: "", postalCode: "", addressCountry: "" })
  const [basis, setBasis] = useState(null)
  const candidates = Array.isArray(data.candidates) ? data.candidates : []
  const entity = data.entity || {}
  const confirmation = data.confirmation || {}
  const ready = form.streetAddress.trim() && form.addressLocality.trim()
  const entityProv = provenanceInfo(entity.present ? "observed" : "unknown")
  const missing = data.existingAddress?.state === "missing"
  const addrProv = provenanceInfo(missing ? "observed" : "unknown")
  const prefill = (c) => { setForm(Object.fromEntries(FIELD_LABELS.map(([k]) => [k, c.fields?.[k] || ""]))); setBasis(c.id) }
  const submit = (e) => {
    e.preventDefault()
    if (!ready || confirming) return
    onConfirm(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), basis)
  }
  return (
    <Section title="Business address" testId="investigation-address">
      <div data-testid="address-evidence" className="flex flex-col gap-1 text-[12px] text-foreground/85">
        <div><Chip tone={entityProv.tone}>{entityProv.label}</Chip> {entity.present ? <>Organization entity <span className="font-mono text-[11px]">{entity.id}</span> found in the page's raw HTML{entity.publishedBy === "rank_math" ? ", published by Rank Math" : ""}.</> : "No Organization entity was found."}</div>
        <div><Chip tone={addrProv.tone}>{addrProv.label}</Chip> {missing ? "The entity has no address property." : data.existingAddress?.state ? `Existing address: ${data.existingAddress.state}.` : "Whether the entity has an address is unknown."}</div>
        {confirmation.state === "confirmed_by_user" && (
          <div data-testid="address-confirmed"><Chip tone="info">{provenanceInfo("user_confirmed").label}</Chip> {confirmation.formatted || "An address"} — asserted by you{confirmation.confirmedAt ? ` on ${String(confirmation.confirmedAt).slice(0, 10)}` : ""}; not independently verified.</div>
        )}
      </div>

      {candidates.length > 0 && (
        <ul data-testid="address-candidates" className="flex flex-col gap-1.5">
          {candidates.map((c) => {
            const b = candidateBadge(c)
            return (
              <li key={c.id} data-testid="address-candidate" data-usable={c.usable ? "true" : "false"} className="rounded-lg border border-border p-2 text-[12px] text-foreground/85">
                <div className="flex flex-wrap items-center gap-2"><Chip tone={b.tone}>{b.label}</Chip><span className="text-[11px] text-muted-foreground">{c.sourceLabel}</span></div>
                <div className="mt-0.5">{c.formatted || "(no address text)"}</div>
                {!c.usable && c.notUsableBecause && <div className="text-[11px] text-[#ffb703]">Not used: {c.notUsableBecause}</div>}
                <button type="button" className="mt-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => prefill(c)}>Use this as a starting point</button>
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={submit} data-testid="address-form" className="flex flex-col gap-1.5">
        <p className="text-[11.5px] text-muted-foreground">Street address and city are required. Odito never fills in or guesses the other fields. You are stating that this is the business's address; Odito does not verify it, and confirming does not approve or change anything on your website.</p>
        {FIELD_LABELS.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">{label}
            <input type="text" value={form[k]} maxLength={200} aria-label={label} onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); if (basis) setBasis(null) }} className="rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground" />
          </label>
        ))}
        <div><button type="submit" className={BTN} disabled={!ready || confirming} data-testid="address-confirm">{confirming ? "Saving…" : confirmation.state === "confirmed_by_user" ? "Update confirmed address" : "Confirm this address"}</button></div>
        {confirmError && <p role="alert" data-testid="address-confirm-error" className="text-[11.5px] text-[#ff6080]">{errorMessage(confirmError)}</p>}
      </form>

      <div data-testid="address-guidance" className="flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
        {GUIDANCE_LABELS.filter(([k]) => data.guidance?.[k]).map(([k, label]) => <div key={k}><span className="font-semibold">{label}:</span> {data.guidance[k]}</div>)}
      </div>
      {data.rankMathRoute?.applicable && <p data-testid="address-route" className="text-[11.5px] text-muted-foreground">{data.rankMathRoute.reason}</p>}
    </Section>
  )
}

function Progress({ investigation, onCancel, cancelling }) {
  const rows = stageRows(investigation?.progress, investigation?.stage, investigation?.status)
  return (
    <div data-testid="investigation-progress" role="status" aria-live="polite" className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.stage} className="flex items-center gap-2 text-[12px]">
          {r.state === "done" ? <CheckCircle2 size={14} className="text-[#00f5a0]" /> : r.state === "running" ? <Loader2 size={14} className="animate-spin text-[#00dfff]" /> : r.state === "failed" ? <AlertTriangle size={14} className="text-[#ffb703]" /> : <Circle size={14} className="text-muted-foreground" />}
          <span className={r.state === "pending" ? "text-muted-foreground" : "text-foreground"}>{r.label}</span>
          {r.note && <span className="text-[11px] text-muted-foreground">{r.note}</span>}
        </div>
      ))}
      <div><button type="button" className={BTN} onClick={onCancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel"}</button></div>
    </div>
  )
}

function Disclosure({ title, meta, testId, open, onToggle, children }) {
  return (
    <details data-testid={testId} open={open} onToggle={onToggle} className="group rounded-lg border border-border bg-background/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-foreground/90 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">{meta}<span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span></span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-3 py-3">{children}</div>
    </details>
  )
}

function Result({ investigation, title, onRerun, rerunning, onConfirmAddress, confirmingAddress, confirmAddressError, onVerify, verifying, verifyError, onPrepare, preparing, prepared, prepareError, onApprove, approving, approveError }) {
  const r = investigation.result
  const [showEvidence, setShowEvidence] = useState(false)
  const view = presentResult(investigation, { prepared })
  const issueInfo = issueStatusInfo(r.issueStatus)
  const statusInfo = investigationStatusInfo(r.investigationStatus)
  const fix = eligibilityInfo(r.automaticFixEligibility)
  const cautions = cautionNotices(investigation).filter((n) => n.text !== view.notice?.text)
  const steps = lifecycleSteps(r.lifecycle)
  const stages = stageList(r.lifecycle)
  const addr = addressAnalysis(r)
  const now = Date.now()
  const checks = normalizeChecks(r.safetyChecks)
  const checkSum = checksSummary(r.safetyChecks)
  const otherBlockers = sortBlockers(r.blockers).filter((b) => b.code !== view.shownBlockerCode)
  const risks = r.risks || []
  const highRisks = risks.filter((x) => x.severity === "high")
  const otherRisks = risks.filter((x) => x.severity !== "high")
  const findings = r.findings?.length ? r.findings : (r.evidence || []).map((e) => ({ statement: e.finding, basis: "observed", evidenceIds: [e.evidenceId] }))
  const approval = approvalState({ lifecycle: r.lifecycle, prepared })
  const action = view.action
  const showAddressInline = view.awaitingInformation && !!addr

  return (
    <div data-testid="investigation-result" className="flex flex-col gap-3.5">
      {/* A. header: what, where, one status */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div data-testid="investigation-title" className="text-[13.5px] font-semibold leading-snug text-foreground">{title}</div>
          <div data-testid="investigation-page" className="truncate text-[11px] text-muted-foreground" title={investigation.pageUrl}>{pagePath(investigation.pageUrl)}</div>
        </div>
        <Chip tone={view.status.tone} data-testid="investigation-state" data-state={view.status.key}>{view.status.label}</Chip>
      </div>

      {/* E. the one contextual notice */}
      {view.notice && (
        <div role={view.notice.tone === "bad" ? "alert" : "status"} data-testid="investigation-notice" data-code={view.notice.code || undefined}
          className={`rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${view.notice.tone === "bad" ? "border-[rgba(255,56,96,0.22)] text-[#ff6080]" : view.notice.tone === "warn" ? "border-[rgba(255,183,3,0.25)] text-[#ffb703]" : "border-border text-muted-foreground"}`}>
          {view.notice.code && <span data-testid="investigation-blocker" data-code={view.notice.code} className="sr-only">{view.notice.code}</span>}
          {view.notice.text}
        </div>
      )}

      {/* B. what we found */}
      {view.found && (
        <div className="flex flex-col gap-0.5">
          <div className={LABEL}>What we found</div>
          <p className={BODY} data-testid="investigation-summary">{view.found}</p>
        </div>
      )}

      {/* C. recommended fix */}
      {view.fix && (
        <div className="flex flex-col gap-0.5" data-testid="investigation-solution">
          <div className={LABEL}>Recommended fix</div>
          <p className={BODY}>{view.fix}</p>
        </div>
      )}

      {highRisks.length > 0 && (
        <div role="status" data-testid="investigation-risks-high" className="rounded-lg border border-[rgba(255,56,96,0.22)] px-3 py-2 text-[12px] text-foreground/85">
          {highRisks.map((x, i) => <div key={i}><Chip tone="bad">high risk</Chip> {x.risk}{x.mitigation ? ` — ${x.mitigation}` : ""}</div>)}
        </div>
      )}

      {showAddressInline && <AddressPanel data={addr} onConfirm={onConfirmAddress} confirming={confirmingAddress} confirmError={confirmAddressError} />}

      {/* D. the primary action — only what the server's state allows */}
      {action && action.kind === "rerun" && (
        <div><button type="button" className={`${PRIMARY}`} onClick={onRerun} disabled={rerunning} data-testid="investigation-rerun">{action.label}</button></div>
      )}
      {action && action.kind === "verify" && (
        <div>
          <button type="button" className={BTN} onClick={onVerify} disabled={verifying || r.lifecycle?.verificationStatus === "pending"} data-testid="investigation-verify">{verifying || r.lifecycle?.verificationStatus === "pending" ? "Verifying…" : action.label}</button>
          {verifyError && <p role="alert" className="mt-1 text-[11.5px] text-[#ff6080]">{errorMessage(verifyError)}</p>}
        </div>
      )}
      {r.automaticFixEligibility?.eligible && (action?.kind === "prepare" || action?.kind === "approve" || prepared || r.lifecycle?.approval?.approved || r.lifecycle?.approval?.consumed) && (
        <div data-testid="investigation-prepare" className="flex flex-col gap-1.5">
          {prepared && <p role="status" data-testid="investigation-prepared" className="text-[12px] text-[#00f5a0]">Task ready{prepared.createdTask ? " (created)" : ""}.</p>}
          {action?.kind === "prepare" && !prepared && (
            <div className="flex flex-col gap-1"><button type="button" className={PRIMARY} onClick={onPrepare} disabled={preparing}>{preparing ? "Preparing…" : action.label}</button><span className="text-center text-[10.5px] text-muted-foreground">Preparing creates the task; nothing on your website changes.</span></div>
          )}
          {(action?.kind === "approve" || approval.key === "approved" || approval.key === "used") && (
            <div data-testid="investigation-approval" data-state={approval.key} className="flex flex-col gap-1">
              <Chip tone={approval.tone}>{approval.label}</Chip>
              {approval.key === "needs_approval" && (
                <>
                  <p className="text-[11.5px] text-muted-foreground">You are approving proposal <span className="font-mono">{String(r.proposal?.fingerprint || "").slice(0, 12)}</span> for this page. If anything changes, the approval no longer applies.</p>
                  <div><button type="button" className={PRIMARY} onClick={() => onApprove(r.proposal?.fingerprint)} disabled={approving || !r.proposal?.fingerprint}>{approving ? "Approving…" : action.label}</button></div>
                </>
              )}
            </div>
          )}
          {approveError && <p role="alert" data-testid="investigation-approve-error" className="text-[11.5px] text-[#ff6080]">{errorMessage(approveError)}</p>}
        </div>
      )}
      {prepareError && <p role="alert" data-testid="investigation-prepare-error" className="text-[11.5px] text-[#ff6080]">{errorMessage(prepareError)}</p>}
      {view.verifyHint && view.status.key !== "verified" && <p data-testid="investigation-verify-hint" className="text-[11px] text-muted-foreground">How to verify: {view.verifyHint}</p>}

      {/* progressive disclosure: everything else, collapsed, no empty sections */}
      <div className="flex flex-col gap-1.5">
        <Disclosure title="Technical details" testId="investigation-technical">
          {r.recommendedSolution?.routeNote && <p data-testid="investigation-route-note" className="text-[11.5px] text-muted-foreground">{r.recommendedSolution.routeNote}</p>}
          {r.discardedModelProposal?.length > 0 && (
            <div role="status" data-testid="investigation-discarded" className="rounded-lg border border-[rgba(255,183,3,0.25)] px-3 py-2 text-[12px] leading-relaxed text-[#ffb703]">
              The AI's draft code was withheld{r.discardedModelProposal[0]?.reason ? `: ${r.discardedModelProposal[0].reason}` : "."} Odito only shows changes it built itself from confirmed facts.
            </div>
          )}
          {r.codeOrConfiguration.length > 0 && (
            <div data-testid="investigation-code-section" className="flex flex-col gap-1.5">
              {r.codeOrConfiguration.map((b, i) => <CodeBlock key={i} block={b} />)}
            </div>
          )}
          {addr && !showAddressInline && <AddressPanel data={addr} onConfirm={onConfirmAddress} confirming={confirmingAddress} confirmError={confirmAddressError} />}
          <Blockers blockers={otherBlockers} requirements={r.automaticFixEligibility?.requirements} />
          <section data-testid="investigation-eligibility" className="flex flex-col gap-1.5">
            <div className={LABEL}>Automatic fix</div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={fix.tone}>{fix.label}</Chip>
              {r.requiresHumanApproval && <Chip tone="info"><ShieldCheck size={11} className="mr-1" />Needs your approval</Chip>}
            </div>
            {r.automaticFixEligibility?.reason && <p className="text-[11.5px] text-muted-foreground">{r.automaticFixEligibility.reason}</p>}
            {r.missingCapabilities?.length > 0 && <p className="text-[11.5px] text-[#ffb703]">Missing on this site: {r.missingCapabilities.join(", ")}</p>}
          </section>
          <p className="text-[10.5px] text-muted-foreground">Odito applies its own validated change for this issue, not the code shown here, and only after you approve it. Preparing creates the task; nothing on your website changes.</p>
        </Disclosure>

        {checks.length > 0 && (
          <Disclosure title="Validation checks" meta={<span data-testid="investigation-checks-summary">{checkSum.text}</span>} testId="investigation-safety-group">
            <ChecksList checks={r.safetyChecks} />
          </Disclosure>
        )}

        <Disclosure title="Evidence & diagnosis" meta={`Confidence: ${r.confidence?.label || "unknown"}`} testId="investigation-diagnosis">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={issueInfo.tone} data-testid="investigation-issue-status">{issueInfo.label}</Chip>
            <Chip tone={statusInfo.tone} data-testid="investigation-status">{statusInfo.label}</Chip>
            <Chip tone={r.confidence?.label === "high" ? "ok" : r.confidence?.label === "medium" ? "info" : "warn"}>Confidence: {r.confidence?.label || "unknown"}</Chip>
          </div>
          {cautions.map((n, i) => <div key={i} data-testid="investigation-caution" className="text-[11.5px] text-muted-foreground">{n.text}</div>)}
          {findings.length > 0 && (
            <Section title="Findings and how well they are supported" testId="investigation-findings">
              <ul className="flex flex-col gap-1.5">
                {findings.map((f, i) => {
                  const b = basisInfo(f.basis)
                  return (
                    <li key={i} data-testid="investigation-finding" data-basis={f.basis} className="text-[12px] text-foreground/85">
                      <Chip tone={b.tone} title={b.hint}>{b.label}{f.absence ? " · absence" : ""}</Chip> {f.statement}
                      {f.note && <div className="mt-0.5 text-[11px] text-[#ffb703]">{f.note}</div>}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
          {r.reviewItems?.length > 0 && (
            <Section title="Needs your review" testId="investigation-review">
              {r.reviewItems.map((ri) => (
                <div key={ri.evidenceId} className="rounded-lg border border-[rgba(255,183,3,0.25)] p-2.5 text-[12px] text-foreground/85">
                  <div className="font-semibold">{ri.summary}</div>
                  {ri.unresolved.map((u, i) => <div key={i} className="mt-1 text-[#ffb703]">Unresolved{u.position ? ` (level ${u.position})` : ""}: {u.reason}</div>)}
                  {ri.issues.map((u, i) => <div key={`i${i}`} className="mt-1 text-muted-foreground">{u}</div>)}
                  {ri.trail.length > 0 && <div className="mt-1 text-[11px] text-muted-foreground">Best available trail: {ri.trail.map((n) => `${n.name || "?"}${n.verified ? "" : " (unverified)"}`).join(" › ")}</div>}
                </div>
              ))}
            </Section>
          )}
          {(r.rootCause?.description || r.rootCause?.symptomVersusCause) && (
            <Section title="Root cause" testId="investigation-root-cause">
              <p className={BODY}>{r.rootCause.description}</p>
              {r.rootCause.symptomVersusCause && <p className="text-[11.5px] text-muted-foreground">{r.rootCause.symptomVersusCause}</p>}
            </Section>
          )}
          {r.recommendedSolution?.method && <div className="text-[11.5px] text-muted-foreground">Method: {methodLabel(r.recommendedSolution.method)}{r.recommendedSolution.rationale ? ` — ${r.recommendedSolution.rationale}` : ""}</div>}
          {(r.limitations.length > 0 || r.additionalEvidenceRequested.length > 0) && (
            <Section title="Limits of this diagnosis" testId="investigation-limitations">
              <ul className="flex flex-col gap-1">
                {r.limitations.map((l, i) => <li key={`l${i}`} className="text-[12px] text-muted-foreground">{l}</li>)}
                {r.additionalEvidenceRequested.map((l, i) => <li key={`a${i}`} className="text-[12px] text-[#ffb703]">Needed to be sure: {l}</li>)}
              </ul>
            </Section>
          )}
          <div>
            <button type="button" className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground" aria-expanded={showEvidence} onClick={() => setShowEvidence((v) => !v)} data-testid="investigation-evidence-toggle">
              {showEvidence ? "Hide" : "Show"} what was inspected ({investigation.evidence.length})
            </button>
            {showEvidence && (
              <ul data-testid="investigation-evidence" className="mt-2 flex flex-col gap-1.5">
                {investigation.evidence.map((e) => (
                  <li key={e.id} className="flex flex-col gap-0.5 rounded-lg border border-border bg-background/50 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-foreground"><span className="mr-1.5 font-mono text-[10.5px] text-muted-foreground">{e.id}</span>{evidenceKindLabel(e.kind)}</span>
                      <Chip tone={evidenceStatusTone(e.status)}>{e.status}</Chip>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{e.summary} · {describeFreshness(e, now)}</span>
                    {e.error && <span className="text-[11px] text-[#ffb703]">{e.error.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-[10.5px] text-muted-foreground">Master prompt v{investigation.promptVersion || "?"} · {investigation.planFamily || "general"}</div>
        </Disclosure>

        {otherRisks.length > 0 && (
          <Disclosure title="Risks" meta={`${otherRisks.length}`} testId="investigation-risks">
            <ul className="flex flex-col gap-1">{otherRisks.map((x, i) => <li key={i} className="text-[12px] text-foreground/85"><Chip tone={x.severity === "high" ? "bad" : x.severity === "medium" ? "warn" : "muted"}>{x.severity}</Chip> {x.risk}{x.mitigation ? ` — ${x.mitigation}` : ""}</li>)}</ul>
          </Disclosure>
        )}

        <Disclosure title="Status history" meta={view.status.label} testId="investigation-lifecycle">
          {stages ? (
            <ul className="flex flex-col gap-1" data-testid="investigation-stages">
              {stages.map((s) => (
                <li key={s.key} data-testid={`stage-${s.key}`} data-state={s.state} className="flex items-center gap-2 text-[12px]">
                  {s.done ? <CheckCircle2 size={14} className="text-[#00f5a0]" /> : s.tone === "bad" ? <AlertTriangle size={14} className="text-[#ff6080]" /> : s.tone === "warn" ? <AlertTriangle size={14} className="text-[#ffb703]" /> : s.tone === "info" ? <Loader2 size={14} className="animate-spin text-[#00dfff]" /> : <Circle size={14} className="text-muted-foreground" />}
                  <span className={s.done ? "text-foreground" : s.tone === "bad" ? "text-[#ff6080]" : "text-muted-foreground"}>{s.label}{s.failure?.message ? ` (${s.failure.message})` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              {steps.map((s) => (
                <li key={s.key} data-testid={`lifecycle-${s.key}`} data-done={s.done ? "true" : "false"} className="flex items-center gap-2 text-[12px]">
                  {s.done ? <CheckCircle2 size={14} className="text-[#00f5a0]" /> : s.tone === "bad" ? <AlertTriangle size={14} className="text-[#ff6080]" /> : s.tone === "info" ? <Loader2 size={14} className="animate-spin text-[#00dfff]" /> : <Circle size={14} className="text-muted-foreground" />}
                  <span className={s.done ? "text-foreground" : s.tone === "bad" ? "text-[#ff6080]" : "text-muted-foreground"}>{s.label}{s.note ? ` (${s.note})` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      </div>
    </div>
  )
}

export const PRIMARY_LABEL = "Investigate & Recommend"
export const PRIMARY_HINT = "Analyze the affected page, identify the root cause, and recommend the safest fix."

/**
 * The single AI action of the recommendation panel: "Investigate & Recommend".
 * It runs the evidence-driven investigation (live page, root cause, findings, recommended fix); there is no second "generate" button.
 * Nothing here changes the website. `onStatusChange` lets the parent know how this selection's investigation is doing.
 */
export default function InvestigationPanel({ projectId, issueId, pageUrl, ruleMetadata, issueSource, onStatusChange }) {
  const title = ruleMetadata?.title || humanizeIssueId(issueId)
  const inv = useInvestigation({ projectId, issueId, pageUrl, ruleMetadata, issueSource })
  const { investigation } = inv
  const active = inv.isActive
  const terminalFailure = investigation && (investigation.status === "failed" || investigation.status === "cancelled")
  const hasResult = investigation?.status === "completed" && investigation.result
  const failed = terminalFailure || !!inv.startError // a failed run OR a rejected start: the same action becomes "Retry"
  const limited = hasResult && ["blocked", "partial", "insufficient_evidence"].includes(investigation.result.investigationStatus)

  const reportedStatus = investigation?.status || (inv.isStarting ? "starting" : "idle")
  useEffect(() => { onStatusChange?.({ status: reportedStatus, completed: !!hasResult, investigationId: investigation?.id || null }) }, [reportedStatus, hasResult, investigation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pageUrl) return null

  const showPrimary = !hasResult
  return (
    <div data-testid="investigation-panel" className="flex flex-col gap-3">
      {showPrimary && (
        <>
          <button
            type="button" onClick={inv.start} disabled={active} data-testid="investigation-start" aria-busy={active}
            className={`${PRIMARY} flex items-center justify-center gap-2`}
          >
            {active
              ? <><Loader2 size={14} className="animate-spin" />Investigating page...</>
              : <><Search size={14} />{failed ? "Retry" : PRIMARY_LABEL}</>}
          </button>
          {!active && !failed && <div data-testid="investigation-hint" className="text-center text-[10.5px] leading-relaxed text-muted-foreground">{PRIMARY_HINT}</div>}
        </>
      )}

      {investigation && isActive(investigation.status) && <Progress investigation={investigation} onCancel={inv.cancel} cancelling={inv.isCancelling} />}

      {inv.startError && <div role="alert" data-testid="investigation-error" className="rounded-lg border border-[rgba(255,56,96,0.22)] px-3 py-2 text-[12px] text-[#ff6080]">{errorMessage(inv.startError)}</div>}
      {inv.loadError && (
        <div role="alert" data-testid="investigation-load-error" className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(255,56,96,0.22)] px-3 py-2 text-[12px] text-[#ff6080]">
          <span>Lost contact with the server while checking progress. {errorMessage(inv.loadError)}</span>
          <button type="button" className={BTN} onClick={inv.retryLoad}>Retry</button>
        </div>
      )}
      {terminalFailure && <div role="alert" data-testid="investigation-error" className="rounded-lg border border-[rgba(255,183,3,0.25)] px-3 py-2 text-[12px] text-[#ffb703]">{errorMessage(investigation.error || { code: investigation.status === "cancelled" ? "CANCELLED" : null })}</div>}

      {hasResult && (
        <>
          <Result investigation={investigation} title={title} onRerun={inv.start} rerunning={active} onConfirmAddress={inv.confirmAddress} confirmingAddress={inv.isConfirmingAddress} confirmAddressError={inv.confirmAddressError} onVerify={inv.verify} verifying={inv.isVerifying} verifyError={inv.verifyError} onPrepare={inv.prepare} preparing={inv.isPreparing} prepared={inv.prepared} prepareError={inv.prepareError} onApprove={inv.approve} approving={inv.isApproving} approveError={inv.approveError} />
          {!limited && <div><button type="button" className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground" onClick={inv.start} disabled={active} data-testid="investigation-rerun">Investigate again</button></div>}
        </>
      )}
    </div>
  )
}

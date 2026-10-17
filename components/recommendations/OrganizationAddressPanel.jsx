"use client"

import { memo, useId, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, MapPin, ShieldCheck } from "lucide-react"
import RecommendationCodeBlock from "./RecommendationCodeBlock"
import { ADDRESS_FIELDS, ADDRESS_FIELD_LABEL, extractIntentCode } from "./organizationIntent"
import { FIELD_LIMITS, emptyAddressForm, formEquals, formFromFields, validateAddressForm } from "./organizationAddress"
import { useConfirmOrganizationAddress } from "@/hooks/useConfirmOrganizationAddress"

// Same design tokens as SchemaIntentPanel / IssueRecommendationPanel (theme-aware CSS variables).
const LABEL = "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
const CARD = "rounded-xl border border-border bg-card/60 p-4"
const BODY = "text-[12.5px] leading-[1.65] text-foreground/80"
const INPUT = "w-full rounded-lg border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#7730ed]/50 disabled:opacity-60"
const GRADIENT_BTN = "w-full rounded-xl border-none bg-gradient-to-r from-[#7730ed] to-[#00dfff] py-3 text-[13px] font-bold text-white shadow-[0_0_20px_rgba(119,48,237,0.2)] transition-all duration-200 hover:shadow-[0_0_28px_rgba(119,48,237,0.35)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
const QUIET_BTN = "rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"

const TONES = {
  ok: "text-[#00f5a0] bg-[rgba(0,245,160,0.08)] border-[rgba(0,245,160,0.18)]",
  warn: "text-[#ffb703] bg-[rgba(255,183,3,0.08)] border-[rgba(255,183,3,0.2)]",
  bad: "text-[#ff6080] bg-[rgba(255,56,96,0.08)] border-[rgba(255,56,96,0.22)]",
  info: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
}

const Chip = ({ tone = "info", children, ...rest }) => (
  <span {...rest} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[tone] || TONES.info}`}>{children}</span>
)

// ── Before vs after: ONLY the lines that differ are highlighted; the unchanged entity is shown dimmed ───────────────
function DiffBlock({ lines }) {
  return (
    <pre data-testid="address-diff" className="max-h-72 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[11px] leading-[1.55]" aria-label="Before and after">
      {lines.map((l, i) => (
        <div
          key={i}
          data-diff={l.type}
          className={l.type === "add" ? "bg-[rgba(0,245,160,0.10)] text-[#00f5a0]" : l.type === "remove" ? "bg-[rgba(255,56,96,0.10)] text-[#ff6080]" : "text-muted-foreground/70"}
        >
          <span aria-hidden className="select-none pr-2">{l.type === "add" ? "+" : l.type === "remove" ? "−" : " "}</span>
          <span className="sr-only">{l.type === "add" ? "added: " : l.type === "remove" ? "removed: " : ""}</span>
          {l.text}
        </div>
      ))}
    </pre>
  )
}

// ── Confirm Address ───────────────────────────────────────────────────────────────────────────────────────────────
function ConfirmForm({ fix, projectId, selUrl, ruleMetadata, onRegenerated }) {
  const baseId = useId()
  const confirm = useConfirmOrganizationAddress({ projectId, pageUrl: selUrl })
  const starting = fix.suggestion?.fields || fix.alternatives?.[0]?.fields || {}
  const [form, setForm] = useState(() => formFromFields(starting))
  const [picked, setPicked] = useState(null) // { fields, source } — only while the form still equals it
  const [errors, setErrors] = useState({})
  const submitting = useRef(false)

  const set = (field, value) => {
    const next = { ...form, [field]: value }
    setForm(next)
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
    if (picked && !formEquals(next, formFromFields(picked.fields))) setPicked(null)
  }
  const use = (fields, source) => { setForm(formFromFields(fields)); setPicked({ fields, source }); setErrors({}) }

  const submit = (e) => {
    e.preventDefault()
    if (submitting.current || confirm.isPending) return
    const v = validateAddressForm(form)
    if (!v.ok) { setErrors(v.errors); return }
    submitting.current = true
    confirm.mutate(
      { address: v.fields, basisSource: picked?.source || undefined, ruleMetadata },
      { onSuccess: (response) => onRegenerated?.(response), onSettled: () => { submitting.current = false } },
    )
  }

  const choices = [
    ...fix.alternatives.map((a, i) => ({ key: `alt-${i}`, fields: a.fields, text: a.text, where: a.sources.join(", "), source: null, structured: true })),
    ...fix.candidates.filter((c) => c.structured && Object.keys(c.fields).length && c.trust !== "Not verified — not used as evidence").map((c) => ({ key: c.id, fields: c.fields, text: c.text, where: c.sourceLabel, source: c.source, structured: true })),
  ].filter((c, i, all) => all.findIndex((x) => x.text === c.text) === i)

  const serverMessage = confirm.isError ? (confirm.error?.message || "The address could not be confirmed.") : null

  return (
    <form onSubmit={submit} noValidate className="space-y-3" data-testid="address-confirm-form" aria-label="Confirm the business address">
      {choices.length > 0 && (
        <div data-testid="address-choices" className="space-y-1.5">
          <div className={LABEL}>Found — use one as a starting point</div>
          {choices.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/50 p-2.5">
              <div className="min-w-0 text-[12px]"><div className="break-words text-foreground">{c.text}</div><div className="text-[10.5px] text-muted-foreground">from {c.where}</div></div>
              <button type="button" className={QUIET_BTN} onClick={() => use(c.fields, c.source)} disabled={confirm.isPending}>Use this</button>
            </div>
          ))}
        </div>
      )}
      {fix.suggestion && (
        <p className="text-[11.5px] text-muted-foreground" data-testid="address-suggestion">
          Found, but incomplete: <span className="text-foreground">{fix.suggestion.text || "a partial address"}</span> — from {fix.suggestion.sources.join(", ")}. Enter the full address below; ODITO does not fill in the missing parts.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ADDRESS_FIELDS.map((f) => {
          const id = `${baseId}-${f}`
          const { required, label } = FIELD_LIMITS[f]
          return (
            <div key={f} className={f === "streetAddress" ? "sm:col-span-2" : ""}>
              <label htmlFor={id} className={LABEL}>{label}{required ? " *" : ""}</label>
              <input
                id={id}
                name={f}
                value={form[f]}
                onChange={(e) => set(f, e.target.value)}
                disabled={confirm.isPending}
                aria-required={required}
                aria-invalid={!!errors[f]}
                aria-describedby={errors[f] ? `${id}-err` : undefined}
                autoComplete="off"
                className={`${INPUT} mt-1 ${errors[f] ? "border-destructive" : "border-border"}`}
              />
              {errors[f] && <p id={`${id}-err`} role="alert" className="mt-1 text-[11px] text-destructive">{errors[f]}</p>}
            </div>
          )
        })}
      </div>

      {serverMessage && <div role="alert" data-testid="address-server-error" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-[11.5px] text-destructive">{serverMessage}</div>}

      <p className="text-[11px] text-muted-foreground">
        By confirming you tell ODITO this is the business&apos;s real address. It is saved as confirmed by you (not as externally verified) and used only to propose a change — your website is not modified.
      </p>
      <button type="submit" disabled={confirm.isPending} className={GRADIENT_BTN}>{confirm.isPending ? "Confirming…" : "Confirm Address"}</button>
    </form>
  )
}

/**
 * The Fix-with-AI content for ONE finding: "this Organization has no (complete) address". Everything shown comes from the
 * server's validated contract (`addressFix`): the browser derives no address, no source and no verdict.
 */
const OrganizationAddressPanel = memo(function OrganizationAddressPanel({ model, recommendation, projectId, selUrl, ruleMetadata, onRegenerated }) {
  const fix = model.addressFix
  const [showReview, setShowReview] = useState(false)
  const [hint, setHint] = useState(null)
  const code = fix.state === "ready" ? extractIntentCode(recommendation) : null
  const ready = fix.state === "ready" && fix.proposal && fix.diff

  const reviewAndApply = () => {
    const target = typeof document !== "undefined" ? document.querySelector('[data-testid="organization-fix-panel"]') : null
    if (target) { setHint(null); target.scrollIntoView?.({ behavior: "smooth", block: "start" }); return }
    setHint("To review the exact WordPress change, first create a task from this recommendation (below). The preview and the Apply step appear once WordPress with Rank Math is connected; otherwise use the manual steps here.")
  }

  return (
    <div className="space-y-3" data-testid="org-address-panel" data-state={fix.state}>
      {/* 1. Recommended change */}
      <section className={CARD} aria-labelledby="addr-change-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="addr-change-title" className={`${LABEL} flex items-center gap-1.5`}><MapPin size={12} /> Recommended change</h3>
          <div className="flex items-center gap-1.5">
            <Chip tone="info" data-testid="address-property-chip">address</Chip>
            <Chip tone={fix.tone} data-testid="address-state-chip">{fix.chip}</Chip>
          </div>
        </div>
        <p className={BODY} data-testid="address-missing">
          Add the <strong className="text-foreground">address</strong> property to your existing{" "}
          <strong className="text-foreground">{fix.entityTypes.join(" + ") || "Organization"}</strong> entity
          {fix.entityId ? <> (<span className="break-all font-mono text-[11px]">{fix.entityId}</span>)</> : null}.{" "}
          {fix.current.state === "incomplete" ? `It currently publishes an incomplete address (missing ${fix.current.missingParts.join(" and ")}).` : "It currently has no address."}
          {fix.confirmedByEvidence && <span className="text-muted-foreground"> This was confirmed from the markup ODITO crawled, not assumed.</span>}
        </p>

        {ready ? (
          <div className="mt-3" data-testid="address-proposal">
            <div className="mb-1.5 flex items-center gap-2"><div className={LABEL}>Proposed value</div><Chip tone="ok">{fix.proposal.statusLabel}</Chip></div>
            <table className="w-full text-left text-[12px]">
              <tbody>
                {Object.entries(fix.proposal.fields).map(([f, v]) => (
                  <tr key={f} className="align-top" data-testid={`address-field-${f}`}>
                    <th scope="row" className="w-32 py-1 pr-2 text-[11px] font-semibold text-muted-foreground">{ADDRESS_FIELD_LABEL[f]}</th>
                    <td className="py-1 pr-2 break-words text-foreground">{v}</td>
                    <td className="py-1 text-[10.5px] text-muted-foreground">from {fix.proposal.fieldSources[f] || "the evidence"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fix.proposal.completes?.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">The parts the entity already has are kept; ODITO adds only the missing ones.</p>}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.05)] p-3" data-testid="address-unavailable">
            <p className="flex items-start gap-1.5 text-[12px] text-[#ffb703]"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> No address can be proposed yet.</p>
            {fix.message && <p className="mt-1 text-[11.5px] text-foreground/80">{fix.message}</p>}
          </div>
        )}
      </section>

      {/* 2. Evidence source */}
      <section className={CARD} aria-labelledby="addr-evidence-title" data-testid="address-evidence">
        <h3 id="addr-evidence-title" className={`${LABEL} mb-2 flex items-center gap-1.5`}><ShieldCheck size={12} /> Evidence source</h3>
        {fix.candidates.length === 0 ? (
          <p className={BODY}>ODITO looked at your Organization markup, the other pages of your site, the business you selected for this project, your connected Business Profile and the details you entered in ODITO. None of them holds an address.</p>
        ) : (
          <ul className="space-y-2">
            {fix.candidates.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-background/50 p-2.5" data-testid="address-candidate" data-trust={c.trustTone}>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground">From {c.sourceLabel}</span>
                  <Chip tone={c.trustTone}>{c.trust}</Chip>
                </div>
                <div className="mt-1 break-words text-[12px] text-foreground/90">{c.text}</div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">{c.kind}{!c.structured ? " · free text (not structured)" : !c.complete ? " · incomplete (needs a street and a city)" : ""}</div>
                {c.detail && <div className="mt-0.5 text-[10.5px] text-[#ffb703]">{c.detail}</div>}
                {c.note && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{c.note}</div>}
              </li>
            ))}
          </ul>
        )}
        {fix.notes.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-border bg-background/50 p-2.5 text-[11.5px] text-muted-foreground" data-testid="address-notes">
            <Info size={13} className="mt-0.5 shrink-0" /><div className="space-y-1">{fix.notes.map((n, i) => <p key={i}>{n}</p>)}</div>
          </div>
        )}
      </section>

      {/* 3. Before vs after — only when there is a validated proposal */}
      {ready && (
        <section className={CARD} aria-labelledby="addr-diff-title">
          <h3 id="addr-diff-title" className={`${LABEL} mb-2`}>Before vs after</h3>
          <p className="mb-2 text-[11.5px] text-muted-foreground" data-testid="address-diff-summary">
            Only the highlighted lines change. The entity keeps its @id, its type and every other property; no second entity is created.
          </p>
          <DiffBlock lines={fix.diff.lines} />
        </section>
      )}

      {/* 4. Actions */}
      <section className={CARD} aria-labelledby="addr-actions-title" data-testid="address-actions" data-action={fix.action}>
        <h3 id="addr-actions-title" className={`${LABEL} mb-2`}>{fix.actionLabel}</h3>

        {fix.action === "review_and_apply" && (
          <div className="space-y-3">
            <button type="button" className={GRADIENT_BTN} onClick={reviewAndApply} data-testid="address-review-apply">Review &amp; Apply</button>
            {hint && <p role="status" data-testid="address-apply-hint" className="text-[11.5px] text-muted-foreground">{hint}</p>}
            <p className="text-[11px] text-muted-foreground" data-testid="address-approval-note">
              Review &amp; Apply shows the exact WordPress change and asks for your approval first. Nothing is written until you approve it, and the result is checked against your live page afterwards.
            </p>
            <details className="rounded-lg border border-border bg-background/40 p-3" data-testid="address-manual">
              <summary className="cursor-pointer text-[12px] font-semibold text-foreground">Apply it manually instead</summary>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Replace your existing entity with the merged one below (same @id) — do not add it next to the old one. If your SEO plugin generates the entity, set the address in its organization / local-business settings instead.</p>
              {code && <div className="mt-2"><RecommendationCodeBlock type="html" content={code} /></div>}
            </details>
          </div>
        )}

        {fix.action === "confirm_address" && (
          <ConfirmForm
            key={`${fix.state}:${fix.suggestion?.text || ""}:${fix.alternatives.length}`}
            fix={fix}
            projectId={projectId}
            selUrl={selUrl}
            ruleMetadata={ruleMetadata}
            onRegenerated={onRegenerated}
          />
        )}

        {fix.action === "review_changes" && (
          <div className="space-y-2">
            <button type="button" className={QUIET_BTN} onClick={() => setShowReview((v) => !v)} aria-expanded={showReview} data-testid="address-review-changes">{showReview ? "Hide details" : "Review Changes"}</button>
            {showReview && (
              <ul data-testid="address-review-reasons" className="list-disc space-y-1 pl-4 text-[12px] text-foreground/80">
                {[fix.message, ...fix.validationErrors].filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">No change is offered until this is resolved. Nothing has been changed on your website.</p>
          </div>
        )}
      </section>

      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground" data-testid="schema-not-deployed">
        <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
        <span>This is a recommendation. Generating it does not modify your website. Odito re-checks the page&apos;s real markup after the change is applied and your next recrawl before it reports anything as fixed.</span>
      </p>
    </div>
  )
})

export default OrganizationAddressPanel

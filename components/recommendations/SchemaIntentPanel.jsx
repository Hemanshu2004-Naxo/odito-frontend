"use client"

import { memo, useCallback, useState } from "react"
import { Check, Copy, Info, ShieldCheck } from "lucide-react"
import RecommendationCodeBlock from "./RecommendationCodeBlock"
import { extractIntentCode } from "./organizationIntent"
import OrganizationAddressPanel from "./OrganizationAddressPanel"

// Same design tokens as IssueRecommendationPanel (theme-aware CSS variables).
const LABEL = "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
const CARD = "rounded-xl border border-border bg-card/60 p-4"
const BODY = "text-[12.5px] leading-[1.65] text-foreground/80"

const TONES = {
  generate: "text-[#00f5a0] bg-[rgba(0,245,160,0.08)] border-[rgba(0,245,160,0.18)]",
  reuse: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
  reference: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
  needs_input: "text-[#ffb703] bg-[rgba(255,183,3,0.08)] border-[rgba(255,183,3,0.2)]",
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable: the code stays selectable in the block */ }
  }, [text])
  return (
    <button type="button" onClick={copy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      {copied ? <Check size={11} className="text-[#00f5a0]" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy JSON-LD"}
    </button>
  )
}

function List({ items, testId }) {
  if (!items.length) return null
  return (
    <ul className="space-y-1.5" data-testid={testId}>
      {items.map((t, i) => (
        <li key={i} className={`${BODY} flex gap-2`}><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" /><span>{t}</span></li>
      ))}
    </ul>
  )
}

/**
 * Shows the server's schema-intent decision for organization_schema: WHICH entity was chosen and why, what it was built
 * from, what is still missing, and the validated JSON-LD (or a request for information / an explanation of reuse).
 * Nothing here deploys anything — the notice at the bottom says so.
 */
const SchemaIntentPanel = memo(function SchemaIntentPanel({ model, recommendation, projectId = null, selUrl = null, ruleMetadata = null, onRegenerated = null }) {
  // "This Organization has no (complete) address": the finding has its own contract, evidence, diff and actions.
  if (model.addressFix) {
    return <OrganizationAddressPanel model={model} recommendation={recommendation} projectId={projectId} selUrl={selUrl} ruleMetadata={ruleMetadata} onRegenerated={onRegenerated} />
  }
  const code = model.hasCode ? extractIntentCode(recommendation) : null

  return (
    <div className="space-y-3" data-testid="schema-intent-panel" data-intent={model.intent} data-state={model.state}>
      <section className={CARD} aria-labelledby="schema-intent-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="schema-intent-title" className={LABEL}>Recommended schema type</h3>
          <div className="flex items-center gap-1.5">
            <span data-testid="schema-type-chip" className="inline-flex items-center rounded-full border border-[rgba(119,48,237,0.3)] bg-[rgba(119,48,237,0.08)] px-2 py-0.5 text-[10px] font-bold text-[#b580ff]">{model.type}</span>
            <span data-testid="schema-state-chip" className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[model.state] || TONES.reuse}`}>{model.stateLabel}</span>
          </div>
        </div>
        <p className="mb-2 text-[11px] font-semibold text-foreground">Why {model.type}?</p>
        <List items={model.reasons} testId="schema-reasons" />
        {model.notes.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg border border-border bg-background/50 p-2.5 text-[11.5px] text-muted-foreground" data-testid="schema-notes">
            <Info size={13} className="mt-0.5 shrink-0" />
            <div className="space-y-1">{model.notes.map((n, i) => <p key={i}>{n}</p>)}</div>
          </div>
        )}
      </section>

      {model.state === "needs_input" && (
        <section className="rounded-xl border border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.05)] p-4" data-testid="schema-needs-input">
          <h3 className="mb-2 text-[12.5px] font-bold text-[#ffb703]">Information needed before markup can be written</h3>
          <ul className="space-y-2">
            {model.missing.map((m) => (
              <li key={m.field} className={BODY}><strong className="text-foreground">{m.label}</strong> — {m.why}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-muted-foreground">No JSON-LD is shown because it would require a detail ODITO cannot verify. Add it to your site (or your SEO plugin&apos;s local-business settings), then regenerate.</p>
        </section>
      )}

      {(model.state === "reuse" || model.state === "reference") && (
        <section className={CARD} data-testid="schema-reuse">
          <h3 className={`${LABEL} mb-2`}>{model.state === "reuse" ? "Existing entity is reused" : "No standalone entity needed here"}</h3>
          <p className={BODY}>
            {model.state === "reuse"
              ? `This page already declares ${model.types.join(" + ")}. ODITO keeps it exactly as it is — no second entity is created.`
              : `The site's ${model.types.join(" + ")} entity is declared once${model.reuse?.pageUrl ? ` on ${model.reuse.pageUrl}` : ""}. Other pages can point to it instead of repeating it.`}
          </p>
          {model.id && <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground" data-testid="schema-reused-id">@id {model.id}</p>}
        </section>
      )}

      {model.state === "generate" && (
        <section className={CARD} data-testid="schema-generated">
          <div className="mb-3 flex items-center justify-between">
            <h3 className={LABEL}>{model.extending ? "Updated entity (merge into your existing markup)" : "Validated JSON-LD"}</h3>
            {code && <CopyButton text={code} />}
          </div>
          {model.extending && model.delta.length > 0 && (
            <p className="mb-2 text-[11.5px] text-muted-foreground" data-testid="schema-delta">Changes only: {model.delta.map((d) => `${d.field} (${d.kind === "add" ? "added" : d.kind === "remove" ? "removed" : "updated"})`).join(", ")}. Your other properties stay.</p>
          )}
          {model.placement === "homepage" && <p className="mb-2 text-[11.5px] text-muted-foreground" data-testid="schema-placement">Add this to your homepage — the business entity is declared once, not on every page.</p>}
          {code ? <RecommendationCodeBlock type="html" content={code} /> : <p className="text-[12px] text-muted-foreground">The JSON-LD was not returned. Regenerate to try again.</p>}
        </section>
      )}

      {model.factsUsed.length > 0 && model.state !== "reference" && (
        <section className={CARD} data-testid="schema-facts">
          <h3 className={`${LABEL} mb-2 flex items-center gap-1.5`}><ShieldCheck size={12} /> Verified details used</h3>
          <ul className="space-y-1.5">
            {model.factsUsed.map((f, i) => (
              <li key={i} className={BODY}><strong className="text-foreground">{f.label}</strong>{f.value ? `: ${f.value}` : ""} <span className="text-muted-foreground">— from {f.source}</span></li>
            ))}
          </ul>
          {model.optional.length > 0 && <p className="mt-3 text-[11.5px] text-muted-foreground" data-testid="schema-optional">Not included because ODITO could not verify it: {model.optional.join(", ")}.</p>}
        </section>
      )}

      <p className="rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground" data-testid="schema-not-deployed">
        This is a recommendation. Nothing has been added to your website. Odito re-checks the page&apos;s real markup after your next recrawl before it reports anything as fixed.
      </p>
    </div>
  )
})

export default SchemaIntentPanel

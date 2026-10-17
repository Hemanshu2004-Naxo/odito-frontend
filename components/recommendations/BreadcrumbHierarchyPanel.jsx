"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, ArrowDown, ArrowUp, Check, CheckCircle2, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import RecommendationCodeBlock from "./RecommendationCodeBlock"
import { useRegenerateBreadcrumbHierarchy } from "@/hooks/useBreadcrumbHierarchy"
import { useBreadcrumbDiscovery, useRefreshBreadcrumbDiscovery } from "@/hooks/useBreadcrumbDiscovery"
import {
  MAX_ITEMS, MAX_NAME, ORIGIN_LABEL, addParent, describeDiscovery, discoveryStartItems, hasErrors, initialFormItems, mapServerErrors, moveParent,
  originTone, parseGeneratedBreadcrumb, removeParent, summarizeGenerated, toPayloadItems, validateItems,
} from "./breadcrumbHierarchy"

// Same design tokens as IssueRecommendationPanel (theme-aware CSS variables, dark-theme friendly).
const LABEL = "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
const CARD = "rounded-xl border border-border bg-card/60 p-4"
const INPUT = "w-full rounded-lg border bg-background px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#7730ed]/50 disabled:opacity-60"
const ICON_BTN = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#7730ed]/50 disabled:cursor-not-allowed disabled:opacity-35"
const GRADIENT_BTN = "w-full rounded-xl border-none bg-gradient-to-r from-[#7730ed] to-[#00dfff] py-3 text-[13px] font-bold text-white shadow-[0_0_20px_rgba(119,48,237,0.2)] transition-all duration-200 hover:shadow-[0_0_28px_rgba(119,48,237,0.35)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"

function Pill({ tone, children }) {
  const tones = {
    ok: "text-[#00f5a0] bg-[rgba(0,245,160,0.08)] border-[rgba(0,245,160,0.18)]",
    warn: "text-[#ffb703] bg-[rgba(255,183,3,0.08)] border-[rgba(255,183,3,0.2)]",
    info: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
    bad: "text-[#ff6080] bg-[rgba(255,56,96,0.08)] border-[rgba(255,56,96,0.22)]",
    muted: "text-muted-foreground bg-muted border-border",
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${tones[tone] || tones.muted}`}>{children}</span>
}

// ── Discovery ────────────────────────────────────────────────────────────────

/** Status of what Odito found on the page, with the evidence behind it. Compact: one headline, one sentence, a few notes. */
function DiscoveryCard({ info, discovery, onLookAgain, refreshing, children }) {
  return (
    <div className={CARD} data-testid="breadcrumb-discovery" data-state={info.state}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <Pill tone={info.tone}>{info.label}</Pill>
        {onLookAgain && (
          <button type="button" onClick={onLookAgain} disabled={refreshing} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50">
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Looking again…" : "Look again"}
          </button>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-foreground/80" data-testid="breadcrumb-discovery-text">{info.text}</p>
      {(info.evidence || []).map((e) => <p key={e} className="mt-1 text-[11.5px] text-muted-foreground">{e}</p>)}
      {(info.notes || []).map((n) => <p key={n} className="mt-1 text-[11.5px] text-[#ffb703]">{n}</p>)}
      {discovery?.sources?.fetched?.length > 0 && (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground" data-testid="breadcrumb-discovery-sources">
          Looked at {discovery.sources.fetched.filter((f) => f.status === "ok").length} page{discovery.sources.fetched.filter((f) => f.status === "ok").length === 1 ? "" : "s"} of your site{discovery.sources.crawl?.hasBreadcrumbJsonLd ? " and the stored crawl" : ""}. Nothing was changed.
        </p>
      )}
      {children}
    </div>
  )
}

/** already_valid / conflict: nothing to enter. Say what the page has, never offer a second BreadcrumbList. */
function DiscoveryOutcome({ info, discovery, onLookAgain, refreshing }) {
  const trail = discovery.recommended?.items || []
  return (
    <DiscoveryCard info={info} discovery={discovery} onLookAgain={onLookAgain} refreshing={refreshing}>
      {info.state === "already_valid" && trail.length > 0 && (
        <ol className="mt-2 space-y-0.5 text-[12px]" aria-label="Breadcrumb trail already on the page" data-testid="breadcrumb-existing-trail">
          {trail.map((i, n) => <li key={`${n}-${i.url}`} className="flex gap-2"><span className="text-muted-foreground">{n + 1}.</span><span className="font-medium text-foreground">{i.name}</span><span className="truncate font-mono text-[11px] text-muted-foreground">{i.url}</span></li>)}
        </ol>
      )}
      {info.state === "conflict" && discovery.conflict?.problems?.length > 0 && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">Problems found: <span className="font-mono">{discovery.conflict.problems.join(", ")}</span></p>
      )}
    </DiscoveryCard>
  )
}

// ── The form ─────────────────────────────────────────────────────────────────

function HierarchyForm({ projectId, selUrl, model, ruleMetadata, onRegenerated, onCancel, discoveryProps }) {
  const uid = useId()
  const [items, setItems] = useState(() => initialFormItems(model))
  // The form starts from what discovery found — once, and never over something the person has already typed or changed.
  const touched = useRef(false)
  const startItems = discoveryProps?.startItems || null
  useEffect(() => {
    if (startItems && !touched.current) setItems(startItems)
  }, [startItems])
  const edit = (updater) => { touched.current = true; setItems(updater) }
  const [errors, setErrors] = useState({ fieldErrors: {}, formErrors: [] })
  const [serverMessage, setServerMessage] = useState(null)
  const submitting = useRef(false)
  const formRef = useRef(null)
  const mutation = useRegenerateBreadcrumbHierarchy({ projectId, pageUrl: selUrl })
  const pending = mutation.isPending
  const lastIndex = items.length - 1

  const setField = useCallback((id, field, value) => {
    touched.current = true
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
    setErrors((prev) => (prev.fieldErrors[id]?.[field]
      ? { ...prev, fieldErrors: { ...prev.fieldErrors, [id]: { ...prev.fieldErrors[id], [field]: undefined } } }
      : prev))
  }, [])

  const focusFirstInvalid = (fieldErrors) => {
    const first = items.find((it) => fieldErrors[it.id]?.name || fieldErrors[it.id]?.url)
    if (!first) return
    const field = fieldErrors[first.id].name ? "name" : "url"
    requestAnimationFrame(() => formRef.current?.querySelector(`#${CSS.escape(`${uid}-${first.id}-${field}`)}`)?.focus())
  }

  const submit = (event) => {
    event.preventDefault()
    if (pending || submitting.current) return // never send a duplicate request
    setServerMessage(null)
    const found = validateItems(items, { canonicalUrl: model.canonicalUrl, crawlUrl: model.crawlUrl })
    if (hasErrors(found)) { setErrors(found); focusFirstInvalid(found.fieldErrors); return }
    setErrors({ fieldErrors: {}, formErrors: [] })
    submitting.current = true
    mutation.mutate({ items: toPayloadItems(items), ruleMetadata }, {
      onSuccess: (response) => { submitting.current = false; onRegenerated?.(response) },
      onError: (error) => {
        submitting.current = false
        if (error?.name === "AbortError") return
        // The entered values are kept either way; only the messages change.
        if (error?.status === 422 && Array.isArray(error.errors)) {
          const mapped = mapServerErrors(error, items)
          setErrors(mapped)
          focusFirstInvalid(mapped.fieldErrors)
        } else {
          setServerMessage(error?.message || "The hierarchy could not be saved. Please try again.")
        }
      },
    })
  }

  const parentCount = items.length - 1
  const canonicalHint = model.canonicalTrusted
    ? <>Verified canonical URL from your site. Odito never changes it.</>
    : <>No canonical tag was found for this page. Enter this page&apos;s exact URL to confirm it — Odito will not assume the crawl address (<span className="font-mono">{model.crawlUrl}</span>) is the published one.</>

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending} data-testid="breadcrumb-hierarchy-form" className={`${CARD} space-y-4`}>
      <div>
        <h3 className="text-[13px] font-bold text-foreground">Complete Your Breadcrumb Hierarchy</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Provide the verified pages that lead to this page. Odito will use these details to generate BreadcrumbList structured data.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#ffb703]">
          Odito only uses pages it found or you confirm — it will not guess your parent pages.
          {model.savedStale && " Your previously saved hierarchy no longer ends at this page's canonical URL, so it was not reused."}
        </p>
      </div>
      {discoveryProps && <DiscoveryCard info={discoveryProps.info} discovery={discoveryProps.data} onLookAgain={discoveryProps.onLookAgain} refreshing={discoveryProps.refreshing} />}

      {(errors.formErrors.length > 0 || serverMessage) && (
        <div role="alert" data-testid="breadcrumb-form-errors" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-[11.5px] text-destructive">
          {errors.formErrors.map((m) => <div key={m}>{m}</div>)}
          {serverMessage && <div>{serverMessage}</div>}
        </div>
      )}

      <fieldset disabled={pending} className="space-y-3 border-0 p-0">
        <legend className="sr-only">Breadcrumb items, in order from the first page to the current page</legend>
        <ol className="space-y-3">
          {items.map((it, index) => {
            const isCurrent = index === lastIndex
            const fe = errors.fieldErrors[it.id] || {}
            const nameId = `${uid}-${it.id}-name`
            const urlId = `${uid}-${it.id}-url`
            return (
              <li key={it.id} data-testid={isCurrent ? "breadcrumb-row-current" : "breadcrumb-row"} className={`rounded-lg border p-3 ${isCurrent ? "border-[rgba(0,223,255,0.25)] bg-[rgba(0,223,255,0.04)]" : "border-border"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={LABEL}>
                    {index + 1}. {isCurrent ? "This page (being audited)" : "Parent page"}
                    {!isCurrent && it.origin !== "manual" && <span className="ml-2 align-middle" data-testid="breadcrumb-origin"><Pill tone={originTone(it.orig && (it.orig.name !== it.name.trim() || it.orig.url !== it.url.trim()) ? "edited" : it.origin)}>{ORIGIN_LABEL[it.orig && (it.orig.name !== it.name.trim() || it.orig.url !== it.url.trim()) ? "edited" : it.origin]}</Pill></span>}
                  </span>
                  {isCurrent ? <Pill tone="info">Current page</Pill> : (
                    <div className="flex items-center gap-1" role="group" aria-label={`Reorder or remove item ${index + 1}`}>
                      <button type="button" className={ICON_BTN} aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => edit((p) => moveParent(p, index, -1))}><ArrowUp size={14} /></button>
                      <button type="button" className={ICON_BTN} aria-label={`Move item ${index + 1} down`} disabled={index >= lastIndex - 1} onClick={() => edit((p) => moveParent(p, index, 1))}><ArrowDown size={14} /></button>
                      <button type="button" className={ICON_BTN} aria-label={`Remove item ${index + 1}`} disabled={parentCount <= 1} onClick={() => edit((p) => removeParent(p, index))}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <div>
                    <label htmlFor={nameId} className={LABEL}>Page name</label>
                    <input id={nameId} value={it.name} maxLength={MAX_NAME + 20} autoComplete="off" placeholder={isCurrent ? "e.g. Blog" : "e.g. Home"}
                      onChange={(e) => setField(it.id, "name", e.target.value)}
                      aria-invalid={!!fe.name} aria-describedby={fe.name ? `${nameId}-err` : undefined}
                      className={`${INPUT} mt-1 ${fe.name ? "border-destructive" : "border-border"}`} />
                    {fe.name && <p id={`${nameId}-err`} className="mt-1 text-[11px] text-destructive">{fe.name}</p>}
                  </div>
                  <div>
                    <label htmlFor={urlId} className={LABEL}>Page URL</label>
                    <input id={urlId} type="url" inputMode="url" value={it.url} autoComplete="off" spellCheck={false} placeholder="https://example.com/page/"
                      onChange={(e) => setField(it.id, "url", e.target.value)}
                      aria-invalid={!!fe.url} aria-describedby={[fe.url ? `${urlId}-err` : null, isCurrent ? `${urlId}-hint` : null].filter(Boolean).join(" ") || undefined}
                      className={`${INPUT} mt-1 font-mono ${fe.url ? "border-destructive" : "border-border"}`} />
                    {isCurrent && <p id={`${urlId}-hint`} className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">{canonicalHint}</p>}
                    {!isCurrent && it.evidence && <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground" data-testid="breadcrumb-evidence">{it.evidence}</p>}
                    {!isCurrent && !it.url.trim() && it.urlSuggestion && (
                      <button type="button" className="mt-1 rounded-md border border-border px-2 py-1 text-left text-[11px] font-semibold text-foreground hover:bg-accent" data-testid="breadcrumb-url-suggestion"
                        onClick={() => setField(it.id, "url", it.urlSuggestion.url)}>
                        Use {it.urlSuggestion.url} <span className="font-normal text-muted-foreground">— {it.urlSuggestion.evidence}</span>
                      </button>
                    )}
                    {fe.url && <p id={`${urlId}-err`} className="mt-1 text-[11px] text-destructive">{fe.url}</p>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <button type="button" onClick={() => edit(addParent)} disabled={items.length >= MAX_ITEMS}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#7730ed]/50 disabled:cursor-not-allowed disabled:opacity-40">
          <Plus size={13} /> Add parent page
        </button>
      </fieldset>

      <div className="space-y-2">
        <button type="submit" disabled={pending} className={GRADIENT_BTN}>
          {pending ? "Generating…" : "Generate BreadcrumbList"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className="w-full rounded-lg border border-border bg-muted py-2 text-[12px] font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50">
            Cancel
          </button>
        )}
        <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground">
          Odito does not open the URLs you type, change your website, or start a new audit.
        </p>
        <p className="sr-only" role="status" aria-live="polite">{pending ? "Generating the BreadcrumbList" : ""}</p>
      </div>
    </form>
  )
}

// ── The generated result ─────────────────────────────────────────────────────

function CopyCodeButton({ text }) {
  const [state, setState] = useState("idle")
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); setTimeout(() => setState("idle"), 1800) } catch { setState("failed") }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-[#7730ed]/50">
      {state === "copied" ? <Check size={13} className="text-[#00f5a0]" /> : <Copy size={13} />}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed — select the code manually" : "Copy Code"}
    </button>
  )
}

function GeneratedResult({ recommendation, model, onEdit }) {
  const code = recommendation?.sections?.implementationExample?.content || ""
  const json = useMemo(() => parseGeneratedBreadcrumb(code), [code])
  const summary = useMemo(() => summarizeGenerated(json), [json])
  const last = json?.itemListElement?.[json.itemListElement.length - 1]
  const matchesCanonical = !!(last && model.canonicalUrl && last.item.replace(/\/+$/, "") === model.canonicalUrl.replace(/\/+$/, ""))
  const valid = !!(summary && summary.consecutive && summary.uniqueUrls && summary.allAbsolute && summary.itemCount >= 2)

  return (
    <div className="space-y-3" data-testid="breadcrumb-generated">
      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-foreground">BreadcrumbList generated from your hierarchy</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {valid ? <Pill tone="ok">Validated</Pill> : <Pill tone="warn">Could not be validated</Pill>}
            <Pill tone="warn">Not applied to your site yet</Pill>
          </div>
        </div>

        {json && (
          <ol className="mb-3 space-y-1 text-[12px]" aria-label="Breadcrumb trail">
            {json.itemListElement.map((i) => (
              <li key={i.position} className="flex gap-2"><span className="text-muted-foreground">{i.position}.</span><span className="font-medium text-foreground">{i.name}</span><span className="truncate font-mono text-[11px] text-muted-foreground">{i.item}</span></li>
            ))}
          </ol>
        )}

        {valid && (
          <ul className="mb-3 space-y-1 text-[11.5px] text-muted-foreground" data-testid="breadcrumb-validation">
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[#00f5a0]" /> Valid JSON-LD, type BreadcrumbList, {summary.itemCount} items</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[#00f5a0]" /> Positions run 1–{summary.itemCount} in order; every URL is absolute and unique</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[#00f5a0]" /> {matchesCanonical ? "The last item is this page's verified canonical URL" : "The last item is this page, as you confirmed it"}</li>
          </ul>
        )}

        <RecommendationCodeBlock type="html" content={code} />

        <div className="mt-3 flex flex-wrap gap-2">
          <CopyCodeButton text={code} />
          <button type="button" onClick={onEdit} className="rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Edit hierarchy</button>
        </div>
      </div>

      <div className="rounded-xl border border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.05)] p-3.5 text-[11.5px] leading-relaxed text-foreground/80" data-testid="breadcrumb-guidance">
        <div className="mb-1 font-semibold text-[#ffb703]">This has not been published</div>
        <ul className="list-disc space-y-1 pl-4">
          <li>Generating or copying this code does not change your website, and the task stays as it is.</li>
          <li>Add it in <strong>one</strong> of two ways — never both, or the page outputs two BreadcrumbList entities: turn on breadcrumbs in your SEO plugin (it builds the trail from your real page structure), or paste this JSON-LD into the page&apos;s <code>&lt;head&gt;</code>.</li>
          <li>Odito marks it fixed only after a recrawl finds the correct trail live on the page. Until then it stays pending.</li>
        </ul>
      </div>
    </div>
  )
}

// ── Conflict ─────────────────────────────────────────────────────────────────

function ConflictNotice({ model, onEdit }) {
  const kind = model.conflict?.kind
  return (
    <div className={`${CARD} space-y-3`} data-testid="breadcrumb-conflict">
      <div className="flex items-center gap-2"><AlertCircle size={14} className="text-[#ffb703]" /><h3 className="text-[13px] font-bold text-foreground">This page already outputs a BreadcrumbList</h3></div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {kind === "existing_valid_differs"
          ? "The trail already on the page is different from the hierarchy you entered. Adding Odito's code would create a second BreadcrumbList, so none was generated."
          : "The page already outputs a BreadcrumbList, but it is not valid. Adding Odito's code would create a second one, so none was generated."}
      </p>
      {kind === "existing_valid_differs" && model.conflict?.existingItems?.length > 0 && (
        <div>
          <div className={LABEL}>Trail currently on the page</div>
          <ol className="mt-1 space-y-0.5 text-[11.5px] text-foreground/80">{model.conflict.existingItems.map((i) => <li key={`${i.position}-${i.url}`}>{i.position}. {i.name} <span className="font-mono text-muted-foreground">{i.url}</span></li>)}</ol>
        </div>
      )}
      {kind === "existing_invalid" && model.conflict?.existingProblems?.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">Problems found: <span className="font-mono">{[...new Set(model.conflict.existingProblems)].join(", ")}</span></p>
      )}
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">Fix or remove the existing one where it comes from (your SEO plugin or theme), or correct the hierarchy you entered, then regenerate.</p>
      <button type="button" onClick={onEdit} className="rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">Edit my hierarchy</button>
    </div>
  )
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Rendered by IssueRecommendationPanel for breadcrumblist_schema when `model.state` is unavailable, user_provided
 * or conflict (see getBreadcrumbModel). `onRegenerated(response)` receives the server's { data, meta } so the
 * parent can show the new recommendation everywhere (the DIY guide too).
 */
export default function BreadcrumbHierarchyPanel({ projectId, selUrl, model, recommendation, ruleMetadata, onRegenerated }) {
  const [editing, setEditing] = useState(false)
  const discoveryQ = useBreadcrumbDiscovery(projectId, selUrl, { enabled: model.state === "unavailable" })
  const refreshDiscovery = useRefreshBreadcrumbDiscovery(projectId, selUrl)
  const info = describeDiscovery({ discovery: discoveryQ.data, isLoading: discoveryQ.isLoading, isError: discoveryQ.isError })
  const startItems = useMemo(() => (editing || model.savedItems?.length >= 2 ? null : discoveryStartItems(discoveryQ.data)), [editing, model.savedItems, discoveryQ.data])

  const showForm = model.state === "unavailable" || editing
  // The page already outputs a valid BreadcrumbList, or an invalid / duplicated one: nothing to enter, never a second entity.
  if (model.state === "unavailable" && !editing && info.replacesForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <DiscoveryOutcome info={info} discovery={discoveryQ.data} onLookAgain={() => refreshDiscovery.mutate()} refreshing={refreshDiscovery.isPending} />
      </motion.div>
    )
  }
  if (showForm) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <HierarchyForm
          key={`${selUrl}|${editing}`}
          discoveryProps={model.state === "unavailable" && !editing ? { info, data: discoveryQ.data, startItems, onLookAgain: () => refreshDiscovery.mutate(), refreshing: refreshDiscovery.isPending } : null}
          projectId={projectId} selUrl={selUrl} model={model} ruleMetadata={ruleMetadata}
          onRegenerated={(response) => { setEditing(false); onRegenerated?.(response) }}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      {model.state === "conflict"
        ? <ConflictNotice model={model} onEdit={() => setEditing(true)} />
        : <GeneratedResult recommendation={recommendation} model={model} onEdit={() => setEditing(true)} />}
    </motion.div>
  )
}

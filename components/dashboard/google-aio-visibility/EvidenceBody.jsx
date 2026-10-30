"use client"

import { ExternalLink } from "lucide-react"
import { Pill } from "../shared/parts"
import { OBSERVATION, errorText, formatDateTime, hostOf, intentLabel, safeHref, reasonText, DEVICES } from "./format"

const ERROR_CLASS_TEXT = {
  retryable: "A temporary provider problem. A later run may succeed.",
  non_retryable: "The provider rejected this search.",
  fatal: "A provider account problem stopped the run.",
  parse: "The provider answered, but the response could not be read.",
  cancelled: "The run was cancelled before this question was sent.",
  budget: "Not sent: the run cost limit was reached.",
  not_executed: "Not sent.",
}

export const ObservationPill = ({ observation }) => {
  const o = OBSERVATION[observation] || OBSERVATION.pending
  return <Pill tone={o.tone}>{o.label}</Pill>
}

const Yes = ({ v, yes = "Yes", no = "No" }) => (v == null ? <>—</> : <span className={v ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{v ? yes : no}</span>)

/**
 * One question's stored evidence. Everything is rendered as TEXT (React escapes it; nothing here uses dangerouslySetInnerHTML), links are
 * only created for http(s) URLs, and an absent AI Overview is described separately from a failed request.
 */
export default function EvidenceBody({ e }) {
  if (!e) return null
  const succeeded = e.status === "succeeded"
  const owned = (e.references || []).filter((r) => r.isOwned)
  return (
    <div className="space-y-5">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <ObservationPill observation={e.observation} />
          {e.intent ? <Pill>{intentLabel(e.intent)}</Pill> : null}
          <Pill>Questions v{e.questionSetVersion}</Pill>
        </div>
        <h3 className="mt-3 text-xs font-medium text-muted-foreground">Exact question searched</h3>
        <p className="mt-1 text-sm">{e.question}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {e.location?.name || "Location not recorded"} · language {e.language || "—"} · {DEVICES[e.device] || e.device || "—"} · retrieved {formatDateTime(e.retrievedAt)}
        </p>
      </section>

      {succeeded && !e.aiOverviewPresent ? (
        <section className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="font-medium">Google showed no AI Overview for this search.</p>
          <p className="mt-1 text-muted-foreground">The request worked. This question counts as “no AI Overview” and is left out of the mention and citation rates.</p>
        </section>
      ) : null}

      {succeeded && e.aiOverviewPresent ? (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Business mentioned</dt><dd><Yes v={e.brandMentioned} />{e.mentionStatus === "ambiguous" ? <span className="ml-1 text-xs text-muted-foreground">(name too generic to confirm)</span> : null}</dd></div>
            <div><dt className="text-muted-foreground">Your website cited</dt><dd>{e.referencesStatus === "unavailable" ? <span className="text-muted-foreground">No source links returned</span> : <Yes v={e.websiteCited} />}</dd></div>
            <div><dt className="text-muted-foreground">Sources listed</dt><dd className="font-medium tabular-nums">{e.referenceCount}</dd></div>
            <div><dt className="text-muted-foreground">Provider cost</dt><dd className="font-medium tabular-nums">{e.cost == null ? "Not reported" : `${e.cost.toFixed(4)}${e.costUnit ? ` ${e.costUnit}` : ""}`}</dd></div>
            {e.competitors?.length ? (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Competitors</dt>
                <dd className="space-y-0.5">
                  {e.competitors.map((c) => (
                    <div key={c.name} className="text-sm">{c.name}: <span className="text-muted-foreground">{c.mentioned ? "mentioned" : c.mentioned === false ? "not mentioned" : "mentions unknown"} · {c.cited ? "cited" : c.cited === false ? "not cited" : "citations unknown"}</span></div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>

          <section>
            <h3 className="text-xs font-medium text-muted-foreground">Google's AI Overview</h3>
            {e.overview?.text || e.overview?.markdown ? (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{e.overview.text || e.overview.markdown}</p>
            ) : <p className="mt-1 text-sm text-muted-foreground">An AI Overview was present but the provider returned no readable text.</p>}
            {e.mentionExcerpt ? <p className="mt-2 border-l-2 border-emerald-500/50 pl-3 text-xs text-muted-foreground">Mention: “{e.mentionExcerpt}”</p> : null}
          </section>

          <section>
            <h3 className="text-xs font-medium text-muted-foreground">Sources in the AI Overview</h3>
            {e.references?.length ? (
              <ul className="mt-1 divide-y divide-border/40">
                {e.references.map((r, i) => {
                  const href = safeHref(r.url)
                  const label = r.title || r.source || hostOf(r.url)
                  return (
                    <li key={`${r.url}-${i}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-1.5 hover:underline">
                          <span className="truncate">{label}</span><ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        </a>
                      ) : <span className="truncate">{label}</span>}
                      <span className={`shrink-0 text-xs ${r.isOwned ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{r.isOwned ? "Your site" : r.host || hostOf(r.url)}</span>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-1 text-sm text-muted-foreground">Google's AI Overview came back without readable source links, so citations could not be checked for this question.</p>}
            {owned.length ? <p className="mt-2 text-xs text-muted-foreground">{owned.length} {owned.length === 1 ? "link points" : "links point"} to your website.</p> : null}
            {e.rejectedReferences ? <p className="mt-1 text-xs text-muted-foreground">{e.rejectedReferences} source {e.rejectedReferences === 1 ? "link was" : "links were"} ignored because {e.rejectedReferences === 1 ? "its" : "their"} address was not a normal web address.</p> : null}
          </section>
        </>
      ) : null}

      {!succeeded ? (
        <section className="rounded-lg border border-border/60 p-3 text-sm">
          <p className="font-medium">{e.status === "failed" ? "The search request failed." : e.status === "skipped" ? "This question was never sent." : e.status === "cancelled" ? "The run was cancelled before this question was sent." : "This question has not been searched yet."}</p>
          {reasonText(e) || e.errorClass ? <p className="mt-1 text-muted-foreground">{reasonText(e) || ERROR_CLASS_TEXT[e.errorClass]}</p> : null}
          {e.status !== "pending" ? <p className="mt-1 text-xs text-muted-foreground">It is left out of the percentages rather than counted as “no AI Overview”.{e.retryable ? " A later run may succeed." : ""}</p> : null}
          {e.diagnostics ? (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Provider diagnostics</summary>
              <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
                <dt>HTTP status</dt><dd>{e.diagnostics.httpStatus ?? "none (no HTTP response)"}</dd>
                <dt>Provider code</dt><dd>{e.diagnostics.providerCode ?? "none"}</dd>
                <dt>Provider message</dt><dd>{e.diagnostics.providerMessage || "none"}</dd>
                <dt>Task id returned</dt><dd>{e.diagnostics.taskIdReturned ? "yes" : "no"}</dd>
                <dt>Requests sent</dt><dd>{e.diagnostics.attempts?.length || e.attempts}{e.diagnostics.attempts?.length ? ` (${e.diagnostics.attempts.map((a) => `${a.durationMs ?? "?"} ms`).join(", ")})` : ""}</dd>
                <dt>Total time</dt><dd>{e.durationMs != null ? `${e.durationMs} ms` : "—"}</dd>
              </dl>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

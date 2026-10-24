"use client"

import { ExternalLink } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useEvidenceItem, useQuestionHistory } from "@/hooks/useChatGptVisibility"
import { ErrorNote, Pill, StatusMark } from "../parts"
import { ERROR_CLASS_TEXT, errorText, formatDateTime, intentLabel } from "../format"
import QuestionHistoryTable from "./QuestionHistoryTable"

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } }
const LOCATION_TEXT = { provider_country: "country set in the provider request", provider_country_city: "country and city set in the provider request", none: "only through the question's wording" }

/**
 * Why this result moved (or did not move) each dashboard figure, using the same rules the server applies: only ANSWERED discovery
 * questions are eligible; brand diagnostic questions and failed / unsent questions never count.
 */
export function HowItCounted({ e }) {
  const answered = e.status === "succeeded"
  const discovery = e.group === "visibility"
  const eligible = answered && discovery
  const rows = [
    ["Counted in the figures", eligible ? "Yes - an answered question that does not name your business"
      : !discovery ? "No - this question names your business (brand diagnostic)" : "No - no answer was collected, so it is left out rather than counted as not visible"],
  ]
  if (eligible) {
    rows.push(["Visibility", e.analysis?.brandMentioned ? "Counted: your business is mentioned" : "Counted as not mentioning your business"])
    rows.push(["Recommended", e.analysis?.recommended ? "Counted as recommended (estimated from the wording)" : "Not counted as recommended (estimated from the wording)"])
    rows.push(["Website cited", e.firstPartyPages.length ? `Counted: ${e.firstPartyPages.length} of your pages cited` : "Not cited"])
  }
  rows.push(["Target location", [e.city, e.country].filter(Boolean).join(", ") || "None (national question)"])
  rows.push(["Asked", `${formatDateTime(e.completedAt || e.startedAt)} · questions v${e.questionSetVersion} · ${intentLabel(e.intent)}`])
  return (
    <section aria-label="How this answer counted">
      <h3 className="text-xs font-medium text-muted-foreground">How this answer counted</h3>
      <dl className="mt-1 space-y-1 text-sm">
        {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[10rem_1fr] gap-2"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {eligible ? <p className="mt-2 text-xs text-muted-foreground">Mentions are matched on your business name; “recommended” is a wording-based estimate (method {e.analysis?.recommendationMethod || "heuristic_v1"}) and can be wrong - read the answer to judge.</p> : null}
    </section>
  )
}

/** Why a question has no answer, in the user's words. Never a stack trace or a provider id. */
export const failureText = (e) => errorText(e.errorCode) || ERROR_CLASS_TEXT[e.errorClass] || "No answer was collected."

/**
 * One question's stored evidence: the exact question asked, the full answer, every cited URL, and how the question fared in earlier runs.
 * Loaded lazily: nothing is requested until the sheet is opened. Provider request ids and worker data are not part of the response.
 */
export default function EvidenceSheet({ projectId, runId, questionId, open, onOpenChange }) {
  const evidence = useEvidenceItem(projectId, runId, questionId, { enabled: open })
  const history = useQuestionHistory(projectId, questionId, { enabled: open })
  const e = evidence.data?.data
  const answered = e?.status === "succeeded"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Evidence</SheetTitle>
          <SheetDescription>The stored answer and sources for one question in one run.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {evidence.isLoading ? <div className="h-40 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
          {evidence.error ? <ErrorNote>{evidence.error.status === 404 ? "This evidence is not available." : "Could not load this evidence. Try again."}</ErrorNote> : null}

          {e ? (
            <>
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{intentLabel(e.intent)}</Pill>
                  <Pill>Questions v{e.questionSetVersion}</Pill>
                  <StatusMark status={e.status} />
                </div>
                <h3 className="mt-3 text-xs font-medium text-muted-foreground">Question asked</h3>
                <p className="mt-1 text-sm">{e.question}</p>
              </section>

              {answered ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><dt className="text-muted-foreground">Business mentioned</dt><dd className={e.analysis?.brandMentioned ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{e.analysis ? (e.analysis.brandMentioned ? `Yes, ${e.analysis.brandMentionCount}×` : "No") : "—"}</dd></div>
                    <div>
                      <dt className="text-muted-foreground">Recommended</dt>
                      <dd className="font-medium">{e.analysis?.recommended == null ? "—" : e.analysis.recommended ? "Yes" : "No"}</dd>
                      {e.analysis?.recommended != null ? <dd className="text-xs text-muted-foreground">Estimated from the wording, not exact</dd> : null}
                    </div>
                    <div><dt className="text-muted-foreground">Your pages cited</dt><dd className={e.firstPartyPages.length ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{e.firstPartyPages.length}</dd></div>
                    <div><dt className="text-muted-foreground">Other sites cited</dt><dd className="font-medium tabular-nums">{e.externalDomains.length}</dd></div>
                    <div><dt className="text-muted-foreground">Provider cost</dt><dd className="font-medium tabular-nums">{e.cost == null ? "Not reported" : e.cost.toFixed(4)}</dd></div>
                    <div><dt className="text-muted-foreground">Collected</dt><dd className="font-medium">{formatDateTime(e.completedAt)}</dd></div>
                    {e.analysis?.competitorMentions?.length ? (
                      <div className="col-span-2"><dt className="text-muted-foreground">Competitors named</dt><dd className="font-medium">{e.analysis.competitorMentions.map((c) => c.name).join(", ")}</dd></div>
                    ) : null}
                  </dl>

                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground">ChatGPT's answer</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{e.answer}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {e.modelReported ? `Model ${e.modelReported} · ` : ""}{e.webSearch ? "web search on" : "web search off"}
                      {e.country ? ` · searched as ${e.city ? `${e.city}, ` : ""}${e.country}` : ""} · location applied: {LOCATION_TEXT[e.locationApplied] || LOCATION_TEXT.none}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground">Sources ChatGPT linked</h3>
                    {e.citations.length ? (
                      <ul className="mt-1 divide-y divide-border/40">
                        {e.citations.map((c, i) => (
                          <li key={`${c.url}-${i}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                              <span className="truncate">{c.title || hostOf(c.url)}</span>
                              <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                            </a>
                            <span className={`shrink-0 text-xs ${c.isTarget ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{c.isTarget ? "Your site" : c.host || hostOf(c.url)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-sm text-muted-foreground">ChatGPT listed no sources for this answer.</p>}
                    {e.firstPartyPages.length ? (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-muted-foreground">Your pages that were cited ({e.firstPartyPages.length})</h4>
                        <ul className="mt-1 space-y-0.5 text-sm">{e.firstPartyPages.map((p) => <li key={p} className="break-all">{p}</li>)}</ul>
                      </div>
                    ) : null}
                  </section>
                </>
              ) : (
                <section>
                  <p className="text-sm text-muted-foreground">
                    {failureText(e)} {e.status === "failed" || e.status === "skipped" ? "This question is left out of the percentages rather than counted as \"not visible\"." : ""}
                  </p>
                  {e.retryable ? <p className="mt-1 text-xs text-muted-foreground">A later run may succeed.</p> : null}
                </section>
              )}
              <HowItCounted e={e} />
            </>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold">This question over time</h3>
            {history.isLoading ? <div className="h-24 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
            {history.error ? <ErrorNote>Could not load the history for this question.</ErrorNote> : null}
            {history.data ? <QuestionHistoryTable items={history.data.data || []} /> : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

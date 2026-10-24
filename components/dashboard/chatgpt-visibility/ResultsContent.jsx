"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useChatGptSummary, useChatGptRuns, useChatGptRun } from "@/hooks/useChatGptVisibility"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton, NoProject, StatusMark, FailureNote } from "./parts"
import { CATEGORY_LABELS, CATEGORY_HINTS, CATEGORY_ORDER, errorText, formatCost, formatDateTime } from "./format"

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url }
}

function Execution({ e, targetHost }) {
  const [open, setOpen] = useState(false)
  const answered = e.status === "succeeded"
  const citations = e.annotations || []
  const targetPages = new Set(e.analysis?.targetPages || [])
  const isTarget = (url) => {
    try {
      const h = new URL(url).hostname.replace(/^www\./, "")
      return !!targetHost && (h === targetHost || h.endsWith(`.${targetHost}`))
    } catch { return false }
  }

  return (
    <article className="rounded-xl border border-border/60 bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{CATEGORY_LABELS[e.category] || e.category}</h3>
          <p className="text-sm text-muted-foreground">{CATEGORY_HINTS[e.category]}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{e.branded ? "Names your business" : "Doesn't name your business"}</span>
          <StatusMark status={e.status} />
        </div>
      </header>

      <div className="mt-4">
        <div className="text-xs font-medium text-muted-foreground">Question sent</div>
        <p className="mt-1 text-sm">{e.prompt}</p>
      </div>

      {answered ? (
        <>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><dt className="text-muted-foreground">Business mentioned</dt><dd className={e.analysis?.brandMentioned ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{e.analysis ? (e.analysis.brandMentioned ? `Yes, ${e.analysis.brandMentionCount}×` : "No") : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Links to your site</dt><dd className={e.analysis?.targetCitationCount ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{e.analysis ? e.analysis.targetCitationCount : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Sources listed</dt><dd className="font-medium tabular-nums">{citations.length}</dd></div>
            {e.analysis?.competitorMentions?.length ? (
              <div><dt className="text-muted-foreground">Competitors named</dt><dd className="font-medium">{e.analysis.competitorMentions.map((c) => c.name).join(", ")}</dd></div>
            ) : null}
            <div><dt className="text-muted-foreground">Provider cost</dt><dd className="font-medium tabular-nums">{e.cost == null ? "Not reported" : e.cost.toFixed(4)}</dd></div>
          </dl>

          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground">ChatGPT's answer</div>
            <p className={`mt-1 whitespace-pre-line text-sm leading-relaxed ${open ? "" : "line-clamp-6"}`}>{e.answer}</p>
            {e.answer && e.answer.length > 420 ? (
              <button type="button" className="mt-1 text-sm underline-offset-4 hover:underline" onClick={() => setOpen((v) => !v)}>
                {open ? "Show less" : "Show the full answer"}
              </button>
            ) : null}
          </div>

          {citations.length ? (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground">Sources ChatGPT linked</div>
              <ul className="mt-1 divide-y divide-border/40">
                {citations.map((c, i) => (
                  <li key={`${c.url}-${i}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                      <span className="truncate">{c.title || hostOf(c.url)}</span>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                    </a>
                    <span className={`shrink-0 text-xs ${isTarget(c.url) ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {isTarget(c.url) ? "Your site" : hostOf(c.url)}
                    </span>
                  </li>
                ))}
              </ul>
              {targetPages.size ? <p className="mt-1 text-xs text-muted-foreground">{targetPages.size} distinct {targetPages.size === 1 ? "page" : "pages"} of your site cited.</p> : null}
            </div>
          ) : <p className="mt-4 text-sm text-muted-foreground">ChatGPT listed no sources for this answer.</p>}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {errorText(e.errorCode) || "No answer."} This prompt is left out of the percentages rather than counted as "not visible".
        </p>
      )}
    </article>
  )
}

export default function ResultsContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get("run")

  const { data: summary, isLoading: summaryLoading } = useChatGptSummary(projectId)
  const { data: runsData } = useChatGptRuns(projectId, { page: 1, limit: 20 })
  const fallbackId = summary?.data?.latest?.id || summary?.data?.active?.id
  const runId = requested || fallbackId
  const { data, isLoading, error } = useChatGptRun(projectId, runId)

  if (!projectId) return <NoProject />
  if (summaryLoading || (runId && isLoading)) return <PageSkeleton />

  const run = data?.data
  const runs = (runsData?.data || []).filter((r) => r.status !== "skipped" && r.executionMode !== "approved_questions")
  const byCategory = new Map((run?.executions || []).map((e) => [e.category, e]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt results"
        description="The five questions sent to ChatGPT, its answers, and the sources it linked."
        actions={runs.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Run</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={runId || ""}
              onChange={(ev) => router.replace(`/app/chatgpt-visibility/results?run=${ev.target.value}`)}
            >
              {runs.map((r) => <option key={r.id} value={r.id}>{formatDateTime(r.createdAt)} · {r.status}</option>)}
            </select>
          </label>
        ) : null}
      />

      {!runId ? <EmptyState title="Nothing to show yet">Run a visibility check from the overview to see ChatGPT's answers here.</EmptyState> : null}
      {error ? <ErrorNote>That run could not be loaded.</ErrorNote> : null}

      {run ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <StatusMark status={run.status} />
            <span>{formatDateTime(run.completedAt || run.failedAt || run.createdAt)}</span>
            <span>Provider cost {formatCost(run.totalCost)}</span>
            {run.market?.countryCode ? <span>Searched as {run.market.effectiveScope === "local" && run.market.city ? `${run.market.city}, ` : ""}{run.market.countryCode}</span> : null}
          </div>
          <FailureNote run={run} />
          {run.executions.length === 0 ? (
            <Panel><p className="text-sm text-muted-foreground">{run.status === "queued" || run.status === "running" ? "The questions are being prepared." : "No questions were sent for this run."}</p></Panel>
          ) : (
            <div className="space-y-4">
              {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => <Execution key={c} e={byCategory.get(c)} targetHost={run.target?.targetHost} />)}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

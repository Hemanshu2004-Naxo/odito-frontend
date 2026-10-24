"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useProject } from "@/contexts/ProjectContext"
import { useChatGptRuns, useQuestionHistory } from "@/hooks/useChatGptVisibility"
import { useApprovedQuestionSet } from "@/hooks/useAiVisibilityQuestions"
import { Button } from "@/components/ui/button"
import { Panel, EmptyState, ErrorNote, StatusMark } from "../parts"
import { COST_TEXT, formatDateTime, intentLabel, num } from "../format"
import QuestionHistoryTable from "./QuestionHistoryTable"
import RunComparePanel from "./RunComparePanel"

const PAGE_SIZE = 10

/**
 * Change in the visibility score against the next-older approved run, in points. ONLY comparable when both runs used the same question
 * set version: a different set asks different questions, so the difference would not measure a change in visibility.
 */
export function ScoreDelta({ now, before }) {
  if (!before) return <span className="text-muted-foreground">—</span>
  if (now.questionSetVersion !== before.questionSetVersion) {
    return <span className="text-xs text-muted-foreground" title="The question set changed between these runs, so the change is not comparable">v{before.questionSetVersion} → v{now.questionSetVersion}, not comparable</span>
  }
  const a = now.metrics?.overview?.visibilityScore
  const b = before.metrics?.overview?.visibilityScore
  if (a == null || b == null) return <span className="text-muted-foreground">—</span>
  const pts = a - b
  if (pts === 0) return <span className="text-muted-foreground">no change</span>
  return <span className={pts > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{pts > 0 ? "+" : "−"}{Math.abs(pts)} pts</span>
}

function QuestionTrend({ projectId, approved }) {
  const questions = useMemo(() => (approved?.questions || []).filter((q) => q.group === "visibility"), [approved])
  const [selected, setSelected] = useState("")
  const history = useQuestionHistory(projectId, selected, { enabled: Boolean(selected) })
  if (!questions.length) return null
  return (
    <Panel title="One question over time" description="Pick a question from the approved set to see how its answers changed from run to run.">
      <label className="block text-sm">
        <span className="text-muted-foreground">Question</span>
        <select className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a question…</option>
          {questions.map((q) => <option key={q.id} value={q.id}>{intentLabel(q.intent)} · {q.text.length > 90 ? `${q.text.slice(0, 90)}…` : q.text}</option>)}
        </select>
      </label>
      <div className="mt-4">
        {selected && history.isLoading ? <div className="h-24 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
        {history.error ? <ErrorNote>Could not load the history for this question.</ErrorNote> : null}
        {history.data ? <QuestionHistoryTable items={history.data.data || []} /> : null}
      </div>
    </Panel>
  )
}

/** Approved-question runs side by side, each tied to the question-set version it used, plus a per-question comparison. */
export default function ApprovedHistoryContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page])
  const { data, isLoading, error } = useChatGptRuns(projectId, params)
  const { data: approvedData } = useApprovedQuestionSet(projectId)

  const rows = useMemo(() => (data?.data || []).filter((r) => r.executionMode === "approved_questions" && r.status !== "skipped"), [data])
  const finished = useMemo(() => rows.filter((r) => r.status === "completed" || r.status === "partial"), [rows])
  const approved = approvedData?.data || null

  if (error) return <ErrorNote>Could not load the history.</ErrorNote>
  if (isLoading) return <div className="h-40 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" />

  return (
    <div className="space-y-6">
      <Panel title="Approved-question runs" description="Each run is tied to the question set it used. Changes are shown against the previous run, and only when both used the same set." className="overflow-x-auto">
        {!rows.length ? (
          <EmptyState title="No approved-question runs yet">Run the approved questions to start a history.</EmptyState>
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Questions</th>
                <th className="pb-2 text-right font-medium">Answered</th>
                <th className="pb-2 text-right font-medium">Score</th>
                <th className="pb-2 pl-3 text-right font-medium">vs previous</th>
                <th className="pb-2 text-right font-medium">Mentions</th>
                <th className="pb-2 text-right font-medium">Recommended</th>
                <th className="pb-2 text-right font-medium">Cited pages</th>
                <th className="pb-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const before = rows.slice(i + 1).find((x) => x.metrics?.overview)
                const o = r.metrics?.overview
                const v = r.metrics?.visibility
                const stats = r.questionStats
                return (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="py-3 pr-4"><Link className="underline-offset-4 hover:underline" href={`/app/chatgpt-visibility/results?run=${r.id}`}>{formatDateTime(r.completedAt || r.createdAt)}</Link></td>
                    <td className="py-3 pr-4"><StatusMark status={r.status} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">v{r.questionSetVersion ?? "—"}</td>
                    <td className="py-3 text-right tabular-nums">{v ? `${v.succeeded} of ${v.attempted}` : stats ? `${stats.succeeded} of ${stats.succeeded + stats.failed}` : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{o ? num(o.visibilityScore) : "—"}</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{o ? <ScoreDelta now={r} before={before} /> : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{o ? o.mentions : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{v ? v.answersRecommendingBrand : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{o ? num(o.citedPages) : "—"}</td>
                    <td className="py-3 text-right tabular-nums">{r.metrics?.cost ? COST_TEXT(r.metrics.cost) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {(page > 1 || (data?.data || []).length === PAGE_SIZE) ? (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
              <Button variant="outline" size="sm" disabled={(data?.data || []).length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Older</Button>
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">Score = share of answered, unbranded questions that mention your business. A dash means unknown. Runs with failed questions are marked partial and rely on fewer answers.</p>
      </Panel>
      <RunComparePanel projectId={projectId} runs={finished} />
      <QuestionTrend projectId={projectId} approved={approved} />
    </div>
  )
}

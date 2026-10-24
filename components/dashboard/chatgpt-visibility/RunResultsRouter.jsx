"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { useChatGptSummary, useChatGptRuns, useChatGptRun } from "@/hooks/useChatGptVisibility"
import { PageHeader, ErrorNote, EmptyState, PageSkeleton, NoProject } from "./parts"
import { formatDateTime } from "./format"
import ResultsContent from "./ResultsContent"
import ApprovedRunResults from "./evidence/ApprovedRunResults"

/**
 * /results?run=<id>. The run's mode (from the server) decides the view: approved-question runs show their stored evidence, anything else
 * is the original five-prompt view, unchanged. With no `run` parameter the latest finished (or active) run is shown.
 */
export default function RunResultsRouter() {
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
  if (run && run.executionMode !== "approved_questions") return <ResultsContent />

  const runs = (runsData?.data || []).filter((r) => r.status !== "skipped" && r.executionMode === "approved_questions")
  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        description="Every question that was asked of ChatGPT in a run, its stored answer, and the sources it linked."
        actions={runs.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Run</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={runId || ""}
              onChange={(ev) => router.replace(`/app/chatgpt-visibility/results?run=${ev.target.value}`)}
            >
              {runs.map((r) => <option key={r.id} value={r.id}>{formatDateTime(r.createdAt)} · v{r.questionSetVersion} · {r.status}</option>)}
            </select>
          </label>
        ) : null}
      />
      {!runId ? <EmptyState title="Nothing to show yet">Run the approved questions from the overview to see ChatGPT's answers here.</EmptyState> : null}
      {error ? <ErrorNote>{error.status === 404 ? "That run is not available." : "That run could not be loaded."}</ErrorNote> : null}
      {run ? <ApprovedRunResults key={run.id} projectId={projectId} run={run} /> : null}
    </div>
  )
}

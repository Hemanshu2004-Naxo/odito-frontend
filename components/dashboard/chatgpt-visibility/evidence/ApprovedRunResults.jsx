"use client"

import { useState } from "react"
import { Notice, StatusMark, FailureNote } from "../parts"
import { formatCost, formatDateTime } from "../format"
import MostCitedPages from "../dashboard/MostCitedPages"
import QuestionsAnswersTable from "../dashboard/QuestionsAnswersTable"

/**
 * One approved-question run's answers and citations: the run's facts, the pages of the website it cited, and every question with its
 * stored answer (searchable, filterable, paginated by the server; each answer loads only when opened).
 * `run` is the run detail from GET .../runs/:id.
 */
export default function ApprovedRunResults({ projectId, run }) {
  const [filter, setFilter] = useState({})
  const stats = run.questionStats
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <StatusMark status={run.status} />
        <span>{formatDateTime(run.completedAt || run.failedAt || run.createdAt)}</span>
        <span>Questions v{run.questionSetVersion}</span>
        <span>Provider cost {formatCost(run.totalCost)}</span>
        {run.market?.countryCode ? <span>Searched as {run.market.effectiveScope === "local" && run.market.city ? `${run.market.city}, ` : ""}{run.market.countryCode}</span> : null}
      </div>
      <FailureNote run={run} />
      {stats ? (
        <p className="text-sm tabular-nums text-muted-foreground">
          {stats.succeeded} answered · {stats.failed} failed · {stats.skipped} not sent · {stats.pending} remaining · {stats.total} questions in this run
        </p>
      ) : null}
      {run.status === "partial" ? <Notice tone="warn">This run is partial. Answered questions are kept; failed and unsent ones are left out of the percentages rather than counted as “not visible”.</Notice> : null}
      {run.status === "cancelled" ? <Notice>This run was cancelled. Answers collected before then are kept.</Notice> : null}
      {run.policy?.truncatedQuestions ? <Notice tone="warn">{run.policy.truncatedQuestions} enabled {run.policy.truncatedQuestions === 1 ? "question was" : "questions were"} not included because of the per-run question limit.</Notice> : null}

      <MostCitedPages projectId={projectId} runId={run.id} onSelectPage={(url) => setFilter({ citedUrl: url })} />
      <QuestionsAnswersTable projectId={projectId} run={run} filter={filter} onFilterChange={setFilter} />
    </div>
  )
}

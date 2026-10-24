"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useProject } from "@/contexts/ProjectContext"
import { useQuestionSets } from "@/hooks/useAiVisibilityQuestions"
import { Button } from "@/components/ui/button"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton, NoProject, Pill } from "../parts"
import { GENERATED_BY_LABELS, SET_STATUS_LABELS, describeQuestionError, formatDateTime } from "../format"
import BusinessProfilePanel from "../profile/BusinessProfilePanel"

const PAGE_SIZE = 10
const STATUS_TONE = { approved: "success", draft: "warn", archived: "neutral" }
const GROUPS = [
  { status: "approved", title: "Approved", note: "The set every run is executed and compared against." },
  { status: "draft", title: "Drafts", note: "Review, edit and approve a draft before anything is asked." },
  { status: "archived", title: "Archived", note: "Replaced by a newer approved version, or discarded. Kept as history." },
]

export function SetRow({ set }) {
  const missing = set.missingBusinessInformation || []
  const warnings = set.warnings || []
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/chatgpt-visibility/questions/${set.id}`} className="text-sm font-semibold underline-offset-4 hover:underline">
            Version {set.version}
          </Link>
          <Pill tone={STATUS_TONE[set.status]}>{SET_STATUS_LABELS[set.status] || set.status}</Pill>
          {missing.length ? <Pill tone="warn">{missing.length} missing {missing.length === 1 ? "detail" : "details"}</Pill> : null}
          {warnings.length ? <Pill tone="warn">{warnings.length} {warnings.length === 1 ? "warning" : "warnings"}</Pill> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(set.createdAt)} · {GENERATED_BY_LABELS[set.generatedBy] || set.generatedBy}
          {set.status === "approved" && set.approvedAt ? ` · approved ${formatDateTime(set.approvedAt)}` : ""}
        </p>
      </div>
      <div className="text-sm tabular-nums text-muted-foreground">
        {set.counts?.enabled ?? 0} of {set.counts?.total ?? 0} questions enabled
        <span className="ml-2 text-xs">({set.counts?.visibility ?? 0} visibility · {set.counts?.brandReputation ?? 0} brand)</span>
      </div>
    </li>
  )
}

export default function QuestionSetsContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page])
  const { data, isLoading, error } = useQuestionSets(projectId, params)

  const sets = data?.data || []

  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />

  const hasNextPage = sets.length === PAGE_SIZE

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        description="The questions ChatGPT is asked about your business. Confirm your business profile, generate a draft, review every question, then approve it. An approved set never changes, so each run can be compared with the last."
      />

      <BusinessProfilePanel projectId={projectId} />

      {error ? <ErrorNote>{describeQuestionError(error)}</ErrorNote> : null}

      {!sets.length && !error ? (
        <EmptyState title="No question sets yet">
          Confirm your business profile above, then generate a draft. Nothing is sent to ChatGPT until you approve a set and run it.
        </EmptyState>
      ) : null}

      {GROUPS.map(({ status, title, note }) => {
        const rows = sets.filter((s) => s.status === status)
        if (!rows.length) return null
        return (
          <Panel key={status} title={title} description={note}>
            <ul className="divide-y divide-border/50">{rows.map((s) => <SetRow key={s.id} set={s} />)}</ul>
          </Panel>
        )
      })}

      {page > 1 || hasNextPage ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</Button>
            <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>Older</Button>
          </div>
        </div>
      ) : null}

    </div>
  )
}


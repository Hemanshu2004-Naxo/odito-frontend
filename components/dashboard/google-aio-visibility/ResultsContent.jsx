"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useProject } from "@/contexts/ProjectContext"
import { useGoogleAioSummary, useGoogleAioRun, useRunEvidence, useEvidenceItem } from "@/hooks/useGoogleAioVisibility"
import { PageHeader, Panel, EmptyState, ErrorNote, PageSkeleton } from "../shared/parts"
import EvidenceBody, { ObservationPill } from "./EvidenceBody"
import { NoProject } from "./GoogleAioDashboard"
import { PAGE_BASE, DEVICES, formatDateTime } from "./format"

function QuestionCard({ projectId, runId, row, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const item = useEvidenceItem(projectId, runId, row.questionId, { enabled: open })
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm"><span className="mr-2 tabular-nums text-muted-foreground">{row.position}</span>{row.question}</div>
          <div className="mt-1"><ObservationPill observation={row.observation} /></div>
        </div>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</Button>
      </div>
      {open ? (
        <div className="mt-3 rounded-lg border border-border/60 p-4">
          {item.isLoading ? <div className="h-24 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
          {item.error ? <ErrorNote>Could not load this evidence. Try again.</ErrorNote> : null}
          {item.data?.data ? <EvidenceBody e={item.data.data} /> : null}
        </div>
      ) : null}
    </li>
  )
}

/** Answers & citations: the stored AI Overview and sources for each of the five questions of one run (the latest finished run, or ?runId=). */
export default function ResultsContent() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const params = useSearchParams()
  const requested = params.get("runId")
  const { data: summary, isLoading } = useGoogleAioSummary(projectId)
  const runId = requested || summary?.data?.overview?.runId || summary?.data?.latest?.id || null
  const { data: runData, error: runError } = useGoogleAioRun(projectId, runId)
  const { data: evData, isLoading: evLoading, error: evError } = useRunEvidence(projectId, runId)
  const run = runData?.data

  if (!projectId) return <NoProject />
  if (isLoading) return <PageSkeleton />
  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Answers & citations" description="Google's AI Overview and its sources for each question." />
        <EmptyState title="No results yet" action={<Button asChild><Link href={PAGE_BASE}>Go to the overview</Link></Button>}>Run the five questions first. Results appear here as soon as each question has been searched.</EmptyState>
      </div>
    )
  }
  const rows = evData?.data || []
  return (
    <div className="space-y-6">
      <PageHeader title="Answers & citations" description="What Google returned for each of the five questions: the AI Overview text and the sources it links to." />
      {runError ? <ErrorNote>{runError.status === 404 ? "That run is not available." : "Could not load the run."}</ErrorNote> : null}
      {run ? (
        <p className="text-sm text-muted-foreground">
          Run of {formatDateTime(run.completedAt || run.createdAt)} · questions v{run.questionSetVersion} · {run.location?.name || "location not recorded"} · {DEVICES[run.location?.device] || run.location?.device}
          {" · "}<Link className="underline underline-offset-2" href={`${PAGE_BASE}/history`}>All runs</Link>
        </p>
      ) : null}
      <Panel>
        {evError ? <ErrorNote>Could not load the evidence.</ErrorNote> : null}
        {evLoading ? <div className="h-40 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
        <ul className="divide-y divide-border/40">{rows.map((r) => <QuestionCard key={r.questionId} projectId={projectId} runId={runId} row={r} defaultOpen={rows.length === 1} />)}</ul>
      </Panel>
    </div>
  )
}

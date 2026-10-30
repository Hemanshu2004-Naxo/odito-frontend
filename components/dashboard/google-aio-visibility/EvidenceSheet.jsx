"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useEvidenceItem, useQuestionHistory } from "@/hooks/useGoogleAioVisibility"
import { ErrorNote } from "../shared/parts"
import EvidenceBody, { ObservationPill } from "./EvidenceBody"
import { formatDateTime } from "./format"

function QuestionHistory({ items }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">This question has not been searched in any other run.</p>
  return (
    <ul className="divide-y divide-border/40 text-sm">
      {items.map((h) => (
        <li key={`${h.runId}-${h.questionId}`} className="flex items-center justify-between gap-3 py-1.5">
          <span className="tabular-nums text-muted-foreground">{formatDateTime(h.completedAt)} · v{h.questionSetVersion}</span>
          <span className="flex items-center gap-3">
            <ObservationPill observation={h.observation} />
            <span className="w-24 text-right text-xs text-muted-foreground">{h.aiOverviewPresent ? `${h.brandMentioned ? "mentioned" : "not mentioned"}` : ""}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** One question's full stored evidence, loaded lazily when the sheet opens. Provider request ids and worker data are not in the response. */
export default function EvidenceSheet({ projectId, runId, questionId, open, onOpenChange }) {
  const evidence = useEvidenceItem(projectId, runId, questionId, { enabled: open })
  const history = useQuestionHistory(projectId, questionId, { enabled: open })
  const e = evidence.data?.data
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Evidence</SheetTitle>
          <SheetDescription>What Google returned for one question in one run.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {evidence.isLoading ? <div className="h-40 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
          {evidence.error ? <ErrorNote>{evidence.error.status === 404 ? "This evidence is not available." : "Could not load this evidence. Try again."}</ErrorNote> : null}
          {e ? <EvidenceBody e={e} /> : null}
          <section>
            <h3 className="mb-2 text-sm font-semibold">This question over time</h3>
            {history.isLoading ? <div className="h-16 rounded-xl skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
            {history.error ? <ErrorNote>Could not load the history for this question.</ErrorNote> : null}
            {history.data ? <QuestionHistory items={history.data.data || []} /> : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

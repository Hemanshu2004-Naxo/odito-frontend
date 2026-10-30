"use client"

import { useQuestionSelection } from "@/hooks/useGoogleAioVisibility"
import { Panel, ErrorNote, Notice } from "../shared/parts"
import { DEVICES, QUESTIONS_PER_RUN, REFUSAL_TEXT, intentLabel } from "./format"

/** What the next run would ask: exactly five questions from the approved set, and the verified Google location. Makes no paid request. */
export function SelectionDetails({ selection, loading, error }) {
  if (loading) return <div className="h-32 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" />
  if (error) return <ErrorNote>Could not prepare the question selection. Try again.</ErrorNote>
  const d = selection?.data
  if (!d) return null
  const problem = d.problem
  const problemText = problem ? (REFUSAL_TEXT[problem.code] || problem.message || problem.code) : null
  return (
    <div className="space-y-3">
      {problemText ? <ErrorNote>{problemText}</ErrorNote> : null}
      {problem?.code === "NOT_ENOUGH_QUESTIONS" && problem.details?.available != null ? (
        <p className="text-sm text-muted-foreground">{problem.details.available} usable of {problem.details.required} required.</p>
      ) : null}
      {d.questions?.length ? (
        <>
          <ol className="space-y-2 text-sm">
            {d.questions.map((q) => (
              <li key={q.questionId} className="flex gap-3">
                <span className="w-4 shrink-0 tabular-nums text-muted-foreground">{q.position}</span>
                <span><span>{q.question}</span> <span className="text-xs text-muted-foreground">· {intentLabel(q.intent)}</span></span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Questions v{d.questionSetVersion} · {d.questions.length} of {QUESTIONS_PER_RUN} · {d.location ? <>Google location <span className="font-medium text-foreground">{d.location.name}</span> (code {d.location.code})</> : "location not verified"}
            {d.languageCode ? ` · language ${d.languageCode}` : ""} · {DEVICES[d.device] || d.device}
          </p>
        </>
      ) : null}
    </div>
  )
}

export default function SelectionPanel({ projectId, device = "desktop" }) {
  const { data, isLoading, error } = useQuestionSelection(projectId, device)
  return (
    <Panel title="Next run: five questions" description="Every run asks exactly five questions from the approved set. They are picked in a fixed order across question types, so the same set always gives the same five.">
      <SelectionDetails selection={data} loading={isLoading} error={error} />
      <Notice className="mt-4">Each question is one paid Google search through the data provider. A run never asks more than five.</Notice>
    </Panel>
  )
}

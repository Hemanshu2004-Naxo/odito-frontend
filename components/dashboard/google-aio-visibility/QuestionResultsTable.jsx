"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRunEvidence } from "@/hooks/useGoogleAioVisibility"
import { Panel, ErrorNote } from "../shared/parts"
import { ObservationPill } from "./EvidenceBody"
import EvidenceSheet from "./EvidenceSheet"
import { QUESTIONS_PER_RUN, intentLabel, reasonText } from "./format"

const Tick = ({ v }) => (v == null ? <span className="text-muted-foreground">—</span> : <span className={v ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{v ? "Yes" : "No"}</span>)

/** The five questions of one run with what Google did for each. A row opens the stored evidence. */
export default function QuestionResultsTable({ projectId, runId }) {
  const { data, isLoading, error } = useRunEvidence(projectId, runId)
  const [openId, setOpenId] = useState(null)
  const rows = data?.data || []
  return (
    <Panel title={`The ${QUESTIONS_PER_RUN} questions`} description="Open a question to see the exact search, Google's AI Overview and its sources.">
      {error ? <ErrorNote>Could not load the questions of this run.</ErrorNote> : null}
      {isLoading ? <div className="h-40 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3 font-medium">#</th><th className="py-2 pr-3 font-medium">Question</th><th className="py-2 pr-3 font-medium">Google</th><th className="py-2 pr-3 font-medium">Mentions you</th><th className="py-2 pr-3 font-medium">Cites your site</th><th className="py-2 text-right font-medium" /></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.questionId}>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{r.position}</td>
                  <td className="max-w-md py-2.5 pr-3">
                    <div>{r.question}</div>
                    <div className="text-xs text-muted-foreground">{intentLabel(r.intent)}</div>
                  </td>
                  <td className="max-w-xs py-2.5 pr-3">
                    <ObservationPill observation={r.observation} />
                    {reasonText(r) ? <div className="mt-1 text-xs text-muted-foreground">{reasonText(r)}</div> : null}
                  </td>
                  <td className="py-2.5 pr-3"><Tick v={r.brandMentioned} /></td>
                  <td className="py-2.5 pr-3">{r.referencesStatus === "unavailable" ? <span className="text-xs text-muted-foreground">No sources</span> : <Tick v={r.websiteCited} />}</td>
                  <td className="py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => setOpenId(r.questionId)}>Evidence</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <EvidenceSheet projectId={projectId} runId={runId} questionId={openId} open={Boolean(openId)} onOpenChange={(v) => { if (!v) setOpenId(null) }} />
    </Panel>
  )
}

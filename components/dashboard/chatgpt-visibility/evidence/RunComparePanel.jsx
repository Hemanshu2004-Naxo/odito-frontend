"use client"

import { useEffect, useState } from "react"
import { useCompareRuns } from "@/hooks/useChatGptVisibility"
import { ErrorNote, Notice, Panel } from "../parts"
import { formatDateTime, num, pct1 } from "../format"

const REASON_TEXT = {
  DIFFERENT_QUESTION_SET_VERSION: "The runs used different question-set versions.",
  QUESTIONS_CHANGED: "Some questions were reworded, changed type, or target a different city.",
  DIFFERENT_QUESTIONS: "Questions were added or removed between the runs.",
  NO_QUESTIONS: "One of the runs has no discovery questions to compare.",
}
const CHANGE_TEXT = { text: "wording", intent: "type", location: "target city" }

const ROWS = [
  ["Visibility", "visibilityRate", pct1],
  ["Recommended", "recommendationRate", pct1],
  ["Website cited", "websiteCitationRate", pct1],
  ["Unique cited pages", "uniqueCitedPages", num],
  ["Eligible answers", "eligibleAnswers", num],
  ["Failed questions", "failed", num],
]

function Delta({ value, isRate }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const shown = isRate ? Math.round(value * 100) : value
  if (shown === 0) return <span className="text-muted-foreground">no change</span>
  return <span className={shown > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{shown > 0 ? "+" : "−"}{Math.abs(shown)}{isRate ? " pts" : ""}</span>
}

/**
 * Two finished approved-question runs side by side (server-computed). A change is shown only when the runs asked the same questions;
 * otherwise the figures are listed with the reasons they are not directly comparable, and the changed questions are named.
 */
export default function RunComparePanel({ projectId, runs }) {
  const [a, setA] = useState(runs[1]?.id || "")
  const [b, setB] = useState(runs[0]?.id || "")
  useEffect(() => { if (!b && runs[0]) setB(runs[0].id); if (!a && runs[1]) setA(runs[1].id) }, [runs]) // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading, error } = useCompareRuns(projectId, a, b)
  const c = data?.data
  if (runs.length < 2) return null
  const option = (r) => <option key={r.id} value={r.id}>{formatDateTime(r.completedAt || r.createdAt)} · v{r.questionSetVersion}</option>
  return (
    <Panel title="Compare two runs" description="Changes are shown only when both runs asked the same questions.">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Earlier run
          <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" value={a} onChange={(e) => setA(e.target.value)}>{runs.map(option)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Later run
          <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" value={b} onChange={(e) => setB(e.target.value)}>{runs.map(option)}</select>
        </label>
      </div>
      <div className="mt-4">
        {a === b ? <p className="text-sm text-muted-foreground">Choose two different runs.</p> : null}
        {error ? <ErrorNote>Could not compare these runs.</ErrorNote> : null}
        {isLoading ? <div className="h-32 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
        {c ? (
          <>
            {c.equivalent
              ? <Notice tone="success">Same {c.questions.comparable} questions in both runs: the figures are directly comparable.</Notice>
              : (
                <Notice tone="warn">
                  Not directly comparable. {c.reasons.map((r) => REASON_TEXT[r] || r).join(" ")}
                  {c.questions.changed.length ? ` Changed: ${c.questions.changed.slice(0, 3).map((q) => `“${q.after}” (${q.reasons.map((r) => CHANGE_TEXT[r] || r).join(", ")})`).join("; ")}${c.questions.changed.length > 3 ? "…" : ""}.` : ""}
                </Notice>
              )}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium" />
                    <th className="pb-2 text-right font-medium">{formatDateTime(c.a.completedAt || c.a.createdAt)} · v{c.a.questionSetVersion}</th>
                    <th className="pb-2 text-right font-medium">{formatDateTime(c.b.completedAt || c.b.createdAt)} · v{c.b.questionSetVersion}</th>
                    <th className="pb-2 pl-3 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, key, fmt]) => (
                    <tr key={key} className="border-t border-border/50">
                      <td className="py-2 pr-4 font-medium">{label}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(c.a.figures?.[key])}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(c.b.figures?.[key])}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{c.delta && key in c.delta ? <Delta value={c.delta[key]} isRate={key.endsWith("Rate")} /> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">A change between runs can come from many things (including ChatGPT itself); it does not by itself show what caused it.</p>
          </>
        ) : null}
      </div>
    </Panel>
  )
}

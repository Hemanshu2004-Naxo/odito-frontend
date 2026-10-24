"use client"

import { useMemo } from "react"
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useVisibilityTrend } from "@/hooks/useChatGptVisibility"
import { ErrorNote, Panel } from "../parts"
import { formatDateTime, pct1 } from "../format"

export const RANGES = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "all", label: "All time" },
]

const SERIES = [
  { key: "visibility", name: "Visibility", color: "#059669" },
  { key: "recommendation", name: "Recommended", color: "#7c3aed" },
  { key: "citation", name: "Website cited", color: "#2563eb" },
]

const shortDate = (v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })

/**
 * Visibility over time, one point per finished run. When the question set changed between two runs, a marker says so: those points ask
 * different questions and are not directly comparable. A change in a rate is not presented as caused by anything.
 */
export default function VisibilityTrendChart({ projectId, range, onRangeChange }) {
  const { data, isLoading, error } = useVisibilityTrend(projectId, range)
  const points = data?.data?.points || []
  const rows = useMemo(() => points.map((p) => ({
    date: p.date,
    label: shortDate(p.date),
    version: p.questionSetVersion,
    changed: !p.comparableWithPrevious && points.indexOf(p) > 0,
    visibility: p.figures?.visibilityRate == null ? null : Math.round(p.figures.visibilityRate * 100),
    recommendation: p.figures?.recommendationRate == null ? null : Math.round(p.figures.recommendationRate * 100),
    citation: p.figures?.websiteCitationRate == null ? null : Math.round(p.figures.websiteCitationRate * 100),
    n: p.figures?.eligibleAnswers ?? 0,
  })), [points])
  const changes = rows.filter((r) => r.changed)

  return (
    <Panel
      title="Visibility over time"
      description="One point per completed run. Percentages use that run's eligible answers."
      action={(
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Date range</span>
          <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={range} onChange={(e) => onRangeChange(e.target.value)}>
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      )}
    >
      {error ? <ErrorNote>Could not load the trend.</ErrorNote> : null}
      {isLoading ? <div className="h-56 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
      {!isLoading && !error && rows.length < 2 ? (
        <p className="text-sm text-muted-foreground">{rows.length === 1 ? "One run so far in this range. Run again later to see a trend." : "No completed runs in this range yet."}</p>
      ) : null}
      {rows.length >= 2 ? (
        <>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => (v == null ? "—" : `${v}%`)} />
                <Legend />
                {changes.map((r) => <ReferenceLine key={r.date} x={r.label} strokeDasharray="4 4" stroke="#d97706" label={{ value: `v${r.version}`, fontSize: 11, fill: "#d97706" }} />)}
                {SERIES.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot connectNulls={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {changes.length ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              The question set changed at the dashed {changes.length === 1 ? "line" : "lines"}; points on either side ask different questions and are not directly comparable.
            </p>
          ) : null}
          {/* The same data as a table, for screen readers and for exact values. */}
          <table className="sr-only">
            <caption>Visibility by run</caption>
            <thead><tr><th>Run</th><th>Questions</th><th>Visibility</th><th>Recommended</th><th>Website cited</th><th>Eligible answers</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.runId}>
                  <td>{formatDateTime(p.date)}</td><td>v{p.questionSetVersion}</td>
                  <td>{pct1(p.figures?.visibilityRate)}</td><td>{pct1(p.figures?.recommendationRate)}</td><td>{pct1(p.figures?.websiteCitationRate)}</td>
                  <td>{p.figures?.eligibleAnswers ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Panel>
  )
}

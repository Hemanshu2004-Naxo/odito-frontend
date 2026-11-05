"use client"

import { useState } from "react"
import { useSnapshotComparison } from "@/hooks/useDatasetHistory"
import { EmptyNote, SectionError, Skel } from "../domain-overview/SectionState"
import { describeSectionError } from "@/lib/describeSectionError"
import { compareKeyedRows, formatDay, formatNumber, metricDelta, valueAt } from "@/lib/history/compare"
import { ChangeList, DeltaCell, NotEnoughHistory, PeriodSelect, Tile } from "./parts"

/**
 * Before / now for a SUMMARY dataset (Domain Overview, Traffic, Backlink Overview, Top Pages counts), from two stored snapshots.
 * Each metric shows the earlier value, the current one and the absolute and percentage change; a metric either snapshot did not have
 * shows "—" (never 0). With only one snapshot the panel says there is not enough history and still shows what is stored now.
 */
export function SnapshotDeltas({ projectId, spec, enabled = true }) {
  const [period, setPeriod] = useState("previous")
  const q = useSnapshotComparison(projectId, { datasetType: spec.datasetType, part: spec.part, period }, enabled)
  const { latest, previous } = q.data?.data ?? {}

  let body
  if (q.isLoading) body = <Skel className="h-28 w-full" />
  else if (q.isError) body = <SectionError message={describeSectionError(q.error)} onRetry={() => q.refetch()} />
  else if (!latest) body = <EmptyNote>{spec.emptyMessage}</EmptyNote>
  else {
    body = (
      <>
        {previous ? <p className="mb-2 text-xs text-muted-foreground" data-testid="snapshot-range">{formatDay(previous.capturedAt)} → {formatDay(latest.capturedAt)}</p> : null}
        {!previous ? <NotEnoughHistory latestAt={formatDay(latest.capturedAt)} note={period === "previous" ? undefined : `No stored snapshot is ${period === "week" ? "a week" : "a month"} old yet.`} /> : null}
        <div className="mt-2 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr><th scope="col" className="px-2 py-1.5 font-medium">Metric</th><th scope="col" className="px-2 py-1.5 text-right font-medium">Before</th><th scope="col" className="px-2 py-1.5 text-right font-medium">Now</th><th scope="col" className="px-2 py-1.5 font-medium">Change</th></tr>
            </thead>
            <tbody>
              {spec.metrics.map((m) => {
                const delta = metricDelta(valueAt(latest.data, m.path), previous ? valueAt(previous.data, m.path) : null)
                return (
                  <tr key={m.id} className="border-t border-border">
                    <th scope="row" className="px-2 py-1.5 font-normal">{m.label}</th>
                    <td className="px-2 py-1.5 text-right tabular-nums">{previous ? formatNumber(delta.previous, { digits: m.digits }) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(delta.current, { digits: m.digits })}</td>
                    <td className="px-2 py-1.5">{previous ? <DeltaCell delta={delta} digits={m.digits} good={m.good ?? "up"} /> : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <section aria-label={spec.title} className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{spec.title}</h3>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>
      <div className={q.isFetching && !q.isLoading ? "opacity-70 transition-opacity" : undefined}>{body}</div>
    </section>
  )
}

/**
 * Before / now for a stored LIST snapshot (competitors, anchors): which rows are new or gone and how a metric moved for the rest.
 * Computed here from the two stored snapshots (pure, lib/history/compare.js); a list that was capped on either side is flagged.
 */
export function KeyedSnapshotDeltas({ projectId, spec, enabled = true }) {
  const [period, setPeriod] = useState("previous")
  const [active, setActive] = useState("added")
  const q = useSnapshotComparison(projectId, { datasetType: spec.datasetType, part: spec.part, period }, enabled)
  const { latest, previous } = q.data?.data ?? {}

  let body
  if (q.isLoading) body = <Skel className="h-28 w-full" />
  else if (q.isError) body = <SectionError message={describeSectionError(q.error)} onRetry={() => q.refetch()} />
  else if (!latest) body = <EmptyNote>{spec.emptyMessage}</EmptyNote>
  else if (!previous) body = <NotEnoughHistory latestAt={formatDay(latest.capturedAt)} note={period === "previous" ? undefined : `No stored snapshot is ${period === "week" ? "a week" : "a month"} old yet.`} />
  else {
    const now = latest.data?.items ?? []
    const before = previous.data?.items ?? []
    const { added, removed, changed } = compareKeyedRows(now, before, { key: spec.key, metrics: spec.metrics })
    const top = spec.metrics[0]
    const movers = [...changed].sort((a, b) => Math.abs(b.deltas[top.id].abs ?? 0) - Math.abs(a.deltas[top.id].abs ?? 0)).slice(0, 25)
    const lists = {
      added: { label: spec.addedLabel, count: added.length, rows: added.slice(0, 25).map((r) => ({ label: spec.labelOf(r), value: top.get(r) })) },
      removed: { label: spec.removedLabel, count: removed.length, rows: removed.slice(0, 25).map((r) => ({ label: spec.labelOf(r), value: top.get(r) })) },
      changed: { label: `Changed ${top.label.toLowerCase()}`, count: changed.length, rows: movers.map((c) => ({ label: spec.labelOf(c.row), value: top.get(c.row), delta: c.deltas[top.id] })) },
    }
    const list = lists[active]
    body = (
      <>
        <p className="mb-2 text-xs text-muted-foreground" data-testid="snapshot-range">
          {formatDay(previous.capturedAt)} ({formatNumber(before.length)} listed) → {formatDay(latest.capturedAt)} ({formatNumber(now.length)} listed). Only the rows each snapshot listed are compared.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(lists).map(([id, l]) => <Tile key={id} label={l.label} value={l.count} active={id === active} onClick={() => setActive(id)} />)}
        </div>
        <ChangeList
          title={list.label}
          rows={list.rows}
          count={list.count}
          empty="None."
          columns={[
            { id: "row", label: spec.rowLabel, render: (r) => r.label, title: (r) => r.label },
            { id: "value", label: top.label, render: (r) => formatNumber(r.value, { digits: top.digits }) },
            ...(active === "changed" ? [{ id: "delta", label: "Change", render: (r) => <DeltaCell delta={r.delta} digits={top.digits} /> }] : []),
          ]}
        />
      </>
    )
  }

  return (
    <section aria-label={spec.title} className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{spec.title}</h3>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>
      <div className={q.isFetching && !q.isLoading ? "opacity-70 transition-opacity" : undefined}>{body}</div>
    </section>
  )
}

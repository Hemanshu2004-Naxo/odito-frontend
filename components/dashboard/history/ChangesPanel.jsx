"use client"

import { useState } from "react"
import { useDatasetChanges } from "@/hooks/useDatasetHistory"
import { EmptyNote, SectionError, Skel } from "../domain-overview/SectionState"
import { describeSectionError } from "@/lib/describeSectionError"
import { formatDay, formatNumber } from "@/lib/history/compare"
import { ChangeList, NotEnoughHistory, PeriodSelect, Tile } from "./parts"

/**
 * "What changed" for a stored row dataset (keywords, backlinks, referring domains), from two stored scans. `spec` (history/routes.js) says
 * which counts to show as tiles and how to list their rows. Every state is explicit: loading, error, nothing collected, only one scan
 * (not enough history), and the real comparison - where a zero is a zero and a capped scan is labelled as such.
 */
export default function ChangesPanel({ projectId, spec, enabled = true }) {
  const [period, setPeriod] = useState("previous")
  const [active, setActive] = useState(spec.tiles[0].id)
  const q = useDatasetChanges(projectId, { dataset: spec.dataset, status: spec.status ?? null, period }, enabled)
  const data = q.data?.data ?? null
  const tile = spec.tiles.find((t) => t.id === active) ?? spec.tiles[0]

  let body
  if (q.isLoading) {
    body = <div className="space-y-2" aria-busy="true"><Skel className="h-14 w-full" /><Skel className="h-24 w-full" /></div>
  } else if (q.isError) {
    body = <SectionError message={describeSectionError(q.error)} onRetry={() => q.refetch()} />
  } else if (!data?.hasData) {
    body = <EmptyNote>{spec.emptyMessage}</EmptyNote>
  } else if (!data.reference) {
    body = <NotEnoughHistory note={data.note} latestAt={formatDay(data.latest?.capturedAt)} />
  } else {
    const list = tile.read(data)
    body = (
      <>
        <p className="mb-2 text-xs text-muted-foreground" data-testid="change-range">
          {formatDay(data.reference.capturedAt)} ({formatNumber(data.reference.rows)} stored) → {formatDay(data.latest.capturedAt)} ({formatNumber(data.latest.rows)} stored)
        </p>
        {data.caveat ? <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" role="note">{data.caveat}</p> : null}
        {spec.headline ? <div className="mb-2 text-sm">{spec.headline(data)}</div> : null}
        <div className="flex flex-wrap gap-2">
          {spec.tiles.map((t) => <Tile key={t.id} label={t.label} value={t.read(data)?.count ?? null} active={t.id === tile.id} tone={t.tone} onClick={() => setActive(t.id)} />)}
        </div>
        <ChangeList title={tile.label} rows={list?.items ?? []} count={list?.count} columns={tile.columns} empty={tile.empty ?? "None."} />
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

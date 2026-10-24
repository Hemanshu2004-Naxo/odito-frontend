"use client"

import { Button } from "@/components/ui/button"
import { STATUS_LABELS, isActiveStatus } from "./format"

/**
 * Progress of the run in flight. The numbers come from the API (`active.questionStats` / `active.progress`, refreshed by the summary
 * query that polls while a run is active) and are overlaid with the socket's live counters when they belong to the SAME run. After a reload
 * or a reconnect the API values are the only source, so the display is always recoverable.
 */
export function progressNumbers(active, live) {
  const liveMatches = Boolean(live && active && live.runId === active.id)
  const stats = active?.questionStats || {}
  const total = (liveMatches ? live.total : active?.progress?.total) ?? stats.total ?? 0
  const completed = (liveMatches ? live.completed : active?.progress?.completed) ?? 0
  const pick = (liveValue, apiValue) => (liveMatches && liveValue != null ? liveValue : apiValue ?? 0)
  const succeeded = pick(live?.succeeded, stats.succeeded)
  const failed = pick(live?.failed, stats.failed)
  const skipped = pick(live?.skipped, stats.skipped)
  const remaining = liveMatches && live.pending != null ? live.pending : Math.max(0, total - completed)
  return { total, completed, succeeded, failed, skipped, remaining }
}

export default function LiveRunProgress({ active, live, onCancel, cancelling }) {
  if (!active || !isActiveStatus(active.status)) return null
  const n = progressNumbers(active, live)
  const queued = active.status === "queued"
  const pct = n.total ? Math.round((n.completed / n.total) * 100) : 0
  return (
    <section aria-label="Run progress" className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
          {STATUS_LABELS[active.status] || active.status}
          {active.questionSetVersion ? <span className="font-normal text-muted-foreground">· questions v{active.questionSetVersion}</span> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => onCancel(active.id)} disabled={cancelling || active.cancelRequested}>
          {active.cancelRequested ? "Cancelling…" : "Cancel run"}
        </Button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Questions processed">
        <div className="h-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${queued ? 3 : Math.max(pct, 3)}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums" role="status" aria-live="polite">
        {queued
          ? "Waiting for a worker to pick this run up."
          : `${n.succeeded} answered · ${n.failed} failed${n.skipped ? ` · ${n.skipped} not sent` : ""} · ${n.remaining} remaining`}
      </p>
    </section>
  )
}

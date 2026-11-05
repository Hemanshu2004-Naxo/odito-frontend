"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSeoScan } from "@/hooks/useSeoScan"

/** Stored SEO data older than this is called stale. Pages keep showing it; the bar offers the explicit update. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export function timeAgo(date, now = Date.now()) {
  const ms = Math.max(0, now - new Date(date).getTime())
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

export function ProjectScanBar({ projectId, scope, now = Date.now() }) {
  const { status, latest, lastSuccessful, running, starting, startError, start } = useSeoScan(projectId)
  if (status === "loading") return null

  const busy = running || starting
  const stale = lastSuccessful?.finishedAt && now - new Date(lastSuccessful.finishedAt).getTime() > STALE_AFTER_MS
  const failedCount = latest?.datasetsFailed ?? 0

  let tone = "text-muted-foreground"
  let Icon = CheckCircle2
  let message
  let action = { label: "Update data", run: () => start({ scope }) }

  if (running) {
    Icon = Loader2
    message = `Collecting SEO data… ${(latest.datasetsCompleted ?? 0) + (latest.datasetsFailed ?? 0)} of ${latest.totalDatasets} datasets done`
  } else if (!latest) {
    Icon = AlertTriangle
    tone = "text-amber-700 dark:text-amber-300"
    message = "No SEO data has been collected for this project yet. Pages show what Odito has stored; run a scan to collect it."
    action = { label: "Run SEO scan", run: () => start({ scope }) }
  } else if (latest.status === "partially_completed") {
    Icon = AlertTriangle
    tone = "text-amber-700 dark:text-amber-300"
    message = `Last scan finished ${timeAgo(latest.finishedAt, now)}, but ${failedCount} dataset${failedCount === 1 ? "" : "s"} could not be collected. The rest is saved.`
    action = { label: "Retry failed", run: () => start({ retryOf: latest.id }) }
  } else if (latest.status === "failed") {
    Icon = AlertTriangle
    tone = "text-red-700 dark:text-red-300"
    message = lastSuccessful
      ? `The last scan failed. Showing data saved ${timeAgo(lastSuccessful.finishedAt, now)}.`
      : "The last scan failed and nothing has been saved yet."
    action = { label: "Run again", run: () => start({ scope }) }
  } else if (stale) {
    Icon = AlertTriangle
    tone = "text-amber-700 dark:text-amber-300"
    message = `Data saved ${timeAgo(lastSuccessful.finishedAt, now)} — it may be out of date.`
  } else {
    message = `Data saved ${timeAgo((lastSuccessful ?? latest).finishedAt, now)}.`
  }

  return (
    <div role="status" aria-live="polite" className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" data-testid="seo-scan-bar">
      <Icon className={`size-4 shrink-0 ${tone} ${running ? "animate-spin" : ""}`} aria-hidden />
      <span className={`min-w-0 flex-1 ${tone}`}>{message}</span>
      {startError ? <span className="text-red-700 dark:text-red-300">{startError.message}</span> : null}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={action.run}>
        <RefreshCw className="size-3.5" aria-hidden /> {busy ? "Scanning…" : action.label}
      </Button>
    </div>
  )
}

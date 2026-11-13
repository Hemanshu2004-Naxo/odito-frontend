"use client"

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { useAutoCollect } from "@/hooks/useAutoCollect"

/** "just now", "4 minutes ago", "3 hours ago", "2 days ago". */
export function ago(date, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(date).getTime()) / 60_000))
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/**
 * What the status line says, from the server's answer for the page (`ensure`) and the scan being watched. Pure.
 * @returns {{ text: string, tone: 'muted'|'warn', busy: boolean, progress: { done: number, total: number } | null } | null}
 */
export function describeDataStatus({ ensure, scan = null, now = Date.now() }) {
  if (!ensure) return null
  const { activity, hasData, state, lastError } = ensure
  const progress = scan && scan.totalDatasets ? { done: (scan.datasetsCompleted ?? 0) + (scan.datasetsFailed ?? 0), total: scan.totalDatasets } : null

  if (activity === "collecting" || activity === "queued" || activity === "waiting") {
    if (scan?.stalled) return { text: hasData ? "Showing saved data · Refresh will continue shortly." : "Data collection will start shortly. It continues by itself.", tone: "warn", busy: false, progress: null }
    if (!hasData) return { text: "Collecting SEO data for this section…", tone: "muted", busy: true, progress: activity === "waiting" ? null : progress }
    if (activity === "collecting") return { text: "Updating data…", tone: "muted", busy: true, progress }
    return { text: "Showing saved data · Refreshing in background.", tone: "muted", busy: true, progress: null }
  }
  if (lastError && state !== "fresh") {
    return { text: hasData ? "Unable to refresh data. Showing previously saved results." : "Unable to collect SEO data right now. We'll try again automatically.", tone: "warn", busy: false, progress: null }
  }
  if (activity === "unavailable") return { text: hasData ? "Showing saved data. Updates are unavailable right now." : "SEO data collection is unavailable right now.", tone: "warn", busy: false, progress: null }
  if (activity === "disabled") return { text: hasData ? "Showing saved data. Automatic updates are turned off." : "Automatic SEO data collection is turned off.", tone: "muted", busy: false, progress: null }
  if (state === "stale" && activity === "cooldown") return { text: "Showing saved data · Will refresh automatically.", tone: "muted", busy: false, progress: null }
  if (!hasData) return { text: "Collecting SEO data for this section…", tone: "muted", busy: false, progress: null }
  return { text: ensure.lastUpdatedAt ? `Data updated ${ago(ensure.lastUpdatedAt, now)}.` : "Showing saved data.", tone: "muted", busy: false, progress: null }
}

/**
 * The one place a page says where its data stands. There is no scan button: data is collected and refreshed by itself in the background
 * (see hooks/useAutoCollect.js), and the page keeps showing what is stored meanwhile. An optional refresh lives in "History & data freshness".
 */
export function DataStatusLine({ projectId, page, now }) {
  const { status, ensure, scan } = useAutoCollect(projectId, page)
  if (status !== "ready") return null
  const view = describeDataStatus({ ensure, scan, now })
  if (!view) return null
  const Icon = view.busy ? Loader2 : view.tone === "warn" ? AlertTriangle : CheckCircle2
  const tone = view.tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
  return (
    <div role="status" aria-live="polite" className="mb-3 flex flex-wrap items-center gap-2 text-xs" data-testid="seo-data-status">
      <Icon className={`size-3.5 shrink-0 ${tone} ${view.busy ? "animate-spin" : ""}`} aria-hidden />
      <span className={tone}>{view.text}</span>
      {view.progress ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={view.progress.total} aria-valuenow={view.progress.done} aria-label="Data collection progress">
            <span className="block h-full bg-primary transition-[width]" style={{ width: `${Math.round((view.progress.done / view.progress.total) * 100)}%` }} />
          </span>
          {view.progress.done} of {view.progress.total}
        </span>
      ) : null}
    </div>
  )
}

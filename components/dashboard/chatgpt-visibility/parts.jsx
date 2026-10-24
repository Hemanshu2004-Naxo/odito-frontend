"use client"

import { AlertCircle, Loader2, MessageSquareText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { STATUS_LABELS, isActiveStatus, errorText, describeStartError } from "./format"

/** Small status marker. Colour only carries meaning: green = answered/complete, amber = partial, red = failed, neutral otherwise. */
const STATUS_TONE = {
  completed: "text-emerald-600 dark:text-emerald-400",
  succeeded: "text-emerald-600 dark:text-emerald-400",
  partial: "text-amber-600 dark:text-amber-400",
  failed: "text-red-600 dark:text-red-400",
  running: "text-foreground",
  queued: "text-muted-foreground",
  cancelled: "text-muted-foreground",
  skipped: "text-muted-foreground",
  pending: "text-muted-foreground",
}

export function StatusMark({ status, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", STATUS_TONE[status] || "text-muted-foreground", className)}>
      <span className={cn("size-1.5 rounded-full bg-current", isActiveStatus(status) && "animate-pulse")} aria-hidden />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

/** A KPI is type, not a tile: the figure, what it is, and the denominator it was computed over. */
export function Figure({ label, value, basis, hint, tone }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-4xl font-semibold tracking-tight tabular-nums", tone === "data" && value !== "—" && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </div>
      {basis ? <div className="mt-1 text-sm text-muted-foreground tabular-nums">{basis}</div> : null}
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, description, children, className, action }) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8">
      <MessageSquareText className="size-5 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  )
}

export function ErrorNote({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 skeleton-fade-in" aria-busy="true">
      <div className="h-8 w-64 rounded skeleton-base skeleton-shimmer" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded skeleton-base skeleton-shimmer" />)}
      </div>
      <div className="h-64 rounded-xl skeleton-base skeleton-shimmer" />
    </div>
  )
}

export function NoProject() {
  return <EmptyState title="Select a project">Choose a project in the sidebar to see how it appears in ChatGPT answers.</EmptyState>
}

/** Start / cancel control plus live progress for the run in flight. */
export function RunControls({ active, live, onStart, onCancel, starting, cancelling, startError }) {
  const inFlight = active && isActiveStatus(active.status)
  const liveMatches = Boolean(live && active && live.runId === active.id)
  const completed = liveMatches ? live.completed : active?.progress?.completed
  const total = liveMatches ? live.total : active?.progress?.total
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {inFlight ? (
          <Button variant="outline" onClick={() => onCancel(active.id)} disabled={cancelling || active.cancelRequested}>
            {active.cancelRequested ? "Cancelling…" : "Cancel run"}
          </Button>
        ) : null}
        <Button onClick={onStart} disabled={starting || inFlight}>
          {starting || inFlight ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {inFlight ? "Run in progress" : "Run visibility check"}
        </Button>
      </div>
      {inFlight ? (
        <div className="min-w-56" role="status" aria-live="polite">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${total ? Math.round(((completed || 0) / total) * 100) : 5}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {active.status === "queued" ? "Waiting to start" : `${completed || 0} of ${total || 5} prompts answered`}
          </div>
        </div>
      ) : null}
      {startError ? <ErrorNote>{describeStartError(startError)}</ErrorNote> : null}
    </div>
  )
}

export function FailureNote({ run }) {
  if (!run?.failureCode || run.status === "completed") return null
  return <ErrorNote>{errorText(run.failureCode)}</ErrorNote>
}

/** A neutral / success note (ErrorNote's counterpart). `tone`: "info" | "success" | "warn". */
export function Notice({ children, tone = "info", className }) {
  const tones = {
    info: "border-border bg-muted/40 text-foreground",
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300",
  }
  return <div role="status" className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone] || tones.info, className)}>{children}</div>
}

/** A small label pill; `tone` carries meaning only: success = approved / answered, warn = draft / partial, neutral otherwise. */
export function Pill({ children, tone = "neutral", className }) {
  const tones = {
    neutral: "border-border bg-muted/40 text-muted-foreground",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  }
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone] || tones.neutral, className)}>{children}</span>
}

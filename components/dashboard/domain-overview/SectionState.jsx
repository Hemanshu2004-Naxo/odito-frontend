"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The three states every section has besides "here is the data":
 *  - loading: a skeleton shaped like the section (passed in), never a page-wide spinner;
 *  - error:   an inline message with its own Retry button — the rest of the page keeps working;
 *  - empty:   a friendly sentence instead of a broken, empty chart.
 */

/** A shimmering placeholder block; pass the size/shape in className. */
export function Skel({ className }) {
  return <div className={cn("skeleton-base skeleton-shimmer rounded", className)} aria-hidden />
}

export function SectionError({ message, onRetry, className }) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm dark:border-red-500/30 dark:bg-red-500/10", className)}>
      <div className="flex items-start gap-2 text-red-800 dark:text-red-200">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{message || "This section could not be loaded."}</span>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden /> Retry
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyNote({ children, className }) {
  return (
    <div className={cn("flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  )
}

/**
 * Chooses what a section shows. `state` is the SectionState from useDomainOverview. While a REFRESH is running the old data stays
 * (state.status is still "success"), so a refresh never blanks the page.
 */
export function SectionBoundary({ state, skeleton, empty = false, emptyMessage, children, errorClassName }) {
  if (!state || state.status === "loading") return skeleton ?? null
  if (state.status === "error") return <SectionError message={state.error?.message} onRetry={state.refetch} className={errorClassName} />
  if (empty) return <EmptyNote>{emptyMessage}</EmptyNote>
  return children
}

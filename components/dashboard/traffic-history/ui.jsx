"use client"

import { cn } from "@/lib/utils"
import { MISSING, formatPercent1 } from "../domain-overview/format"

/**
 * A percentage change with its direction: ▲ green when up, ▼ red when down, quiet when flat, "—" when unknown (never "0%" for
 * "we do not know"). The arrow and a screen-reader word carry the direction, so colour is never the only signal.
 */
export function ChangeText({ percent, direction, className, testId }) {
  if (percent === null || percent === undefined || !direction) {
    return <span className={cn("text-muted-foreground", className)} data-testid={testId}>{MISSING}</span>
  }
  const up = direction === "up"
  const down = direction === "down"
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", up && "text-emerald-600 dark:text-emerald-400", down && "text-red-600 dark:text-red-400", !up && !down && "text-muted-foreground", className)}
      data-testid={testId}
      data-direction={direction}
    >
      <span aria-hidden>{up ? "▲" : down ? "▼" : "–"}</span>
      <span className="sr-only">{up ? "Up " : down ? "Down " : "No change "}</span>
      {formatPercent1(Math.abs(percent))}
    </span>
  )
}

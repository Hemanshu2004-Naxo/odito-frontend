"use client"

import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { TRAFFIC_HINT } from "../traffic-history/SummaryCards"

const Grid = ({ children }) => (
  <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-6 @min-[1180px]/main:grid-cols-5" data-testid="ok-summary">{children}</div>
)

// Narrow: two columns (Movement full width). Mid-width: 3 cards over 2 (6 columns: 2 + 3). Wide: all five side by side.
function Card({ label, hint, testId, children, caption, wide, full }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/60 bg-card p-4 @min-[1180px]/main:col-span-1", wide ? "@min-[900px]/main:col-span-3" : "@min-[900px]/main:col-span-2", full && "col-span-2")} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        {hint ? <InfoHint label={label} text={hint} /> : null}
      </div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight">{children}</div>
      {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

const num = (v) => <span title={formatExact(v)}>{formatCompact(v)}</span>

/**
 * The whole domain at a glance — from the UNFILTERED totals (the provider's metrics for a filtered request describe only the rows that
 * match, so they are never used here). They do not change when the table is filtered; a caption says so.
 */
export default function SummaryCards({ state, summary }) {
  if (state.status === "loading") {
    return <Grid>{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-[112px] rounded-xl" />)}</Grid>
  }
  if (state.status === "error") {
    return <SectionError message={state.error?.message} onRetry={state.refetch} />
  }
  const { movement } = summary
  const hasMovement = movement.added !== null || movement.up !== null || movement.down !== null
  return (
    <Grid>
      <Card label="Total keywords" testId="ok-card-total" caption="Whole domain">{num(summary.total)}</Card>
      <Card label="Top 3" testId="ok-card-top3" caption="Ranking in positions 1–3">{num(summary.top3)}</Card>
      <Card label="Top 10" testId="ok-card-top10" caption="Ranking in positions 1–10">{num(summary.top10)}</Card>
      <Card wide label="Est. traffic" hint={TRAFFIC_HINT} testId="ok-card-traffic" caption="Monthly organic visits">{num(summary.traffic)}</Card>
      <Card wide full label="Movement" testId="ok-card-movement" caption="New · improved · declined">
        {hasMovement ? (
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xl" aria-label={`${formatExact(movement.added)} new, ${formatExact(movement.up)} improved, ${formatExact(movement.down)} declined`}>
            <span className="text-sky-600 dark:text-sky-400" title={`${formatExact(movement.added)} new keywords`} data-testid="ok-move-new">+{formatCompact(movement.added)}</span>
            <span className="text-emerald-600 dark:text-emerald-400" title={`${formatExact(movement.up)} improved`} data-testid="ok-move-up">▲{formatCompact(movement.up)}</span>
            <span className="text-red-600 dark:text-red-400" title={`${formatExact(movement.down)} declined`} data-testid="ok-move-down">▼{formatCompact(movement.down)}</span>
          </span>
        ) : MISSING}
      </Card>
    </Grid>
  )
}

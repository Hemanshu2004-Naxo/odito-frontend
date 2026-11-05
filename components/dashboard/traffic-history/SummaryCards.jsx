"use client"

import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { ChangeText } from "./ui"
import { METRICS } from "./trafficStory"

export const TRAFFIC_HINT = "Estimated from rankings × CTR"

const FORMAT = { traffic: [formatCompact, formatExact], keywords: [formatCompact, formatExact], value: [formatUsdCompact, formatUsdExact], top10: [formatCompact, formatExact] }

const Skeleton = () => (
  <div className="grid grid-cols-1 gap-3 @min-[560px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-4">
    {METRICS.map((c) => <Skel key={c.key} className="h-[128px] rounded-2xl" />)}
  </div>
)

/**
 * Four cards: the latest month against the FIRST month of the selected range, with the range's peak underneath. Each card is a button
 * that puts its metric on the main chart; the chosen one is outlined and badged "On chart". green = up, red = down; a missing figure or a
 * zero starting point has no percentage ("—").
 */
export default function SummaryCards({ state, summary, selected = "traffic", onSelect }) {
  return (
    <SectionBoundary state={state} skeleton={<Skeleton />}>
      <div className="grid grid-cols-1 gap-3 @min-[560px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-4" data-testid="th-summary" role="group" aria-label="Metric shown on the chart">
        {METRICS.map(({ key, label, color }) => {
          const m = summary[key]
          const [compact, exact] = FORMAT[key]
          const on = selected === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect?.(key)}
              className={cn(
                "relative min-w-0 overflow-hidden rounded-2xl border bg-card py-3.5 pl-5 pr-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-2" : "border-border/60 hover:border-foreground/25",
              )}
              style={on ? { borderColor: color } : undefined}
              data-testid={`th-card-${key}`}
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden />
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground/80" title={key === "traffic" ? TRAFFIC_HINT : undefined} data-testid={`th-label-${key}`}>
                  {label}
                  {key === "traffic" ? <span className="sr-only"> ({TRAFFIC_HINT})</span> : null}
                </span>
                {on ? <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">On chart</span> : null}
              </span>
              <span className="mt-1.5 block text-[30px] font-semibold leading-none tracking-tight tabular-nums" title={exact(m.latest)} data-testid={`th-latest-${key}`}>{compact(m.latest)}</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" title={m.change.basis ? `Latest month ${m.change.basis}` : undefined}>
                <ChangeText percent={m.change.percent} direction={m.change.direction} testId={`th-change-${key}`} />
                {m.change.basis ? <span className={cn(m.change.direction === "down" ? "text-red-600 dark:text-red-400" : m.change.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{m.change.basis}</span> : null}
              </span>
              <span className="mt-2 block text-[11px] text-muted-foreground" data-testid={`th-peak-${key}`}>
                Peak {m.peak.value === null ? MISSING : <span className="tabular-nums" title={exact(m.peak.value)}>{compact(m.peak.value)}</span>}
                {m.peak.label ? <> ({m.peak.label})</> : null}
              </span>
            </button>
          )
        })}
      </div>
    </SectionBoundary>
  )
}

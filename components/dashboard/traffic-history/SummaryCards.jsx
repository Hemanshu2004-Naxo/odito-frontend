"use client"

import InfoHint from "../referring-domains/InfoHint"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { ChangeText } from "./ui"

export const TRAFFIC_HINT = "Estimated from rankings × CTR"

const CARDS = [
  { key: "traffic", label: "Organic Traffic", caption: "Est. traffic", hint: TRAFFIC_HINT, compact: formatCompact, exact: formatExact },
  { key: "keywords", label: "Organic Keywords", caption: "Ranking keywords", compact: formatCompact, exact: formatExact },
  { key: "value", label: "Traffic Value", caption: "Est. monthly value", compact: formatUsdCompact, exact: formatUsdExact },
  { key: "top10", label: "Top 10 Keywords", caption: "Ranking in positions 1–10", compact: formatCompact, exact: formatExact },
]

const Skeleton = () => (
  <div className="grid grid-cols-1 gap-3 @min-[560px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-4">
    {CARDS.map((c) => <Skel key={c.key} className="h-[132px] rounded-xl" />)}
  </div>
)

/**
 * The latest month against the FIRST month of the selected range, with the range's peak underneath. green = up, red = down;
 * a missing figure or a zero starting point has no percentage ("—").
 */
export default function SummaryCards({ state, summary }) {
  return (
    <SectionBoundary state={state} skeleton={<Skeleton />}>
      <div className="grid grid-cols-1 gap-3 @min-[560px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-4" data-testid="th-summary">
        {CARDS.map(({ key, label, caption, hint, compact, exact }) => {
          const m = summary[key]
          return (
            <div key={key} className="min-w-0 rounded-xl border border-border/60 bg-card p-4" data-testid={`th-card-${key}`}>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{label}</span>
                {hint ? <InfoHint label={label} text={hint} /> : null}
              </div>
              <div className="mt-1.5 text-3xl font-semibold tracking-tight" title={exact(m.latest)}>{compact(m.latest)}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium" title={m.change.basis ? `Latest month ${m.change.basis}` : undefined}>
                <ChangeText percent={m.change.percent} direction={m.change.direction} testId={`th-change-${key}`} />
                {m.change.basis ? <span className="font-normal text-muted-foreground">{m.change.basis}</span> : null}
              </p>
              <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground" data-testid={`th-peak-${key}`}>
                Peak: {m.peak.value === null ? MISSING : <span className="tabular-nums text-foreground" title={exact(m.peak.value)}>{compact(m.peak.value)}</span>}
                {m.peak.label ? <> ({m.peak.label})</> : null}
              </p>
            </div>
          )
        })}
      </div>
    </SectionBoundary>
  )
}

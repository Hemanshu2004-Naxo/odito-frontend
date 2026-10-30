"use client"

import Link from "next/link"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "./format"
import { positionHref } from "./hubLinks"

/**
 * "Keyword positions" (API 1): keywords per ranking bucket, plus the headline "Top 10: X keywords (Y%)". Each bucket is a row you can click:
 * it opens Organic Keywords with the matching position range already chosen. The rows are real links (keyboard focusable, with a focus ring),
 * and the exact figure is in their accessible name.
 */
export default function KeywordPositionsCard({ state, positions, hasRankingData }) {
  const { buckets, top10 } = positions
  const max = Math.max(1, ...buckets.map((b) => b.value ?? 0))

  return (
    <Panel title="Keyword positions" description="Keywords by where they rank in Google" className="min-w-0">
      <SectionBoundary
        state={state}
        skeleton={<><Skel className="mb-3 h-5 w-48" /><Skel className="h-[236px] w-full rounded-lg" /></>}
        empty={!hasRankingData}
        emptyMessage="No ranking data yet for this domain."
      >
        <p className="mb-3 text-sm" data-testid="do-top10">
          {top10
            ? <>Top 10: <span className="font-semibold tabular-nums" title={formatExact(top10.count)}>{formatCompact(top10.count)} keywords</span>{top10.percent !== null ? <span className="text-muted-foreground"> ({formatPercent1(top10.percent)})</span> : null}</>
            : <span className="text-muted-foreground">Top 10: {MISSING}</span>}
        </p>
        <ul aria-label="Keywords per position range" className="space-y-1" data-testid="do-positions-chart">
          {buckets.map((b) => {
            const known = b.value !== null
            const row = (
              <>
                <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{b.label}</span>
                <span className="relative h-[18px] min-w-0 flex-1" aria-hidden>
                  {known ? <span className="absolute inset-y-0 left-0 rounded-r bg-primary" style={{ width: `${Math.max(1, (b.value / max) * 100)}%` }} data-testid="do-position-bar" /> : null}
                </span>
                <span className="w-14 shrink-0 text-right text-[12px] font-medium tabular-nums" title={known ? formatExact(b.value) : undefined}>{known ? formatCompact(b.value) : MISSING}</span>
              </>
            )
            return (
              <li key={b.key}>
                {known ? (
                  <Link
                    href={positionHref(b.key)}
                    aria-label={`Positions ${b.label}: ${formatExact(b.value)} keywords. Open them in Organic Keywords`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`do-position-${b.key}`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-1.5" aria-label={`Positions ${b.label}: not available`}>{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      </SectionBoundary>
    </Panel>
  )
}

"use client"

import Link from "next/link"
import OverviewCard, { Note } from "./OverviewCard"
import MovementStrip from "./MovementStrip"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { positionHref } from "./hubLinks"
import { describePositions } from "./overviewInsights"

/** Page-1 buckets are green, #11–20 teal, deeper positions indigo — the closer to the top, the "healthier" the colour. */
const BAR_COLOR = {
  top1: "bg-emerald-600 dark:bg-emerald-500",
  top3: "bg-emerald-600 dark:bg-emerald-500",
  top10: "bg-emerald-500 dark:bg-emerald-400",
  top20: "bg-teal-600 dark:bg-teal-500",
  top50: "bg-indigo-400 dark:bg-indigo-400",
  top100: "bg-indigo-400 dark:bg-indigo-400",
}

/**
 * "Where your keywords rank" (API 1): keywords per ranking bucket as bars on a track, what that means in one sentence, then this month's
 * movement (new / improved / declined / lost). Each bar is a link: it opens Organic Keywords with the matching position range chosen.
 */
export default function KeywordPositionsCard({ state, positions, hasRankingData, movement, keywordsTotal }) {
  const { buckets } = positions
  const max = Math.max(1, ...buckets.map((b) => b.value ?? 0))
  const note = describePositions(positions)
  const description = keywordsTotal === null || keywordsTotal === undefined
    ? "Keywords by Google position · tap a bar to see them"
    : `${formatExact(keywordsTotal)} keywords by Google position · tap a bar to see them`

  return (
    <OverviewCard title="Where your keywords rank" description={description} className="h-full">
      <SectionBoundary
        state={state}
        skeleton={<><Skel className="h-[180px] w-full rounded-lg" /><Skel className="mt-4 h-[64px] w-full rounded-lg" /></>}
        empty={!hasRankingData}
        emptyMessage="No ranking data yet for this domain."
      >
        <ul aria-label="Keywords per position range" className="space-y-0.5" data-testid="do-positions-chart">
          {buckets.map((b) => {
            const known = b.value !== null
            const row = (
              <>
                <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">{b.label}</span>
                <span className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {known && b.value > 0 ? <span className={`absolute inset-y-0 left-0 rounded-full ${BAR_COLOR[b.key] ?? "bg-primary"}`} style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }} data-testid="do-position-bar" /> : null}
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums" title={known ? formatExact(b.value) : undefined}>{known ? formatCompact(b.value) : MISSING}</span>
              </>
            )
            return (
              <li key={b.key}>
                {known ? (
                  <Link
                    href={positionHref(b.key)}
                    aria-label={`Positions ${b.label}: ${formatExact(b.value)} keywords. Open them in Organic Keywords`}
                    className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`do-position-${b.key}`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-1.5 py-1.5" aria-label={`Positions ${b.label}: not available`}>{row}</div>
                )}
              </li>
            )
          })}
        </ul>
        <Note className="mt-3" testId="do-top10">{note}</Note>
        <div className="mt-4">
          <MovementStrip state={state} movement={movement} hasRankingData={hasRankingData} />
        </div>
      </SectionBoundary>
    </OverviewCard>
  )
}

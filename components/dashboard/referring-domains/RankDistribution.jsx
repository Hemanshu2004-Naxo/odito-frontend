"use client"

import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import InfoHint from "./InfoHint"
import { PROFILE_SCOPE_LABEL } from "./constants"

const label = (b) => (b.max === null ? `${b.min}+` : `${b.min}–${b.max}`)

/** Does the table's rank filter equal this bucket? */
const isApplied = (state, b) => state.minRank === String(b.min) && state.maxRank === (b.max === null ? "" : String(b.max))

/**
 * "Authority distribution": how many referring domains fall in each rank bucket. A click on a bucket applies that rank range to the table.
 * WHOLE PROFILE: live links, no filters, no dofollow switch — nothing on the page changes these numbers (they are five count-only requests,
 * cached for 7 days). The bars are real buttons.
 */
export default function RankDistribution({ buckets, state, onSelect }) {
  const data = buckets.data ?? []
  const total = data.reduce((s, b) => s + b.count, 0)
  const max = Math.max(1, ...data.map((b) => b.count))
  return (
    <Panel
      title={<span className="flex items-center gap-1.5">Authority distribution<InfoHint label="Authority distribution" text="How many referring domains have a link rank in each range (0–1000, higher = stronger). Click a bar to show only those domains in the table below." /></span>}
      description={<span data-testid="rd-rank-scope">{PROFILE_SCOPE_LABEL}</span>}
      className="min-w-0"
    >
      <SectionBoundary
        state={{ status: buckets.status, error: buckets.error, refetch: buckets.refetch }}
        skeleton={<div className="space-y-2" aria-hidden>{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-7 w-full" />)}</div>}
        empty={data.length === 0 || total === 0}
        emptyMessage="No referring domains found for this domain yet."
      >
        <ul className="space-y-1" data-testid="rd-rank-buckets" data-counts={data.map((b) => b.count).join("|")} data-keys={data.map((b) => b.key).join("|")}>
          {data.map((b) => {
            const applied = isApplied(state, b)
            return (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => onSelect(b)}
                  aria-pressed={applied}
                  aria-label={`Rank ${label(b)}: ${formatExact(b.count)} referring domains. Show only these in the table.`}
                  className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="rd-rank-bar"
                  data-key={b.key}
                >
                  <span className={applied ? "font-semibold" : ""}>{label(b)}</span>
                  <span className="h-5 overflow-hidden rounded bg-muted/50" role="presentation">
                    <span className="block h-full rounded bg-primary" style={{ width: `${b.count === 0 ? 0 : Math.max(2, (b.count / max) * 100)}%` }} />
                  </span>
                  <span className="min-w-20 text-right tabular-nums text-muted-foreground" title={`${formatExact(b.count)} referring domains`}>
                    {formatCompact(b.count)} <span className="text-xs">· {total > 0 ? formatPercent1((b.count / total) * 100) : "—"}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Counts do not change with the table&apos;s tab, filters or the Dofollow switch.</p>
      </SectionBoundary>
    </Panel>
  )
}

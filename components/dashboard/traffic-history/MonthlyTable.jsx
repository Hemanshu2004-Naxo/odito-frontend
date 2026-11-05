"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { downloadCsv } from "../referring-domains/exportCsv"
import OverviewCard from "../domain-overview/OverviewCard"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { buildTrafficHistoryCsv, trafficHistoryCsvFileName } from "./exportCsv"
import { sortRows } from "./mapTrafficHistory"
import { TRAFFIC_HINT } from "./SummaryCards"
import { ChangeText } from "./ui"
import { isBigFall } from "./trafficStory"

const plain = (read, fmt = formatCompact, exact = formatExact) => (r) => <span title={exact(read(r))}>{fmt(read(r))}</span>
const tinted = (read, tone) => (r) => <span className={tone} title={formatExact(read(r))}>{formatCompact(read(r))}</span>
const GOOD = "text-emerald-600 dark:text-emerald-400"
const BAD = "text-red-600 dark:text-red-400"

const COLUMNS = [
  { key: "month", label: "Month", cell: (r) => <span className="font-semibold" title={r.longLabel}>{r.label}</span> },
  { key: "traffic", label: "Traffic", hint: TRAFFIC_HINT, numeric: true, cell: (r) => <span className="font-semibold" title={formatExact(r.traffic)}>{formatCompact(r.traffic)}</span> },
  { key: "trafficChange", label: "Change", ariaLabel: "Traffic change", numeric: true, cell: (r) => <ChangeText percent={r.mom.traffic.percent} direction={r.mom.traffic.direction} className="font-semibold" /> },
  { key: "keywords", label: "Keywords", numeric: true, cell: plain((r) => r.keywords) },
  { key: "keywordsChange", label: "Change", ariaLabel: "Keywords change", numeric: true, cell: (r) => <ChangeText percent={r.mom.keywords.percent} direction={r.mom.keywords.direction} className="font-semibold" /> },
  { key: "value", label: "Value", numeric: true, cell: plain((r) => r.value, formatUsdCompact, formatUsdExact) },
  { key: "top3g", label: "Top 3", numeric: true, cell: plain((r) => sumTop3(r)) },
  { key: "top10", label: "4–10", numeric: true, cell: plain((r) => r.buckets.top10) },
  { key: "top20", label: "11–20", numeric: true, cell: plain((r) => r.buckets.top20) },
  { key: "new", label: "New", numeric: true, cell: tinted((r) => r.movement.new, GOOD) },
  { key: "up", label: "Improved", numeric: true, cell: tinted((r) => r.movement.up, GOOD) },
  { key: "down", label: "Declined", numeric: true, cell: tinted((r) => r.movement.down, BAD) },
  { key: "lost", label: "Lost", numeric: true, cell: tinted((r) => r.movement.lost, BAD) },
]

/** Top 3 = #1 + #2–3; null only when both are unknown. */
export function sumTop3(r) {
  const a = r.buckets.top1
  const b = r.buckets.top3
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0)
}

const Skeleton = () => <div className="space-y-2" aria-hidden>{Array.from({ length: 8 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}</div>

/**
 * "Month by month": one row per month, newest first to start with. Months whose traffic fell 20% or more are tinted. Every heading sorts
 * (click again to flip); unknown values always sort last. Export CSV downloads what is on screen: the selected range, in the current order.
 */
export default function MonthlyTable({ state, rows, domain, months, onExported, onExportError }) {
  const [sort, setSort] = useState({ key: "month", dir: "desc" })
  const sorted = sortRows(rows, sort.key, sort.dir)

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))

  const exportCsv = () => {
    try {
      downloadCsv(trafficHistoryCsvFileName(domain, months), buildTrafficHistoryCsv(sorted))
      onExported?.(sorted.length)
    } catch {
      onExportError?.()
    }
  }

  return (
    <OverviewCard
      title="Month by month"
      description="Changes compare each month with the one before"
      action={(
        <button type="button" onClick={exportCsv} disabled={!sorted.length} className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Export CSV
        </button>
      )}
    >
      <SectionBoundary state={state} skeleton={<Skeleton />}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]" data-testid="th-table">
            <thead>
              <tr className="bg-muted/50">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key
                  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:rounded-l-lg last:rounded-r-lg", c.numeric ? "text-right" : "text-left")}>
                      <span className={cn("inline-flex items-center gap-1", c.numeric && "justify-end")}>
                        <button
                          type="button"
                          onClick={() => onSort(c.key)}
                          aria-label={c.ariaLabel ? `Sort by ${c.ariaLabel}` : undefined}
                          className="inline-flex items-center gap-0.5 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.label}
                          {active && sort.key !== "month" ? <Icon className="size-3" aria-hidden /> : null}
                        </button>
                        {c.hint ? <InfoHint label={c.label} text={c.hint} /> : null}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.key} className={cn("border-b border-border/40 last:border-0", isBigFall(r) && "bg-red-50/70 dark:bg-red-500/[0.06]")} data-testid="th-row" data-fall={isBigFall(r) ? "1" : "0"}>
                  {COLUMNS.map((c) => <td key={c.key} className={cn("px-2 py-2.5", c.numeric && "text-right tabular-nums")}>{c.cell(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBoundary>
    </OverviewCard>
  )
}

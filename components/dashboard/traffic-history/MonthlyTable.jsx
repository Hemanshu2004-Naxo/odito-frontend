"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { downloadCsv } from "../referring-domains/exportCsv"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { buildTrafficHistoryCsv, trafficHistoryCsvFileName } from "./exportCsv"
import { sortRows } from "./mapTrafficHistory"
import { TRAFFIC_HINT } from "./SummaryCards"
import { ChangeText } from "./ui"

const num = (key, read, fmt = formatCompact, exact = formatExact) => ({ key, numeric: true, cell: (r) => <span title={exact(read(r))}>{fmt(read(r))}</span> })

const COLUMNS = [
  { key: "month", label: "Month", cell: (r) => <span className="font-medium" title={r.longLabel}>{r.label}</span> },
  { ...num("traffic", (r) => r.traffic), label: "Traffic", hint: TRAFFIC_HINT },
  { key: "trafficChange", label: "Δ Traffic %", numeric: true, cell: (r) => <ChangeText percent={r.mom.traffic.percent} direction={r.mom.traffic.direction} /> },
  { ...num("keywords", (r) => r.keywords), label: "Keywords" },
  { key: "keywordsChange", label: "Δ Keywords %", numeric: true, cell: (r) => <ChangeText percent={r.mom.keywords.percent} direction={r.mom.keywords.direction} /> },
  { ...num("value", (r) => r.value, formatUsdCompact, formatUsdExact), label: "Traffic value" },
  { ...num("top1", (r) => r.buckets.top1), label: "#1" },
  { ...num("top3", (r) => r.buckets.top3), label: "#2–3" },
  { ...num("top10", (r) => r.buckets.top10), label: "#4–10" },
  { ...num("top20", (r) => r.buckets.top20), label: "#11–20" },
  { ...num("new", (r) => r.movement.new), label: "New" },
  { ...num("up", (r) => r.movement.up), label: "Up" },
  { ...num("down", (r) => r.movement.down), label: "Down" },
  { ...num("lost", (r) => r.movement.lost), label: "Lost" },
]

const Skeleton = () => <div className="space-y-2" aria-hidden>{Array.from({ length: 8 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}</div>

/**
 * "Monthly data": one row per month, newest first to start with. Every column sorts (click again to flip); unknown values always
 * sort last. Export CSV downloads what is on screen: the selected range, in the current order.
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
    <Panel
      title="Monthly data"
      description="One row per month. Change columns compare each month with the one before it."
      action={(
        <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}>
          <Download className="size-4" aria-hidden /> Export CSV
        </Button>
      )}
      className="min-w-0"
    >
      <SectionBoundary state={state} skeleton={<Skeleton />}>
        <Table className="min-w-[1100px]" data-testid="th-table">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
                return (
                  <TableHead key={c.key} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn(c.numeric && "text-right")}>
                    <div className={cn("inline-flex items-center gap-1", c.numeric && "justify-end")}>
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {c.label}
                        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
                      </button>
                      {c.hint ? <InfoHint label={c.label} text={c.hint} /> : null}
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.key} data-testid="th-row">
                {COLUMNS.map((c) => <TableCell key={c.key} className={cn(c.numeric && "text-right tabular-nums")}>{c.cell(r)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionBoundary>
    </Panel>
  )
}

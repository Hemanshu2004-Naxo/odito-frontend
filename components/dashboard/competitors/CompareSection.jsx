"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Plus, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { TRAFFIC_HINT } from "../traffic-history/SummaryCards"
import { LOCAL_PACK_COLOR, PAID_COLOR, SNIPPET_COLOR } from "../traffic-history/chartColors"
import { Legend, Swatch, TooltipRow, TooltipShell, chartClass } from "../traffic-history/ChartParts"
import { DomainLink } from "./cells"
import { sortComparison } from "./mapBulkTraffic"
import { normalizeDomain } from "@/lib/normalizeDomain"

const SERIES = [
  { key: "organicTraffic", label: "Organic traffic", color: "currentColor" },
  { key: "localPackTraffic", label: "Local pack traffic", color: LOCAL_PACK_COLOR },
  { key: "featuredSnippetTraffic", label: "Featured snippet traffic", color: SNIPPET_COLOR },
  { key: "paidTraffic", label: "Paid traffic", color: PAID_COLOR },
]

const COLUMNS = [
  { key: "domain", label: "Domain" },
  { key: "organicTraffic", label: "Organic traffic", align: "end", hint: TRAFFIC_HINT, hintLabel: "Est. traffic" },
  { key: "organicKeywords", label: "Organic keywords", align: "end" },
  { key: "localPackTraffic", label: "Local pack traffic", align: "end", hint: "Estimated visits from Google's map results (the local pack)." },
  { key: "featuredSnippetTraffic", label: "Featured snippet traffic", align: "end", hint: "Estimated visits from featured snippets (the answer box above the results)." },
  { key: "paidTraffic", label: "Paid traffic", align: "end", hint: "Estimated visits from paid ads." },
  { key: "paidKeywords", label: "Paid keywords", align: "end" },
]

const short = (domain) => (domain.length > 16 ? `${domain.slice(0, 15)}…` : domain)

/** The chart's data: one entry per domain; a metric the provider did not give stays undefined (no bar), never 0. */
export function buildCompareChart(rows) {
  return rows.filter((r) => r.found).map((r) => ({
    domain: r.domain,
    name: r.isProject ? "You" : short(r.domain),
    isProject: r.isProject,
    ...Object.fromEntries(SERIES.map((s) => [s.key, r[s.key] ?? undefined])),
  }))
}

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.isProject ? `You · ${d.domain}` : d.domain}>
      {SERIES.map((s) => <TooltipRow key={s.key} swatch={<Swatch color={s.color} />} name={s.label}>{formatExact(d[s.key])}</TooltipRow>)}
    </TooltipShell>
  )
}

function SortHead({ column, sort, onSort }) {
  const active = sort.key === column.key
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={cn("align-bottom", column.align === "end" && "text-right")}>
      <span className={cn("inline-flex items-center gap-0.5", column.align === "end" && "justify-end")}>
        <button
          type="button"
          onClick={() => onSort(column.key)}
          className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-foreground" : "text-foreground/80")}
          aria-label={`Sort by ${column.label}${active ? `, currently ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}
        >
          {column.label}<Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
        </button>
        {column.hint ? <InfoHint label={column.hintLabel ?? column.label} text={column.hint} /> : null}
      </span>
    </TableHead>
  )
}

function AddDomain({ onAdd, full }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!normalizeDomain(value)) { setError("Enter a valid domain, for example example.com."); return }
    setBusy(true)
    const res = await onAdd(value)
    setBusy(false)
    if (res.ok) { setValue(""); setError(null) } else setError(res.message)
  }
  return (
    <form onSubmit={submit} className="w-full max-w-md" data-testid="cp-add-form">
      <label htmlFor="cp-add-domain" className="sr-only">Add domain to compare</label>
      <div className="flex gap-2">
        <Input
          id="cp-add-domain"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          placeholder="Add any domain, e.g. example.com"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "cp-add-error" : undefined}
          className="h-9"
          data-testid="cp-add-input"
        />
        <Button type="submit" variant="outline" disabled={busy || !value.trim() || full} data-testid="cp-add-button">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} Add domain
        </Button>
      </div>
      {error ? <p id="cp-add-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="cp-add-error">{error}</p> : null}
    </form>
  )
}

const Cell = ({ row, field }) => (row.loading ? <Skel className="ml-auto h-4 w-14" /> : <span className="tabular-nums" title={formatExact(row[field])}>{row[field] === null ? MISSING : formatCompact(row[field])}</span>)

/**
 * "Tracked competitors" (API 5): the project and the competitors pinned with the star, side by side. Hidden behind a hint while nothing is
 * tracked. Any domain can be added by hand, whether or not it is in the competitors list. The project is highlighted in the chart and
 * pinned to the top of the table, whatever the sort.
 */
export default function CompareSection({ compare, settings, onNotify }) {
  const [sort, setSort] = useState({ key: "organicTraffic", dir: "desc" })
  const tracked = settings.tracked
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "domain" ? "asc" : "desc" }))

  const rows = useMemo(() => sortComparison(compare.rows, sort.key, sort.dir), [compare.rows, sort])
  const chart = useMemo(() => buildCompareChart(compare.rows), [compare.rows])

  const add = async (input) => {
    const res = await settings.track(input)
    if (res.ok) onNotify?.(`Tracking ${res.domain}.`, "success")
    return res
  }
  const remove = async (domain) => {
    const res = await settings.untrack(domain)
    if (!res.ok) onNotify?.(res.message, "danger")
  }

  const action = <AddDomain onAdd={add} full={tracked.length >= settings.trackedLimit} />
  const count = `${tracked.length} of ${settings.trackedLimit} tracked`

  return (
    <Panel
      title="Tracked competitors"
      description="You and the competitors you pinned, side by side"
      action={<span className="pt-1 text-xs text-muted-foreground tabular-nums" data-testid="cp-tracked-count">{count}</span>}
      className="min-w-0"
    >
      <div className="mb-4">{action}</div>

      {tracked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="cp-compare-hint">
          Pin competitors with ☆ to compare them here.
        </div>
      ) : compare.status === "error" ? (
        <SectionError message={compare.error?.message} onRetry={compare.refetch} />
      ) : compare.status === "loading" ? (
        <div className="space-y-3" data-testid="cp-compare-skeleton" aria-hidden>
          <Skel className="h-[280px] w-full rounded-lg" />
          {Array.from({ length: Math.min(tracked.length + 1, 4) }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
        </div>
      ) : (
        <div className={cn("space-y-5 transition-opacity", compare.isFetching && "opacity-70")} aria-busy={compare.isFetching || compare.pending}>
          <div>
            <Legend label="Traffic types" items={SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color }))} />
            <div className={cn(chartClass("h-[300px]"), "mt-2")} role="img" aria-label={`Grouped bars comparing organic, local pack, featured snippet and paid traffic for you and ${tracked.length} competitor${tracked.length === 1 ? "" : "s"}.`} data-testid="cp-compare-chart" data-domains={chart.length}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
                  {chart.some((d) => d.isProject) ? <ReferenceArea x1="You" x2="You" fill="currentColor" fillOpacity={0.09} ifOverflow="visible" /> : null}
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={formatCompact} />
                  <Tooltip content={<CompareTooltip />} cursor={false} />
                  {SERIES.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Table data-testid="cp-compare-table">
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => <SortHead key={c.key} column={c} sort={sort} onSort={onSort} />)}
                <TableHead className="w-10"><span className="sr-only">Remove</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.domain} className={cn(row.isProject && "bg-primary/5")} data-testid="cp-compare-row" data-domain={row.domain} data-project={row.isProject ? "true" : undefined}>
                  <TableCell className="max-w-[240px]">
                    <span className="flex items-center gap-2">
                      <DomainLink domain={row.domain} />
                      {row.isProject ? <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">You</span> : null}
                      {row.noData ? <span className="shrink-0 text-[11px] text-muted-foreground" title="The data provider has no ranking data for this domain.">No data</span> : null}
                    </span>
                  </TableCell>
                  {COLUMNS.slice(1).map((c) => <TableCell key={c.key} className="text-right"><Cell row={row} field={c.key} /></TableCell>)}
                  <TableCell className="w-10 pr-3">
                    {row.isProject ? null : (
                      <button
                        type="button"
                        onClick={() => remove(row.domain)}
                        aria-label={`Stop tracking ${row.domain}`}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {compare.pending ? <p className="text-xs text-muted-foreground" role="status">Updating the comparison…</p> : null}
        </div>
      )}
    </Panel>
  )
}

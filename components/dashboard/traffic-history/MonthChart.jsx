"use client"

import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronLeft, ChevronRight } from "lucide-react"
import OverviewCard from "../domain-overview/OverviewCard"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { TooltipRow, TooltipShell } from "./ChartParts"
import { ChangeText } from "./ui"
import { metricOf } from "./trafficStory"

const fmt = (money) => (money ? formatUsdCompact : formatCompact)
const fmtExact = (money) => (money ? formatUsdExact : formatExact)

function MonthTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  const m = metricOf(metric)
  return (
    <TooltipShell title={r.longLabel}>
      <TooltipRow name={m.short}>{fmtExact(m.money)(r[metric])}{r.mom[metric] ? <ChangeText percent={r.mom[metric].percent} direction={r.mom[metric].direction} /> : null}</TooltipRow>
    </TooltipShell>
  )
}

/** The strip under the chart: the chosen month's four figures, with arrows to step through the months from the keyboard. */
function MonthStrip({ row, onStep, canBack, canForward }) {
  const cell = (label, value, change, testId) => (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums" data-testid={testId}>
        {value}
        {change ? <ChangeText percent={change.percent} direction={change.direction} className="text-[11px] font-semibold" /> : null}
      </div>
    </div>
  )
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-muted/50 px-4 py-3 @min-[700px]/main:grid-cols-5" data-testid="th-month-strip" aria-live="polite">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Month</div>
        <div className="mt-0.5 flex items-center gap-1">
          <button type="button" onClick={() => onStep(-1)} disabled={!canBack} aria-label="Previous month" className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" aria-hidden /></button>
          <span className="text-lg font-semibold" data-testid="th-month-label">{row.label}</span>
          <button type="button" onClick={() => onStep(1)} disabled={!canForward} aria-label="Next month" className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" aria-hidden /></button>
        </div>
      </div>
      {cell("Traffic", formatCompact(row.traffic), row.mom.traffic, "th-month-traffic")}
      {cell("Keywords", formatCompact(row.keywords), row.mom.keywords, "th-month-keywords")}
      {cell("Traffic value", formatUsdCompact(row.value), null, "th-month-value")}
      {cell("Top 10 keywords", row.top10 === null ? MISSING : formatExact(row.top10), null, "th-month-top10")}
    </div>
  )
}

/**
 * The main chart: the metric chosen in the cards above, one point per month. Clicking a month (or stepping with the strip's arrows) picks
 * it: a guide line and a ring mark it on the chart and the strip below shows that month's figures. The latest month is picked to start with.
 */
export default function MonthChart({ state, range, metric, selectedKey, onSelectMonth }) {
  const m = metricOf(metric)
  const hasData = range.some((r) => r[metric] !== null)
  const index = Math.max(0, range.findIndex((r) => r.key === selectedKey))
  const row = range[index] ?? range[range.length - 1]
  const step = (d) => { const next = range[index + d]; if (next) onSelectMonth(next.key) }

  return (
    <OverviewCard title={m.chartTitle} description="Click a month to see its numbers · switch the metric with the boxes above" testId="th-main-card">
      <SectionBoundary state={state} skeleton={<Skel className="h-[300px] w-full rounded-lg" />} empty={!hasData} emptyMessage="No data for this metric in this range.">
        <div
          className="h-[280px] w-full cursor-pointer [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[11px]"
          style={{ color: m.color }}
          data-testid="th-main-chart"
          data-metric={metric}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={range}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              onClick={(s) => { const i = s?.activeTooltipIndex; if (Number.isInteger(Number(i)) && range[Number(i)]) onSelectMonth(range[Number(i)].key) }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.6} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={fmt(m.money)} />
              <Tooltip content={<MonthTooltip metric={metric} />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
              <Area type="linear" dataKey={metric} stroke="currentColor" strokeWidth={2.25} fill="currentColor" fillOpacity={0.12} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} />
              {row ? <ReferenceLine x={row.label} stroke="var(--muted-foreground)" strokeOpacity={0.6} /> : null}
              {row && row[metric] !== null ? <ReferenceDot x={row.label} y={row[metric]} r={6} fill="var(--card)" stroke="currentColor" strokeWidth={2.5} /> : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {row ? <MonthStrip row={row} onStep={step} canBack={index > 0} canForward={index < range.length - 1} /> : null}
        <table className="sr-only">
          <caption>{m.chartTitle}</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">{m.short}</th></tr></thead>
          <tbody>{range.map((r) => <tr key={r.key}><th scope="row">{r.longLabel}</th><td>{fmtExact(m.money)(r[metric])}</td></tr>)}</tbody>
        </table>
      </SectionBoundary>
    </OverviewCard>
  )
}

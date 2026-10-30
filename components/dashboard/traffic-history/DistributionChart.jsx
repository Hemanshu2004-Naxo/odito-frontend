"use client"

import { useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { BUCKET_OPACITY } from "./chartColors"
import { Legend, Swatch, TooltipRow, TooltipShell, chartClass } from "./ChartParts"
import { buildDistribution, distributionBuckets } from "./mapTrafficHistory"

export function Segmented({ label, options, value, onChange, disabled = false }) {
  return (
    <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function DistributionTooltip({ active, payload, buckets, percent }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.longLabel}>
      {[...buckets].reverse().map((b) => {
        const count = d[`${b.key}__count`]
        return (
          <TooltipRow key={b.key} swatch={<Swatch opacity={BUCKET_OPACITY[b.key]} />} name={b.label}>
            {percent ? <>{formatPercent1(d[b.key])}<span className="font-normal text-muted-foreground">({formatExact(count)})</span></> : formatExact(count)}
          </TooltipRow>
        )
      })}
    </TooltipShell>
  )
}

const Skeleton = () => <Skel className="h-[320px] w-full rounded-lg" />

/**
 * "Ranking distribution over time": the six position buckets stacked per month, ONE hue from dark (#1) to light (#51–100).
 *  - Count / %: counts, or each bucket's share of that month's total across all six buckets.
 *  - Top 20 only: just #1 … #11–20, because #51–100 is usually so large it flattens everything else.
 */
export default function DistributionChart({ state, range }) {
  const [mode, setMode] = useState("count")
  const [top20Only, setTop20Only] = useState(false)
  const percent = mode === "percent"
  const buckets = distributionBuckets(top20Only)
  const data = buildDistribution(range, { percent, top20Only })
  const hasData = data.some((d) => d.total !== null)

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Show counts or percentages" value={mode} onChange={setMode} options={[{ value: "count", label: "Count" }, { value: "percent", label: "%" }]} />
      <Segmented label="Buckets shown" value={top20Only ? "top20" : "all"} onChange={(v) => setTop20Only(v === "top20")} options={[{ value: "all", label: "All" }, { value: "top20", label: "Top 20 only" }]} />
    </div>
  )

  return (
    <Panel title="Ranking distribution over time" description="Keywords by ranking position, per month" action={controls} className="min-w-0">
      <SectionBoundary state={state} skeleton={<Skeleton />} empty={!hasData} emptyMessage="No ranking distribution data for this range.">
        <div className="mb-2">
          <Legend items={buckets.map((b) => ({ key: b.key, label: b.label, opacity: BUCKET_OPACITY[b.key] }))} label="Position buckets" />
        </div>
        <div className={chartClass()} data-testid="th-distribution-chart" data-mode={mode} data-buckets={buckets.map((b) => b.key).join(",")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={48} domain={percent ? [0, 100] : [0, "auto"]} tickFormatter={percent ? (v) => `${v}%` : formatCompact} />
              <Tooltip content={<DistributionTooltip buckets={buckets} percent={percent} />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
              {buckets.map((b) => (
                <Area
                  key={b.key}
                  type="monotone"
                  stackId="distribution"
                  dataKey={b.key}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  fill="currentColor"
                  fillOpacity={BUCKET_OPACITY[b.key]}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

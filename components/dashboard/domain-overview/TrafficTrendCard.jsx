"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"
import OverviewCard, { FooterLink } from "./OverviewCard"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { describeTrend } from "./overviewInsights"

const METRICS = [
  { key: "etv", label: "Traffic", axis: "Estimated monthly visits from Google" },
  { key: "count", label: "Keywords", axis: "Keywords ranking in Google's top 100" },
]

/** One tooltip for the hovered month: the month, then traffic and keywords (both, whichever is plotted). */
function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-semibold text-popover-foreground">{p.label}</div>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex items-center justify-between gap-6"><span>Traffic</span><span className="font-medium tabular-nums text-popover-foreground">{formatExact(p.etv)}</span></div>
        <div className="flex items-center justify-between gap-6"><span>Keywords</span><span className="font-medium tabular-nums text-popover-foreground">{formatExact(p.count)}</span></div>
      </div>
    </div>
  )
}

const ChartSkeleton = () => <Skel className="h-[230px] w-full rounded-lg" />

export const TRAFFIC_HISTORY_HREF = "/app/traffic-history"

/** The segmented control the reference uses on its cards: a light track with the chosen option raised. */
export function CardToggle({ label, options, value, onChange, disabled = false }) {
  return (
    <div className="inline-flex rounded-lg bg-muted/70 p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * "Organic traffic: last 12 months" (API 2). A green area chart that switches between traffic and keyword count, a plain-language
 * summary of the year underneath, and a plain table of the same numbers for screen readers. The whole card opens Traffic History.
 */
export default function TrafficTrendCard({ state, trend }) {
  const router = useRouter()
  const [metric, setMetric] = useState("etv")
  const active = METRICS.find((m) => m.key === metric)
  const hasData = trend.some((p) => p.etv !== null || p.count !== null)
  const summary = describeTrend(trend, metric)

  const toggle = <CardToggle label="Metric shown in the chart" options={METRICS.map((m) => ({ value: m.key, label: m.label }))} value={metric} onChange={setMetric} />

  // The whole card opens Traffic History. A link around it would swallow the chart hover and nest the toggle's buttons inside a link, so
  // a click anywhere that is not itself a button or link navigates, and the footer link below is the keyboard / screen-reader way in.
  const open = (e) => { if (!e.target.closest("a, button")) router.push(TRAFFIC_HISTORY_HREF) }

  return (
    <div onClick={open} className="min-w-0 cursor-pointer rounded-2xl transition-shadow hover:ring-1 hover:ring-foreground/15" data-testid="do-trend-card">
      <OverviewCard
        title="Organic traffic: last 12 months"
        description={active.axis}
        action={toggle}
        className="h-full"
        footer={<FooterLink href={TRAFFIC_HISTORY_HREF}>Full traffic history</FooterLink>}
      >
        <SectionBoundary state={state} skeleton={<ChartSkeleton />} empty={!hasData} emptyMessage="No traffic history yet for this domain.">
          <div
            className="h-[230px] w-full text-emerald-600 dark:text-emerald-400 [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[10px]"
            data-testid="do-trend-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.6} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={formatCompact} />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
                <Area
                  type="linear"
                  dataKey={metric}
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="currentColor"
                  fillOpacity={0.12}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {summary ? (
            <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground/80" data-testid="do-trend-summary">{summary}</p>
          ) : null}
          <table className="sr-only">
            <caption>Organic traffic and ranking keywords by month</caption>
            <thead><tr><th scope="col">Month</th><th scope="col">Est. monthly traffic</th><th scope="col">Ranking keywords</th></tr></thead>
            <tbody>
              {trend.map((p) => (
                <tr key={p.key}><th scope="row">{p.label}</th><td>{p.etv === null ? MISSING : formatExact(p.etv)}</td><td>{p.count === null ? MISSING : formatExact(p.count)}</td></tr>
              ))}
            </tbody>
          </table>
        </SectionBoundary>
      </OverviewCard>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"

const METRICS = [
  { key: "etv", label: "Traffic", axis: "Est. monthly traffic" },
  { key: "count", label: "Keywords", axis: "Ranking keywords" },
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

const ChartSkeleton = () => <Skel className="h-[260px] w-full rounded-lg" />

/**
 * "Organic traffic — last 12 months" (API 2). An area chart that switches between traffic and keyword count. The plotted series
 * is the single hue of the page (text-primary), the axes and grid stay recessive, and a plain table of the same numbers is
 * available to screen readers.
 */
export const TRAFFIC_HISTORY_HREF = "/app/traffic-history"

export default function TrafficTrendCard({ state, trend }) {
  const router = useRouter()
  const [metric, setMetric] = useState("etv")
  const active = METRICS.find((m) => m.key === metric)
  const hasData = trend.some((p) => p.etv !== null || p.count !== null)

  const toggle = (
    <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5" role="group" aria-label="Metric shown in the chart">
      {METRICS.map((m) => (
        <button
          key={m.key}
          type="button"
          aria-pressed={metric === m.key}
          onClick={() => setMetric(m.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            metric === m.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )

  // The whole card opens Traffic History. A link around it would swallow the chart hover and nest the toggle's buttons inside a link, so
  // a click anywhere that is not itself a button or link navigates, and the footer link below is the keyboard / screen-reader way in.
  const open = (e) => { if (!e.target.closest("a, button")) router.push(TRAFFIC_HISTORY_HREF) }

  return (
    <div onClick={open} className="min-w-0 cursor-pointer rounded-xl transition-shadow hover:ring-1 hover:ring-foreground/20" data-testid="do-trend-card">
    <Panel title="Organic traffic — last 12 months" description={active.axis} action={toggle} className="min-w-0 h-full" >
      <SectionBoundary state={state} skeleton={<ChartSkeleton />} empty={!hasData} emptyMessage="No traffic history yet for this domain.">
        <div
          className="h-[260px] w-full text-primary [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[11px]"
          data-testid="do-trend-chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="currentColor"
                strokeWidth={2}
                fill="currentColor"
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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
      <div className="mt-3 border-t border-border/60 pt-3">
        <Link href={TRAFFIC_HISTORY_HREF} className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2">
          View full traffic history <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Panel>
    </div>
  )
}

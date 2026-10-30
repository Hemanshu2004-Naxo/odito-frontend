"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { TooltipRow, TooltipShell, chartClass } from "./ChartParts"
import { ChangeText } from "./ui"

function ValueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <TooltipShell title={r.longLabel}>
      <TooltipRow name="Traffic value">{formatUsdExact(r.value)}<ChangeText percent={r.mom.value.percent} direction={r.mom.value.direction} /></TooltipRow>
    </TooltipShell>
  )
}

/** "Traffic value": what the month's organic traffic would have cost to buy through paid search (USD), one thin bar per month. */
export default function TrafficValueChart({ state, range }) {
  const hasData = range.some((r) => r.value !== null)
  return (
    <Panel title="Traffic value" description="Estimated cost of buying this traffic through paid search, in USD" className="min-w-0">
      <SectionBoundary state={state} skeleton={<Skel className="h-[260px] w-full rounded-lg" />} empty={!hasData} emptyMessage="No traffic value data for this range.">
        <div className={chartClass("h-[260px]")} data-testid="th-value-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={range} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatUsdCompact} />
              <Tooltip content={<ValueTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
              <Bar dataKey="value" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

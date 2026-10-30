"use client"

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact } from "../domain-overview/format"
import { MOVEMENT_COLORS } from "./chartColors"
import { Legend, Swatch, TooltipRow, TooltipShell, chartClass } from "./ChartParts"
import { buildMovement } from "./mapTrafficHistory"

const SERIES = [
  { key: "new", label: "New", color: MOVEMENT_COLORS.new },
  { key: "up", label: "Improved", color: MOVEMENT_COLORS.up },
  { key: "down", label: "Declined", color: MOVEMENT_COLORS.down },
  { key: "lost", label: "Lost", color: MOVEMENT_COLORS.lost },
]

function MovementTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.longLabel}>
      {SERIES.map((s) => (
        <TooltipRow key={s.key} swatch={<Swatch color={s.color} />} name={s.label}>{formatExact(d[s.key] === null ? null : Math.abs(d[s.key]))}</TooltipRow>
      ))}
    </TooltipShell>
  )
}

/**
 * "Keyword movement per month": keywords that are New or Improved above the zero line (greens), keywords that Declined or were
 * Lost below it (reds), stacked per month. The reds are plotted as negatives; the tooltip and legend show them as plain counts.
 */
export default function MovementChart({ state, range }) {
  const data = buildMovement(range)
  const hasData = data.some((d) => [d.new, d.up, d.down, d.lost].some((v) => v !== null))
  return (
    <Panel title="Keyword movement per month" description="New and improved keywords above the line, declined and lost below it" action={<Legend items={SERIES} label="Movement types" />} className="min-w-0">
      <SectionBoundary state={state} skeleton={<Skel className="h-[280px] w-full rounded-lg" />} empty={!hasData} emptyMessage="No keyword movement data for this range.">
        <div className={chartClass("h-[280px]")} data-testid="th-movement-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompact(Math.abs(v))} />
              <Tooltip content={<MovementTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} />
              {SERIES.map((s) => <Bar key={s.key} dataKey={s.key} stackId="movement" fill={s.color} maxBarSize={24} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

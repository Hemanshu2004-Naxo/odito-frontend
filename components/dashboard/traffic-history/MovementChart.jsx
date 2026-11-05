"use client"

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import OverviewCard, { Note } from "../domain-overview/OverviewCard"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { TooltipRow, TooltipShell } from "./ChartParts"
import { KeyLegend } from "./DistributionChart"
import { buildMovement } from "./mapTrafficHistory"
import { MOVEMENT_SERIES, describeMovement, shortMonth } from "./trafficStory"

function MovementTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.longLabel}>
      {MOVEMENT_SERIES.map((s) => (
        <TooltipRow key={s.key} name={s.label}>{formatExact(d[s.key] === null ? null : Math.abs(d[s.key]))}</TooltipRow>
      ))}
    </TooltipShell>
  )
}

/**
 * "Keyword movement each month": New and Improved above the line (greens), Declined and Lost below it (reds), stacked per month, and one
 * sentence on how many months lost more than they gained. The reds are plotted as negatives; the tooltip shows them as plain counts.
 */
export default function MovementChart({ state, range }) {
  const data = buildMovement(range).map((d, i) => ({ ...d, shortLabel: shortMonth(range[i]) }))
  const hasData = data.some((d) => [d.new, d.up, d.down, d.lost].some((v) => v !== null))
  return (
    <OverviewCard title="Keyword movement each month" description="Above the line: new and improved · below: declined and lost" className="h-full" testId="th-movement-card">
      <SectionBoundary state={state} skeleton={<Skel className="h-[240px] w-full rounded-lg" />} empty={!hasData} emptyMessage="No keyword movement data for this range.">
        <KeyLegend items={MOVEMENT_SERIES} label="Movement types" />
        <div className="mt-3 h-[220px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[10px]" data-testid="th-movement-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} stackOffset="sign" margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
              <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} interval={0} minTickGap={0} />
              <Tooltip content={<MovementTooltip />} cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.06 }} />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              {MOVEMENT_SERIES.map((s) => <Bar key={s.key} dataKey={s.key} stackId="movement" fill={s.color} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Note className="mt-3" testId="th-movement-note">{describeMovement(range)}</Note>
      </SectionBoundary>
    </OverviewCard>
  )
}

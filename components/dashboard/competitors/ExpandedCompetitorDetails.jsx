"use client"

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import InfoHint from "../referring-domains/InfoHint"
import { formatCompact, formatExact, formatUsdCompact, formatUsdExact } from "../domain-overview/format"
import { TRAFFIC_HINT } from "../traffic-history/SummaryCards"
import { THEM_COLOR } from "../traffic-history/chartColors"
import { Legend, Swatch, TooltipRow, TooltipShell, chartClass } from "../traffic-history/ChartParts"
import { HeadToHead } from "./cells"
import { describeComparison } from "./summary"

function PositionsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={`Rankings in ${d.name}`}>
      <TooltipRow swatch={<Swatch />} name="You">{formatExact(d.you)}</TooltipRow>
      <TooltipRow swatch={<Swatch color={THEM_COLOR} />} name="Them">{formatExact(d.them)}</TooltipRow>
    </TooltipShell>
  )
}

/** Keywords by position on the keywords both sites rank for: #1, #2–3, #4–10, You vs Them. A bucket the provider did not report is left out of the bars (null, not 0). */
export function positionBuckets(row) {
  return [
    { name: "#1", you: row.ourTop1, them: row.theirTop1 },
    { name: "#2–3", you: row.ourTop2to3, them: row.theirTop2to3 },
    { name: "#4–10", you: row.ourTop4to10, them: row.theirTop4to10 },
  ]
}

/**
 * Opened by clicking a row: where each site ranks on the shared keywords (grouped bars), the traffic on them, what the competitor's
 * whole site is worth, and one sentence saying who is ahead. Every figure here is the same one the table row shows.
 */
export default function ExpandedCompetitorDetails({ row, id }) {
  const data = positionBuckets(row)
  const label = `Keywords ranking in each position group on the shared keywords. ${data.map((d) => `${d.name}: you ${formatExact(d.you)}, ${row.domain} ${formatExact(d.them)}`).join("; ")}.`
  return (
    <div id={id} role="region" aria-label={`Details for ${row.domain}`} className="grid gap-6 p-5 @min-[900px]/main:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-testid="cp-expanded">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Rankings on the shared keywords</h3>
          <Legend label="Chart key" items={[{ key: "you", label: "You" }, { key: "them", label: row.domain, color: THEM_COLOR }]} />
        </div>
        <div className={chartClass("h-[200px]")} role="img" aria-label={label} data-testid="cp-positions-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatCompact} />
              <Tooltip content={<PositionsTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
              <Bar dataKey="you" name="You" fill="currentColor" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="you" position="top" formatter={formatCompact} className="fill-muted-foreground text-[10px]" />
              </Bar>
              <Bar dataKey="them" name={row.domain} fill={THEM_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="them" position="top" formatter={formatCompact} className="fill-muted-foreground text-[10px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            Est. traffic on the shared keywords <InfoHint label="Est. traffic" text={TRAFFIC_HINT} />
          </h3>
          <HeadToHead row={row} className="mt-2 max-w-sm" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Their traffic value</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums" title={formatUsdExact(row.theirTrafficValue)} data-testid="cp-traffic-value">{formatUsdCompact(row.theirTrafficValue)}</dd>
            <dd className="text-xs text-muted-foreground">per month, whole site</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shared keywords</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums" title={formatExact(row.sharedKeywords)}>{formatCompact(row.sharedKeywords)}</dd>
            <dd className="text-xs text-muted-foreground">both sites rank for</dd>
          </div>
        </dl>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm" data-testid="cp-summary">{describeComparison(row)}</p>
      </div>
    </div>
  )
}

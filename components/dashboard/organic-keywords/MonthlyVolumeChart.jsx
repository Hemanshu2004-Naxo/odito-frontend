"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { chartClass, TooltipRow, TooltipShell } from "../traffic-history/ChartParts"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"

function VolumeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <TooltipShell title={r.label}>
      <TooltipRow name="Searches">{formatExact(r.volume)}</TooltipRow>
    </TooltipShell>
  )
}

/**
 * The keyword's searches per month (last 12 months the provider reports), one thin bar per month in the page accent. A month with no
 * figure is a gap, not a zero. The same figures are in a visually hidden table, so the chart is never the only way to read them.
 */
export default function MonthlyVolumeChart({ months, keyword }) {
  const known = months.some((m) => m.volume !== null)
  if (!known) return <p className="text-sm text-muted-foreground">No monthly search data for this keyword.</p>
  return (
    <div>
      <div className={chartClass("h-[150px]")} data-testid="ok-volume-chart" role="img" aria-label={`Monthly searches for ${keyword}, ${months[0].label} to ${months.at(-1).label}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={formatCompact} />
            <Tooltip content={<VolumeTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
            <Bar dataKey="volume" fill="currentColor" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Monthly searches for {keyword}</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Searches</th></tr></thead>
        <tbody>
          {months.map((m) => <tr key={m.key}><th scope="row">{m.label}</th><td>{m.volume === null ? MISSING : formatExact(m.volume)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

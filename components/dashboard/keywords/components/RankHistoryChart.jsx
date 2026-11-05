"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { chartClass, Legend, TooltipRow, TooltipShell } from "../../traffic-history/ChartParts"

const DESKTOP = { key: "desktop", label: "Desktop", color: "currentColor" }
const MOBILE = { key: "mobile", label: "Mobile", color: "#8b5cf6" }

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const dayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })

function RankTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <TooltipShell title={dayYear.format(p.at)}>
      {payload.map((entry) => (
        <TooltipRow key={entry.name} name={entry.name}>{entry.payload.position === null ? "Not found" : `#${entry.payload.position}`}</TooltipRow>
      ))}
    </TooltipShell>
  )
}

/**
 * Position over time, one line per device that has history. Lower is better, so the axis is reversed (#1 at the top). A scan that did
 * NOT find the site has no position: it is a gap in the line (and "Not found" in the tooltip), never a point at 0 or at the bottom.
 * The same figures are in a visually hidden table, so the chart is never the only way to read them.
 */
export default function RankHistoryChart({ desktop, mobile, keyword, depth = 100, windowDays = 180 }) {
  const series = [
    { ...DESKTOP, points: desktop },
    { ...MOBILE, points: mobile },
  ].filter((s) => s.points.length > 0)
  if (!series.length) return <p className="text-sm text-muted-foreground" data-testid="rank-history-empty">No ranking history yet. It builds up with each scan.</p>

  const all = series.flatMap((s) => s.points)
  // Every scan came back "not found": there is nothing to plot, and an empty chart would read as broken.
  if (all.every((p) => p.position === null)) {
    return <p className="text-sm text-muted-foreground" data-testid="rank-history-none-found">Not found in the top {depth} in any of the {all.length} scan{all.length === 1 ? "" : "s"} recorded for the last {windowDays} days.</p>
  }
  const worst = Math.max(10, ...all.map((p) => p.position ?? 0))
  const max = Math.min(depth, Math.ceil(worst / 10) * 10)
  // Round ticks (#1, #5, #10, #15 ... or every 10 on a deep chart) instead of whatever the axis would pick.
  const step = max <= 20 ? 5 : 10
  const ticks = [1, ...Array.from({ length: Math.floor(max / step) }, (_, i) => (i + 1) * step)].filter((v, i, a) => a.indexOf(v) === i && v <= max)
  const times = all.map((p) => p.t)
  const domain = [Math.min(...times), Math.max(...times)]
  const single = domain[0] === domain[1]
  const hasGap = all.some((p) => p.position === null)

  return (
    <div>
      <Legend items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: "line" }))} label="Ranking history devices" />
      <div className={chartClass("mt-2 h-[170px]")} data-testid="rank-history-chart" role="img" aria-label={`Ranking history for ${keyword}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
            <XAxis
              dataKey="t" type="number" scale="time" domain={single ? [domain[0] - 86400000, domain[1] + 86400000] : domain}
              tickLine={false} axisLine={false} tickFormatter={(t) => day.format(t)} minTickGap={28}
            />
            <YAxis reversed type="number" dataKey="position" domain={[1, max]} ticks={ticks} interval={0} allowDecimals={false} tickLine={false} axisLine={false} width={34} tickFormatter={(v) => `#${v}`} />
            <Tooltip content={<RankTooltip />} />
            {series.map((s) => (
              <Line
                key={s.key} name={s.label} data={s.points} dataKey="position" stroke={s.color} strokeWidth={2} type="monotone"
                dot={{ r: 3, fill: s.color }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasGap ? <p className="mt-1 text-[11px] text-muted-foreground">A gap means that scan did not find the site in the top {depth}.</p> : null}
      {/* A <div> carries sr-only: a clipped <table> keeps its own width and would still widen the page on a phone. */}
      <div className="sr-only">
      <table>
        <caption>Ranking history for {keyword}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Device</th><th scope="col">Position</th></tr></thead>
        <tbody>
          {series.flatMap((s) => s.points.map((p) => (
            <tr key={`${s.key}-${p.t}`}><td>{dayYear.format(p.at)}</td><td>{s.label}</td><td>{p.position === null ? `Not found in the top ${depth}` : `#${p.position}`}</td></tr>
          )))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

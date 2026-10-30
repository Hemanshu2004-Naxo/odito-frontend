"use client"

import { useMemo } from "react"
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact } from "../domain-overview/format"
import { THEM_COLOR } from "../traffic-history/chartColors"
import { Legend, TooltipRow, TooltipShell, chartClass } from "../traffic-history/ChartParts"

const positive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0

/**
 * The points of the chart. x = shared keywords, y = the competitor's total traffic (log scale, so every value must be above 0), bubble
 * size = their total keywords. A competitor missing any of the three cannot be placed and is counted, not drawn at a made-up spot.
 * The project is its own point ("You") from its own row: x = the keywords it shares with itself, i.e. all of them.
 * @param {import("./types").CompetitorRow[]} rows
 * @param {import("./types").SelfRow|null} self
 */
export function buildLandscape(rows, self) {
  const competitors = []
  let unplaced = 0
  for (const r of rows) {
    if (positive(r.sharedKeywords) && positive(r.theirTotalTraffic) && positive(r.theirTotalKeywords)) {
      competitors.push({ domain: r.domain, x: r.sharedKeywords, y: r.theirTotalTraffic, z: r.theirTotalKeywords, you: false })
    } else unplaced += 1
  }
  const you = self && positive(self.sharedKeywords) && positive(self.totalTraffic) && positive(self.totalKeywords)
    ? [{ domain: self.domain, x: self.sharedKeywords, y: self.totalTraffic, z: self.totalKeywords, you: true, label: "You" }]
    : []
  return { competitors, you, unplaced }
}

/** Powers of ten that enclose the data, for a log axis. */
export function logDomain(values) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const floor = Math.floor(Math.log10(lo))
  let ceil = Math.ceil(Math.log10(hi))
  if (ceil === floor) ceil += 1
  return { domain: [10 ** floor, 10 ** ceil], ticks: Array.from({ length: ceil - floor + 1 }, (_, i) => 10 ** (floor + i)) }
}

function LandscapeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.you ? `You · ${d.domain}` : d.domain}>
      <TooltipRow name="Shared keywords">{formatExact(d.x)}</TooltipRow>
      <TooltipRow name="Their traffic">{formatExact(d.y)}</TooltipRow>
      <TooltipRow name="Their keywords">{formatExact(d.z)}</TooltipRow>
    </TooltipShell>
  )
}

/** One bubble. The size comes from the Z axis (area); the one the user clicked in the table or chart is ringed. */
function Bubble({ cx, cy, size, payload, highlight, you }) {
  if (typeof cx !== "number" || typeof cy !== "number") return null
  const r = Math.max(4, Math.sqrt((size ?? 100) / Math.PI))
  const active = highlight === payload.domain
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={you ? "currentColor" : THEM_COLOR}
        fillOpacity={you ? 0.9 : 0.5}
        stroke={you ? "currentColor" : THEM_COLOR}
        strokeWidth={active ? 3 : 1.5}
        className="cursor-pointer"
        data-testid={you ? "cp-bubble-you" : "cp-bubble"}
        data-domain={payload.domain}
      />
      {active ? <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 3" /> : null}
    </g>
  )
}

/**
 * "Competitive landscape": the competitors on the current page (plus the project, highlighted) by shared keywords and total traffic.
 * Clicking a bubble scrolls to that competitor's row in the table and highlights it (`onSelect`).
 */
export default function LandscapeChart({ state, rows, self, highlight, onSelect }) {
  const data = useMemo(() => buildLandscape(rows, self), [rows, self])
  const all = [...data.competitors, ...data.you]
  const y = all.length ? logDomain(all.map((p) => p.y)) : null
  const summary = `Bubble chart of ${data.competitors.length} competitors by shared keywords and total traffic${data.you.length ? ", with your site highlighted" : ""}.`

  return (
    <Panel title="Competitive landscape" description="Competitors on this page: shared keywords against their total traffic. Bigger bubble = more keywords." className="min-w-0">
      <SectionBoundary state={state} skeleton={<Skel className="h-[360px] w-full rounded-lg" />} empty={data.competitors.length === 0 && data.you.length === 0} emptyMessage="Nothing to plot yet — no competitors on this page have traffic data.">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Legend label="Chart key" items={[{ key: "you", label: "You" }, { key: "them", label: "Competitors", color: THEM_COLOR, opacity: 0.6 }]} />
          <p className="text-xs text-muted-foreground">Traffic is on a log scale · click a bubble to find it in the table</p>
        </div>
        <div className={chartClass("h-[360px]")} role="img" aria-label={summary} data-testid="cp-landscape" data-points={data.competitors.length} data-you={data.you.length}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 24, left: 8, bottom: 24 }}>
              <CartesianGrid className="stroke-border" strokeOpacity={0.7} />
              <XAxis type="number" dataKey="x" name="Shared keywords" tickLine={false} tickFormatter={formatCompact} domain={[0, "auto"]} label={{ value: "Shared keywords", position: "insideBottom", offset: -12, className: "fill-muted-foreground text-[11px]" }} />
              <YAxis
                type="number"
                dataKey="y"
                name="Their traffic"
                scale="log"
                domain={y?.domain ?? [1, 10]}
                ticks={y?.ticks}
                allowDataOverflow
                tickLine={false}
                width={56}
                tickFormatter={formatCompact}
              />
              <ZAxis type="number" dataKey="z" range={[60, 1100]} name="Their keywords" />
              <Tooltip content={<LandscapeTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter name="Competitors" data={data.competitors} isAnimationActive={false} onClick={(p) => onSelect?.(p?.payload?.domain ?? p?.domain)} shape={(p) => <Bubble {...p} highlight={highlight} />} />
              <Scatter name="You" data={data.you} isAnimationActive={false} onClick={(p) => onSelect?.(p?.payload?.domain ?? p?.domain)} shape={(p) => <Bubble {...p} highlight={highlight} you />}>
                <LabelList dataKey="label" position="top" offset={10} className="fill-foreground text-xs font-semibold" />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {data.unplaced > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="cp-unplaced">
            {data.unplaced} competitor{data.unplaced === 1 ? "" : "s"} without traffic or keyword data {data.unplaced === 1 ? "is" : "are"} not plotted.
          </p>
        ) : null}
        {data.you.length === 0 && data.competitors.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="cp-no-you">Your own site is not plotted: its totals are not available for these settings.</p>
        ) : null}
      </SectionBoundary>
    </Panel>
  )
}

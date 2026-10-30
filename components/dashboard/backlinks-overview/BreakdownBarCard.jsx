"use client"

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import InfoHint from "../referring-domains/InfoHint"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { PAID_COLOR, THEM_COLOR } from "../traffic-history/chartColors"
import { describeUnknownCountries } from "./mapBacklinkSummary"
import { TooltipRow, TooltipShell } from "../traffic-history/ChartParts"

const ROW_HEIGHT = 30

/** What colour a bar is: the page accent; amber for an attribute worth attention; slate for "Unknown" and "Others" (context, not a finding). */
export function barColor(entry) {
  if (entry.highlight) return PAID_COLOR
  if (entry.isOthers || entry.key === "" || String(entry.key).toLowerCase() === "unknown" || entry.key === "WW") return THEM_COLOR
  return "currentColor"
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A category label: flag + name, cut to fit, with the full text as the SVG tooltip. */
function CategoryTick({ x, y, payload, byLabel, max }) {
  const e = byLabel.get(payload.value)
  const text = `${e?.flag ? `${e.flag} ` : ""}${payload.value}`
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" className="fill-foreground text-[12px]">{clip(text, max)}</text>
    </g>
  )
}

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const e = payload[0].payload
  return (
    <TooltipShell title={`${e.flag ? `${e.flag} ` : ""}${e.label}`}>
      <TooltipRow name="Links">{formatExact(e.count)}</TooltipRow>
      <TooltipRow name="Share">{formatPercent1(e.percent)}</TooltipRow>
      {e.description ? <p className="max-w-[220px] pt-1 text-[11px] leading-snug">{e.description}</p> : null}
    </TooltipShell>
  )
}

/**
 * One horizontal-bar breakdown: label (flag + name), bar, "count · share". `breakdown` is a mapped { entries, isEmpty } (the mapping
 * already sorted it and added "Others"). An empty or missing breakdown shows "No data", not an empty chart. Every bar's exact figures are
 * in its tooltip and in the chart's accessible description.
 */
export default function BreakdownBarCard({ title, description, hint, state, breakdown, testId, labelWidth = 120, note }) {
  const entries = breakdown?.entries ?? []
  const data = entries.map((e) => ({ ...e, labelText: `${formatCompact(e.count)} · ${formatPercent1(e.percent)}` }))
  const byLabel = new Map(data.map((e) => [e.label, e]))
  const maxChars = Math.floor(labelWidth / 7)
  const summary = `${title}: ${entries.slice(0, 5).map((e) => `${e.label} ${formatExact(e.count)} (${formatPercent1(e.percent)})`).join(", ")}${entries.length > 5 ? ", and more" : ""}.`
  return (
    <Panel
      title={<span className="flex items-center gap-1.5">{title}{hint ? <InfoHint label={title} text={hint} /> : null}</span>}
      description={description}
      className="min-w-0"
    >
      <SectionBoundary
        state={state}
        skeleton={<div className="space-y-2" aria-hidden>{Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-6 w-full" />)}</div>}
        empty={!breakdown || breakdown.isEmpty}
        emptyMessage="No data"
      >
        <div
          className="w-full text-primary [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground"
          style={{ height: data.length * ROW_HEIGHT + 12 }}
          role="img"
          aria-label={summary}
          data-testid={testId}
          data-labels={data.map((e) => e.label).join("|")}
          data-counts={data.map((e) => e.count).join("|")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 2, right: 96, bottom: 2, left: 4 }} barCategoryGap={5}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="label" width={labelWidth} tickLine={false} axisLine={false} interval={0} tick={<CategoryTick byLabel={byLabel} max={maxChars} />} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                {data.map((e) => <Cell key={e.key} fill={barColor(e)} data-testid="bo-bar" data-key={e.key} />)}
                <LabelList dataKey="labelText" position="right" className="fill-muted-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* A country breakdown that set its unknown part aside says how much that is (every page with a countries card gets it). */}
        {(note ?? describeUnknownCountries(breakdown)) ? <p className="mt-2 text-xs text-muted-foreground" data-testid="bo-unknown-note">{note ?? describeUnknownCountries(breakdown)}</p> : null}
      </SectionBoundary>
    </Panel>
  )
}

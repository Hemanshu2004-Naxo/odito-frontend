"use client"

import { useState } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import InfoHint from "../referring-domains/InfoHint"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact, formatUsdExact } from "../domain-overview/format"
import { DROP_COLOR, KEYWORDS_COLOR, PAID_COLOR } from "./chartColors"
import { Legend, Swatch, TooltipRow, TooltipShell, chartClass } from "./ChartParts"
import { ChangeText } from "./ui"
import { TRAFFIC_HINT } from "./SummaryCards"

function MainTooltip({ active, payload, showPaid }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <TooltipShell title={r.longLabel}>
      <TooltipRow swatch={<Swatch />} name="Est. traffic">{formatExact(r.traffic)}<ChangeText percent={r.mom.traffic.percent} direction={r.mom.traffic.direction} /></TooltipRow>
      <TooltipRow swatch={<Swatch color={KEYWORDS_COLOR} shape="line" />} name="Keywords">{formatExact(r.keywords)}<ChangeText percent={r.mom.keywords.percent} direction={r.mom.keywords.direction} /></TooltipRow>
      <TooltipRow name="Traffic value">{formatUsdExact(r.value)}<ChangeText percent={r.mom.value.percent} direction={r.mom.value.direction} /></TooltipRow>
      {showPaid ? <TooltipRow swatch={<Swatch color={PAID_COLOR} shape="line" />} name="Paid traffic">{formatExact(r.paidTraffic)}</TooltipRow> : null}
    </TooltipShell>
  )
}

const Skeleton = () => <Skel className="h-[320px] w-full rounded-lg" />

/**
 * "Organic traffic & keywords": traffic as an area on the left axis, keywords as a line on the right axis (two scales, so each
 * series is named in the legend and the tooltip rather than by axis colour). The legend items hide / show a series; the month
 * with the biggest traffic fall is marked. A "Paid traffic" series exists only when some month in the range has paid traffic.
 */
export default function TrafficKeywordsChart({ state, range, hasPaid, biggestDrop }) {
  const [hidden, setHidden] = useState(() => new Set())
  const toggle = (key) => setHidden((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })

  const items = [
    { key: "traffic", label: "Est. traffic" },
    { key: "keywords", label: "Keywords", color: KEYWORDS_COLOR, shape: "line" },
    ...(hasPaid ? [{ key: "paid", label: "Paid traffic", color: PAID_COLOR, shape: "line" }] : []),
  ]
  const showTraffic = !hidden.has("traffic")
  const showKeywords = !hidden.has("keywords")
  const showPaid = hasPaid && !hidden.has("paid")
  const dropRow = biggestDrop ? range.find((r) => r.key === biggestDrop.key) : null

  return (
    <Panel
      title="Organic traffic & keywords"
      description={<span className="inline-flex items-center gap-1">Est. traffic <InfoHint label="Est. traffic" text={TRAFFIC_HINT} /> and ranking keywords by month</span>}
      action={<Legend items={items} hidden={hidden} onToggle={toggle} label="Series shown in the chart" />}
      className="min-w-0"
    >
      <SectionBoundary state={state} skeleton={<Skeleton />}>
        {!showTraffic && !showKeywords && !showPaid ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">Turn a series back on in the legend to see the chart.</div>
        ) : (
          <div className={chartClass()} data-testid="th-main-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={range} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.7} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="left" hide={!showTraffic && !showPaid} tickLine={false} axisLine={false} width={48} tickFormatter={formatCompact} />
                <YAxis yAxisId="right" orientation="right" hide={!showKeywords} tickLine={false} axisLine={false} width={48} tickFormatter={formatCompact} />
                <Tooltip content={<MainTooltip showPaid={showPaid} />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
                {showTraffic ? <Area yAxisId="left" type="monotone" dataKey="traffic" stroke="currentColor" strokeWidth={2} fill="currentColor" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} /> : null}
                {showPaid ? <Line yAxisId="left" type="monotone" dataKey="paidTraffic" stroke={PAID_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} /> : null}
                {showKeywords ? <Line yAxisId="right" type="monotone" dataKey="keywords" stroke={KEYWORDS_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={false} /> : null}
                {showTraffic && dropRow && dropRow.traffic !== null ? (
                  <ReferenceDot
                    yAxisId="left" x={dropRow.label} y={dropRow.traffic} r={5} fill={DROP_COLOR} stroke="var(--card)" strokeWidth={2} ifOverflow="extendDomain"
                    label={{ value: `−${Math.abs(biggestDrop.percent).toFixed(0)}% MoM`, position: "top", className: "fill-foreground text-[11px] font-semibold" }}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {dropRow ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="th-drop-note">
            Biggest traffic drop: <span className="font-medium text-foreground">{dropRow.longLabel}</span> (−{Math.abs(biggestDrop.percent).toFixed(1)}% month over month)
          </p>
        ) : null}
      </SectionBoundary>
    </Panel>
  )
}

"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatExact, formatPercent1 } from "../domain-overview/format"
import { THEM_COLOR } from "../traffic-history/chartColors"
import { Swatch, TooltipRow, TooltipShell } from "../traffic-history/ChartParts"

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.name}>
      <TooltipRow name={d.what}>{formatExact(d.value)}</TooltipRow>
      <TooltipRow name="Share">{formatPercent1(d.percent)}</TooltipRow>
    </TooltipShell>
  )
}

/** One donut: dofollow against nofollow, the dofollow % in the middle. Both counts and shares are also listed as text underneath. */
function Donut({ title, what, dofollow, nofollow, percent, testId }) {
  const total = dofollow !== null && nofollow !== null ? dofollow + nofollow : null
  const known = total !== null && total > 0
  const data = known ? [
    { name: "Dofollow", value: dofollow, percent: (dofollow / total) * 100, what },
    { name: "Nofollow", value: nofollow, percent: (nofollow / total) * 100, what },
  ] : []
  return (
    <div className="min-w-0" data-testid={testId} data-percent={percent === null ? "" : percent.toFixed(1)}>
      <h3 className="text-center text-sm font-medium">{title}</h3>
      <div className="relative mx-auto mt-2 h-[170px] w-full max-w-[200px] text-primary" role="img" aria-label={known ? `${title}: ${formatPercent1(percent)} dofollow, ${formatExact(dofollow)} dofollow and ${formatExact(nofollow)} nofollow` : `${title}: no data`}>
        {known ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} startAngle={90} endAngle={-270} paddingAngle={data.every((d) => d.value > 0) ? 2 : 0} stroke="none" isAnimationActive={false}>
                <Cell fill="currentColor" />
                <Cell fill={THEM_COLOR} />
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center rounded-full border border-dashed border-border text-sm text-muted-foreground">No data</div>}
        {known ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-xl font-semibold tabular-nums text-foreground" data-testid={`${testId}-center`}>{formatPercent1(percent)}</div>
              <div className="text-[11px] text-muted-foreground">dofollow</div>
            </div>
          </div>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Swatch />Dofollow</span><span className="tabular-nums" title={formatExact(dofollow)}>{known ? `${formatExact(dofollow)} · ${formatPercent1((dofollow / total) * 100)}` : MISSING}</span></li>
        <li className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Swatch color={THEM_COLOR} />Nofollow</span><span className="tabular-nums" title={formatExact(nofollow)}>{known ? `${formatExact(nofollow)} · ${formatPercent1((nofollow / total) * 100)}` : MISSING}</span></li>
      </ul>
    </div>
  )
}

/** "Follow vs Nofollow": two donuts side by side — referring domains and referring pages. */
export default function FollowDonuts({ state, summary }) {
  const s = summary
  return (
    <Panel title="Follow vs Nofollow" description="How many links pass ranking credit (dofollow)" className="min-w-0">
      <SectionBoundary state={state} skeleton={<div className="grid grid-cols-2 gap-4"><Skel className="h-[260px]" /><Skel className="h-[260px]" /></div>}>
        <div className="grid grid-cols-1 gap-6 @min-[420px]/main:grid-cols-2" data-testid="bo-follow">
          <Donut title="Domains" what="Referring domains" dofollow={s?.derived.dofollowDomains ?? null} nofollow={s?.derived.nofollowDomains ?? null} percent={s?.derived.dofollowDomainsPercent ?? null} testId="bo-donut-domains" />
          <Donut title="Pages" what="Referring pages" dofollow={s?.derived.dofollowPages ?? null} nofollow={s?.derived.nofollowPages ?? null} percent={s?.derived.dofollowPagesPercent ?? null} testId="bo-donut-pages" />
        </div>
      </SectionBoundary>
    </Panel>
  )
}

"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { cn } from "@/lib/utils"
import OverviewCard, { Note } from "../domain-overview/OverviewCard"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import { TooltipRow, TooltipShell } from "./ChartParts"
import { RANK_GROUPS, buildRankGroups, describeRankGroups } from "./trafficStory"

/** A small two/three-way toggle; other pages (Anchors, Backlink Overview, Competitors, …) use it too. */
export function Segmented({ label, options, value, onChange, disabled = false }) {
  return (
    <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** The colour key above the two lower charts. */
export function KeyLegend({ items, label }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={label}>
      {items.map((it) => (
        <li key={it.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: it.color, opacity: it.opacity ?? 1 }} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

function GroupsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <TooltipShell title={d.longLabel}>
      {[...RANK_GROUPS].reverse().map((g) => <TooltipRow key={g.key} name={g.label}>{formatExact(d[g.key])}</TooltipRow>)}
    </TooltipShell>
  )
}

/**
 * "Where keywords ranked each month": keywords per month stacked by position group — top 3 (green), 4–10 (aqua), 11–20 (indigo) and
 * 21–100 (grey) — with one sentence on what changed most.
 */
export default function DistributionChart({ state, range }) {
  const data = buildRankGroups(range)
  const hasData = data.some((d) => d.g3 !== null)
  const note = describeRankGroups(range)

  return (
    <OverviewCard title="Where keywords ranked each month" description="Number of keywords by Google position" className="h-full" testId="th-distribution-card">
      <SectionBoundary state={state} skeleton={<Skel className="h-[240px] w-full rounded-lg" />} empty={!hasData} emptyMessage="No ranking distribution data for this range.">
        <KeyLegend items={RANK_GROUPS} label="Position groups" />
        <div className="mt-3 h-[220px] w-full [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[10px]" data-testid="th-distribution-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
              <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} interval={0} minTickGap={0} />
              <Tooltip content={<GroupsTooltip />} cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.06 }} />
              {RANK_GROUPS.map((g, i) => (
                <Bar key={g.key} dataKey={g.key} stackId="groups" fill={g.color} fillOpacity={g.opacity ?? 1} radius={i === RANK_GROUPS.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Note className="mt-3" testId="th-distribution-note">{note}</Note>
      </SectionBoundary>
    </OverviewCard>
  )
}

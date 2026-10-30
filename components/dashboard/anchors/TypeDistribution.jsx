"use client"

import { useState } from "react"
import { ANCHOR_TYPES, TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { Segmented } from "../traffic-history/DistributionChart"
import { PROFILE_NOTE, SHARE_NOTE } from "./constants"

const MEASURES = [
  { value: "referringDomains", label: "By referring domains", unit: "referring domains", percent: "percentByReferringDomains" },
  { value: "backlinks", label: "By backlinks", unit: "backlinks", percent: "percentByBacklinks" },
]

const R = 40
const C = 2 * Math.PI * R

/** The donut as plain SVG: one stroke arc per type, in the types' own colours. No chart library, so it renders (and tests) the same anywhere. */
function Donut({ slices, centre }) {
  let offset = 0
  return (
    <svg viewBox="0 0 100 100" className="size-44 shrink-0 -rotate-90" role="presentation" data-testid="an-donut">
      <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
      {slices.map((s) => {
        const length = (s.fraction * C)
        const arc = <circle key={s.key} cx="50" cy="50" r={R} fill="none" strokeWidth="14" stroke={s.color} strokeDasharray={`${Math.max(0, length - (slices.length > 1 ? 0.6 : 0))} ${C}`} strokeDashoffset={-offset} data-testid="an-slice" data-type={s.key}><title>{`${s.label}: ${formatPercent1(s.fraction * 100)}`}</title></circle>
        offset += length
        return arc
      })}
      <g className="rotate-90" style={{ transformOrigin: "50px 50px" }}>
        <text x="50" y="48" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{centre.value}</text>
        <text x="50" y="60" textAnchor="middle" className="fill-muted-foreground text-[6px]">{centre.label}</text>
      </g>
    </svg>
  )
}

/**
 * "Anchor type distribution": the share of each type, by referring domains (default) or by backlinks. It is drawn from the profile and
 * the project's settings, so it moves the moment they change — with no request.
 */
export default function TypeDistribution({ profile, measure: initial = "referringDomains" }) {
  const [measure, setMeasure] = useState(initial)
  const m = MEASURES.find((x) => x.value === measure)
  const { summary } = profile
  const total = summary ? summary.totals[measure] : 0
  const slices = summary && total > 0
    ? TYPE_KEYS.map((key) => ({ key, label: ANCHOR_TYPES[key].label, color: ANCHOR_TYPES[key].color, value: summary.types[key][measure], percent: summary.types[key][m.percent], fraction: summary.types[key][measure] / total })).filter((s) => s.value > 0)
    : []
  const description = slices.map((s) => `${s.label} ${formatPercent1(s.percent)}`).join(", ")

  return (
    <Panel
      title="Anchor type distribution"
      description={`How the anchors are split, ${m.label.toLowerCase()}`}
      action={<Segmented label="Measure the distribution by" options={MEASURES} value={measure} onChange={setMeasure} />}
      className="min-w-0"
    >
      <SectionBoundary
        state={{ status: profile.status, error: profile.error, refetch: profile.refetch }}
        skeleton={<div className="flex items-center gap-6" aria-hidden><Skel className="size-44 rounded-full" /><div className="flex-1 space-y-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-5 w-full" />)}</div></div>}
        empty={!summary || summary.totals.anchors === 0 || total === 0}
        emptyMessage="No anchor data for this domain yet."
      >
        <div className="flex flex-col items-center gap-5 @min-[560px]/main:flex-row" data-testid="an-distribution" data-measure={measure} data-percents={slices.map((s) => `${s.key}:${(s.percent ?? 0).toFixed(1)}`).join("|")} role="img" aria-label={`Anchor type distribution ${m.label.toLowerCase()}: ${description}.`}>
          <Donut slices={slices} centre={{ value: formatCompact(total), label: m.unit }} />
          <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm" aria-hidden="true">
            {(summary ? TYPE_KEYS : []).map((key) => {
              const t = summary.types[key]
              return (
                <li key={key} className="flex items-center gap-2" data-testid={`an-legend-${key}`}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ANCHOR_TYPES[key].color }} />
                  <span className="min-w-0 flex-1 truncate" title={ANCHOR_TYPES[key].description}>{ANCHOR_TYPES[key].label}</span>
                  <span className="tabular-nums text-muted-foreground" title={`${formatExact(t.anchors)} anchors · ${formatExact(t[measure])} ${m.unit}`}>{formatCompact(t[measure])}</span>
                  <span className="w-14 text-right font-medium tabular-nums" data-testid={`an-legend-${key}-percent`}>{t[m.percent] === null ? MISSING : formatPercent1(t[m.percent])}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{SHARE_NOTE}</p>
        {profile.truncated ? <p className="mt-1 text-xs text-muted-foreground" data-testid="an-profile-note">{PROFILE_NOTE}</p> : null}
      </SectionBoundary>
    </Panel>
  )
}

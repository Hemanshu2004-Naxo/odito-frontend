"use client"

import { ANCHOR_TYPES, EMPTY_ANCHOR_LABEL, TOP_ANCHORS, TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { Panel } from "@/components/dashboard/shared/parts"
import { SectionBoundary, Skel } from "../domain-overview/SectionState"
import { formatCompact, formatExact } from "../domain-overview/format"

/**
 * "Top anchors": the 15 anchors used by the most referring domains, as horizontal bars in their type's colour. A bar is a button: a click
 * filters the table to that exact anchor. Drawn with plain elements (not a chart library) so every bar is a real, focusable control.
 */
export default function TopAnchorsChart({ profile, onSelect, selected }) {
  const rows = [...(profile.rows ?? [])].filter((r) => (r.referringDomains ?? 0) > 0).sort((a, b) => b.referringDomains - a.referringDomains || (b.backlinks ?? 0) - (a.backlinks ?? 0)).slice(0, TOP_ANCHORS)
  const max = rows[0]?.referringDomains ?? 0
  const usedTypes = TYPE_KEYS.filter((k) => rows.some((r) => r.type === k))
  return (
    <Panel title="Top anchors" description="The anchors used by the most referring domains — click one to filter the table" className="min-w-0">
      <SectionBoundary
        state={{ status: profile.status, error: profile.error, refetch: profile.refetch }}
        skeleton={<div className="space-y-2" aria-hidden>{Array.from({ length: 8 }, (_, i) => <Skel key={i} className="h-6 w-full" />)}</div>}
        empty={rows.length === 0}
        emptyMessage="No anchor data for this domain yet."
      >
        <ul className="space-y-1" data-testid="an-top" data-labels={rows.map((r) => r.label).join("|")} data-counts={rows.map((r) => r.referringDomains).join("|")}>
          {rows.map((r) => {
            const color = ANCHOR_TYPES[r.type]?.color ?? ANCHOR_TYPES.other.color
            const active = selected === (r.isEmpty ? EMPTY_ANCHOR_LABEL : r.anchor)
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  aria-pressed={active}
                  aria-label={`${r.label}: ${formatExact(r.referringDomains)} referring domains, ${ANCHOR_TYPES[r.type]?.label ?? ""}. Show only this anchor in the table.`}
                  className="group grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @min-[560px]/main:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
                  data-testid="an-top-bar"
                  data-type={r.type}
                >
                  <span className={r.isEmpty ? "truncate italic text-muted-foreground" : "truncate"} title={r.label}>{r.isEmpty ? r.label : `“${r.anchor}”`}</span>
                  <span className="h-4 overflow-hidden rounded bg-muted/50" role="presentation">
                    <span className="block h-full rounded" style={{ width: `${Math.max(2, (r.referringDomains / max) * 100)}%`, backgroundColor: color }} />
                  </span>
                  <span className="w-10 text-right tabular-nums text-muted-foreground" title={`${formatExact(r.referringDomains)} referring domains`}>{formatCompact(r.referringDomains)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Colours">
          {usedTypes.map((k) => <li key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: ANCHOR_TYPES[k].color }} aria-hidden />{ANCHOR_TYPES[k].label}</li>)}
        </ul>
      </SectionBoundary>
    </Panel>
  )
}

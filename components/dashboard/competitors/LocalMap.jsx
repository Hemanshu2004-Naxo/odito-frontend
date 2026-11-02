"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { formatDistance, projectToMap } from "./localUi"

/**
 * A schematic map of the search area: the business in the middle, rings at a third and two thirds of the radius and at the radius itself,
 * and one marker per business, to scale (north is up). It is NOT a street map: it needs no map provider and no key, and it never shows a
 * location other than the project's own. Selecting a marker selects the business in the list, and the reverse.
 */
export default function LocalMap({ center, radiusKm, results, selectedId, onSelect, className }) {
  const points = useMemo(() => projectToMap(center, results, radiusKm), [center, results, radiusKm])
  const byId = useMemo(() => new Map(results.map((r) => [r.placeId, r])), [results])
  if (!center) return null
  const rings = [1 / 3, 2 / 3, 1]
  const half = 42
  return (
    <figure className={cn("space-y-2", className)} data-testid="local-map">
      <svg viewBox="0 0 100 100" className="aspect-square w-full max-w-[460px] rounded-xl border border-border/60 bg-muted/20" role="group" aria-label={`Map of businesses within ${radiusKm} km of your business`}>
        {rings.map((f) => <circle key={f} cx="50" cy="50" r={half * f} fill={f === 1 ? "hsl(var(--primary) / 0.05)" : "none"} stroke="currentColor" strokeOpacity={f === 1 ? 0.45 : 0.18} strokeDasharray={f === 1 ? undefined : "1.5 1.5"} strokeWidth={f === 1 ? 0.5 : 0.35} className="text-foreground" data-testid={f === 1 ? "local-map-radius" : undefined} />)}
        {/* Ring labels sit on the upper-right diagonal with a halo so a marker never hides them; north is marked in the corner. */}
        {rings.map((f) => <text key={`t${f}`} x={50 + half * f * 0.7071 + 0.8} y={50 - half * f * 0.7071 - 0.6} textAnchor="start" fontSize="2.6" strokeWidth="0.9" paintOrder="stroke" className="fill-muted-foreground stroke-background">{`${Number((radiusKm * f).toFixed(1))} km`}</text>)}
        <text x="4" y="8.5" fontSize="2.8" fontWeight="600" className="fill-muted-foreground" aria-hidden="true">N ↑</text>

        {points.map((p) => {
          const r = byId.get(p.id)
          const active = p.id === selectedId
          const label = `${r.name}, ${formatDistance(r.distanceMeters)} away`
          return (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={active}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id) } }}
              className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-primary"
              data-testid="local-marker"
              data-place-id={p.id}
              data-selected={active ? "true" : undefined}
            >
              <circle r={active ? 3.6 : 2.6} fill="none" stroke="currentColor" strokeWidth={active ? 0.9 : 0} className="text-primary" />
              <circle r={active ? 2.4 : 1.8} className={cn(r.addedCompetitorId ? "fill-emerald-500" : r.relevance === "direct" ? "fill-red-500" : r.relevance === "related" ? "fill-amber-500" : "fill-slate-400")} stroke="white" strokeWidth="0.4" />
              <title>{label}</title>
            </g>
          )
        })}

        <g transform="translate(50 50)" data-testid="local-map-center">
          <circle r="2.8" className="fill-primary" stroke="white" strokeWidth="0.6" />
          <title>Your business</title>
        </g>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" aria-hidden /> Your business</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-500" aria-hidden /> Category match</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" aria-hidden /> Related</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-400" aria-hidden /> Unclassified</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" aria-hidden /> In My competitors</span>
        <span className="basis-full">Schematic map, to scale (no street map). The outer ring is {radiusKm} km.</span>
      </figcaption>
    </figure>
  )
}

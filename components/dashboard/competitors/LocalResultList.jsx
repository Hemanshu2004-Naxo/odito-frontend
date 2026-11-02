"use client"

import { Check, ExternalLink, Loader2, MapPin, Phone, Plus, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { RELEVANCE_HINT, RELEVANCE_LABEL, formatDistance } from "./localUi"

const REL_VARIANT = { direct: "critical", related: "warning", unclassified: "secondary" }

/** Google's own numbers, labelled as Google's. A missing rating or review count is a dash, never 0. */
export function RatingLine({ rating, reviewCount }) {
  if (typeof rating !== "number") return <span className="text-xs text-muted-foreground" title="Google shows no rating for this place">No rating</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs" title="Rating on Google. It reflects customer opinion, not SEO performance.">
      <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
      <span className="font-medium tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground tabular-nums">({typeof reviewCount === "number" ? formatExact(reviewCount) : "—"})</span>
      <span className="sr-only"> on Google</span>
    </span>
  )
}

function AddButton({ r, pending, onAdd }) {
  if (r.addedCompetitorId) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="local-added"><Check className="size-3.5" aria-hidden /> In My competitors</span>
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={(e) => { e.stopPropagation(); onAdd(r) }} aria-label={`Add ${r.name} to My competitors`} data-testid="local-add">
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />} Add
    </Button>
  )
}

/** The business the user selected, in full. */
export function LocalDetails({ r, pending, onAdd }) {
  if (!r) return null
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4" aria-label={`Details of ${r.name}`} data-testid="local-details">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{r.name}</h3>
          <p className="text-xs text-muted-foreground">{r.primaryTypeLabel ?? "Category not given by Google"}</p>
        </div>
        <AddButton r={r} pending={pending} onAdd={onAdd} />
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Address</dt><dd>{r.address ?? "—"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Distance</dt><dd>{formatDistance(r.distanceMeters)} from your business</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Website</dt><dd>{r.websiteDomain ? <a href={`https://${r.websiteDomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">{r.websiteDomain}<ExternalLink className="size-3" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a> : "Not listed on Google"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Phone</dt><dd className="inline-flex items-center gap-1">{r.phone ? <><Phone className="size-3.5" aria-hidden />{r.phone}</> : "—"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Rating</dt><dd><RatingLine rating={r.rating} reviewCount={r.reviewCount} /></dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Status</dt><dd>{r.businessStatus === "OPERATIONAL" ? "Open for business" : r.businessStatus === "CLOSED_TEMPORARILY" ? "Temporarily closed" : r.businessStatus ?? "Not given by Google"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Match</dt><dd>{RELEVANCE_LABEL[r.relevance]}. <span className="text-muted-foreground">{RELEVANCE_HINT[r.relevance]}</span></dd></div>
      </dl>
      {r.mapsUrl ? <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" data-testid="local-maps-link"><MapPin className="size-3.5" aria-hidden /> Open in Google Maps<span className="sr-only"> (opens in a new tab)</span></a> : null}
      <p className="text-[11px] text-muted-foreground">A Google rating shows customer opinion on Google. It says nothing about a business's search performance.</p>
    </section>
  )
}

/** The results, nearest first by default. Clicking a row selects it (and its marker on the map). */
export default function LocalResultList({ results, selectedId, onSelect, addPending, onAdd }) {
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card" data-testid="local-list">
      {results.map((r) => {
        const active = r.placeId === selectedId
        return (
          <li key={r.placeId} className={cn("flex items-start gap-3 px-3 py-2.5", active && "bg-primary/5")} data-testid="local-row" data-place-id={r.placeId} data-selected={active ? "true" : undefined}>
            <button type="button" onClick={() => onSelect(r.placeId)} aria-pressed={active} className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-sm font-medium">{r.name}</span>
                <Badge variant={REL_VARIANT[r.relevance]} title={RELEVANCE_HINT[r.relevance]}>{RELEVANCE_LABEL[r.relevance]}</Badge>
                {r.businessStatus === "CLOSED_TEMPORARILY" ? <Badge variant="outline">Temporarily closed</Badge> : null}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.primaryTypeLabel ?? "—"} · {r.address ?? "No address"}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-medium tabular-nums" data-testid="local-distance">{formatDistance(r.distanceMeters)}</span>
                <RatingLine rating={r.rating} reviewCount={r.reviewCount} />
                <span className="text-muted-foreground">{r.websiteDomain ?? "No website"}</span>
              </span>
            </button>
            <div className="shrink-0 pt-0.5"><AddButton r={r} pending={addPending.has(r.placeId)} onAdd={onAdd} /></div>
          </li>
        )
      })}
    </ul>
  )
}

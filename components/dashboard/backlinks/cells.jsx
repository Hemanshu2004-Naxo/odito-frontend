"use client"

import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Favicon } from "../domain-overview/CompetitorsCard"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { MAX_RANK } from "./constants"

/** Small building blocks of a backlink row. Components read the clean row from mapBacklink and never a raw API path. */

const BAND_STYLE = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
}

const Chip = ({ className, children, ...p }) => <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none", className)} {...p}>{children}</span>

/** Source: favicon, the page's title in bold (its URL when it has none) and the URL underneath, with the source country's flag. Opens in a new tab. */
export function SourceCell({ row }) {
  const title = row.sourceTitle ?? row.sourceUrlDisplay
  return (
    <div className="flex min-w-[250px] max-w-[340px] items-start gap-2" data-testid="bl-source">
      {row.sourceDomain ? <span className="mt-0.5"><Favicon domain={row.sourceDomain} /></span> : null}
      <div className="min-w-0">
        <a
          href={row.sourceUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          title={title ?? undefined}
          className="flex min-w-0 items-center gap-1.5 font-semibold hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          data-testid="bl-source-link"
        >
          {row.sourceCountry ? <span className="shrink-0 text-sm font-normal" title={row.sourceCountry.name} aria-label={row.sourceCountry.name} role="img">{row.sourceCountry.flag}</span> : null}
          <span className="truncate" data-testid="bl-source-title">{title ?? MISSING}</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <div className="truncate text-xs text-muted-foreground" title={row.sourceUrl ?? undefined} data-testid="bl-source-url">{row.sourceUrlDisplay ?? MISSING}</div>
      </div>
    </div>
  )
}

/** Anchor: the text; for an image link the image icon and its alt text; "(no anchor text)" in muted italics when empty. A chip names a non-text type. */
export function AnchorCell({ row }) {
  return (
    <div className="flex min-w-[150px] max-w-[240px] items-start gap-1.5" data-testid="bl-anchor">
      {row.anchorKind === "image" ? (
        <span className="flex min-w-0 items-center gap-1.5" title={row.imageAlt ?? "Image link"}>
          <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="line-clamp-2 break-words">{row.imageAlt ?? <span className="italic text-muted-foreground">(no alt text)</span>}</span>
        </span>
      ) : row.anchorKind === "text" ? (
        <span className="line-clamp-2 break-words" title={row.anchor}>{row.anchor}</span>
      ) : (
        <span className="italic text-muted-foreground">(no anchor text)</span>
      )}
      {row.itemTypeLabel ? <Chip className="mt-0.5 shrink-0 border border-border/70 bg-muted/40 text-foreground" data-testid="bl-type-chip">{row.itemTypeLabel}</Chip> : null}
    </div>
  )
}

/** Target: the path on the audited site (the full URL in the tooltip); a redirect shows where it ends up on a second muted line. */
export function TargetCell({ row }) {
  return (
    <div className="min-w-[160px] max-w-[260px]" data-testid="bl-target">
      <div className="truncate" title={row.targetUrl ?? undefined} data-testid="bl-target-path">{row.targetPath ?? MISSING}</div>
      {row.targetRedirect ? <div className="truncate text-xs text-muted-foreground" title={row.targetRedirect} data-testid="bl-target-redirect">→ {row.targetRedirectDisplay}</div> : null}
    </div>
  )
}

/** Dofollow (green) or Nofollow (grey), plus small chips for ugc and sponsored. */
export function FollowCell({ row }) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="bl-follow">
      {row.isDofollow === null ? MISSING : row.isDofollow
        ? <Chip className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" data-follow="dofollow">Dofollow</Chip>
        : <Chip className="bg-muted text-muted-foreground" data-follow="nofollow">Nofollow</Chip>}
      {row.isUgc ? <Chip className="bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" title="User-generated content">ugc</Chip> : null}
      {row.isSponsored ? <Chip className="bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" title="Paid or sponsored link">sponsored</Chip> : null}
    </div>
  )
}

/** A rank out of 1,000 with a mini bar. */
export function RankCell({ value, label }) {
  if (value === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <div className="min-w-[64px]" title={`${label}: ${formatExact(value)} out of ${MAX_RANK.toLocaleString("en-US")}`} data-testid="bl-rank">
      <div className="tabular-nums">{formatCompact(value)}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(1, (value / MAX_RANK) * 100))}%` }} />
      </div>
    </div>
  )
}

/** The spam score with the same colour badge as the Backlink Overview: 0–10 Low (green), 11–30 Medium (amber), 31+ High (red). */
export function SpamBadge({ score, band }) {
  if (score === null || !band) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="bl-spam" data-band={band.key} title={`Spam score ${score} out of 100 (${band.label})`}>
      <span className="tabular-nums">{score}</span>
      <Chip className={BAND_STYLE[band.key]}>{band.label}</Chip>
    </span>
  )
}

export const PlacementChip = ({ label }) => (label ? <Chip className="border border-border/70 bg-muted/40 text-foreground" data-testid="bl-placement">{label}</Chip> : <span className="text-muted-foreground">{MISSING}</span>)

/** "Oct 5, 2026" with the full date-time and how long ago in the tooltip. */
export const DateCell = ({ value }) => (value.label ? <span className="whitespace-nowrap tabular-nums" title={value.tooltip ?? undefined}>{value.label}</span> : <span className="text-muted-foreground">{MISSING}</span>)

const BADGE_STYLE = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  lost: "bg-muted text-muted-foreground",
  broken: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
}

/** NEW (blue), LOST (grey), BROKEN <status> (red). */
export function StatusBadges({ badges }) {
  if (!badges.length) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <div className="flex flex-wrap gap-1" data-testid="bl-status">
      {badges.map((b) => <Chip key={b.key} className={BADGE_STYLE[b.key]} data-badge={b.key}>{b.label}</Chip>)}
    </div>
  )
}

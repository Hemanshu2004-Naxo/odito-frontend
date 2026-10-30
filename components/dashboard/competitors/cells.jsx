"use client"

import { ExternalLink, Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Favicon } from "../domain-overview/CompetitorsCard"
import { MISSING, formatCompact, formatDecimal1, formatExact, formatPercent1 } from "../domain-overview/format"

/** A domain with its favicon; the link opens the site in a new tab. */
export function DomainLink({ domain, className, hideIconOnNarrow = false }) {
  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("group inline-flex min-w-0 max-w-full items-center gap-2 font-medium hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded", className)}
      data-testid="cp-domain-link"
    >
      <span className={cn("shrink-0", hideIconOnNarrow && "hidden @min-[640px]/main:inline")}><Favicon domain={domain} /></span>
      <span className="truncate" title={domain}>{domain}</span>
      <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/** A number with its exact value in the native tooltip; "—" when unknown. */
export const Num = ({ value, className }) => <span className={cn("tabular-nums", className)} title={formatExact(value)}>{formatCompact(value)}</span>

/** Shared keywords, with a thin bar: shared ÷ the project's total keywords. */
export function SharedKeywordsCell({ row }) {
  const share = row.sharedShare
  return (
    <div className="min-w-[56px] @min-[640px]/main:min-w-[110px]" data-testid="cp-shared">
      <div className="text-right tabular-nums" title={formatExact(row.sharedKeywords)}>{formatCompact(row.sharedKeywords)}</div>
      {share !== null ? (
        <div className="mt-1 flex items-center gap-2" title={`${formatPercent1(share)} of your keywords are shared with ${row.domain}`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share, 1)}%` }} />
          </div>
          <span className="hidden w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground @min-[640px]/main:inline" data-testid="cp-shared-pct">{formatPercent1(share)}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * "You 26K · Them 36.9K": our traffic against theirs on the keywords both rank for, as a split bar. Green when we lead, red when they
 * do (the words say it too, so colour is never the only signal).
 */
export function HeadToHead({ row, className }) {
  const { ourSharedTraffic: ours, theirSharedTraffic: theirs, lead } = row
  const known = ours !== null && theirs !== null
  const total = known ? ours + theirs : 0
  const pct = known && total > 0 ? (ours / total) * 100 : known ? 50 : 0
  const tone = lead === "us" ? "bg-emerald-500" : lead === "them" ? "bg-red-500" : "bg-muted-foreground/50"
  return (
    <div className={cn("min-w-[72px] @min-[640px]/main:min-w-[140px]", className)} data-testid="cp-h2h" data-lead={lead ?? ""}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
        {known ? <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(Math.max(pct, 2), 98)}%` }} /> : null}
      </div>
      {/* One line on a wide screen ("You 26K · Them 36.9K"); on a narrow one the two halves stack so the column stays small. */}
      <div className="mt-1 text-xs tabular-nums @min-[640px]/main:whitespace-nowrap" title={known ? `You ${formatExact(ours)} · Them ${formatExact(theirs)} estimated monthly visits on the shared keywords` : undefined}>
        <span className="block whitespace-nowrap @min-[640px]/main:inline"><span className="text-muted-foreground">You</span> <span data-testid="cp-h2h-you">{formatCompact(ours)}</span></span>
        <span className="text-muted-foreground hidden @min-[640px]/main:inline"> · </span>
        <span className="block whitespace-nowrap @min-[640px]/main:inline"><span className="text-muted-foreground">Them</span> <span data-testid="cp-h2h-them">{formatCompact(theirs)}</span></span>
        {lead === "us" ? <span className="sr-only"> You lead.</span> : lead === "them" ? <span className="sr-only"> They lead.</span> : null}
      </div>
    </div>
  )
}

/** "You 32 · Them 213": #1 rankings on the shared keywords. */
export function Top1Cell({ row }) {
  return (
    <span className="whitespace-nowrap text-sm tabular-nums" data-testid="cp-top1" title={`#1 rankings on the shared keywords — you: ${formatExact(row.ourTop1)}, them: ${formatExact(row.theirTop1)}`}>
      <span className="text-muted-foreground">You</span> {formatCompact(row.ourTop1)}<span className="text-muted-foreground"> · Them </span>{formatCompact(row.theirTop1)}
    </span>
  )
}

export const AvgPosition = ({ value }) => <span className="tabular-nums" data-testid="cp-avgpos">{value === null ? MISSING : formatDecimal1(value)}</span>

/** The pin: adds / removes the domain from the tracked competitors (Compare section). */
export function TrackButton({ domain, tracked, busy, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(domain)}
      aria-pressed={tracked}
      aria-label={tracked ? `Stop tracking ${domain}` : `Track ${domain}`}
      title={tracked ? "Tracked — click to stop tracking" : "Track this competitor"}
      disabled={busy}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      data-testid="cp-track"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Star className={cn("size-4", tracked && "fill-amber-400 text-amber-500")} aria-hidden />}
    </button>
  )
}

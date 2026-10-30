"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Chip } from "../anchors/cells"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { FLAG_TONE, MAX_ROW_FLAGS, STATUS, TRAFFIC_HINT } from "./constants"

export { Chip }

/** The status as a coloured badge: "200", "301", "404", "403 Blocked". */
export function StatusBadge({ row, className }) {
  const s = STATUS[row.statusGroup] ?? STATUS.unknown
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", s.chip, className)}
      title={s.description}
      data-testid="tp-status"
      data-group={row.statusGroup}
    >
      {row.statusLabel}
    </span>
  )
}

/**
 * The page: its title in bold (or its address when it has none), the address underneath (small, cut to fit), a redirect's target on a muted second
 * line, "N variants" when URL variants are merged. The whole URL is in the tooltip; the link opens the page in a new tab.
 */
export function PageCell({ row }) {
  return (
    <div className="min-w-0 max-w-[260px] @min-[700px]/main:max-w-[380px]">
      <a href={row.url} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1 font-semibold hover:underline" title={row.url} data-testid="tp-page-link">
        <span className="truncate" data-testid="tp-heading">{row.heading}</span>
        <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </a>
      {row.title ? <div className="truncate text-xs text-muted-foreground" title={row.url} data-testid="tp-address">{row.address}</div> : null}
      {row.locationLabel ? <div className="truncate text-xs text-muted-foreground" title={row.location} data-testid="tp-location">→ {row.locationLabel}</div> : null}
      {row.variantCount > 1 ? <Chip className="mt-1 border border-border/70 bg-muted/40 text-foreground" title="The same page found with different spellings (http / https / www / trailing slash)" data-testid="tp-variants">{row.variantCount} variants</Chip> : null}
    </div>
  )
}

/** Referring domains with a thin bar: its share of the site's total referring domains (no total, no bar). */
export function ReferringDomainsCell({ row, total }) {
  if (row.referringDomains === null) return <span className="text-muted-foreground">{MISSING}</span>
  const share = total > 0 ? Math.min(100, (row.referringDomains / total) * 100) : null
  const approx = row.approx
  return (
    <div className="min-w-[72px]" title={`${formatExact(row.referringDomains)} referring domains${approx ? " (approximate: summed over the variants)" : ""}${share === null ? "" : ` — ${formatPercent1(share)} of the site's total`}`} data-testid="tp-rd">
      <div className="tabular-nums">{approx ? "≈ " : ""}{formatCompact(row.referringDomains)}</div>
      {share !== null ? (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(2, share))}%` }} data-testid="tp-rd-bar" />
        </div>
      ) : null}
    </div>
  )
}

/** Backlinks, with "<n> broken" in red underneath when some of them point to a broken URL. */
export function BacklinksCell({ row }) {
  if (row.backlinks === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <div title={`${formatExact(row.backlinks)}${row.approx ? " (approximate: summed over the variants)" : ""}`} data-testid="tp-backlinks">
      <div className="tabular-nums">{row.approx ? "≈ " : ""}{formatCompact(row.backlinks)}</div>
      {row.brokenBacklinks > 0 ? <div className="whitespace-nowrap text-xs font-medium tabular-nums text-red-600 dark:text-red-400" data-testid="tp-broken">{formatCompact(row.brokenBacklinks)} broken</div> : null}
    </div>
  )
}

export function DofollowCell({ row }) {
  if (row.dofollowPct === null) return <span className="text-muted-foreground">{MISSING}</span>
  return <span className="tabular-nums" title="Share of the referring domains that pass ranking credit (dofollow)" data-testid="tp-dofollow">{formatPercent1(row.dofollowPct)}</span>
}

/**
 * The estimated traffic from Organic Keywords, with "<n> keywords" underneath. "—" when the traffic could not be joined (the table still loads);
 * 0 when the keywords read do not rank this page. `truncated`: the domain has more keywords than the 1,000 that were read.
 */
export function TrafficCell({ row, truncated }) {
  if (row.traffic === null) return <span className="text-muted-foreground" title="The traffic could not be loaded" data-testid="tp-traffic" data-known="false">{MISSING}</span>
  return (
    <div title={`${formatExact(Math.round(row.traffic))} estimated visits a month. ${TRAFFIC_HINT}${truncated ? " The domain has more keywords than that, so a page can rank for more than shown." : ""}`} data-testid="tp-traffic" data-known="true">
      <div className="tabular-nums">{formatCompact(Math.round(row.traffic))}</div>
      <div className="text-xs text-muted-foreground tabular-nums" data-testid="tp-keywords">{formatCompact(row.keywords ?? 0)} {row.keywords === 1 ? "keyword" : "keywords"}</div>
    </div>
  )
}

/** The opportunity chips: at most two, then "+N" (all of them, with their explanations, are in the expanded row). */
export function FlagChips({ row }) {
  if (!row.flags.length) return <span className="text-muted-foreground">{MISSING}</span>
  const shown = row.flags.slice(0, MAX_ROW_FLAGS)
  const more = row.flags.length - shown.length
  return (
    <div className="flex flex-wrap gap-1" data-testid="tp-flags">
      {shown.map((f) => <Chip key={f.id} className={FLAG_TONE[f.tone]} title={f.message} data-testid={`tp-flag-${f.id}`}>{f.label}</Chip>)}
      {more > 0 ? <Chip className="bg-muted text-muted-foreground" title={row.flags.slice(MAX_ROW_FLAGS).map((f) => f.message).join(" · ")} data-testid="tp-flags-more">+{more}</Chip> : null}
    </div>
  )
}

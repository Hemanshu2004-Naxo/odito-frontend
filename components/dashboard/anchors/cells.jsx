"use client"

import { ANCHOR_TYPES } from "@/lib/anchors/anchorConfig"
import { cn } from "@/lib/utils"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"

/** A small pill. */
export const Chip = ({ className, children, ...rest }) => (
  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", className)} {...rest}>{children}</span>
)

/** The anchor type as a coloured chip (the type's fixed colour is used everywhere on the page). */
export function TypeChip({ type, className }) {
  const t = ANCHOR_TYPES[type]
  if (!t) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: `${t.color}1f`, borderColor: `${t.color}66` }}
      title={t.description}
      data-testid="an-type"
      data-type={type}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
      <span>{t.label}</span>
    </span>
  )
}

/** The anchor text in quotes, cut to fit with the whole text in the tooltip; "(empty / image link)" in muted italics. */
export function AnchorCell({ row }) {
  if (row.isEmpty) return <span className="italic text-muted-foreground" data-testid="an-anchor" data-empty="true">{row.label}</span>
  return (
    <span className="block max-w-[150px] truncate font-medium @min-[700px]/main:max-w-[300px]" title={row.anchor} data-testid="an-anchor">
      &ldquo;{row.anchor}&rdquo;
    </span>
  )
}

/** Referring domains with a thin bar: its share of all the project's referring domains (null share = no bar). */
export function ReferringDomainsCell({ row, total }) {
  if (row.referringDomains === null) return <span className="text-muted-foreground">{MISSING}</span>
  const share = total > 0 ? Math.min(100, (row.referringDomains / total) * 100) : null
  return (
    <div className="min-w-[72px]" title={share === null ? formatExact(row.referringDomains) : `${formatExact(row.referringDomains)} referring domains — ${formatPercent1(share)} of all`} data-testid="an-rd">
      <div className="tabular-nums">{formatCompact(row.referringDomains)}</div>
      {share !== null ? (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(2, share))}%` }} data-testid="an-rd-bar" />
        </div>
      ) : null}
    </div>
  )
}

/** Backlinks, plus a "sitewide" chip when there are many links per referring domain (typically a footer or sidebar link). */
export function BacklinksCell({ row }) {
  if (row.backlinks === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span className="inline-flex items-center gap-1.5" title={formatExact(row.backlinks)} data-testid="an-backlinks">
      <span className="tabular-nums">{formatCompact(row.backlinks)}</span>
      {row.isSitewide ? <Chip className="bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" title="Many links from few sites — usually a footer or sidebar link" data-testid="an-sitewide">sitewide</Chip> : null}
    </span>
  )
}

export function DofollowCell({ row }) {
  if (row.dofollowPercent === null) return <span className="text-muted-foreground">{MISSING}</span>
  return <span className="tabular-nums" title="Share of referring domains that pass ranking credit (dofollow)" data-testid="an-dofollow">{formatPercent1(row.dofollowPercent)}</span>
}

/** Broken links in red as "104 broken"; none is a quiet dash. */
export function BrokenCell({ row }) {
  if (row.brokenBacklinks === null) return <span className="text-muted-foreground">{MISSING}</span>
  if (row.brokenBacklinks <= 0) return <span className="text-muted-foreground" data-testid="an-broken" data-broken="false">0</span>
  return <span className="whitespace-nowrap font-medium tabular-nums text-red-600 dark:text-red-400" title={`${formatExact(row.brokenBacklinks)} backlinks with this anchor point to pages that return errors`} data-testid="an-broken" data-broken="true">{formatCompact(row.brokenBacklinks)} broken</span>
}

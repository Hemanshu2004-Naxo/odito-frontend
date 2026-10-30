"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Chip } from "../anchors/cells"
import { MISSING, faviconUrl, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { QUALITY } from "./constants"

export { Chip }

/** The quality tier as a coloured chip. A toxic domain the user has marked OK is shown as such, not as a warning. */
export function QualityChip({ row }) {
  if (row.noLiveLinks || !row.quality) return <span className="text-muted-foreground">{MISSING}</span>
  const q = QUALITY[row.quality]
  const calmed = row.quality === "toxic" && row.reviewed
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", calmed ? "border-border bg-muted/50 text-muted-foreground" : q.chip)}
      title={calmed ? "Toxic by our rules, but you marked this domain as OK" : q.description}
      data-testid="rd-quality"
      data-quality={row.quality}
      data-calm={calmed ? "true" : "false"}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: calmed ? "#94a3b8" : q.dot }} aria-hidden />
      {q.label}{calmed ? " · OK" : ""}
    </span>
  )
}

/** Favicon + the domain (opens the site in a new tab) + the top country's flag, and small chips: Sitewide, Disavowed, Reviewed. */
export function DomainCell({ row }) {
  const country = row.topCountry
  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 16px favicon from Google's service */}
      <img src={faviconUrl(row.domain)} alt="" width={16} height={16} className="size-4 shrink-0 rounded-sm" loading="lazy" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <a
            href={`https://${row.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 max-w-[150px] items-center gap-1 truncate font-medium hover:underline @min-[700px]/main:max-w-[260px]"
            title={`Open ${row.domain} in a new tab`}
            data-testid="rd-domain-link"
          >
            <span className="truncate">{row.domain}</span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </a>
          {country?.flag ? <span title={country.name} aria-label={country.name} data-testid="rd-country">{country.flag}</span> : null}
        </div>
        {(row.isSitewide || row.disavowed || row.reviewed || row.noLiveLinks) ? (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {row.noLiveLinks ? <span className="text-xs italic text-muted-foreground" data-testid="rd-no-live">No live links found</span> : null}
            {row.isSitewide ? <Chip className="bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" title="Links from 50 or more pages, or mostly footer links" data-testid="rd-sitewide">Sitewide</Chip> : null}
            {row.disavowed ? <Chip className="bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" title="In your disavow list" data-testid="rd-disavowed">Disavowed</Chip> : null}
            {row.reviewed ? <Chip className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" title="You marked this domain as OK" data-testid="rd-reviewed">Reviewed</Chip> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** The count, plus "from <n> pages" in muted text. */
export function BacklinksCell({ row }) {
  if (row.backlinks === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <div title={formatExact(row.backlinks)} data-testid="rd-backlinks">
      <div className="tabular-nums">{formatCompact(row.backlinks)}</div>
      {row.referringPages !== null ? <div className="text-xs text-muted-foreground" data-testid="rd-pages">from {formatCompact(row.referringPages)} {row.referringPages === 1 ? "page" : "pages"}</div> : null}
    </div>
  )
}

/** The dofollow share with a green / grey split bar. */
export function DofollowCell({ row }) {
  if (row.dofollowPct === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <div className="min-w-[72px]" title="Share of referring pages that pass ranking credit (dofollow)" data-testid="rd-dofollow">
      <div className="tabular-nums">{formatPercent1(row.dofollowPct)}</div>
      <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-600" role="presentation">
        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, row.dofollowPct))}%` }} data-testid="rd-dofollow-bar" />
      </div>
    </div>
  )
}

/** Broken links in red as a count; none is a quiet 0. */
export function BrokenCell({ row }) {
  if (row.brokenBacklinks === null) return <span className="text-muted-foreground">{MISSING}</span>
  if (row.brokenBacklinks <= 0) return <span className="text-muted-foreground" data-testid="rd-broken" data-broken="false">0</span>
  return <span className="whitespace-nowrap font-medium tabular-nums text-red-600 dark:text-red-400" title={`${formatExact(row.brokenBacklinks)} backlinks from this domain point to pages that return errors`} data-testid="rd-broken" data-broken="true">{formatCompact(row.brokenBacklinks)}</span>
}

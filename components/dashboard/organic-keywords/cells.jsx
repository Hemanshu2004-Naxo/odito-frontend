"use client"

import {
  Briefcase, CircleHelp, ExternalLink, FileText, GraduationCap, Image as ImageIcon, Layers, Map as MapIcon, MapPin, MessagesSquare,
  Search, ShoppingBag, Sparkles, Star, StarHalf, Users, Video, BookOpen, Clapperboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ChangeBadge } from "../domain-overview/TopKeywordsCard"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { MAX_SERP_ICONS } from "./constants"
import { formatShare } from "./format"
import Sparkline from "./Sparkline"

/** One mark per cell kind. Missing values are always "—" (never 0). */

const INTENT_STYLE = {
  informational: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  navigational: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  commercial: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  transactional: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
}

/**
 * I / N / C / T. The letter is the visible text; the full name is the accessible name and the native tooltip. (A native `title`, not a
 * Radix tooltip: a table page has up to 100 of these and each Radix tooltip mounts its own provider and listeners.)
 */
export function IntentBadge({ intent }) {
  if (!intent) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span
      role="img"
      aria-label={`${intent.label} intent`}
      title={`${intent.label} — ${intent.hint}`}
      data-testid="ok-intent"
      className={cn("inline-grid size-6 cursor-default place-items-center rounded-md text-xs font-semibold", INTENT_STYLE[intent.value])}
    >
      {intent.letter}
    </span>
  )
}

/** The position, how it moved, and (only when it is not a plain organic result) what kind of result it is. */
export function PositionCell({ row }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-medium tabular-nums" data-testid="ok-position">{row.position ?? MISSING}</span>
      <ChangeBadge change={row.change} />
      {row.resultType ? (
        <span className="rounded border border-border/70 px-1 py-px text-[10px] font-medium leading-4 text-muted-foreground" data-testid="ok-result-type" title={`This ranking is a ${row.resultType.label} result, not a standard organic link`}>
          {row.resultType.label}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Compact volume (exact in the title); hovering shows the last 12 months as a sparkline. The popover is plain CSS (group-hover), not a
 * Radix tooltip, so a page of 100 rows mounts nothing extra. It is a pointer-only extra: the same figures are in the expanded row's
 * chart and table, which work with a keyboard.
 */
export function VolumeCell({ row }) {
  const text = <span className="tabular-nums" data-testid="ok-volume">{formatCompact(row.volume)}</span>
  const hasTrend = row.monthly.filter((m) => m.volume !== null).length >= 2
  if (!hasTrend) return <span title={formatExact(row.volume)}>{text}</span>
  return (
    <span className="group relative inline-block cursor-default" title={`${formatExact(row.volume)} searches / month`}>
      <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">{text}</span>
      <span
        aria-hidden
        data-testid="ok-trend-popover"
        className="pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1.5 w-44 rounded-md bg-foreground px-3 py-2 text-left text-xs text-background opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100"
      >
        <span className="mb-1 block text-[11px] font-medium">{formatExact(row.volume)} searches / month</span>
        <Sparkline points={row.monthly} className="h-9 w-full text-background" />
        <span className="mt-1 flex justify-between text-[10px] opacity-80"><span>{row.monthly[0]?.label}</span><span>{row.monthly.at(-1)?.label}</span></span>
      </span>
    </span>
  )
}

/** The KD number with a coloured dot; the band name is in the tooltip and in text for screen readers. */
export function KdCell({ row }) {
  if (row.difficulty === null) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span className="inline-flex items-center justify-end gap-1.5 tabular-nums" title={row.kdBand ? `${row.kdBand.label} to rank for` : undefined} data-testid="ok-kd">
      {row.difficulty}
      {row.kdBand ? (
        <>
          <span className={cn("size-2 rounded-full", row.kdBand.dot)} aria-hidden data-band={row.kdBand.key} />
          <span className="sr-only">{row.kdBand.label}</span>
        </>
      ) : null}
    </span>
  )
}

/** Estimated monthly visits and, underneath, the share of the whole domain's traffic. */
export function TrafficCell({ row }) {
  return (
    <span className="block text-right">
      <span className="block font-medium tabular-nums" title={formatExact(row.traffic)}>{formatCompact(row.traffic)}</span>
      {row.trafficShare !== null ? <span className="block text-[11px] text-muted-foreground tabular-nums" data-testid="ok-share">{formatShare(row.trafficShare)}</span> : null}
    </span>
  )
}

/** The ranking page: the path truncated, the full URL on hover, opening in a new tab. */
export function UrlCell({ row, className }) {
  if (!row.path) return <span className="text-muted-foreground">{MISSING}</span>
  return row.url ? (
    <a href={row.url} target="_blank" rel="noopener noreferrer" className={cn("block truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", className)} title={row.url} data-testid="ok-url">
      {row.path}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <span className={cn("block truncate text-muted-foreground", className)} title={row.path}>{row.path}</span>
  )
}

const FEATURE_ICON = {
  ai_overview: Sparkles,
  featured_snippet: FileText,
  local_pack: MapPin,
  map: MapIcon,
  people_also_ask: CircleHelp,
  knowledge_graph: BookOpen,
  images: ImageIcon,
  video: Video,
  short_videos: Clapperboard,
  discussions_and_forums: MessagesSquare,
  google_reviews: Star,
  third_party_reviews: StarHalf,
  popular_products: ShoppingBag,
  scholarly_articles: GraduationCap,
  jobs: Briefcase,
  perspectives: Users,
  related_searches: Search,
}

/** Up to four feature icons (each named for screen readers and in a native tooltip), then "+N" listing the rest. */
export function SerpFeatureIcons({ features }) {
  if (!features.length) return <span className="text-muted-foreground">{MISSING}</span>
  const shown = features.slice(0, MAX_SERP_ICONS)
  const rest = features.slice(MAX_SERP_ICONS)
  return (
    <span className="inline-flex items-center gap-1" data-testid="ok-serp">
      {shown.map((f) => {
        const Icon = FEATURE_ICON[f.key] ?? Layers
        return (
          <span key={f.key} role="img" aria-label={f.label} title={f.label} className="grid size-6 cursor-default place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-3.5" aria-hidden />
          </span>
        )
      })}
      {rest.length ? (
        <span
          role="img"
          className="cursor-default rounded-md bg-muted px-1.5 py-1 text-[11px] font-medium text-muted-foreground"
          aria-label={`${rest.length} more: ${rest.map((f) => f.label).join(", ")}`}
          title={rest.map((f) => f.label).join(", ")}
        >
          +{rest.length}
        </span>
      ) : null}
    </span>
  )
}

/** The keyword as a link to Google's results for it (new tab) when the provider gave the results URL; plain text otherwise. */
export function KeywordLink({ row }) {
  if (!row.googleUrl) return <span className="break-words font-medium">{row.keyword}</span>
  return (
    <a href={row.googleUrl} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-baseline gap-1 font-medium hover:underline underline-offset-2" data-testid="ok-keyword-link">
      <span className="break-words">{row.keyword}</span>
      <ExternalLink className="size-3 shrink-0 translate-y-px text-muted-foreground group-hover:text-foreground" aria-hidden />
      <span className="sr-only">(search results open in a new tab)</span>
    </a>
  )
}

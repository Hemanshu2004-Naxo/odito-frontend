"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import InfoHint from "../referring-domains/InfoHint"
import { Segmented } from "../traffic-history/DistributionChart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { ANCHORS, ANCHOR_SETTINGS_HINT, keywordsHref } from "./hubLinks"

export const ORGANIC_KEYWORDS_HREF = "/app/organic-keywords"

const MODES = [
  { value: "all", label: "All" },
  { value: "non", label: "Non-brand" },
  { value: "only", label: "Brand" },
]
const EMPTY = { all: "No ranking keywords yet for this domain.", non: "No non-brand keywords rank yet.", only: "No brand keywords rank yet." }

/** ▲3 green / ▼2 red / NEW. "Same" and "unknown" show nothing: no movement is claimed when none is known. */
export function ChangeBadge({ change }) {
  if (change.kind === "new") {
    return <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" aria-label="New keyword" data-testid="do-badge-new">New</span>
  }
  if (change.kind === "up") {
    return <span className="text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400" aria-label={`Up ${change.amount}`} data-testid="do-badge-up">▲{change.amount}</span>
  }
  if (change.kind === "down") {
    return <span className="text-xs font-medium tabular-nums text-red-600 dark:text-red-400" aria-label={`Down ${change.amount}`} data-testid="do-badge-down">▼{change.amount}</span>
  }
  return null
}

const TableSkeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
  </div>
)

/**
 * "Top keywords" (API 3): the five keywords that bring the most traffic, in three groups: All, Non-brand and Brand. The split uses the
 * brand terms the project saved on the Anchors page; with none saved the toggle is off and says where to add them. Each group is its own
 * request (cached like any other API 3 request), and "View all" carries the same group to the Organic Keywords page.
 *
 * @param {{ state: any, topKeywords: { rows: any[], totalCount: number|null }, brand: any }} props
 *   `state` is the plain top-5 section; `brand` is useDomainHub().brand (mode, terms, the variant's rows and status).
 */
export default function TopKeywordsCard({ state, topKeywords, brand }) {
  const mode = brand?.mode ?? "all"
  const split = mode !== "all"
  // The plain list is shown for "All"; a group shows its own request. Until the saved terms are known the card does not guess a group.
  const active = split
    ? { status: brand.status, error: brand.error, refetch: brand.refetch, data: brand.keywords }
    : !brand || brand.settled ? state : { status: "loading" }
  const rows = split ? (brand.keywords?.rows ?? []) : topKeywords.rows
  const total = split ? (brand.keywords?.totalCount ?? null) : topKeywords.totalCount
  const hasTerms = Boolean(brand?.hasTerms)

  const toggle = brand ? (
    <div className="flex flex-col items-end gap-1">
      <Segmented label="Which keywords" options={MODES} value={mode} onChange={brand.setMode} disabled={!hasTerms} />
      {!hasTerms && brand.settled ? (
        <Link href={ANCHORS} className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="do-brand-hint">
          {ANCHOR_SETTINGS_HINT}
        </Link>
      ) : null}
    </div>
  ) : null

  return (
    <Panel title="Top keywords" description="The keywords that bring the most estimated traffic" action={toggle} className="min-w-0">
      <SectionBoundary state={active} skeleton={<TableSkeleton />} empty={rows.length === 0} emptyMessage={EMPTY[mode]}>
        <Table data-testid="do-top-keywords" data-mode={mode}>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-0">Keyword</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right"><span className="inline-flex items-center gap-1">KD <InfoHint label="KD" text="Keyword difficulty, 0–100: how hard it is to rank in Google's top 10 for this keyword." /></span></TableHead>
              <TableHead className="text-right">Traffic</TableHead>
              <TableHead className="pr-0">URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.keyword}>
                <TableCell className="max-w-[200px] whitespace-normal pl-0 font-medium" title={r.keyword}><span className="line-clamp-2 break-words">{r.keyword}</span></TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium tabular-nums">{r.position ?? MISSING}</span>
                    <ChangeBadge change={r.change} />
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums" title={formatExact(r.volume)}>{formatCompact(r.volume)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.difficulty ?? MISSING}</TableCell>
                <TableCell className="text-right tabular-nums" title={formatExact(r.traffic)}>{formatCompact(r.traffic)}</TableCell>
                <TableCell className={cn("max-w-[160px] pr-0")}>
                  {r.path ? (
                    r.url
                      ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" title={r.url}>{r.path}</a>
                      : <span className="block truncate text-muted-foreground" title={r.path}>{r.path}</span>
                  ) : MISSING}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-3 border-t border-border/60 pt-3">
          <Link href={keywordsHref(mode)} className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2" data-testid="do-view-all-keywords">
            {total === null ? "View all keywords" : `View all ${formatExact(total)} keywords`} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

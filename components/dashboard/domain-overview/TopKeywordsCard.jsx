"use client"

import Link from "next/link"
import InfoHint from "../referring-domains/InfoHint"
import OverviewCard, { FooterLink, Note } from "./OverviewCard"
import { CardToggle } from "./TrafficTrendCard"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { ANCHORS, ANCHOR_SETTINGS_HINT, keywordsHref } from "./hubLinks"
import { describeTopKeywords } from "./overviewInsights"

export const ORGANIC_KEYWORDS_HREF = "/app/organic-keywords"

const MODES = [
  { value: "all", label: "All" },
  { value: "non", label: "Non-brand" },
  { value: "only", label: "Brand" },
]
const EMPTY = { all: "No ranking keywords yet for this domain.", non: "No non-brand keywords rank yet.", only: "No brand keywords rank yet." }

const CHIP = "inline-flex items-center rounded px-1 py-px text-[10px] font-semibold tabular-nums"

/** ▲3 green / ▼2 red / NEW blue / – grey for "no change". Unknown shows nothing: no movement is claimed when none is known. */
export function ChangeBadge({ change }) {
  if (change.kind === "new") {
    return <span className={`${CHIP} bg-sky-100 uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-300`} aria-label="New keyword" data-testid="do-badge-new">New</span>
  }
  if (change.kind === "up") {
    return <span className={`${CHIP} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`} aria-label={`Up ${change.amount}`} data-testid="do-badge-up">▲{change.amount}</span>
  }
  if (change.kind === "down") {
    return <span className={`${CHIP} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`} aria-label={`Down ${change.amount}`} data-testid="do-badge-down">▼{change.amount}</span>
  }
  if (change.kind === "same") {
    return <span className={`${CHIP} bg-muted text-muted-foreground`} aria-label="No change" data-testid="do-badge-same">–</span>
  }
  return null
}

const TableSkeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
  </div>
)

const TH = "px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"

/**
 * "Top keywords" (API 3): the five keywords that bring the most traffic, in three groups: All, Non-brand and Brand. The split uses the
 * brand terms the project saved on the Anchors page; with none saved the toggle is off and says where to add them. Each group is its own
 * request (cached like any other API 3 request), and "All N keywords" carries the same group to the Organic Keywords page. Under the table
 * one sentence says how much of the site's traffic the top keywords bring.
 *
 * @param {{ state: any, topKeywords: { rows: any[], totalCount: number|null }, brand: any, totalTraffic?: number|null }} props
 *   `state` is the plain top-5 section; `brand` is useDomainHub().brand (mode, terms, the variant's rows and status).
 */
export default function TopKeywordsCard({ state, topKeywords, brand, totalTraffic = null }) {
  const mode = brand?.mode ?? "all"
  const split = mode !== "all"
  // The plain list is shown for "All"; a group shows its own request. Until the saved terms are known the card does not guess a group.
  const active = split
    ? { status: brand.status, error: brand.error, refetch: brand.refetch, data: brand.keywords }
    : !brand || brand.settled ? state : { status: "loading" }
  const rows = split ? (brand.keywords?.rows ?? []) : topKeywords.rows
  const total = split ? (brand.keywords?.totalCount ?? null) : topKeywords.totalCount
  const hasTerms = Boolean(brand?.hasTerms)
  const note = mode === "all" ? describeTopKeywords(rows, totalTraffic, brand?.terms) : null

  const toggle = brand ? (
    <div className="flex flex-col items-end gap-1">
      <CardToggle label="Which keywords" options={MODES} value={mode} onChange={brand.setMode} disabled={!hasTerms} />
      {!hasTerms && brand.settled ? (
        <Link href={ANCHORS} className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="do-brand-hint">
          {ANCHOR_SETTINGS_HINT}
        </Link>
      ) : null}
    </div>
  ) : null

  return (
    <OverviewCard
      title="Top keywords"
      description="Bring the most estimated traffic"
      action={toggle}
      className="h-full"
      footer={active.status === "success" && rows.length > 0 ? (
        <FooterLink href={keywordsHref(mode)} testId="do-view-all-keywords">{total === null ? "All keywords" : `All ${formatExact(total)} keywords`}</FooterLink>
      ) : null}
    >
      <SectionBoundary state={active} skeleton={<TableSkeleton />} empty={rows.length === 0} emptyMessage={EMPTY[mode]}>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13px]" data-testid="do-top-keywords" data-mode={mode}>
            <thead>
              <tr className="border-b border-border/70 text-left">
                <th scope="col" className={TH}>Keyword</th>
                <th scope="col" className={TH}>Position</th>
                <th scope="col" className={`${TH} text-right`}>Volume</th>
                <th scope="col" className={`${TH} text-right`}><span className="inline-flex items-center gap-1">KD <InfoHint label="KD" text="Keyword difficulty, 0–100: how hard it is to rank in Google's top 10 for this keyword." /></span></th>
                <th scope="col" className={`${TH} text-right`}>Traffic</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.keyword} className="border-b border-border/40 last:border-0">
                  <td className="max-w-[240px] px-2 py-2.5 align-top">
                    <span className="line-clamp-2 break-words font-semibold" title={r.keyword}>{r.keyword}</span>
                    {r.path ? (
                      r.url
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11px] text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400" title={r.url}>{r.path}</a>
                        : <span className="block truncate text-[11px] text-muted-foreground" title={r.path}>{r.path}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold tabular-nums">{r.position ?? MISSING}</span>
                      <ChangeBadge change={r.change} />
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right align-top tabular-nums" title={formatExact(r.volume)}>{formatCompact(r.volume)}</td>
                  <td className="px-2 py-2.5 text-right align-top tabular-nums">{r.difficulty ?? MISSING}</td>
                  <td className="px-2 py-2.5 text-right align-top font-semibold tabular-nums" title={formatExact(r.traffic)}>{formatCompact(r.traffic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note className="mt-3" testId="do-top-keywords-note">{note}</Note>
      </SectionBoundary>
    </OverviewCard>
  )
}

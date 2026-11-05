"use client"

import InfoHint from "../referring-domains/InfoHint"
import { cn } from "@/lib/utils"
import { StatusBadge } from "../top-pages/cells"
import OverviewCard, { FooterLink, Note } from "./OverviewCard"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { TOP_PAGES } from "./hubLinks"
import { describePinnedPage } from "./overviewInsights"

export const TRAFFIC_NOTE = "Estimated monthly visits from Google, from the page's top 1,000 keywords by traffic."
export const SCOPE_NOTE = "Ranked among the 50 best-linked live pages."

const TableSkeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
  </div>
)

const TH = "px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
const OK_CHIP = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
const BAD_CHIP = "border-red-200 bg-red-100 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"

/**
 * "Top pages" (API 10, with its server-side traffic join): the four live pages that bring the most estimated traffic, plus — pinned at the
 * bottom with a red status badge — the error page that wastes the most backlinks, and a sentence saying what that page costs. The data is
 * the Top Pages page's own (same requests, same caches), so opening that page afterwards costs nothing.
 *
 * @param {{ topPages: any }} props  useDomainHub().topPages
 */
export default function TopPagesCard({ topPages }) {
  const { rows, trafficKnown, status } = topPages
  const state = { status, error: topPages.error, refetch: topPages.refetch }
  const pinnedNote = describePinnedPage(rows)
  return (
    <OverviewCard
      title="Top pages"
      description={trafficKnown || status !== "success" ? "Your best-linked live pages, plus the error page with the most links" : "Your best-linked pages (traffic is unavailable)"}
      className="h-full"
      footer={status === "success" && rows.length > 0 ? <FooterLink href={TOP_PAGES} testId="do-view-all-pages">All linked pages</FooterLink> : null}
    >
      <SectionBoundary state={state} skeleton={<TableSkeleton />} empty={rows.length === 0} emptyMessage="No pages with backlinks found for this domain yet.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13px]" data-testid="do-top-pages">
            <thead>
              <tr className="border-b border-border/70 text-left">
                <th scope="col" className={TH}>Page</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={`${TH} text-right`}><span className="inline-flex items-center gap-1">Traffic <InfoHint label="Traffic" text={TRAFFIC_NOTE} /></span></th>
                <th scope="col" className={`${TH} text-right`}>Linking sites</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b border-border/40 last:border-0", r.pinned && "bg-red-50/70 dark:bg-red-500/[0.06]")} data-testid="do-page-row" data-pinned={r.pinned ? "1" : "0"}>
                  <td className="max-w-[260px] px-2 py-2.5">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold underline-offset-2 hover:underline" title={r.url} data-testid="do-page-link">{r.heading}</a>
                    {r.title ? <span className="block truncate text-[11px] text-indigo-600 dark:text-indigo-400">{r.path ?? r.address}</span> : null}
                  </td>
                  <td className="px-2 py-2.5"><StatusBadge row={r} className={r.pinned || r.statusGroup !== "ok" ? BAD_CHIP : OK_CHIP} /></td>
                  <td className="px-2 py-2.5 text-right tabular-nums" title={formatExact(r.traffic)}>{r.pinned ? MISSING : formatCompact(r.traffic)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums" title={formatExact(r.referringDomains)}>{formatCompact(r.referringDomains)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topPages.pinnedLoading ? <Skel className="mt-2 h-9 w-full" /> : null}
        {pinnedNote
          ? <Note tone="bad" className="mt-3" testId="do-pinned-note">{pinnedNote}</Note>
          : <Note className="mt-3">{SCOPE_NOTE}</Note>}
      </SectionBoundary>
    </OverviewCard>
  )
}

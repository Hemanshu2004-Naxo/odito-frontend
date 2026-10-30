"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { StatusBadge } from "../top-pages/cells"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact } from "./format"
import { TOP_PAGES } from "./hubLinks"

export const TRAFFIC_NOTE = "Estimated monthly visits from Google, from the page's top 1,000 keywords by traffic."
export const SCOPE_NOTE = "Ranked among the 50 best-linked live pages."

const TableSkeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
  </div>
)

/**
 * "Top pages" (API 10, with its server-side traffic join): the four live pages that bring the most estimated traffic, plus — pinned at the
 * bottom with a red status badge — the error page that wastes the most backlinks. The data is the Top Pages page's own (same requests, same
 * caches), so opening that page afterwards costs nothing.
 *
 * @param {{ topPages: any }} props  useDomainHub().topPages
 */
export default function TopPagesCard({ topPages }) {
  const { rows, trafficKnown, status } = topPages
  const state = { status, error: topPages.error, refetch: topPages.refetch }
  return (
    <Panel title="Top pages" description={trafficKnown || status !== "success" ? "The pages that bring the most estimated traffic" : "Your best-linked pages (traffic is unavailable)"} className="min-w-0">
      <SectionBoundary state={state} skeleton={<TableSkeleton />} empty={rows.length === 0} emptyMessage="No pages with backlinks found for this domain yet.">
        <Table data-testid="do-top-pages">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-0">Page</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><span className="inline-flex items-center gap-1">Est. traffic <InfoHint label="Est. traffic" text={TRAFFIC_NOTE} /></span></TableHead>
              <TableHead className="pr-0 text-right">Ref. domains</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={cn(r.pinned && "border-t-2 border-t-red-200 bg-red-50/40 dark:border-t-red-500/30 dark:bg-red-500/5")} data-testid="do-page-row" data-pinned={r.pinned ? "1" : "0"}>
                <TableCell className="max-w-[240px] pl-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium underline-offset-2 hover:underline" title={r.url} data-testid="do-page-link">{r.heading}</a>
                  {r.title ? <span className="block truncate text-xs text-muted-foreground">{r.address}</span> : null}
                </TableCell>
                <TableCell><StatusBadge row={r} className={r.pinned ? "border-red-300 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300" : undefined} /></TableCell>
                <TableCell className="text-right tabular-nums" title={formatExact(r.traffic)}>{r.pinned ? MISSING : formatCompact(r.traffic)}</TableCell>
                <TableCell className="pr-0 text-right tabular-nums" title={formatExact(r.referringDomains)}>{formatCompact(r.referringDomains)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {topPages.pinnedLoading ? <Skel className="mt-2 h-9 w-full" /> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">{SCOPE_NOTE}{topPages.hasPinned ? " The last row is the error page with the most backlinks." : ""}</p>
        <div className="mt-3 border-t border-border/60 pt-3">
          <Link href={TOP_PAGES} className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2" data-testid="do-view-all-pages">
            View all pages <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

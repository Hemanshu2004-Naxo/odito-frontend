"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Star } from "lucide-react"
import { Panel } from "@/components/dashboard/shared/parts"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionBoundary, Skel } from "./SectionState"
import { MISSING, faviconUrl, formatCompact, formatDecimal1, formatExact } from "./format"
import { headToHeadShare } from "./hubData"

export const COMPETITORS_HREF = "/app/competitors"
export const NOT_IN_LIST_HINT = "Not found among competitors for shared keywords."
export const HEAD_TO_HEAD_HINT = "Estimated organic traffic of each site on the keywords you BOTH rank for (not the whole sites)."

/** The site's favicon, decorative. If it cannot be loaded the first letter takes its place. */
export function Favicon({ domain }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold uppercase" aria-hidden>{domain.charAt(0)}</span>
  }
  // eslint-disable-next-line @next/next/no-img-element -- a 16px third-party icon: next/image would add a proxy hop for nothing
  return <img src={faviconUrl(domain)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="size-4 shrink-0 rounded-sm" onError={() => setFailed(true)} />
}

const TableSkeleton = () => (
  <div className="space-y-2.5" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
  </div>
)

/** "You 12 · Them 340" with a small split bar: green when we lead, red when they lead, neutral on a tie. */
export function HeadToHead({ ours, theirs }) {
  const share = headToHeadShare(ours, theirs)
  if (share === null && !(Number.isFinite(ours) && Number.isFinite(theirs))) return <span className="text-muted-foreground">{MISSING}</span>
  const lead = ours > theirs ? "us" : ours < theirs ? "them" : "tie"
  return (
    <div className="ml-auto flex w-[140px] flex-col items-end gap-1" data-testid="do-h2h" data-lead={lead}>
      <span className="text-xs tabular-nums whitespace-nowrap" title={`You ${formatExact(ours)} · Them ${formatExact(theirs)} (est. monthly visits on shared keywords)`}>
        You <span className="font-semibold">{formatCompact(ours)}</span> · Them <span className="font-semibold">{formatCompact(theirs)}</span>
      </span>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={lead === "us" ? "You lead" : lead === "them" ? "They lead" : "Level"}>
        {share !== null ? (
          <div className={cn("h-full", lead === "us" ? "bg-emerald-500" : lead === "them" ? "bg-red-500" : "bg-slate-400")} style={{ width: `${Math.min(100, Math.max(2, share))}%` }} data-testid="do-h2h-bar" />
        ) : null}
      </div>
    </div>
  )
}

/**
 * "Top competitors" (API 4 + the project's tracked list): the competitors you pinned come FIRST (starred), then the sites that rank for the
 * same keywords, up to five rows. The list is the Competitors page's default view, so it already leaves out the sites the project excluded
 * and the world's biggest sites. "Exclude" uses the Competitors page's own handler, and the card refreshes through the new exclude list.
 */
export default function CompetitorsCard({ state, hub, settings }) {
  const [message, setMessage] = useState(null)
  const rows = hub?.rows ?? []
  const pending = settings?.pending ?? new Set()

  const exclude = async (domain) => {
    setMessage(null)
    const res = await settings.exclude([domain])
    if (!res.ok) setMessage(res.message)
  }

  return (
    <Panel title="Top competitors" description="Pinned competitors first, then sites that rank for the same keywords as you" className="min-w-0">
      <SectionBoundary state={state} skeleton={<TableSkeleton />} empty={rows.length === 0} emptyMessage="No competing domains found yet.">
        {message ? <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" data-testid="do-competitors-message">{message}</p> : null}
        <Table data-testid="do-competitors">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-0">Domain</TableHead>
              <TableHead className="text-right">Shared keywords</TableHead>
              <TableHead className="text-right"><span className="inline-flex items-center gap-1">Head-to-head <InfoHint label="Head-to-head" text={HEAD_TO_HEAD_HINT} /></span></TableHead>
              <TableHead className="text-right">Avg position</TableHead>
              <TableHead className="w-0 pr-0"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.domain} title={c.notInList ? NOT_IN_LIST_HINT : undefined} data-testid="do-competitor-row" data-tracked={c.tracked ? "1" : "0"} data-in-list={c.notInList ? "0" : "1"}>
                <TableCell className="max-w-[220px] pl-0 font-medium">
                  <span className="flex items-center gap-2">
                    <Favicon domain={c.domain} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1">
                        <span className="truncate" title={c.domain}>{c.domain}</span>
                        {c.tracked ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Pinned competitor" data-testid="do-tracked-star" /> : null}
                      </span>
                      {c.notInList && c.organicTraffic !== null ? (
                        <span className="block text-[11px] font-normal text-muted-foreground" data-testid="do-compare-traffic" title={formatExact(c.organicTraffic)}>Organic traffic {formatCompact(c.organicTraffic)}</span>
                      ) : null}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums" title={formatExact(c.sharedKeywords)}>{formatCompact(c.sharedKeywords)}</TableCell>
                <TableCell className="text-right">{c.notInList ? <span className="text-muted-foreground">{MISSING}</span> : <HeadToHead ours={c.ourSharedTraffic} theirs={c.theirSharedTraffic} />}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDecimal1(c.avgPosition)}</TableCell>
                <TableCell className="pr-0 text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => exclude(c.domain)} disabled={pending.has(c.domain)} aria-label={`Exclude ${c.domain}`} data-testid="do-exclude">
                    {pending.has(c.domain) ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Exclude
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-3 border-t border-border/60 pt-3">
          <Link href={COMPETITORS_HREF} className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2">
            View all competitors <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </SectionBoundary>
    </Panel>
  )
}

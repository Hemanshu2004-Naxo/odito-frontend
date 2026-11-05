"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"
import OverviewCard, { FooterLink } from "./OverviewCard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useProject } from "@/contexts/ProjectContext"
import { useMyCompetitors } from "@/hooks/useMyCompetitors"
import { useOwnSeoMetrics } from "@/hooks/useOwnSeoMetrics"
import CompareTable from "../competitors/CompareTable"
import { COMPARE_METRICS, compareToYou, sortByLead } from "../competitors/compareToYou"
import InfoHint from "../referring-domains/InfoHint"
import { Skel } from "./SectionState"
import { Favicon } from "./Favicon"
export { Favicon }
import { MISSING, domainFromUrl, formatCompact, formatDecimal1, formatExact } from "./format"
import { headToHeadShare } from "./hubData"

export const COMPETITORS_HREF = "/app/competitors"
export const NOT_IN_LIST_HINT = "Not found among competitors for shared keywords."
export const HEAD_TO_HEAD_HINT = "Estimated organic traffic of each site on the keywords you BOTH rank for (not the whole sites)."

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

/** How many of the user's own competitors the card lists; the rest are one click away on the Competitors page. */
export const CARD_LIMIT = 5

/**
 * "Your competitors": ONLY the competitors the user added, each compared with the user's own website (who is ahead, who is behind, with
 * arrows and the numbers). It replaces the old list of sites that merely rank for the same keywords. Nothing here calls a provider: the
 * competitors' numbers are what was saved for them and your own are the two sections this page already loads (same query keys).
 */
export default function CompetitorsCard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const own = useOwnSeoMetrics(projectId)
  const mc = useMyCompetitors(projectId)

  const ranked = useMemo(() => {
    const withSite = (mc.competitors ?? []).filter((c) => c.domain).map((c) => ({ c, result: compareToYou(own.metrics, c.enrichment?.metrics ?? {}) }))
    return sortByLead(withSite, (r) => r.result)
  }, [mc.competitors, own.metrics])
  const rows = ranked.slice(0, CARD_LIMIT)
  const ahead = ranked.filter((r) => r.result.verdict === "ahead").length
  const behind = ranked.filter((r) => r.result.verdict === "behind").length
  const summary = ranked.length ? `${ahead} ahead of you, ${behind} behind · red ↑ = they beat you on that number` : "Only the competitors you added, compared with you"

  return (
    <OverviewCard title="Your competitors" description={summary} action={<Link href={COMPETITORS_HREF} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted" data-testid="do-competitors-addbtn"><Plus className="size-3.5" aria-hidden />Add competitor</Link>}>
      <div data-testid="do-competitors-card">
      {mc.status === "loading" ? <TableSkeleton /> : mc.status === "error" ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" data-testid="do-competitors-error">
          Your competitors could not be loaded. <button type="button" className="underline underline-offset-2" onClick={() => mc.refetch?.()}>Try again</button>
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center" data-testid="do-competitors-empty">
          <p className="text-sm font-medium">{(mc.competitors ?? []).length ? "None of your competitors has a website to compare yet" : "You have not added any competitors yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Add the businesses you compete with to see who is ahead of you and who is behind.</p>
          <Link href={COMPETITORS_HREF} className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2" data-testid="do-competitors-add">
            Add competitors <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          <div data-testid="do-competitors"><CompareTable rows={rows} own={own} domain={domainFromUrl(activeProject?.main_url)} rowTestId="do-competitor-row" keys={COMPARE_METRICS.map((m) => m.key)} /></div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <FooterLink href={COMPETITORS_HREF}>Compare in detail</FooterLink>
            {ranked.length > rows.length ? <span className="text-xs text-muted-foreground" data-testid="do-competitors-more">Showing {rows.length} of {ranked.length}</span> : null}
          </div>
        </>
      )}
      </div>
    </OverviewCard>
  )
}

"use client"

import Link from "next/link"
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1, formatUsdCompact, formatUsdExact } from "./format"
import { ORGANIC_KEYWORDS, TRAFFIC_HISTORY } from "./hubLinks"

export const BACKLINK_OVERVIEW_HREF = "/app/backlinks/overview"
export const TRAFFIC_HINT = "Estimated from rankings × CTR"
export const TRAFFIC_VALUE_HINT = "What it would cost to buy this much organic traffic through paid search (estimated)."
export const DOMAIN_RANK_HINT = "DataForSEO's domain rank for this site on a 0–1000 scale."

/** Month-over-month change under a figure. green = up, red = down; unknown is a quiet "—", never 0%. */
function Delta({ change, state }) {
  if (!state || state.status === "loading") return <Skel className="mt-1.5 h-4 w-24" />
  if (state.status === "error") return <p className="mt-1.5 text-xs text-muted-foreground" title={state.error?.message}>Trend unavailable</p>
  if (!change || change.percent === null) return <p className="mt-1.5 text-xs text-muted-foreground">{MISSING}</p>
  const up = change.direction === "up"
  const down = change.direction === "down"
  const Icon = up ? TrendingUp : down ? TrendingDown : null
  return (
    <p
      className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium tabular-nums", up && "text-emerald-600 dark:text-emerald-400", down && "text-red-600 dark:text-red-400", !up && !down && "text-muted-foreground")}
      title={change.basis || undefined}
      data-testid="do-delta"
      data-direction={change.direction}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      <span className="sr-only">{up ? "Up " : down ? "Down " : "No change "}</span>
      {formatPercent1(Math.abs(change.percent))}
      <span className="font-normal text-muted-foreground">{change.basis}</span>
    </p>
  )
}

function CardShell({ label, hint, href, linkLabel = "open the Referring Domains page", children, testId }) {
  const body = (
    <div className={cn("flex h-full min-w-0 flex-col rounded-xl border border-border/60 bg-card p-4", href && "transition-colors group-hover:border-foreground/30")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{label}</span>
          {hint ? <InfoHint label={label} text={hint} /> : null}
        </div>
        {href ? <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
      {children}
    </div>
  )
  if (!href) return <div data-testid={testId}>{body}</div>
  return (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId} aria-label={`${label}: ${linkLabel}`}>
      {body}
    </Link>
  )
}

function Figure({ value, exact, suffix, caption }) {
  return (
    <>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight" title={exact || undefined}>{value}</span>
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
    </>
  )
}

const FigureSkeleton = () => (
  <>
    <Skel className="mt-2 h-8 w-24" />
    <Skel className="mt-2 h-3.5 w-28" />
  </>
)

/** The body of one card, driven by the section its figure comes from. */
function Body({ state, noData, children }) {
  if (!state || state.status === "loading") return <FigureSkeleton />
  if (state.status === "error") return <SectionError className="mt-2 p-3" message={state.error?.message} onRetry={state.refetch} />
  if (noData) return <><Figure value={MISSING} caption="No ranking data yet" /></>
  return children
}

/**
 * Six cards. Traffic / keywords / value come from API 1 (their change from API 2); rank, backlinks and referring domains from API 6.
 * Each card loads and fails on its own section. `vm` is the mapDomainOverview view model.
 */
export default function KpiCards({ vm, sections }) {
  const { kpis } = vm
  const rank = sections.rankOverview
  const backlinks = sections.backlinks
  const noRanking = rank?.status === "success" && !vm.hasRankingData

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" data-testid="do-kpis">
        <CardShell label="Organic Traffic" hint={TRAFFIC_HINT} href={TRAFFIC_HISTORY} linkLabel="open Traffic History" testId="do-kpi-traffic">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatCompact(kpis.traffic)} exact={formatExact(kpis.traffic)} caption="Est. monthly traffic" />
            <Delta change={kpis.trafficChange} state={sections.history} />
          </Body>
        </CardShell>

        <CardShell label="Organic Keywords" href={ORGANIC_KEYWORDS} linkLabel="open Organic Keywords" testId="do-kpi-keywords">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatCompact(kpis.keywords)} exact={formatExact(kpis.keywords)} caption="Ranking keywords" />
            <Delta change={kpis.keywordsChange} state={sections.history} />
          </Body>
        </CardShell>

        <CardShell label="Traffic Value" hint={TRAFFIC_VALUE_HINT} href={TRAFFIC_HISTORY} linkLabel="open Traffic History" testId="do-kpi-value">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatUsdCompact(kpis.trafficValue)} exact={formatUsdExact(kpis.trafficValue)} caption="Est. monthly value" />
          </Body>
        </CardShell>

        <CardShell label="Domain Rank" hint={DOMAIN_RANK_HINT} href={BACKLINK_OVERVIEW_HREF} linkLabel="open the Backlink Overview" testId="do-kpi-rank">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.domainRank)} exact={formatExact(kpis.domainRank)} suffix={kpis.domainRank === null ? null : "/ 1000"} />
          </Body>
        </CardShell>

        <CardShell label="Backlinks" href={BACKLINK_OVERVIEW_HREF} linkLabel="open the Backlink Overview" testId="do-kpi-backlinks">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.backlinks)} exact={formatExact(kpis.backlinks)} caption="Total backlinks" />
          </Body>
        </CardShell>

        <CardShell label="Referring Domains" href="/app/referring-domains" testId="do-kpi-refdomains">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.referringDomains)} exact={formatExact(kpis.referringDomains)} caption="Sites linking to you" />
          </Body>
        </CardShell>
      </div>

      {vm.paid ? (
        <p className="text-xs text-muted-foreground" data-testid="do-paid">
          Paid search: <span className="tabular-nums" title={formatExact(vm.paid.traffic)}>{formatCompact(Math.round(vm.paid.traffic))}</span> est. monthly traffic
          {" · "}
          <span className="tabular-nums" title={formatExact(vm.paid.keywords)}>{formatCompact(vm.paid.keywords)}</span> paid keywords
        </p>
      ) : null}
    </div>
  )
}

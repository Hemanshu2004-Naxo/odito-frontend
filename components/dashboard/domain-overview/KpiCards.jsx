"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import InfoHint from "../referring-domains/InfoHint"
import { SectionError, Skel } from "./SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1, formatUsdCompact, formatUsdExact } from "./format"
import { ORGANIC_KEYWORDS, TRAFFIC_HISTORY } from "./hubLinks"

export const BACKLINK_OVERVIEW_HREF = "/app/backlinks/overview"
export const TRAFFIC_HINT = "Estimated from rankings × CTR"
export const TRAFFIC_VALUE_HINT = "What it would cost to buy this much organic traffic through paid search (estimated)."
export const DOMAIN_RANK_HINT = "DataForSEO's domain rank for this site on a 0–1000 scale."

/** Month-over-month change under a figure: "↓ 55.8% vs Sep 26". green = up, red = down; unknown is a quiet "—", never 0%. */
function Delta({ change, state }) {
  if (!state || state.status === "loading") return <Skel className="mt-1 h-4 w-24" />
  if (state.status === "error") return <p className="mt-1 text-xs text-muted-foreground" title={state.error?.message}>Trend unavailable</p>
  if (!change || change.percent === null) return <p className="mt-1 text-xs text-muted-foreground">{MISSING}</p>
  const up = change.direction === "up"
  const down = change.direction === "down"
  return (
    <p
      className={cn("mt-1 flex items-center gap-1 text-xs font-medium tabular-nums", up && "text-emerald-600 dark:text-emerald-400", down && "text-red-600 dark:text-red-400", !up && !down && "text-muted-foreground")}
      title={change.basis || undefined}
      data-testid="do-delta"
      data-direction={change.direction}
    >
      <span aria-hidden>{up ? "↑" : down ? "↓" : "→"}</span>
      <span className="sr-only">{up ? "Up " : down ? "Down " : "No change "}</span>
      {formatPercent1(Math.abs(change.percent))} {change.basis}
    </p>
  )
}

function CardShell({ label, hint, href, linkLabel = "open the Referring Domains page", children, testId }) {
  const body = (
    <div className={cn("flex h-full min-w-0 flex-col rounded-xl border border-border/60 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", href && "transition-colors group-hover:border-foreground/30")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground/80">
          <span>{label}</span>
          {hint ? <InfoHint label={label} text={hint} /> : null}
        </div>
        {href ? <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
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

function Figure({ value, exact, suffix }) {
  return (
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums" title={exact || undefined} data-testid="do-kpi-figure">{value}</span>
      {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
    </div>
  )
}

const Caption = ({ children }) => <p className="mt-auto pt-2 text-[11px] leading-snug text-muted-foreground">{children}</p>
const Sub = ({ children, tone, testId }) => (
  <p className={cn("mt-1 text-xs tabular-nums", tone === "bad" ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")} data-testid={testId}>{children}</p>
)

const FigureSkeleton = () => (
  <>
    <Skel className="mt-2 h-7 w-20" />
    <Skel className="mt-2 h-3.5 w-28" />
  </>
)

/** The body of one card, driven by the section its figure comes from. */
function Body({ state, noData, children }) {
  if (!state || state.status === "loading") return <FigureSkeleton />
  if (state.status === "error") return <SectionError className="mt-2 p-3" message={state.error?.message} onRetry={state.refetch} />
  if (noData) return <><Figure value={MISSING} /><Caption>No ranking data yet</Caption></>
  return children
}

/** "+17 new · −14 lost" (linking sites, last 30 days). A dash until it is known. */
function NewLost({ last30 }) {
  const d = last30?.data
  if (!last30) return null
  if (last30.status === "loading") return <Skel className="mt-1 h-4 w-24" />
  if (last30.status !== "success" || !d || (d.new === null && d.lost === null)) return <Sub>{MISSING}</Sub>
  return (
    <Sub testId="do-kpi-rd-last30">
      <span className="text-emerald-600 dark:text-emerald-400">+{formatCompact(d.new)} new</span>
      <span aria-hidden> · </span>
      <span className="text-red-600 dark:text-red-400">−{formatCompact(d.lost)} lost</span>
    </Sub>
  )
}

/**
 * Six cards. Traffic / keywords / value come from API 1 (their change from API 2); rank, backlinks and linking sites from API 6, with the
 * broken share from the same backlinks summary and the 30-day new / lost linking sites from the hub. Each card loads and fails on its own
 * section. `vm` is the mapDomainOverview view model; `summary` is mapBacklinkSummary() of the backlinks section.
 */
export default function KpiCards({ vm, sections, summary, last30 }) {
  const { kpis } = vm
  const rank = sections.rankOverview
  const backlinks = sections.backlinks
  const noRanking = rank?.status === "success" && !vm.hasRankingData
  const broken = summary?.totals?.brokenBacklinks ?? null
  const brokenPct = summary?.derived?.brokenBacklinksPercent ?? null

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" data-testid="do-kpis">
        <CardShell label="Organic traffic" hint={TRAFFIC_HINT} href={TRAFFIC_HISTORY} linkLabel="open Traffic History" testId="do-kpi-traffic">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatCompact(kpis.traffic)} exact={formatExact(kpis.traffic)} suffix="/mo" />
            <Delta change={kpis.trafficChange} state={sections.history} />
            <Caption>Est. monthly visits from Google</Caption>
          </Body>
        </CardShell>

        <CardShell label="Organic keywords" href={ORGANIC_KEYWORDS} linkLabel="open Organic Keywords" testId="do-kpi-keywords">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatCompact(kpis.keywords)} exact={formatExact(kpis.keywords)} />
            <Delta change={kpis.keywordsChange} state={sections.history} />
            <Caption>Keywords in Google top 100</Caption>
          </Body>
        </CardShell>

        <CardShell label="Traffic value" hint={TRAFFIC_VALUE_HINT} href={TRAFFIC_HISTORY} linkLabel="open Traffic History" testId="do-kpi-value">
          <Body state={rank} noData={noRanking}>
            <Figure value={formatUsdCompact(kpis.trafficValue)} exact={formatUsdExact(kpis.trafficValue)} suffix="/mo" />
            <Sub>What this traffic would cost as ads</Sub>
            <Caption>Est. monthly value</Caption>
          </Body>
        </CardShell>

        <CardShell label="Domain rank" hint={DOMAIN_RANK_HINT} href={BACKLINK_OVERVIEW_HREF} linkLabel="open the Backlink Overview" testId="do-kpi-rank">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.domainRank)} exact={formatExact(kpis.domainRank)} suffix={kpis.domainRank === null ? null : "/1000"} />
            <Sub>Strength of your links</Sub>
            <Caption>Higher is better</Caption>
          </Body>
        </CardShell>

        <CardShell label="Backlinks" href={BACKLINK_OVERVIEW_HREF} linkLabel="open the Backlink Overview" testId="do-kpi-backlinks">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.backlinks)} exact={formatExact(kpis.backlinks)} />
            {broken === null ? <Sub>{MISSING}</Sub> : (
              <Sub tone={broken > 0 ? "bad" : null} testId="do-kpi-broken">
                {formatCompact(broken)} broken{brokenPct === null ? "" : ` (${formatPercent1(brokenPct)})`}
              </Sub>
            )}
            <Caption>Total links to your site</Caption>
          </Body>
        </CardShell>

        <CardShell label="Linking sites" href="/app/referring-domains" testId="do-kpi-refdomains">
          <Body state={backlinks}>
            <Figure value={formatCompact(kpis.referringDomains)} exact={formatExact(kpis.referringDomains)} />
            <NewLost last30={last30} />
            <Caption>Different sites linking to you</Caption>
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

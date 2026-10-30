"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import InfoHint from "../referring-domains/InfoHint"
import { LINKS } from "./constants"

const dec1 = (v) => (typeof v === "number" ? v.toFixed(1) : MISSING)

/** The eight KPI cards, as data: label, figure, the line under it, where it links to. Calculated values come from the mapping. */
export function kpiCards(s) {
  const t = s.totals
  const d = s.derived
  const broken = (t.brokenBacklinks ?? 0) > 0
  const brokenPages = (t.brokenPages ?? 0) > 0
  return [
    { id: "backlinks", label: "Backlinks", value: t.backlinks, caption: d.backlinksPerDomain === null ? MISSING : `${dec1(d.backlinksPerDomain)} per domain` },
    { id: "domains", label: "Referring Domains", value: t.referringDomains, caption: t.referringMainDomains === null ? MISSING : `${formatCompact(t.referringMainDomains)} main domains`, href: LINKS.referringDomains, linkLabel: "open the Referring Domains page" },
    { id: "pages", label: "Referring Pages", value: t.referringPages },
    { id: "ips", label: "Referring IPs", value: t.referringIps },
    { id: "subnets", label: "Referring Subnets", value: t.referringSubnets, caption: d.subnetDiversity === null ? MISSING : `${formatPercent1(d.subnetDiversity)} diversity`, hint: "Subnets ÷ referring domains. Low diversity means many links come from the same networks." },
    { id: "dofollow", label: "Dofollow Domains", value: d.dofollowDomains, caption: d.dofollowDomainsPercent === null ? MISSING : `${formatPercent1(d.dofollowDomainsPercent)} of domains` },
    { id: "broken", label: "Broken Backlinks", value: t.brokenBacklinks, caption: d.brokenBacklinksPercent === null ? MISSING : `${formatPercent1(d.brokenBacklinksPercent)} of links`, tone: broken ? "bad" : null, href: LINKS.brokenBacklinks, linkLabel: "see the broken backlinks" },
    { id: "broken-pages", label: "Broken Pages", value: t.brokenPages, caption: "Pages with links that return errors", hint: "Pages on your site that return errors but still have links pointing at them.", tone: brokenPages ? "bad" : null, href: LINKS.brokenPages, linkLabel: "see the pages with errors" },
  ]
}

function Card({ card }) {
  const body = (
    <div className={cn("flex h-full min-w-0 flex-col rounded-xl border border-border/60 bg-card p-4", card.href && "transition-colors group-hover:border-foreground/30")}>
      {/* Two lines are reserved for the label so the figures line up across cards, and a long label wraps instead of being cut off. */}
      <div className="flex min-h-9 items-start justify-between gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm leading-tight text-muted-foreground"><span>{card.label}</span>{card.hint ? <InfoHint label={card.label} text={card.hint} /> : null}</span>
        {card.href ? <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </div>
      <div
        className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular-nums", card.tone === "bad" && "text-red-600 dark:text-red-400")}
        title={formatExact(card.value)}
        data-testid={`bo-kpi-${card.id}-value`}
      >
        {formatCompact(card.value)}
      </div>
      {card.caption ? <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`bo-kpi-${card.id}-caption`}>{card.caption}</p> : null}
    </div>
  )
  if (!card.href) return <div data-testid={`bo-kpi-${card.id}`}>{body}</div>
  return (
    <Link href={card.href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`bo-kpi-${card.id}`} aria-label={`${card.label}: ${card.linkLabel}`}>
      {body}
    </Link>
  )
}

const Grid = ({ children }) => (
  <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-4 @min-[1100px]/main:grid-cols-8" data-testid="bo-kpis">{children}</div>
)

/** Eight cards: 8 columns wide, 4 at medium width, 2 on a phone. */
export default function KpiGrid({ state, summary }) {
  if (!state || state.status === "loading") {
    return <Grid>{Array.from({ length: 8 }, (_, i) => <Skel key={i} className="h-[108px] rounded-xl" />)}</Grid>
  }
  if (state.status === "error") return <SectionError message={state.error?.message} onRetry={state.refetch} />
  return <Grid>{kpiCards(summary).map((c) => <Card key={c.id} card={c} />)}</Grid>
}

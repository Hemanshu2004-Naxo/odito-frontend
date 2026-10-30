"use client"

import { ANCHOR_TYPES } from "@/lib/anchors/anchorConfig"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"
import { TypeChip } from "./cells"

function Card({ label, value, sub, hint, testId, children }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card p-4" data-testid={testId}>
      <p className="truncate text-xs font-medium text-muted-foreground" title={hint}>{label}</p>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums" title={hint}>{value}</div>
      {sub ? <p className="mt-1 truncate text-xs text-muted-foreground" title={typeof sub === "string" ? sub : undefined}>{sub}</p> : null}
      {children}
    </div>
  )
}

const share = (summary, key) => summary?.types?.[key]?.percentByReferringDomains ?? null
const pct = (v) => (v === null ? MISSING : formatPercent1(v))

/**
 * Six cards, from the anchor profile (the top 1,000 anchors): how many anchors there are, the share of each important type (of referring
 * domains), and the anchor with the most referring domains. They change the moment the brand terms or target keywords change.
 * 2 columns on a phone, 3 on a tablet, 6 on a wide screen.
 */
export default function SummaryCards({ profile }) {
  const { status, summary, total } = profile
  if (status === "error") return <SectionError message={profile.error?.message} onRetry={profile.refetch} />
  if (status === "loading" || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" aria-hidden data-testid="an-cards-skeleton">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-xl border border-border/60 bg-card p-4"><Skel className="h-3 w-20" /><Skel className="mt-3 h-7 w-16" /><Skel className="mt-2 h-3 w-24" /></div>)}
      </div>
    )
  }
  const top = summary.topAnchor
  const hint = "Share of referring domains"
  return (
    <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" data-testid="an-cards">
      <Card label="Total anchors" value={total === null ? MISSING : formatCompact(total)} sub="Different link texts" hint={total === null ? undefined : `${formatExact(total)} different anchor texts`} testId="an-card-total" />
      <Card label="Branded" value={pct(share(summary, "branded"))} sub={hint} hint={ANCHOR_TYPES.branded.description} testId="an-card-branded" />
      <Card label="Exact match" value={pct(share(summary, "exact"))} sub={hint} hint={ANCHOR_TYPES.exact.description} testId="an-card-exact" />
      <Card label="Naked URL" value={pct(share(summary, "naked_url"))} sub={hint} hint={ANCHOR_TYPES.naked_url.description} testId="an-card-naked" />
      <Card label="Empty / image" value={pct(share(summary, "empty"))} sub={hint} hint={ANCHOR_TYPES.empty.description} testId="an-card-empty" />
      <Card
        label="Top anchor"
        value={top ? pct(top.percent) : MISSING}
        sub={top ? <span className="block truncate" data-testid="an-top-anchor">{top.anchor === null ? top.label : `“${top.anchor}”`}</span> : "No anchors yet"}
        hint={top ? `${top.label} — ${formatExact(top.referringDomains)} referring domains, ${pct(top.percent)} of all referring domains` : undefined}
        testId="an-card-top"
      >
        {top ? <div className="mt-1.5"><TypeChip type={top.type} /></div> : null}
      </Card>
    </div>
  )
}

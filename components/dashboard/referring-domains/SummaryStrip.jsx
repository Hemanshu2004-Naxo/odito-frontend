"use client"

import Link from "next/link"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"

function Card({ label, value, sub, title, testId }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card p-4" data-testid={testId}>
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums" title={title}>{value}</div>
      {sub ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

const compact = (v) => (v === null || v === undefined ? MISSING : formatCompact(v))
const exact = (v) => (v === null || v === undefined ? undefined : formatExact(v))

/**
 * Six figures about the whole profile, from the Backlink Overview's own cached answer (the same query: no new request). 2 columns on a phone,
 * 3 on a tablet, 6 on a wide screen. These describe the whole profile, not the table's tab or filters.
 */
export default function SummaryStrip({ summary }) {
  if (summary.status === "error") return <SectionError message={summary.error?.message} onRetry={summary.refetch} />
  if (summary.status === "loading" || !summary.data) {
    return (
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" aria-hidden data-testid="rd-summary-skeleton">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-xl border border-border/60 bg-card p-4"><Skel className="h-3 w-20" /><Skel className="mt-3 h-7 w-16" /></div>)}
      </div>
    )
  }
  const { totals: t, derived: d } = summary.data
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" data-testid="rd-summary">
        <Card label="Referring domains" value={compact(t.referringDomains)} title={exact(t.referringDomains)} sub="Sites linking to you" testId="rd-sum-domains" />
        <Card label="Referring main domains" value={compact(t.referringMainDomains)} title={exact(t.referringMainDomains)} sub="Without subdomains" testId="rd-sum-main" />
        <Card label="Dofollow domains" value={d.dofollowDomainsPercent === null ? MISSING : formatPercent1(d.dofollowDomainsPercent)} sub="Of referring domains" testId="rd-sum-dofollow" />
        <Card label="Referring IPs" value={compact(t.referringIps)} title={exact(t.referringIps)} sub="Different servers" testId="rd-sum-ips" />
        <Card label="Referring subnets" value={compact(t.referringSubnets)} title={exact(t.referringSubnets)} sub="Different networks" testId="rd-sum-subnets" />
        <Card label="Broken backlinks" value={compact(t.brokenBacklinks)} title={exact(t.brokenBacklinks)} sub="Links to error pages" testId="rd-sum-broken" />
      </div>
      <p className="text-xs text-muted-foreground">
        The whole profile, from the <Link href="/app/backlinks/overview" className="underline underline-offset-2">Backlink Overview</Link>.
      </p>
    </div>
  )
}

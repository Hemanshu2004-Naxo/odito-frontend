"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"

/** A tile with a coloured left edge (the Off-page pages' style). */
function Card({ label, value, sub, title, testId, edge, tone }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card py-4 pl-5 pr-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" data-testid={testId}>
      <span className={cn("absolute inset-y-0 left-0 w-1", edge)} aria-hidden />
      <p className="truncate text-[13px] font-medium text-foreground/80">{label}</p>
      <div className={cn("mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums", tone === "bad" && "text-red-700 dark:text-red-400")} title={title}>{value}</div>
      {sub ? <p className="mt-2 truncate text-xs text-muted-foreground">{sub}</p> : null}
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
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-2xl border border-border/60 bg-card p-4"><Skel className="h-3 w-20" /><Skel className="mt-3 h-7 w-16" /></div>)}
      </div>
    )
  }
  const { totals: t, derived: d } = summary.data
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 @min-[640px]/main:grid-cols-3 @min-[1100px]/main:grid-cols-6" data-testid="rd-summary">
        <Card label="Referring domains" value={compact(t.referringDomains)} title={exact(t.referringDomains)} sub="Sites linking to you" edge="bg-[#0d1a3a] dark:bg-indigo-400" testId="rd-sum-domains" />
        <Card label="Referring main domains" value={compact(t.referringMainDomains)} title={exact(t.referringMainDomains)} sub="Without subdomains" edge="bg-indigo-500" testId="rd-sum-main" />
        <Card label="Dofollow domains" value={d.dofollowDomainsPercent === null ? MISSING : formatPercent1(d.dofollowDomainsPercent)} sub="Of referring domains" edge="bg-emerald-600" testId="rd-sum-dofollow" />
        <Card label="Referring IPs" value={compact(t.referringIps)} title={exact(t.referringIps)} sub="Different servers" edge="bg-sky-500" testId="rd-sum-ips" />
        <Card label="Referring subnets" value={compact(t.referringSubnets)} title={exact(t.referringSubnets)} sub="Different networks" edge="bg-teal-500" testId="rd-sum-subnets" />
        <Card label="Broken backlinks" value={compact(t.brokenBacklinks)} title={exact(t.brokenBacklinks)} sub="Links to error pages" edge="bg-red-500" tone={(t.brokenBacklinks ?? 0) > 0 ? "bad" : null} testId="rd-sum-broken" />
      </div>
      <p className="text-xs text-muted-foreground">
        The whole profile, from the <Link href="/app/backlinks/overview" className="underline underline-offset-2">Backlink Overview</Link>.
      </p>
    </div>
  )
}

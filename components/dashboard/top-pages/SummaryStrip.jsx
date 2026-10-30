"use client"

import { Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { cn } from "@/lib/utils"
import { PROFILE_SCOPE_LABEL } from "./constants"

function Card({ label, value, exact, sub, tone, onClick, ariaLabel, testId }) {
  const body = (
    <>
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tone === "bad" && "text-red-600 dark:text-red-400", tone === "warn" && "text-amber-600 dark:text-amber-400")} title={exact}>{value}</div>
      {sub ? <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </>
  )
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="min-w-0 rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId}>
      {body}
    </button>
  )
}

const show = (v) => (typeof v === "number" ? formatCompact(v) : MISSING)
const exact = (v) => (typeof v === "number" ? formatExact(v) : undefined)

/**
 * Four figures about the whole profile, labelled "Whole profile (live links)": pages with backlinks, error pages with links, redirected pages with
 * links (three count-only requests, cached 7 days) and broken backlinks (the Backlink Overview's own answer: no new request). Nothing the user
 * filters changes them. A click opens the matching tab. 2 columns on a phone, 4 on a wide screen.
 */
export default function SummaryStrip({ counts, summary, onOpenTab }) {
  const c = counts.data
  const broken = summary.data?.totals.brokenBacklinks ?? null
  if ((counts.status === "loading" || summary.status === "loading") && !c) {
    return (
      <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-4" aria-hidden data-testid="tp-summary-skeleton">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="rounded-xl border border-border/60 bg-card p-4"><Skel className="h-3 w-24" /><Skel className="mt-3 h-7 w-16" /></div>)}
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {counts.status === "error" ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {counts.error?.message}
          <button type="button" onClick={counts.refetch} className="font-medium underline underline-offset-2">Retry</button>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-4" data-testid="tp-summary">
        <Card label="Pages with backlinks" value={show(c?.pages)} exact={exact(c?.pages)} sub="Live links" onClick={() => onOpenTab("all")} ariaLabel={`Pages with backlinks: ${exact(c?.pages) ?? "unknown"}. Show them all.`} testId="tp-sum-pages" />
        <Card label="Error pages with links" value={show(c?.errors)} exact={exact(c?.errors)} sub="Open the Errors tab" tone={c?.errors > 0 ? "bad" : null} onClick={() => onOpenTab("errors")} ariaLabel={`Error pages with links: ${exact(c?.errors) ?? "unknown"}. Open the Errors tab.`} testId="tp-sum-errors" />
        <Card label="Redirected pages with links" value={show(c?.redirects)} exact={exact(c?.redirects)} sub="Open the Redirects tab" tone={c?.redirects > 0 ? "warn" : null} onClick={() => onOpenTab("redirects")} ariaLabel={`Redirected pages with links: ${exact(c?.redirects) ?? "unknown"}. Open the Redirects tab.`} testId="tp-sum-redirects" />
        <Card label="Broken backlinks" value={show(broken)} exact={exact(broken)} sub="Links to error pages" tone={broken > 0 ? "bad" : null} onClick={() => onOpenTab("errors")} ariaLabel={`Broken backlinks: ${exact(broken) ?? "unknown"}. Open the Errors tab.`} testId="tp-sum-broken" />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="tp-summary-scope">{PROFILE_SCOPE_LABEL}</p>
    </div>
  )
}

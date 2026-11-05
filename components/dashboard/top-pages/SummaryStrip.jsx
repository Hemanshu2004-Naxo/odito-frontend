"use client"

import { cn } from "@/lib/utils"
import { Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { PROFILE_SCOPE_LABEL } from "./constants"

const isNum = (v) => typeof v === "number" && Number.isFinite(v)
const show = (v) => (isNum(v) ? formatExact(v) : MISSING)

/** Pages with links that are neither errors nor redirects. Null unless all three counts are known. */
export function workingPages(c) {
  if (!c || !isNum(c.pages) || !isNum(c.errors) || !isNum(c.redirects)) return null
  return Math.max(0, c.pages - c.errors - c.redirects)
}

const PARTS = [
  { key: "errors", label: "Error pages", short: "Errors", sub: "4xx or 5xx · links wasted", bar: "bg-rose-500", dot: "bg-rose-500", tab: "errors" },
  { key: "redirects", label: "Redirected", short: "Redirected", sub: "3xx · links still count", bar: "bg-amber-500", dot: "bg-amber-500", tab: "redirects" },
  { key: "working", label: "Working", short: "Working", sub: "2xx OK", bar: "bg-emerald-600", dot: "bg-emerald-600", tab: "ok" },
]

/**
 * "Do your linked pages load?": of the pages with backlinks, how many return an error, redirect or work (three count-only requests, cached 7 days),
 * and how many backlinks point at broken URLs (the Backlink Overview's own answer: no new request). WHOLE PROFILE: nothing the user filters changes
 * it. The split bar and the three tiles open the matching tab.
 */
export default function SummaryStrip({ counts, summary, onOpenTab }) {
  const c = counts.data
  const broken = summary.data?.totals.brokenBacklinks ?? null
  if ((counts.status === "loading" || summary.status === "loading") && !c) {
    return <div className="rounded-2xl border border-border/60 bg-card p-5" aria-hidden data-testid="tp-summary-skeleton"><Skel className="h-4 w-48" /><Skel className="mt-3 h-12 w-80" /><Skel className="mt-4 h-12 w-full rounded-xl" /></div>
  }
  const values = { errors: c?.errors ?? null, redirects: c?.redirects ?? null, working: workingPages(c) }
  const total = c?.pages ?? null
  const shown = PARTS.filter((p) => isNum(values[p.key]) && values[p.key] > 0)
  const sum = shown.reduce((s, p) => s + values[p.key], 0)

  return (
    <section className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-labelledby="tp-load-title" data-testid="tp-summary">
      {counts.status === "error" ? (
        <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {counts.error?.message}
          <button type="button" onClick={counts.refetch} className="font-medium underline underline-offset-2">Retry</button>
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="tp-load-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Do your linked pages load?</h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-[40px] font-semibold leading-tight tracking-tight tabular-nums", (values.errors ?? 0) > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")} data-testid="tp-sum-errors-headline">
              {show(values.errors)} of <span data-testid="tp-sum-pages" title={isNum(total) ? `${formatExact(total)} pages with backlinks` : undefined}>{show(total)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              pages with links return an error{isNum(broken) ? <>, wasting <button type="button" onClick={() => onOpenTab("errors")} className="font-semibold text-rose-700 hover:underline dark:text-rose-400" data-testid="tp-sum-broken" title={`${formatExact(broken)} broken backlinks`}>{formatCompact(broken)} backlinks</button></> : null}
            </span>
          </p>
        </div>
        {(values.errors ?? 0) > 0 ? (
          <button type="button" onClick={() => onOpenTab("errors")} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="tp-sum-show-errors">Show error pages</button>
        ) : null}
      </div>

      {sum > 0 ? (
        <div className="mt-4 flex h-12 w-full gap-0.5 overflow-hidden rounded-xl" role="img" aria-label={shown.map((p) => `${formatExact(values[p.key])} ${p.short.toLowerCase()}`).join(", ")} data-testid="tp-sum-bar">
          {shown.map((p) => (
            <button key={p.key} type="button" onClick={() => onOpenTab(p.tab)} className={cn("flex h-full min-w-[6px] items-center overflow-hidden whitespace-nowrap px-3 text-sm font-semibold text-white", p.bar)} style={{ width: `${(values[p.key] / sum) * 100}%` }} aria-label={`Open the ${p.label} tab`}>
              {values[p.key] / sum >= 0.1 ? `${formatExact(values[p.key])} ${p.short}` : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 @min-[760px]/main:grid-cols-3">
        {PARTS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onOpenTab(p.tab)}
            className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${p.label}: ${isNum(values[p.key]) ? formatExact(values[p.key]) : "unknown"}. Open the ${p.label} tab.`}
            data-testid={`tp-sum-${p.key}`}
          >
            <span className={cn("size-3 shrink-0 rounded-sm", p.dot)} aria-hidden />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.label}</span><span className="block text-xs text-muted-foreground">{p.sub}</span></span>
            <span className="text-2xl font-semibold tabular-nums">{show(values[p.key])}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" data-testid="tp-summary-scope">{PROFILE_SCOPE_LABEL}</p>
    </section>
  )
}

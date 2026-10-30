"use client"

import { cn } from "@/lib/utils"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"

function Stat({ label, value, exact, caption, pressed, onClick, testId, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-3 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pressed ? "border-foreground" : "border-border/60")}
      data-testid={testId}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("mt-0.5 text-xl font-semibold tabular-nums", tone === "bad" && "text-red-600 dark:text-red-400")} title={exact}>{value}</span>
      {caption ? <span className="mt-0.5 text-[11px] text-muted-foreground">{caption}</span> : null}
    </button>
  )
}

/**
 * The profile at a glance, from the Backlink Overview's own cached response (no call of its own): total backlinks, referring domains,
 * broken backlinks and the dofollow share. Each number is a button that applies the matching tab or filter below.
 * Note the list has one row per linking PAGE, and a page can hold several links, so its total (referring pages) is lower than "Backlinks".
 */
export default function SummaryStrip({ summary, state, update }) {
  if (summary.status === "loading") {
    return <div className="grid grid-cols-2 gap-3 @min-[760px]/main:grid-cols-4" data-testid="bl-summary">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-[76px] rounded-xl" />)}</div>
  }
  if (summary.status === "error") return <SectionError message={summary.error?.message} onRetry={summary.refetch} />
  const s = summary.data
  const t = s.totals
  const d = s.derived
  return (
    <div className="space-y-1.5" data-testid="bl-summary">
      <div className="grid grid-cols-2 gap-3 @min-[760px]/main:grid-cols-4">
        <Stat label="Backlinks" value={formatCompact(t.backlinks)} exact={formatExact(t.backlinks)} caption="Show all" pressed={state.tab === "all" && state.group === "all" && state.follow === "all"} onClick={() => update({ tab: "all", group: "all", follow: "all" })} testId="bl-sum-total" />
        <Stat label="Referring domains" value={formatCompact(t.referringDomains)} exact={formatExact(t.referringDomains)} caption="One link per domain" pressed={state.group === "domain" && state.tab === "all"} onClick={() => update({ tab: "all", group: "domain" })} testId="bl-sum-domains" />
        <Stat label="Broken backlinks" value={formatCompact(t.brokenBacklinks)} exact={formatExact(t.brokenBacklinks)} tone={(t.brokenBacklinks ?? 0) > 0 ? "bad" : null} caption="Open the Broken tab" pressed={state.tab === "broken"} onClick={() => update({ tab: "broken" })} testId="bl-sum-broken" />
        <Stat label="Dofollow" value={d.dofollowDomainsPercent === null ? MISSING : formatPercent1(d.dofollowDomainsPercent)} caption="Only dofollow links" pressed={state.follow === "dofollow" && state.tab === "all"} onClick={() => update({ tab: "all", follow: "dofollow" })} testId="bl-sum-dofollow" />
      </div>
      {t.referringPages !== null ? <p className="text-xs text-muted-foreground" data-testid="bl-summary-note">The list has one row per linking page ({formatExact(t.referringPages)}); a page can hold several links, which is why it is shorter than the total above.</p> : null}
    </div>
  )
}

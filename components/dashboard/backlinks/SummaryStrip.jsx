"use client"

import { cn } from "@/lib/utils"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { MISSING, formatCompact, formatExact, formatPercent1 } from "../domain-overview/format"

/** A tile with a coloured left edge (the Off-page pages' style). It is a button: pressing it applies its tab or filter; pressed = outlined. */
function Stat({ label, value, exact, caption, pressed, onClick, testId, tone, edge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card py-4 pl-5 pr-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed ? "border-2 border-[#0d1a3a] dark:border-indigo-400" : "border-border/60 hover:border-foreground/30",
      )}
      data-testid={testId}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", edge)} aria-hidden />
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground/80">{label}</span>
        {pressed ? <span className="rounded-full bg-[#0d1a3a] px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-indigo-500">Showing</span> : null}
      </span>
      <span className={cn("mt-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums", tone === "bad" && "text-red-700 dark:text-red-400")} title={exact}>{value}</span>
      {caption ? <span className="mt-2 text-xs text-muted-foreground">{caption}</span> : null}
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
    return <div className="grid grid-cols-2 gap-3 @min-[760px]/main:grid-cols-4" data-testid="bl-summary">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-[108px] rounded-2xl" />)}</div>
  }
  if (summary.status === "error") return <SectionError message={summary.error?.message} onRetry={summary.refetch} />
  const s = summary.data
  const t = s.totals
  const d = s.derived
  return (
    <div className="space-y-2" data-testid="bl-summary">
      <div className="grid grid-cols-2 gap-3 @min-[760px]/main:grid-cols-4">
        <Stat label="Backlinks" value={formatCompact(t.backlinks)} exact={formatExact(t.backlinks)} caption="Show all" edge="bg-[#0d1a3a] dark:bg-indigo-400" pressed={state.tab === "all" && state.group === "all" && state.follow === "all"} onClick={() => update({ tab: "all", group: "all", follow: "all" })} testId="bl-sum-total" />
        <Stat label="Linking sites" value={formatCompact(t.referringDomains)} exact={formatExact(t.referringDomains)} caption="One link per site" edge="bg-indigo-500" pressed={state.group === "domain" && state.tab === "all"} onClick={() => update({ tab: "all", group: "domain" })} testId="bl-sum-domains" />
        <Stat label="Broken backlinks" value={formatCompact(t.brokenBacklinks)} exact={formatExact(t.brokenBacklinks)} tone={(t.brokenBacklinks ?? 0) > 0 ? "bad" : null} caption="Open the Broken tab" edge="bg-red-500" pressed={state.tab === "broken"} onClick={() => update({ tab: "broken" })} testId="bl-sum-broken" />
        <Stat label="Dofollow" value={d.dofollowDomainsPercent === null ? MISSING : formatPercent1(d.dofollowDomainsPercent)} caption="Only dofollow links" edge="bg-emerald-600" pressed={state.follow === "dofollow" && state.tab === "all"} onClick={() => update({ tab: "all", follow: "dofollow" })} testId="bl-sum-dofollow" />
      </div>
      {t.referringPages !== null ? <p className="text-xs text-muted-foreground" data-testid="bl-summary-note">The list has one row per linking page ({formatExact(t.referringPages)}); a page can hold several links, which is why it is shorter than the total above.</p> : null}
    </div>
  )
}

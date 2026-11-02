"use client"

import { useMemo } from "react"
import { ArrowDown, ArrowUp, Equal, HelpCircle, Plus } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useMyCompetitors } from "@/hooks/useMyCompetitors"
import { useOwnSeoMetrics } from "@/hooks/useOwnSeoMetrics"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { MISSING, domainFromUrl, formatCompact, formatExact } from "../domain-overview/format"
import { DomainLink } from "./cells"
import { StatusChip } from "./EnrichmentCells"
import { COMPARE_METRICS, compareToYou, formatRatio, sortByLead } from "./compareToYou"

/**
 * "Your competitors": ONLY the competitors the user added, each compared with the user's own website. Nothing here calls a provider:
 * the competitors' numbers are what was saved for them, and the user's own numbers are the Domain Overview's (same cache).
 *
 * Reading the arrows (from YOUR point of view):
 *   red up arrow     the competitor is AHEAD of you          green down arrow   the competitor is BEHIND you
 *   grey equals      level                                   grey question mark not known (never treated as zero)
 */

const VERDICT = {
  ahead: { label: "Ahead of you", Icon: ArrowUp, tone: "text-red-600 dark:text-red-400", chip: "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40" },
  behind: { label: "Behind you", Icon: ArrowDown, tone: "text-emerald-600 dark:text-emerald-400", chip: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40" },
  level: { label: "Level with you", Icon: Equal, tone: "text-muted-foreground", chip: "border-border bg-muted/40" },
  unknown: { label: "Not comparable yet", Icon: HelpCircle, tone: "text-muted-foreground", chip: "border-border bg-muted/40" },
}
const LEAD_ICON = { them: VERDICT.ahead, you: VERDICT.behind, level: VERDICT.level, unknown: VERDICT.unknown }

const fmt = (v) => (typeof v === "number" ? formatCompact(v) : MISSING)

/** One metric's arrow with its numbers and the reason in plain words (also the tooltip and the screen-reader text). */
export function metricText(row) {
  if (row.lead === "unknown") return `${row.label}: not known for ${row.you === null ? "you" : "this competitor"} yet, so it is not compared.`
  const nums = `${formatExact(row.them)} for them, ${formatExact(row.you)} for you`
  if (row.lead === "level") return `${row.label}: level (${nums}).`
  const x = formatRatio(row.ratio)
  return `${row.label}: ${row.lead === "them" ? "they are ahead" : "you are ahead"}${x ? ` by ${x}` : ""} (${nums}).`
}

export function MetricArrow({ row }) {
  const { Icon, tone } = LEAD_ICON[row.lead]
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", tone)} title={metricText(row)} data-testid="yc-arrow" data-metric={row.key} data-lead={row.lead}>
      <Icon className="size-3.5" aria-hidden />
      <span className="text-muted-foreground">{row.short}</span>
      <span className="sr-only">. {metricText(row)}</span>
    </span>
  )
}

export function VerdictCell({ result }) {
  const v = VERDICT[result.verdict]
  const traffic = result.rows[0]
  const x = traffic.lead === "them" || traffic.lead === "you" ? formatRatio(traffic.ratio) : null
  const trafficNote = x ? (traffic.lead === "them" ? `${x} your traffic` : `you have ${x} their traffic`) : null
  return (
    <div className="space-y-1.5" data-testid="yc-verdict" data-verdict={result.verdict}>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", v.chip, v.tone)}>
        <v.Icon className="size-3.5" aria-hidden />{v.label}
      </span>
      {result.known > 0 ? (
        <p className="text-xs text-muted-foreground">
          {result.verdict === "level" ? "Same on the numbers we have" : `They lead on ${result.themLeads} of ${result.known}`}
          {trafficNote ? ` · ${trafficNote}` : ""}
        </p>
      ) : <p className="text-xs text-muted-foreground">{result.verdict === "unknown" ? "Waiting for numbers." : ""}</p>}
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {result.rows.map((r) => <MetricArrow key={r.key} row={r} />)}
      </div>
    </div>
  )
}

function YouRow({ metrics, status }) {
  return (
    <tr className="border-b border-border/60 bg-primary/5" data-testid="yc-you">
      <td className="px-3 py-3"><span className="font-semibold">You</span><span className="block text-xs text-muted-foreground">your own website</span></td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{status === "loading" ? "Loading your numbers…" : "The numbers below are compared with these."}</td>
      {COMPARE_METRICS.map((m) => (
        <td key={m.key} className="px-3 py-3 text-right tabular-nums font-medium" title={typeof metrics[m.key] === "number" ? formatExact(metrics[m.key]) : "Not available"}>
          {status === "loading" ? <Skeleton className="ml-auto h-4 w-10" /> : fmt(metrics[m.key])}
        </td>
      ))}
      <td className="px-3 py-3" />
    </tr>
  )
}

export default function YourCompetitorsComparison({ onFindMore, onOpenMine }) {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const own = useOwnSeoMetrics(projectId)
  const mc = useMyCompetitors(projectId)
  const projectDomain = domainFromUrl(activeProject?.main_url)

  const rows = useMemo(() => {
    const withData = (mc.competitors ?? []).filter((c) => c.domain).map((c) => ({ c, result: compareToYou(own.metrics, c.enrichment?.metrics ?? {}) }))
    return sortByLead(withData, (r) => r.result)
  }, [mc.competitors, own.metrics])
  const noSite = (mc.competitors ?? []).filter((c) => !c.domain)

  if (mc.status === "loading") {
    return <div className="space-y-3" aria-busy data-testid="yc-loading">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
  }
  if (mc.status === "error") {
    return (
      <div role="alert" className="space-y-2 rounded-xl border p-5" data-testid="yc-error">
        <p className="font-medium">Your competitors could not be loaded.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => mc.refetch?.()}>Try again</Button>
      </div>
    )
  }
  if ((mc.competitors ?? []).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center" data-testid="yc-empty">
        <p className="font-medium">You have not added any competitors yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add the businesses you compete with and this page will show who is ahead of you and who is behind, on traffic, keywords and links.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onFindMore} data-testid="yc-find"><Plus className="size-4" aria-hidden />Find competitors to add</Button>
          <Button type="button" variant="outline" onClick={onOpenMine}>Add one by website</Button>
        </div>
      </div>
    )
  }

  const anyAhead = rows.filter((r) => r.result.verdict === "ahead").length
  const anyBehind = rows.filter((r) => r.result.verdict === "behind").length
  return (
    <section className="space-y-4" aria-label="Your competitors compared with you" data-testid="yc-root">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your competitors</h2>
          <p className="text-sm text-muted-foreground" data-testid="yc-summary">
            {rows.length} competitor{rows.length === 1 ? "" : "s"} you added, compared with {projectDomain ?? "your website"}: <span className="font-medium text-red-600 dark:text-red-400">{anyAhead} ahead of you</span>, <span className="font-medium text-emerald-600 dark:text-emerald-400">{anyBehind} behind you</span>.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onFindMore} data-testid="yc-find"><Plus className="size-4" aria-hidden />Find more competitors</Button>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="yc-legend">
        <span className="font-medium text-red-600 dark:text-red-400">▲ Red arrow</span> = the competitor is ahead of you. <span className="font-medium text-emerald-600 dark:text-emerald-400">▼ Green arrow</span> = they are behind you. Estimates from the data provider for your project&apos;s country; hover an arrow for the numbers.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[820px] text-sm" data-testid="yc-table">
          <thead>
            <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">Competitor</th>
              <th scope="col" className="px-3 py-2 font-medium">Compared with you</th>
              {COMPARE_METRICS.map((m) => <th key={m.key} scope="col" className="px-3 py-2 text-right font-medium" title={`${m.label} (${m.unit})`}>{m.label}</th>)}
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <YouRow metrics={own.metrics} status={own.status} />
            {rows.map(({ c, result }) => (
              <tr key={c.id} className="border-b border-border/40 align-top last:border-0" data-testid="yc-row" data-id={c.id}>
                <td className="px-3 py-3">
                  <span className="block font-medium">{c.name}</span>
                  <DomainLink domain={c.domain} className="text-xs font-normal text-muted-foreground" />
                </td>
                <td className="px-3 py-3"><VerdictCell result={result} /></td>
                {result.rows.map((r) => (
                  <td key={r.key} className="px-3 py-3 text-right tabular-nums" data-testid={`yc-${r.key}`}>
                    <span className="inline-flex items-center gap-1" title={metricText(r)}>
                      {r.lead !== "unknown" && r.lead !== "level" ? (() => { const I = LEAD_ICON[r.lead].Icon; return <I className={cn("size-3.5", LEAD_ICON[r.lead].tone)} aria-hidden /> })() : null}
                      {r.them === null ? <span className="text-muted-foreground" data-missing="true">{MISSING}</span> : fmt(r.them)}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-3"><StatusChip enrichment={c.enrichment} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noSite.length ? (
        <p className="text-xs text-muted-foreground" data-testid="yc-nosite">
          {noSite.length} competitor{noSite.length === 1 ? " has" : "s have"} no website saved, so {noSite.length === 1 ? "it cannot" : "they cannot"} be compared ({noSite.map((c) => c.name).join(", ")}). Add a website in{" "}
          <button type="button" onClick={onOpenMine} className="underline underline-offset-2">My competitors</button>.
        </p>
      ) : null}
    </section>
  )
}

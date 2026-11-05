"use client"

import { ArrowDown, ArrowUp, Equal, HelpCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { formatRatio } from "./compareToYou"

/**
 * The "Your competitors" table, shared by the Competitors page and the Domain Overview card so they always read the same:
 * you first (tinted), then each competitor you added with a verdict pill, one plain sentence, and its four numbers. Each number carries
 * an arrow from YOUR point of view: red up = they are ahead of you, green down = they are behind you (hover for the exact figures).
 * A figure that is not known is "—" and is never compared.
 */

const VERDICT = {
  ahead: { label: "Ahead of you", Icon: ArrowUp, tone: "text-red-600 dark:text-red-400", chip: "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40" },
  behind: { label: "Behind you", Icon: ArrowDown, tone: "text-emerald-600 dark:text-emerald-400", chip: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40" },
  level: { label: "Level with you", Icon: Equal, tone: "text-muted-foreground", chip: "border-border bg-muted/40" },
  unknown: { label: "Not comparable yet", Icon: HelpCircle, tone: "text-muted-foreground", chip: "border-border bg-muted/40" },
}
const LEAD = { them: VERDICT.ahead, you: VERDICT.behind, level: VERDICT.level, unknown: VERDICT.unknown }

/** Column headings, in the order of COMPARE_METRICS. */
const HEADINGS = ["Traffic", "Keywords", "#1 spots", "Linking sites"]

const fmt = (v) => (typeof v === "number" ? formatCompact(v) : MISSING)

/** One metric's sentence: the tooltip and the screen-reader text of its cell. */
export function metricText(row) {
  if (row.lead === "unknown") return `${row.label}: not known for ${row.you === null ? "you" : "this competitor"} yet, so it is not compared.`
  const nums = `${formatExact(row.them)} for them, ${formatExact(row.you)} for you`
  if (row.lead === "level") return `${row.label}: level (${nums}).`
  const x = formatRatio(row.ratio)
  return `${row.label}: ${row.lead === "them" ? "they are ahead" : "you are ahead"}${x ? ` by ${x}` : ""} (${nums}).`
}

export function MetricCell({ row }) {
  const lead = LEAD[row.lead]
  const known = row.them !== null
  return (
    <td className="px-3 py-3 align-middle tabular-nums" data-testid={`yc-${row.key}`}>
      <span className={cn("inline-flex items-center gap-1 font-semibold", known ? lead.tone : "text-muted-foreground")} title={metricText(row)} data-testid="yc-arrow" data-metric={row.key} data-lead={row.lead} data-missing={known ? undefined : "true"}>
        {row.lead === "them" || row.lead === "you" ? <lead.Icon className="size-3.5" aria-hidden /> : null}
        {fmt(row.them)}
        <span className="sr-only">. {metricText(row)}</span>
      </span>
    </td>
  )
}

export function VerdictCell({ result }) {
  const v = VERDICT[result.verdict]
  const traffic = result.rows[0]
  const x = traffic.lead === "them" || traffic.lead === "you" ? formatRatio(traffic.ratio) : null
  const trafficNote = x ? (traffic.lead === "them" ? `${x} your traffic` : `you have ${x} their traffic`) : null
  return (
    <div className="space-y-1" data-testid="yc-verdict" data-verdict={result.verdict}>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", v.chip, v.tone)}>
        <v.Icon className="size-3.5" aria-hidden />{v.label}
      </span>
      {result.known > 0 ? (
        <p className="text-xs text-muted-foreground">
          {result.verdict === "level" ? "Same on the numbers we have" : `Leads on ${result.themLeads} of ${result.known}`}
          {trafficNote ? ` · ${trafficNote}` : ""}
        </p>
      ) : <p className="text-xs text-muted-foreground">{result.verdict === "unknown" ? "Waiting for numbers." : ""}</p>}
    </div>
  )
}

function YouRow({ domain, metrics, status, keys }) {
  return (
    <tr className="border-b border-border/60 bg-muted/50 align-middle" data-testid="yc-you">
      <td className="px-3 py-3"><span className="block font-semibold">You</span>{domain ? <span className="block text-xs text-muted-foreground">{domain}</span> : null}</td>
      <td className="px-3 py-3">
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Your site</span>
        <p className="mt-1 text-xs text-muted-foreground">{status === "loading" ? "Loading your numbers…" : "Everyone below is compared with you"}</p>
      </td>
      {keys.map((k) => (
        <td key={k} className="px-3 py-3 font-semibold tabular-nums" title={typeof metrics[k] === "number" ? formatExact(metrics[k]) : "Not available"}>
          {status === "loading" ? <Skeleton className="h-4 w-10" /> : fmt(metrics[k])}
        </td>
      ))}
    </tr>
  )
}

/** @param {{ rows: Array<{ c: {id:string,name:string,domain:string}, result: object }>, own: { metrics: object, status: string }, domain?: string|null, keys: string[] }} props */
export default function CompareTable({ rows, own, domain, keys, rowTestId = "yc-row" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm" data-testid="yc-table">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">Competitor</th>
            <th scope="col" className="px-3 py-2 font-medium">Compared with you</th>
            {HEADINGS.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          <YouRow domain={domain} metrics={own.metrics} status={own.status} keys={keys} />
          {rows.map(({ c, result }) => (
            <tr key={c.id} className="border-b border-border/40 last:border-0" data-testid={rowTestId} data-id={c.id} data-verdict={result.verdict}>
              <td className="max-w-[260px] px-3 py-3">
                <span className="block truncate font-medium" title={c.name}>{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground" title={c.domain}>{c.domain}</span>
              </td>
              <td className="px-3 py-3"><VerdictCell result={result} /></td>
              {result.rows.map((r) => <MetricCell key={r.key} row={r} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

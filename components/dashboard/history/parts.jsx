"use client"

import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatNumber, formatPercent, formatSigned } from "@/lib/history/compare"

/** Small building blocks shared by every history panel. Presentational only: no requests, no page knowledge. */

export const PERIODS = Object.freeze([
  { id: "previous", label: "Previous scan" },
  { id: "week", label: "7 days ago" },
  { id: "month", label: "30 days ago" },
])

export function PeriodSelect({ value, onChange, label = "Compare with" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          onClick={() => onChange(p.id)}
          className={cn("rounded px-2.5 py-1 font-medium transition-colors", value === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** A clickable count. `value` null renders "—" (unknown), a real 0 renders 0. */
export function Tile({ label, value, active = false, onClick, tone }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", tone)}>{formatNumber(value)}</span>
    </>
  )
  const cls = cn("flex min-w-[7rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left", active ? "border-primary bg-primary/5" : "border-border bg-card")
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, "hover:border-primary/60")}>{body}</button>
    : <div className={cls}>{body}</div>
}

/** The state shown when there is a history question but only one stored scan (or none old enough). Never zeros. */
export function NotEnoughHistory({ note, latestAt }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground" data-testid="not-enough-history">
      <p className="font-medium text-foreground">Not enough historical data</p>
      <p className="mt-1">{note || "Odito needs at least two stored scans to show what changed."}{latestAt ? ` The only stored scan is from ${latestAt}.` : ""}</p>
    </div>
  )
}

/** A before → now change with its direction. `good` says which direction is an improvement ("up" for traffic, "down" for spam). */
export function DeltaCell({ delta, digits = 0, good = "up" }) {
  if (!delta?.known) return <span className="text-muted-foreground" title="One of the two scans has no figure for this">—</span>
  const { abs, pct } = delta
  if (abs === 0) return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="size-3" aria-hidden /> no change</span>
  const better = (abs > 0) === (good === "up")
  const Icon = abs > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", better ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
      <Icon className="size-3" aria-hidden />
      {formatSigned(abs, { digits })}{pct !== null ? ` (${formatPercent(pct)})` : ""}
    </span>
  )
}

/** A bounded list of changed rows. `columns`: [{ id, label, render(row) }]. */
export function ChangeList({ title, rows = [], count, columns, empty = "None." }) {
  const shown = rows.length
  return (
    <div className="mt-3" data-testid="change-list">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {title}
        {typeof count === "number" && count > shown ? ` — showing the first ${shown} of ${formatNumber(count)}` : ""}
      </p>
      {shown === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-72 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>{columns.map((c) => <th key={c.id} scope="col" className="px-2 py-1.5 font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.__key ?? i} className="border-t border-border">
                  {columns.map((c) => <td key={c.id} className="max-w-[22rem] truncate px-2 py-1.5 align-top" title={typeof c.title === "function" ? c.title(row) : undefined}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

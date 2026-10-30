"use client"

import { cn } from "@/lib/utils"

/** Wrapper classes every chart shares: the page accent is `currentColor`, tick text stays a muted text token. */
export const chartClass = (height = "h-[300px]") =>
  `${height} w-full text-primary [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-[11px]`

/** A colour swatch: an arbitrary CSS colour, or the page accent at a given opacity. */
export function Swatch({ color, opacity = 1, shape = "square" }) {
  return (
    <span
      className={cn("inline-block shrink-0 text-primary", shape === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-sm")}
      style={{ background: color || "currentColor", opacity }}
      aria-hidden
    />
  )
}

/**
 * The legend above a chart. With `onToggle` its items are buttons that hide / show a series (aria-pressed); without it, a plain
 * key. The name is always text, so identity never rests on colour alone.
 */
export function Legend({ items, onToggle, hidden = new Set(), label = "Chart legend" }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label={label}>
      {items.map((it) => {
        const off = hidden.has(it.key)
        const body = (
          <>
            <Swatch color={it.color} opacity={off ? 0.25 : it.opacity} shape={it.shape} />
            <span className={cn(off && "text-muted-foreground line-through")}>{it.label}</span>
          </>
        )
        return (
          <li key={it.key}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(it.key)}
                className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {body}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">{body}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** The popover every chart tooltip uses: the month first, then rows of (name, value). */
export function TooltipShell({ title, children }) {
  return (
    <div className="min-w-[200px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-semibold text-popover-foreground">{title}</div>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </div>
  )
}

export function TooltipRow({ swatch, name, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5">{swatch}{name}</span>
      <span className="flex items-center gap-2 font-medium tabular-nums text-popover-foreground">{children}</span>
    </div>
  )
}

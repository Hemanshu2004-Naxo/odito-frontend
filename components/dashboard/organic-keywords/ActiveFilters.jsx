"use client"

import { X } from "lucide-react"

/** The applied filters as removable chips, and "Clear all". Renders nothing when no filter narrows the list. */
export default function ActiveFilters({ chips, onRemove, onClearAll }) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Applied filters" data-testid="ok-active-filters">
      {chips.map((c) => (
        <span key={c.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-0.5 pl-3 pr-1 text-sm" data-testid="ok-chip">
          <span className="truncate">{c.label}</span>
          <button
            type="button"
            onClick={() => onRemove(c)}
            aria-label={`Remove filter: ${c.label}`}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="rounded px-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="ok-clear-all">
        Clear all
      </button>
    </div>
  )
}

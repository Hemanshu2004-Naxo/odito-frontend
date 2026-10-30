"use client"

import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { TABS, TOXIC_TAB_HINT } from "./constants"

/**
 * The tabs (All / New / Lost / Toxic / Disavowed). A tab's count is shown only once that tab has been loaded for the current filters: the
 * others are never fetched ahead of time, so an unopened tab has no number (not 0).
 */
export default function TabsBar({ tab, counts, onTab }) {
  return (
    <div className="space-y-1.5" data-testid="rd-tabs-bar">
      <div role="tablist" aria-label="Which referring domains" className="inline-flex max-w-full flex-wrap rounded-lg border border-border/70 bg-muted/30 p-0.5">
        {TABS.map((t) => {
          const count = counts[t.id]
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={selected}
              title={t.hint}
              onClick={() => onTab(t.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              data-testid={`rd-tab-${t.id}`}
            >
              {t.label}
              {typeof count === "number" ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-background/20" : "bg-muted")} data-testid={`rd-tab-${t.id}-count`} title={`${formatExact(count)} referring domains`}>{formatExact(count)}</span> : null}
            </button>
          )
        })}
      </div>
      {tab === "toxic" ? <p className="text-xs text-muted-foreground" data-testid="rd-toxic-hint">{TOXIC_TAB_HINT}</p> : null}
    </div>
  )
}

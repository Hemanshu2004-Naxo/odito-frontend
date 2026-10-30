"use client"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { MERGE_HINT, TABS } from "./constants"

/**
 * The tabs (All / Errors / Redirects / OK) and the "Merge URL variants" switch. A tab's count is shown only once that tab has been loaded for the
 * current filters: the others are never fetched ahead of time, so an unopened tab has no number (not 0).
 */
export default function TabsBar({ tab, counts, onTab, merge, onMerge }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="tp-tabs-bar">
      <div role="tablist" aria-label="Which pages" className="inline-flex max-w-full flex-wrap rounded-lg border border-border/70 bg-muted/30 p-0.5">
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
              data-testid={`tp-tab-${t.id}`}
            >
              {t.label}
              {typeof count === "number" ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-background/20" : "bg-muted")} data-testid={`tp-tab-${t.id}-count`} title={`${formatExact(count)} pages`}>{formatExact(count)}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2.5" data-testid="tp-merge-row">
        <Switch id="tp-merge" checked={merge} onCheckedChange={onMerge} data-testid="tp-merge" />
        <label htmlFor="tp-merge" className="text-sm font-medium">Merge URL variants</label>
        <span className="text-xs text-muted-foreground" data-testid="tp-merge-hint">{MERGE_HINT}</span>
      </div>
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { GROUPS, TABS } from "./constants"

/**
 * The tabs (All / New / Lost / Broken) and the Group by control. A tab's count is shown only once that tab has been loaded for the
 * current group and filters: the others are never fetched ahead of time, so an unopened tab has no number (not 0).
 */
export default function TabsBar({ tab, group, counts, onTab, onGroup }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="bl-tabs-bar">
      <div role="tablist" aria-label="Which backlinks" className="inline-flex flex-wrap rounded-lg border border-border/70 bg-muted/30 p-0.5">
        {TABS.map((t) => {
          const count = counts[t.id]
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`bl-tab-${t.id}`}
              aria-selected={selected}
              onClick={() => onTab(t.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              data-testid={`bl-tab-${t.id}`}
            >
              {t.label}
              {typeof count === "number" ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-background/20" : "bg-muted")} data-testid={`bl-tab-${t.id}-count`} title={`${formatExact(count)} backlinks`}>{formatExact(count)}</span> : null}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group by</span>
        <select
          value={group}
          onChange={(e) => onGroup(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="bl-group"
        >
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </label>
    </div>
  )
}

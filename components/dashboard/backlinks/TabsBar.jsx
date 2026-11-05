"use client"

import { cn } from "@/lib/utils"
import { formatExact } from "../domain-overview/format"
import { GROUPS, TABS } from "./constants"

/**
 * The tabs (All / New / Lost / Broken) as navy pills, and the Group by control. A tab's count is shown only once that tab has been loaded for
 * the current group and filters: the others are never fetched ahead of time, so an unopened tab has no number (not 0).
 */
export default function TabsBar({ tab, group, counts, onTab, onGroup }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="bl-tabs-bar">
      <div role="tablist" aria-label="Which backlinks" className="flex flex-wrap gap-2">
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
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-[#0d1a3a] bg-[#0d1a3a] text-white dark:border-indigo-500 dark:bg-indigo-500" : "border-border/70 bg-card text-foreground hover:bg-muted",
              )}
              data-testid={`bl-tab-${t.id}`}
            >
              {t.label}
              {typeof count === "number" ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-white/20" : "bg-muted")} data-testid={`bl-tab-${t.id}-count`} title={`${formatExact(count)} backlinks`}>{formatExact(count)}</span> : null}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group by</span>
        <select
          value={group}
          onChange={(e) => onGroup(e.target.value)}
          className="h-10 rounded-xl border border-border/70 bg-card px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="bl-group"
        >
          {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </label>
    </div>
  )
}

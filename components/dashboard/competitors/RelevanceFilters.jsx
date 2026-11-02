"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { FILTERS, scopeNote } from "./relevanceUi"

/**
 * Filter by business relevance and search by domain. It works on the competitors ALREADY LOADED on this page only, and says so: the
 * provider's list, its paging and its sorting are untouched, and nothing is excluded from the results.
 */
export default function RelevanceFilters({ filter, onFilter, search, onSearch, counts, loaded, total, shown, disabled }) {
  return (
    <section className="space-y-2 rounded-xl border border-border/60 bg-card px-4 py-3" aria-label="Filter competitors by business relevance" data-testid="rel-filters">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Business relevance">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? loaded : counts?.counts?.[f.key] ?? 0
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground/80 hover:bg-muted",
                )}
                data-testid={`rel-filter-${f.key}`}
              >
                {f.label}<span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{n}</span>
              </button>
            )
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search these domains" aria-label="Search competitors by domain" className="h-9 pl-8" data-testid="rel-search" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="rel-scope">
        {scopeNote(loaded, total)}
        {counts?.pending ? ` ${counts.pending} still being checked.` : ""}
        {shown !== loaded ? ` Showing ${shown}.` : ""}
      </p>
    </section>
  )
}

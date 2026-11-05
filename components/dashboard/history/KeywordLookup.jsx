"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useKeywordHistory } from "@/hooks/useDatasetHistory"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { describeSectionError } from "@/lib/describeSectionError"
import { formatDay, formatNumber } from "@/lib/history/compare"

/** One keyword over time, from the stored scans: its position in each, and the best it ever had. Needs two scans to show movement. */
export default function KeywordLookup({ projectId }) {
  const [draft, setDraft] = useState("")
  const [keyword, setKeyword] = useState("")
  const q = useKeywordHistory(projectId, keyword)
  const data = q.data?.data
  const points = data?.points ?? []

  return (
    <section aria-label="Keyword history" className="rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-sm font-semibold">Keyword history</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); setKeyword(draft.trim()) }}
      >
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Keyword
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder="e.g. lasik surgery cost"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
          />
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={!draft.trim()}><Search className="size-3.5" aria-hidden /> Show history</Button>
      </form>
      {keyword ? (
        <div className="mt-3" aria-live="polite">
          {q.isLoading ? <Skel className="h-20 w-full" />
            : q.isError ? <SectionError message={describeSectionError(q.error)} onRetry={() => q.refetch()} />
              : points.length === 0 ? <p className="text-sm text-muted-foreground">No stored scan contains “{keyword}”.</p>
                : (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {points.length === 1 ? "Only one stored scan has this keyword, so there is no movement to show yet. " : ""}
                      Best position: <strong className="text-foreground">{formatNumber(data.bestPosition)}</strong>
                    </p>
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted-foreground"><tr><th scope="col" className="py-1 font-medium">Scan date</th><th scope="col" className="py-1 font-medium">Position</th><th scope="col" className="py-1 font-medium">Traffic</th><th scope="col" className="py-1 font-medium">Volume</th><th scope="col" className="py-1 font-medium">Ranking URL</th></tr></thead>
                      <tbody>
                        {points.map((p) => (
                          <tr key={String(p._id ?? p.scanId)} className="border-t border-border">
                            <td className="py-1">{formatDay(p.capturedAt)}</td>
                            <td className="py-1 tabular-nums">{formatNumber(p.position)}</td>
                            <td className="py-1 tabular-nums">{formatNumber(p.trafficEstimate)}</td>
                            <td className="py-1 tabular-nums">{formatNumber(p.searchVolume)}</td>
                            <td className="max-w-[18rem] truncate py-1" title={p.rankingUrl ?? undefined}>{p.rankingUrl ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
        </div>
      ) : null}
    </section>
  )
}

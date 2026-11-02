"use client"

import { useQuery } from "@tanstack/react-query"
import { useProject } from "@/contexts/ProjectContext"
import myCompetitorsService from "@/services/myCompetitorsService"
import { queryKeys } from "@/lib/query/keys"
import { formatDateTime } from "../referring-domains/format"
import { MISSING, formatExact } from "../domain-overview/format"
import { reasonFor } from "./enrichmentUi"

const Pos = ({ p }) => (p?.position != null ? <span className="tabular-nums">{p.position}</span> : <span className="text-muted-foreground">{MISSING}</span>)

/**
 * The keywords the project AND this competitor both rank for, with each side's position. Read from what is already saved (one GET, no
 * provider call), and only when the saved comparison has values. Otherwise the reason is shown instead of an empty list.
 */
export default function SharedKeywordsList({ competitor }) {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  const e = competitor?.enrichment
  const section = e?.sections?.shared ?? null
  const hasValues = section?.status === "ok"

  const query = useQuery({
    queryKey: queryKeys.myCompetitors.details(projectId, competitor?.id),
    queryFn: ({ signal }) => myCompetitorsService.get(projectId, competitor.id, { signal }),
    enabled: !!projectId && !!competitor?.id && hasValues,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (!hasValues) {
    const processing = e?.status === "pending" || e?.status === "processing"
    return (
      <p className="text-sm text-muted-foreground" data-testid="mc-shared-reason" data-section-status={section?.status ?? "missing"}>
        {section?.status === "failed" ? "The shared keywords could not be loaded. " : ""}{reasonFor(e, "shared")}.{processing ? "" : ""}
      </p>
    )
  }
  if (query.isLoading) return <p className="text-sm text-muted-foreground" aria-busy data-testid="mc-shared-loading">Loading the shared keywords…</p>
  if (query.isError) return <p className="text-sm text-destructive" role="alert" data-testid="mc-shared-error">The shared keywords could not be loaded. Close this panel and open it again.</p>

  const list = query.data?.data?.competitor?.sharedKeywordList ?? null
  if (!list) return <p className="text-sm text-muted-foreground" data-testid="mc-shared-reason">{reasonFor(e, "shared")}.</p>
  if (list.total === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="mc-shared-zero">No keywords found where you and this competitor both rank{list.market ? ` in ${list.market.location}` : ""}.</p>
  }
  return (
    <div className="space-y-2" data-testid="mc-shared-list">
      <p className="text-xs text-muted-foreground">
        {formatExact(list.total)} keyword{list.total === 1 ? "" : "s"} you both rank for
        {list.truncated ? `. The ${formatExact(list.shown)} with the most searches are listed` : ""}
        {list.fetchedAt ? `. Fetched ${formatDateTime(list.fetchedAt)}` : ""}.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">Keyword</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Estimated searches per month">Searches</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Your position in Google">You</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="This competitor's position in Google">Them</th>
            </tr>
          </thead>
          <tbody>
            {list.keywords.map((k) => (
              <tr key={k.keyword} className="border-b border-border/40 last:border-0" data-testid="mc-shared-row">
                <td className="px-3 py-1.5">{k.keyword}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{k.searchVolume != null ? formatExact(k.searchVolume) : MISSING}</td>
                <td className="px-3 py-1.5 text-right"><Pos p={k.project} /></td>
                <td className="px-3 py-1.5 text-right"><Pos p={k.competitor} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

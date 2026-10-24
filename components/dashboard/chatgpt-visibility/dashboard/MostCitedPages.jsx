"use client"

import { useCitedPages } from "@/hooks/useChatGptVisibility"
import { ErrorNote, Panel } from "../parts"
import { formatDateTime } from "../format"

const pathOf = (url) => { try { const u = new URL(url); return `${u.pathname}${u.search}` || "/" } catch { return url } }

/**
 * The website's most-cited pages in one run: distinct pages (tracking parameters and fragments removed), how often each was cited, by how
 * many different questions, and when last. Clicking a page shows the answers that cited it.
 */
export default function MostCitedPages({ projectId, runId, onSelectPage }) {
  const { data, isLoading, error } = useCitedPages(projectId, runId)
  const pages = data?.data?.pages || []
  return (
    <Panel title="Most-cited pages" description="Pages of your website that ChatGPT linked to in this run, across questions that do not name your business.">
      {error ? <ErrorNote>Could not load the cited pages.</ErrorNote> : null}
      {isLoading ? <div className="h-32 rounded-lg skeleton-base skeleton-shimmer" aria-busy="true" /> : null}
      {!isLoading && !error && !pages.length ? (
        <p className="text-sm text-muted-foreground">No page of your website was cited in this run. Answers that cite other sites are listed with each question.</p>
      ) : null}
      {pages.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Page</th>
                <th className="pb-2 text-right font-medium">Citations</th>
                <th className="pb-2 text-right font-medium">Questions citing it</th>
                <th className="pb-2 pl-4 text-right font-medium">Last cited</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.url} className="border-t border-border/50">
                  <td className="max-w-0 py-2.5 pr-4">
                    <button type="button" onClick={() => onSelectPage?.(p.url)} className="block w-full truncate rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={p.url} aria-label={`Show answers citing ${p.url}`}>
                      {pathOf(p.url)}
                    </button>
                    {p.title ? <span className="block truncate text-xs text-muted-foreground">{p.title}</span> : null}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{p.occurrences}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.questionCount}</td>
                  <td className="py-2.5 pl-4 text-right text-muted-foreground">{formatDateTime(p.lastCitedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Citations count every link, repeats included; questions count how many different questions cited the page.</p>
        </div>
      ) : null}
    </Panel>
  )
}

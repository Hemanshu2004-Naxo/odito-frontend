"use client"

import { Fragment } from "react"
import Link from "next/link"
import { useQueries } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import myCompetitorsService from "@/services/myCompetitorsService"
import { queryKeys } from "@/lib/query/keys"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import OverviewCard from "../domain-overview/OverviewCard"
import { MISSING, formatCompact, formatExact } from "../domain-overview/format"
import { statusMeta } from "./enrichmentUi"
import { GRID_GROUPS, buildHeadToHead, shortName } from "./sideBySide"

const NAVY = "bg-[#0d1a3a] text-white dark:bg-indigo-500"
const TONE_CHIP = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  critical: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
}

const initial = (s) => (s?.trim()?.[0] ?? "?").toUpperCase()
const COL = "px-4"
const LABEL_W = 210
const SITE_W = 190

function Avatar({ letter, you }) {
  return <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold", you ? `${NAVY} !text-emerald-300` : "border border-border/70 bg-card")} aria-hidden>{letter}</span>
}

function VerdictChip({ verdict }) {
  if (verdict === "ahead") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">↑ Ahead</span>
  if (verdict === "behind") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">↓ Behind</span>
  if (verdict === "level") return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">= Level</span>
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Not compared yet</span>
}

/** "Side by side": one column per site (you first, tinted), one row per metric, the row's best in green with a BEST tag. */
export function SideBySide({ grid, ownStatus, projectInitial, projectDomain, marketLabel, onRemove }) {
  const { sites, rows, rowCount } = grid
  return (
    <OverviewCard
      title="Side by side"
      description="Each row compares one number across every site. Longest bar wins."
      action={marketLabel ? <span className="text-xs text-muted-foreground" data-testid="sb-market">{marketLabel}</span> : null}
      testId="sb-card"
    >
      <div className="-mx-5 overflow-x-auto">
        {/* Fixed layout + a colgroup: table cells ignore min-width, so without this the label column gets squeezed and clipped. */}
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: LABEL_W + SITE_W * sites.length }} data-testid="sb-table">
          <colgroup>
            <col style={{ width: LABEL_W }} />
            {sites.map((s) => <col key={s.id} style={{ width: SITE_W }} />)}
          </colgroup>
          <thead>
            <tr className="border-y border-border/60">
              <th scope="col" className="px-5 pb-3 pt-6 text-left align-bottom text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Compare</th>
              {sites.map((s) => (
                <th key={s.id} scope="col" className={cn(COL, "py-4 text-left align-top font-normal", s.isYou && "border-t-[3px] border-t-[#0d1a3a] bg-indigo-50/60 dark:border-t-indigo-400 dark:bg-indigo-500/[0.07]")} data-testid="sb-site" data-site={s.id}>
                  <div className="flex items-center gap-2">
                    <Avatar letter={s.isYou ? projectInitial : initial(s.name)} you={s.isYou} />
                    {s.isYou ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">Your site</span> : <VerdictChip verdict={s.result?.verdict} />}
                  </div>
                  <div className="mt-2.5 font-semibold leading-snug">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground" title={s.isYou ? projectDomain : s.domain}>{s.isYou ? projectDomain : s.domain}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID_GROUPS.map((g) => (
              <Fragment key={g.key}>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th scope="rowgroup" colSpan={sites.length + 1} className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</th>
                </tr>
                {rows.filter((r) => g.rows.some((x) => x.key === r.key)).map((r) => (
                  <tr key={r.key} className="border-b border-border/40" data-testid="sb-row" data-metric={r.key}>
                    <th scope="row" className="px-5 py-4 text-left align-top font-normal">
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.hint}</div>
                    </th>
                    {r.cells.map((cell, i) => {
                      const you = sites[i].isYou
                      const loading = you && ownStatus === "loading"
                      return (
                        <td key={cell.siteId} className={cn(COL, "py-4 align-top", you && "bg-indigo-50/60 dark:bg-indigo-500/[0.07]")} data-testid="sb-cell" data-best={cell.best ? "1" : "0"}>
                          {loading ? <Skeleton className="h-5 w-12" /> : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className={cn("text-lg font-semibold tabular-nums", cell.best && "text-emerald-700 dark:text-emerald-400")} title={formatExact(cell.value)}>{cell.value === null ? MISSING : formatCompact(cell.value)}</span>
                                {cell.best && !(sites.length === 1) ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Best</span> : null}
                              </div>
                              <div className="mt-1.5 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted" aria-hidden>
                                {cell.value !== null ? <div className={cn("h-full rounded-full", cell.best ? "bg-emerald-600" : you ? "bg-[#0d1a3a] dark:bg-indigo-400" : "bg-slate-300 dark:bg-slate-600")} style={{ width: `${Math.max(cell.value > 0 ? 2 : 1, cell.share)}%` }} /> : null}
                              </div>
                              <div className="mt-1.5 text-xs text-muted-foreground" data-testid="sb-caption">{cell.caption}</div>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr data-testid="sb-wins-row">
              <th scope="row" className="px-5 py-4 text-left align-top font-normal">
                <div className="font-semibold">Who wins</div>
                <div className="text-xs text-muted-foreground">Rows where this site is best</div>
              </th>
              {sites.map((s) => {
                const meta = s.isYou ? null : statusMeta(s.competitor?.enrichment)
                return (
                  <td key={s.id} className={cn(COL, "py-4 align-top", s.isYou && "bg-indigo-50/60 dark:bg-indigo-500/[0.07]")} data-testid="sb-wins" data-site={s.id}>
                    <div className="flex max-w-[160px] gap-1" aria-hidden>
                      {s.winsByRow.map((w, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", w ? "bg-emerald-600" : "bg-muted")} />)}
                    </div>
                    <p className={cn("mt-2 text-[13px] font-semibold", s.wins > 0 && !s.isYou && "text-emerald-700 dark:text-emerald-400")}>
                      Best in {s.wins} of {rowCount}{s.isYou ? "" : ` · beats you on ${s.beatsYou}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {s.isYou ? (
                        <span className={cn("rounded px-1.5 py-0.5 font-medium", ownStatus === "ready" ? TONE_CHIP.success : TONE_CHIP.muted)}>{ownStatus === "ready" ? "Up to date" : ownStatus === "loading" ? "Loading" : "Unavailable"}</span>
                      ) : (
                        <>
                          <span className={cn("rounded px-1.5 py-0.5 font-medium", TONE_CHIP[meta.tone] ?? TONE_CHIP.muted)} title={meta.hint} data-testid="sb-status">{meta.label}</span>
                          <button type="button" onClick={() => onRemove(s.competitor)} className="font-medium text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-400" aria-label={`Remove ${s.name}`} data-testid="sb-remove">Remove</button>
                        </>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">Domain numbers: DataForSEO Labs and Backlinks estimates. &ldquo;Partial data&rdquo; means some metrics could not be fetched for that site yet.</p>
    </OverviewCard>
  )
}

function PosChip({ position, best, you }) {
  if (position === null) return <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-muted/60 px-2 text-xs text-muted-foreground" aria-label="Not among the keywords you both rank for">–</span>
  return (
    <span className={cn("inline-flex h-7 min-w-9 items-center justify-center rounded-md px-2 text-sm font-bold tabular-nums", best ? "bg-emerald-600 text-white" : you ? NAVY : "bg-muted text-foreground")}>
      #{position}
    </span>
  )
}

/**
 * "Head to head on your keywords": the keywords you share with the competitors (from each one's saved shared-keyword list — one GET each,
 * no provider call), with every site's Google position. The bottom row counts where each site is highest.
 */
export function HeadToHead({ projectId, sites, marketLabel }) {
  const comps = sites.filter((s) => !s.isYou)
  const withLists = comps.filter((s) => s.competitor?.enrichment?.sections?.shared?.status === "ok")
  const queries = useQueries({
    queries: withLists.map((s) => ({
      queryKey: queryKeys.myCompetitors.details(projectId, s.id),
      queryFn: ({ signal }) => myCompetitorsService.get(projectId, s.id, { signal }),
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  })
  const loading = queries.some((q) => q.isLoading)
  const lists = withLists.map((s, i) => ({ siteId: s.id, keywords: queries[i]?.data?.data?.competitor?.sharedKeywordList?.keywords ?? [] }))
  const ids = comps.map((s) => s.id)
  const h2h = buildHeadToHead(lists, ids) // at most 10 lists of 100 keywords: cheap enough to build on every render

  return (
    <OverviewCard
      title="Head to head on your keywords"
      description={`Google position for each site on the keywords you share${marketLabel ? ` · ${marketLabel}` : ""}`}
      action={<Link href="/app/organic-keywords" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open keyword ranking</Link>}
      testId="h2h-card"
    >
      {loading ? (
        <div className="space-y-2" aria-busy>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : h2h.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground" data-testid="h2h-empty">
          {withLists.length === 0 ? "Shared keywords appear here once your competitors' SEO data has been fetched." : "None of your competitors ranks for the same keywords as you yet."}
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm" data-testid="h2h-table">
            <thead>
              <tr className="border-y border-border/60 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-5 py-2.5">Keyword</th>
                <th scope="col" className="bg-indigo-50/60 px-4 py-2.5 dark:bg-indigo-500/[0.07]">You</th>
                {comps.map((s) => <th key={s.id} scope="col" className="px-4 py-2.5" title={s.name}>{shortName(s.name).toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {h2h.rows.map((r) => (
                <tr key={r.keyword} className="border-b border-border/40" data-testid="h2h-row">
                  <th scope="row" className="px-5 py-2.5 text-left font-semibold">{r.keyword}</th>
                  {r.cells.map((c) => (
                    <td key={c.siteId} className={cn("px-4 py-2.5", c.siteId === "you" && "bg-indigo-50/60 dark:bg-indigo-500/[0.07]")} data-site={c.siteId}>
                      <span className="inline-flex items-center gap-2">
                        <PosChip position={c.position} best={c.best} you={c.siteId === "you"} />
                        {c.siteId === "you" ? (c.best && r.cells.filter((x) => x.position !== null).length > 1 ? <span className="text-xs text-muted-foreground">Highest</span> : null) : c.note ? <span className="text-xs text-muted-foreground">{c.note}</span> : null}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr data-testid="h2h-wins">
                <th scope="row" className="px-5 py-3 text-left font-semibold">Highest of these sites</th>
                {["you", ...comps.map((s) => s.id)].map((id) => (
                  <td key={id} className={cn("px-4 py-3 font-semibold", id === "you" && "bg-indigo-50/60 dark:bg-indigo-500/[0.07]", id !== "you" && h2h.wins[id] > h2h.wins.you && "text-emerald-700 dark:text-emerald-400")}>
                    {h2h.wins[id]} of {h2h.rows.length}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">Positions from DataForSEO Labs (organic keywords you and each competitor both rank for). &ldquo;–&rdquo; = not among the keywords you share with that site.</p>
    </OverviewCard>
  )
}

/** "Suggested competitors": sites that rank for the same keywords as you (the discovery list), minus the ones you already added. */
export function Suggested({ rows, status, onAdd, adding, onSeeAll }) {
  if (status === "error" || (status === "success" && rows.length === 0)) return null
  return (
    <section className="space-y-3" aria-labelledby="sg-title" data-testid="sg-section">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="sg-title" className="text-lg font-semibold tracking-tight">Suggested competitors</h2>
          <p className="text-xs text-muted-foreground">Sites that rank for the same keywords as you</p>
        </div>
        <button type="button" onClick={onSeeAll} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400" data-testid="yc-find">See all sites</button>
      </div>
      {status === "loading" ? (
        <div className="grid gap-3 @min-[800px]/main:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}</div>
      ) : (
        <div className="grid gap-3 @min-[800px]/main:grid-cols-2">
          {rows.map((r) => (
            <div key={r.domain} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" data-testid="sg-row">
              <Avatar letter={initial(r.domain)} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.domain}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[r.theirTotalTraffic !== null ? `${formatCompact(r.theirTotalTraffic)} traffic a month` : null, r.sharedKeywords !== null ? `${formatExact(r.sharedKeywords)} shared keywords` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Button type="button" size="sm" onClick={() => onAdd(r)} disabled={adding.has(r.domain)} className={NAVY} aria-label={`Add ${r.domain}`} data-testid="sg-add">
                <Plus className="size-3.5" aria-hidden />Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Remove confirmation, shared by the grid's Remove links. */
export function RemoveDialog({ target, onCancel, onConfirm }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove {target?.name}?</DialogTitle>
          <DialogDescription>It will no longer be compared with you. You can add it again later.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Keep competitor</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} data-testid="sb-remove-confirm">Remove competitor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

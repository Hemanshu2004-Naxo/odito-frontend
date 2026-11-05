"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProject } from "@/contexts/ProjectContext"
import { useMyCompetitors } from "@/hooks/useMyCompetitors"
import { useOwnSeoMetrics } from "@/hooks/useOwnSeoMetrics"
import { useCompetitors } from "@/hooks/useCompetitors"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import CompetitorsDashboard from "./CompetitorsDashboard"
import LocalCompetitorsTab from "./LocalCompetitorsTab"
import MyCompetitorsTab, { CompetitorFormDialog, EMPTY } from "./MyCompetitorsTab"
import { HeadToHead, RemoveDialog, SideBySide, Suggested } from "./SeoCompetitorsView"
import { buildSideBySide, buildStats, formatGap } from "./sideBySide"

const TABS = [
  { value: "seo", label: "SEO competitors" },
  { value: "local", label: "Local competitors" },
  { value: "mine", label: "Manage list" },
]
const SUGGESTED = 4

/**
 * The Competitors page. Above the tabs: the add button and four stat cards about the competitors you added. Tabs:
 *   SEO competitors    your competitors side by side with you, head to head on the keywords you share, and suggestions to add; "See all
 *                      sites" opens the full discovery list (every site that ranks for the same searches)
 *   Local competitors  real businesses near yours, from Google (searched only when you press Search)
 *   Manage list        the competitors you chose: edit, notes, relevance, refresh
 */
export default function CompetitorsTabs() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its competitors.</div>
  }
  return <ProjectCompetitors key={projectId} projectId={projectId} project={activeProject} />
}

function ProjectCompetitors({ projectId, project }) {
  const [tab, setTab] = useState("seo")
  const [seoView, setSeoView] = useState("yours") // "yours" | "discover"
  const [form, setForm] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [adding, setAdding] = useState(() => new Set())
  const { toasts, notify, dismiss } = useToastQueue()

  const own = useOwnSeoMetrics(projectId)
  const mc = useMyCompetitors(projectId)
  const projectDomain = domainFromUrl(project?.main_url)
  const discovery = useCompetitors(projectId, { projectDomain })

  const grid = useMemo(() => buildSideBySide(own.metrics, mc.competitors ?? []), [own.metrics, mc.competitors])
  const stats = buildStats(grid.sites)
  const count = (mc.competitors ?? []).length
  const limit = mc.limit ?? 100
  const marketLabel = own.market ? `Google ${own.market.location}` : null
  const lastMonth = latestMonth(mc.competitors)
  const mine = new Set((mc.competitors ?? []).map((c) => c.domain).filter(Boolean))
  const suggestions = discovery.page.rows.filter((r) => r.domain && !mine.has(r.domain) && r.domain !== projectDomain).slice(0, SUGGESTED)
  const noSite = (mc.competitors ?? []).filter((c) => !c.domain)

  const openAdd = () => setForm({ id: null, values: EMPTY })
  const addSuggested = async (row) => {
    setAdding((s) => new Set(s).add(row.domain))
    const res = await mc.addDiscovered({ source: "seo", domain: row.domain, name: row.domain })
    setAdding((s) => { const n = new Set(s); n.delete(row.domain); return n })
    notify(res.ok ? `${row.domain} added. Its SEO numbers appear when they are ready.` : res.message, res.ok ? "success" : "danger")
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 @min-[700px]/main:flex-row @min-[700px]/main:items-end @min-[700px]/main:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/app/dashboard" className="hover:text-foreground hover:underline underline-offset-2">Dashboard</Link></li>
              <li aria-hidden>/</li><li>SEO</li><li aria-hidden>/</li><li aria-current="page">Rankings &amp; traffic</li>
            </ol>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Competitors</h1>
        </div>
        <Button type="button" onClick={openAdd} disabled={mc.status !== "success" || count >= limit} className="bg-emerald-400 font-semibold text-[#0d1a3a] hover:bg-emerald-300" data-testid="cp-add">
          <Plus className="size-4" aria-hidden />Add competitor
        </Button>
      </div>

      <StatCards status={mc.status} stats={stats} limit={limit} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Competitor views">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn("rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === t.value ? "border-[#0d1a3a] bg-[#0d1a3a] text-white dark:border-indigo-500 dark:bg-indigo-500" : "border-border/70 bg-card hover:bg-muted")}
              data-testid={`cp-tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "seo" && seoView === "yours" ? (
          <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Colour key">
            <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-600" aria-hidden />Best in row</li>
            <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#0d1a3a] dark:bg-indigo-400" aria-hidden />You</li>
            <li className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />Others</li>
          </ul>
        ) : null}
      </div>

      <div role="tabpanel">
        {tab === "seo" ? (
          seoView === "discover" ? (
            <div className="space-y-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSeoView("yours")} data-testid="yc-back">&larr; Back to your competitors</Button>
              <CompetitorsDashboard />
            </div>
          ) : mc.status === "loading" ? (
            <div className="space-y-3" aria-busy data-testid="yc-loading">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : mc.status === "error" ? (
            <div role="alert" className="space-y-2 rounded-xl border p-5" data-testid="yc-error">
              <p className="font-medium">Your competitors could not be loaded.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => mc.refetch?.()}>Try again</Button>
            </div>
          ) : (
            <div className="space-y-5" data-testid="yc-root">
              {grid.sites.length > 1 ? (
                <>
                  <SideBySide
                    grid={grid}
                    ownStatus={own.status}
                    projectInitial={(project?.name ?? projectDomain ?? "Y").trim()[0].toUpperCase()}
                    projectDomain={projectDomain}
                    marketLabel={[marketLabel, lastMonth].filter(Boolean).join(" · ") || null}
                    onRemove={setRemoving}
                  />
                  <HeadToHead projectId={projectId} sites={grid.sites} marketLabel={own.market?.location ?? null} />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center" data-testid="yc-empty">
                  <p className="font-medium">You have not added any competitors {count ? "with a website " : ""}yet</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add the businesses you compete with and this page will show who is ahead of you and who is behind, on traffic, keywords and links.</p>
                  <Button type="button" className="mt-4" onClick={openAdd}><Plus className="size-4" aria-hidden />Add competitor</Button>
                </div>
              )}
              {noSite.length ? (
                <p className="text-xs text-muted-foreground" data-testid="yc-nosite">
                  {noSite.length} competitor{noSite.length === 1 ? " has" : "s have"} no website saved, so {noSite.length === 1 ? "it cannot" : "they cannot"} be compared ({noSite.map((c) => c.name).join(", ")}). Add a website in{" "}
                  <button type="button" onClick={() => setTab("mine")} className="underline underline-offset-2">Manage list</button>.
                </p>
              ) : null}
              <Suggested rows={suggestions} status={discovery.page.status} onAdd={addSuggested} adding={adding} onSeeAll={() => setSeoView("discover")} />
            </div>
          )
        ) : tab === "local" ? <LocalCompetitorsTab /> : <MyCompetitorsTab />}
      </div>

      <CompetitorFormDialog
        key={form ? "open" : "closed"}
        form={form}
        onClose={() => setForm(null)}
        onSave={async (_id, values) => {
          const res = await mc.add(values)
          if (res.ok) notify("Competitor added. Its SEO numbers appear when they are ready.", "success")
          return res
        }}
      />
      <RemoveDialog
        target={removing}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing
          setRemoving(null)
          const res = await mc.remove(target.id)
          notify(res.ok ? `${target.name} removed.` : res.message, res.ok ? "success" : "danger")
        }}
      />
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

/** "Oct 2026": the month of the newest successful update among your competitors. */
function latestMonth(competitors) {
  const times = (competitors ?? []).map((c) => Date.parse(c.enrichment?.lastSuccessAt ?? "")).filter(Number.isFinite)
  if (!times.length) return null
  return new Date(Math.max(...times)).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function StatCards({ status, stats, limit }) {
  const cards = [
    { key: "tracked", label: "Competitors tracked", value: formatExact(stats.tracked), note: `You can track up to ${formatExact(limit)}`, edge: "bg-[#0d1a3a] dark:bg-indigo-400" },
    { key: "ahead", label: "Ahead of you", value: formatExact(stats.ahead.count), note: stats.ahead.names.join(", ") || "Nobody is ahead of you", edge: "bg-red-500" },
    { key: "behind", label: "Behind you", value: formatExact(stats.behind.count), note: stats.behind.names.join(", ") || "Nobody is behind you yet", edge: "bg-emerald-600" },
    { key: "closest", label: "Closest to beat", value: stats.closest ? formatGap(stats.closest.gap) : "—", note: stats.closest ? `More visits a month to pass ${stats.closest.name}` : "No competitor is ahead of you on traffic", edge: "bg-indigo-500" },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 @min-[560px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-4" data-testid="cp-stats">
      {cards.map((c) => (
        <div key={c.key} className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card py-4 pl-5 pr-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" data-testid={`cp-stat-${c.key}`}>
          <span className={cn("absolute inset-y-0 left-0 w-1", c.edge)} aria-hidden />
          <div className="text-[13px] font-medium text-foreground/80">{c.label}</div>
          {status === "loading" ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="mt-1.5 text-[30px] font-semibold leading-none tracking-tight tabular-nums">{c.value}</div>}
          <div className="mt-2 truncate text-xs text-muted-foreground" title={c.note}>{status === "loading" ? "" : c.note}</div>
        </div>
      ))}
    </div>
  )
}

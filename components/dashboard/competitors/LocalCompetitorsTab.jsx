"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, MapPin, Plus, Search, X } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { useLocalCompetitors } from "@/hooks/useLocalCompetitors"
import { useMyCompetitors } from "@/hooks/useMyCompetitors"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SectionError, Skel } from "../domain-overview/SectionState"
import { formatExact } from "../domain-overview/format"
import LocalMap from "./LocalMap"
import LocalResultList, { LocalDetails } from "./LocalResultList"
import { DEFAULT_RADIUS_KM, FILTERS, SORTS, applyLocalFilters, describeLocalError, sortLocal, warningText } from "./localUi"

const RATING_STEPS = [0, 3.5, 4, 4.5]
const REVIEW_STEPS = [0, 10, 50, 100]

const Select = ({ label, value, onChange, children, testId }) => (
  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId}>{children}</select>
  </label>
)

/**
 * Local Competitors: real businesses around YOUR business, from Google. Nothing is searched when the tab opens: a search is one button
 * press (it uses a few billed Google requests, capped per project per day). Results live in this page's memory only; adding one to My
 * competitors saves the business (its Google place and website), never Google's rating or reviews.
 */
export default function LocalCompetitorsTab() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to find nearby competitors.</div>
  return <ProjectLocal key={projectId} projectId={projectId} />
}

function ProjectLocal({ projectId }) {
  const lc = useLocalCompetitors(projectId)
  const mine = useMyCompetitors(projectId)
  const { toasts, notify, dismiss } = useToastQueue()
  const [radius, setRadius] = useState(null)
  const [queries, setQueries] = useState(null) // null = the suggestion; an array once the user edits it
  const [draft, setDraft] = useState("")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState("distance")
  const [minRating, setMinRating] = useState(0)
  const [minReviews, setMinReviews] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [addPending, setAddPending] = useState(() => new Set())
  const queryInput = useRef(null)

  const o = lc.options
  const effectiveRadius = radius ?? o?.defaultRadiusKm ?? DEFAULT_RADIUS_KM
  const shownQueries = queries ?? o?.categories?.queries ?? []
  const result = lc.result

  // A new result clears the selection if that business is no longer in it.
  useEffect(() => { if (selectedId && result && !result.results.some((r) => r.placeId === selectedId)) setSelectedId(null) }, [result, selectedId])

  const rows = useMemo(() => (result ? sortLocal(applyLocalFilters(result.results, { filter, minRating, minReviews }), sort) : []), [result, filter, minRating, minReviews, sort])
  const selected = result?.results.find((r) => r.placeId === selectedId) ?? null

  const run = async (extra = {}) => {
    const res = await lc.search({ radiusKm: effectiveRadius, ...(queries ? { queries } : {}), ...extra })
    if (res.ok) setSelectedId(null)
  }
  const addQuery = () => {
    const v = draft.trim()
    if (v.length < 3 || shownQueries.some((q) => q.toLowerCase() === v.toLowerCase()) || shownQueries.length >= 3) return
    setQueries([...shownQueries, v]); setDraft("")
  }
  const addToMine = async (r) => {
    setAddPending((s) => new Set(s).add(r.placeId))
    const res = await mine.addDiscovered({ source: "local", name: r.name, domain: r.websiteDomain ?? undefined, address: r.address ?? undefined, placeId: r.placeId, lat: r.lat ?? undefined, lng: r.lng ?? undefined })
    setAddPending((s) => { const n = new Set(s); n.delete(r.placeId); return n })
    if (!res.ok) { notify(res.message, "danger"); return }
    lc.markAdded(r.placeId, res.competitor.id)
    notify(res.created ? `${r.name} added to My competitors.${r.websiteDomain ? " Its SEO metrics are being fetched." : " It has no website, so there are no SEO metrics to fetch."}` : `${r.name} was already in My competitors, so that record was updated instead of duplicated.`, "success")
  }

  const err = lc.error ? describeLocalError(lc.error) : null
  const stale = result && result.radiusKm !== effectiveRadius

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">Local competitors</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Real businesses near yours that do what you do. Searched on Google, around your business location, only when you press Search.</p>
      </div>

      {lc.optionsStatus === "loading" ? <Skel className="h-28 w-full rounded-xl" />
        : lc.optionsStatus === "error" ? <SectionError message={lc.optionsError?.message} onRetry={lc.refetchOptions} />
          : (
            <section className="space-y-4 rounded-xl border border-border/60 bg-card p-4" aria-label="Search settings" data-testid="local-controls">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground" id="local-radius-label">Search radius</p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="local-radius-label">
                    {o.radiiKm.map((km) => (
                      <button key={km} type="button" role="radio" aria-checked={effectiveRadius === km} onClick={() => setRadius(km)} data-testid={`local-radius-${km}`}
                        className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", effectiveRadius === km ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted")}>
                        {km} km
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="button" onClick={() => run()} disabled={lc.searching || o.enabled === false} data-testid="local-search">
                  {lc.searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />} {result ? "Search again" : "Search nearby"}
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">What to look for</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {shownQueries.map((q) => (
                    <span key={q} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs" data-testid="local-query">
                      {q}
                      <button type="button" aria-label={`Remove ${q}`} onClick={() => setQueries(shownQueries.filter((x) => x !== q))} className="grid size-5 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" aria-hidden /></button>
                    </span>
                  ))}
                  {shownQueries.length < 3 ? (
                    <form onSubmit={(e) => { e.preventDefault(); addQuery() }} className="flex items-center gap-1">
                      <Input ref={queryInput} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a category" aria-label="Add a category to search for" className="h-7 w-40 text-xs" maxLength={60} data-testid="local-query-input" />
                      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" disabled={draft.trim().length < 3} aria-label="Add category"><Plus className="size-3.5" aria-hidden /></Button>
                    </form>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.categories.specificity === "specific" ? "Taken from what your project says it is." : o.categories.specificity === "broad" ? "Odito only knows your general industry, so the search is broad. Add a category for a sharper list." : "Odito could not tell what kind of business this is. Add a category to search for."}
                  {o.categories.types.length ? ` Google categories also searched: ${o.categories.types.join(", ")}.` : ""}
                </p>
              </div>

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{o.center ? "Around your verified business location" : "No saved business location yet"}</span>
                <span>Each search uses 1–4 Google requests; each project has {o.dailyLimit} a day.</span>
              </p>
            </section>
          )}

      {err ? (
        <div role="alert" className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-700/50 dark:bg-amber-900/20" data-testid="local-error" data-code={lc.error.code ?? ""}>
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" aria-hidden />{err.title}</p>
          <p className="text-muted-foreground">{err.text}{lc.error.address ? ` (${lc.error.address})` : ""}</p>
          {err.action === "settings" || err.action === "confirm" ? <Button asChild size="sm" variant={err.action === "settings" ? "default" : "outline"}><Link href="/app/settings" data-testid="local-open-settings">{err.action === "settings" ? "Add business location" : "Confirm it in project settings"}</Link></Button> : null}
          {err.action === "confirm" ?<Button type="button" size="sm" onClick={() => run({ geocode: true })} disabled={lc.searching} data-testid="local-confirm-address">Look up my address and search</Button> : null}
          {err.action === "category" ? <Button type="button" size="sm" variant="outline" onClick={() => queryInput.current?.focus()}>Enter a category</Button> : null}
          {err.action === "retry" ? <Button type="button" size="sm" variant="outline" onClick={() => run()} disabled={lc.searching}>Try again</Button> : null}
        </div>
      ) : null}

      {lc.searching && !result ? <div className="space-y-2" aria-busy data-testid="local-loading">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-16 w-full rounded-xl" />)}</div> : null}

      {!result && !lc.searching && !err && lc.optionsStatus === "success" ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground" data-testid="local-prompt">
          Choose a radius and press <strong>Search nearby</strong> to see the businesses around you. The default is {DEFAULT_RADIUS_KM} km.
        </div>
      ) : null}

      {result ? (
        <div className={cn("space-y-4 transition-opacity", lc.searching && "opacity-60")} aria-busy={lc.searching}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" role="status" data-testid="local-summary">
              <strong className="tabular-nums">{formatExact(rows.length)}</strong> of {formatExact(result.results.length)} businesses within <strong>{result.radiusKm} km</strong>
              <span className="text-muted-foreground">{result.center.source === "address_geocoded" ? " of your business address" : " of your verified business location"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select label="Sort" value={sort} onChange={setSort} testId="local-sort">{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
              <Select label="Min. rating" value={minRating} onChange={(v) => setMinRating(Number(v))} testId="local-min-rating">{RATING_STEPS.map((v) => <option key={v} value={v}>{v === 0 ? "Any" : `${v}+`}</option>)}</Select>
              <Select label="Min. reviews" value={minReviews} onChange={(v) => setMinReviews(Number(v))} testId="local-min-reviews">{REVIEW_STEPS.map((v) => <option key={v} value={v}>{v === 0 ? "Any" : `${v}+`}</option>)}</Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter results">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} data-testid={`local-filter-${f.key}`}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted")}>
                {f.label}
              </button>
            ))}
          </div>

          {stale ? <p className="text-xs text-amber-700 dark:text-amber-300" role="status" data-testid="local-stale">These results are for {result.radiusKm} km. Press Search again to search {effectiveRadius} km.</p> : null}
          {result.meta.warnings.map((w) => (warningText(w) ? <p key={w} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="local-warning" data-code={w}>{warningText(w)}</p> : null))}

          {result.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground" data-testid="local-empty">
              No matching businesses were found within {result.radiusKm} km. Try a larger radius or a different category.
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="local-no-match">
              None of the {formatExact(result.results.length)} businesses match these filters.
              <div className="mt-2"><Button type="button" size="sm" variant="outline" onClick={() => { setFilter("all"); setMinRating(0); setMinReviews(0) }}>Clear filters</Button></div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
              <div className="order-2 min-w-0 lg:order-1"><LocalResultList results={rows} selectedId={selectedId} onSelect={setSelectedId} addPending={addPending} onAdd={addToMine} /></div>
              <div className="order-1 space-y-4 lg:order-2">
                <LocalMap center={result.center} radiusKm={result.radiusKm} results={rows} selectedId={selectedId} onSelect={setSelectedId} />
                <LocalDetails r={selected} pending={selected ? addPending.has(selected.placeId) : false} onAdd={addToMine} />
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground" data-testid="local-attribution">Business information from Google Maps. It is shown here from your search and is not saved by Odito, except the Google place and website of a business you add to My competitors.</p>
        </div>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

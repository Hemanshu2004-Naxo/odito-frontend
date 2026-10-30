"use client"

import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { NumberInput, TextFilter, useDraft } from "../organic-keywords/FilterBar"
import { QUALITY, QUALITY_FILTER_HINT, QUALITY_KEYS } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (search, exclude): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - number and date fields: only on leaving the field or Enter — "1", "10", "100" never become three requests;
 *  - the switches: at once (one click is one decision).
 * "Dofollow links only" is not a filter: the provider then counts each domain's links using dofollow links only.
 * The QUALITY chips are different on purpose: the provider does not know our tiers, so they narrow only the rows already on the page.
 * On the Disavowed tab only the search applies (it searches your own list). Wide screens show the controls inline; a compact screen gets the
 * same controls in a "Filters" drawer.
 */

function Field({ label, error, children, htmlFor }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}

function DateFilter({ value, onCommit, error }) {
  const props = useDraft(value, onCommit)
  return <Input id="rd-since" type="date" aria-invalid={error ? true : undefined} className="h-9" data-testid="rd-since" {...props} />
}

function QualityChips({ selected, onToggle }) {
  return (
    <div className="min-w-0 @min-[900px]/main:col-span-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id="rd-quality-label">Quality</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="rd-quality-label" data-testid="rd-filter-quality">
        {QUALITY_KEYS.map((key) => {
          const t = QUALITY[key]
          const active = selected.includes(key)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              title={t.description}
              onClick={() => onToggle(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: t.dot }} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="rd-quality-hint">{QUALITY_FILTER_HINT}</p>
    </div>
  )
}

function Controls({ state, update, built, disavowedTab }) {
  const toggleQuality = (key) => update({ quality: state.quality.includes(key) ? state.quality.filter((k) => k !== key) : [...state.quality, key], page: state.page }) // client-side: the page stays
  if (disavowedTab) {
    return (
      <div className="space-y-2">
        <div className="max-w-md"><TextFilter id="rd-q" label="Search your disavow list" placeholder="e.g. spam" value={state.q} onCommit={(q) => update({ q })} icon /></div>
        <p className="text-xs text-muted-foreground" data-testid="rd-disavow-filter-note">These are the domains you marked to disavow. The other filters and sorting do not apply here: your saved list decides which rows appear.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 @min-[640px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-3">
      <TextFilter id="rd-q" label="Search domain" placeholder="e.g. news" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="rd-exclude" label="Exclude domains containing" placeholder="e.g. blogspot" value={state.exclude} onCommit={(exclude) => update({ exclude })} />
      <Field label="Min. rank" htmlFor="rd-rmin" error={built.errors.minRank}>
        <NumberInput id="rd-rmin" label="Minimum rank" placeholder="0–1000" value={state.minRank} onCommit={(minRank) => update({ minRank })} invalid={Boolean(built.errors.minRank)} />
      </Field>
      <Field label="Max. rank" htmlFor="rd-rmax" error={built.errors.maxRank}>
        <NumberInput id="rd-rmax" label="Maximum rank" placeholder="0–1000" value={state.maxRank} onCommit={(maxRank) => update({ maxRank })} invalid={Boolean(built.errors.maxRank)} />
      </Field>
      <Field label="Max. spam score" htmlFor="rd-spam" error={built.errors.maxSpam}>
        <NumberInput id="rd-spam" label="Maximum spam score" placeholder="0–100" value={state.maxSpam} onCommit={(maxSpam) => update({ maxSpam })} invalid={Boolean(built.errors.maxSpam)} />
      </Field>
      <Field label="Min. backlinks" htmlFor="rd-bl" error={built.errors.minBacklinks}>
        <NumberInput id="rd-bl" label="Minimum backlinks" placeholder="e.g. 10" value={state.minBacklinks} onCommit={(minBacklinks) => update({ minBacklinks })} invalid={Boolean(built.errors.minBacklinks)} />
      </Field>
      <Field label="First seen after" htmlFor="rd-since" error={built.errors.since}>
        <DateFilter value={state.since} onCommit={(since) => update({ since })} error={built.errors.since} />
      </Field>
      <div className="flex items-center gap-2.5 self-end pb-1.5" data-testid="rd-has-broken-row">
        <Switch id="rd-has-broken" checked={state.hasBroken} onCheckedChange={(hasBroken) => update({ hasBroken })} data-testid="rd-has-broken" />
        <label htmlFor="rd-has-broken" className="text-sm font-medium">Has broken links</label>
      </div>
      <div className="flex items-center gap-2.5 self-end pb-1.5" data-testid="rd-dofollow-row">
        <Switch id="rd-dofollow" checked={state.dofollow} onCheckedChange={(dofollow) => update({ dofollow })} data-testid="rd-dofollow-only" />
        <label htmlFor="rd-dofollow" className="text-sm font-medium" title="The provider recounts each domain's links using dofollow links only">Dofollow links only</label>
      </div>
      <QualityChips selected={state.quality} onToggle={toggleQuality} />
    </div>
  )
}

function TooMany({ built }) {
  if (!built.tooMany) return null
  return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="rd-too-many">{built.message}</p>
}

export default function FilterBar({ state, update, built, activeCount, onClearAll }) {
  const compact = useIsCompactNav()
  const disavowedTab = state.tab === "disavowed"
  if (compact) {
    return (
      <div className="space-y-3" data-testid="rd-filter-bar">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="rd-filters-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the referring domains. Changes apply as you finish typing.</SheetDescription>
            </SheetHeader>
            <div className="px-4 py-2"><Controls state={state} update={update} built={built} disavowedTab={disavowedTab} /></div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={onClearAll} disabled={!activeCount}>Clear all</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <TooMany built={built} />
      </div>
    )
  }
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4" data-testid="rd-filter-bar">
      <Controls state={state} update={update} built={built} disavowedTab={disavowedTab} />
      <TooMany built={built} />
    </div>
  )
}

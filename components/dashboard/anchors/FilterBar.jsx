"use client"

import { SlidersHorizontal } from "lucide-react"
import { ANCHOR_TYPES, TYPE_KEYS } from "@/lib/anchors/anchorConfig"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { NumberInput, TextFilter, useDraft } from "../organic-keywords/FilterBar"
import { TYPE_FILTER_HINT } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (search, exclude): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - number and date fields: only on leaving the field or Enter — "1", "10", "100" never become three requests;
 *  - the broken-links switch: at once (one click is one decision).
 * The ANCHOR TYPE chips are different on purpose: the provider does not know our types, so they narrow only the rows already on the page.
 * Wide screens show the controls inline; a compact screen gets the same controls in a "Filters" drawer.
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
  return <Input id="an-since" type="date" aria-invalid={error ? true : undefined} className="h-9" data-testid="an-since" {...props} />
}

function TypeChips({ selected, onToggle }) {
  return (
    <div className="min-w-0 @min-[900px]/main:col-span-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id="an-types-label">Anchor type</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="an-types-label" data-testid="an-filter-types">
        {TYPE_KEYS.map((key) => {
          const t = ANCHOR_TYPES[key]
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
              <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="an-types-hint">{TYPE_FILTER_HINT}</p>
    </div>
  )
}

function Controls({ state, update, built }) {
  const toggleType = (key) => update({ types: state.types.includes(key) ? state.types.filter((k) => k !== key) : [...state.types, key], page: state.page }) // client-side: the page stays
  return (
    <div className="grid grid-cols-1 gap-4 @min-[640px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-3">
      <TextFilter id="an-q" label="Search anchors" placeholder="e.g. lasik" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="an-exclude" label="Exclude anchors containing" placeholder="e.g. click here" value={state.exclude} onCommit={(exclude) => update({ exclude })} />
      <Field label="Min. referring domains" htmlFor="an-rd" error={built.errors.minReferringDomains}>
        <NumberInput id="an-rd" label="Minimum referring domains" placeholder="e.g. 5" value={state.minReferringDomains} onCommit={(minReferringDomains) => update({ minReferringDomains })} invalid={Boolean(built.errors.minReferringDomains)} />
      </Field>
      <Field label="Min. backlinks" htmlFor="an-bl" error={built.errors.minBacklinks}>
        <NumberInput id="an-bl" label="Minimum backlinks" placeholder="e.g. 10" value={state.minBacklinks} onCommit={(minBacklinks) => update({ minBacklinks })} invalid={Boolean(built.errors.minBacklinks)} />
      </Field>
      <Field label="Max. spam score" htmlFor="an-spam" error={built.errors.maxSpam}>
        <NumberInput id="an-spam" label="Maximum spam score" placeholder="0–100" value={state.maxSpam} onCommit={(maxSpam) => update({ maxSpam })} invalid={Boolean(built.errors.maxSpam)} />
      </Field>
      <Field label="First seen after" htmlFor="an-since" error={built.errors.since}>
        <DateFilter value={state.since} onCommit={(since) => update({ since })} error={built.errors.since} />
      </Field>
      <div className="flex items-center gap-2.5 self-end pb-1.5" data-testid="an-has-broken-row">
        <Switch id="an-has-broken" checked={state.hasBroken} onCheckedChange={(hasBroken) => update({ hasBroken })} data-testid="an-has-broken" />
        <label htmlFor="an-has-broken" className="text-sm font-medium">Has broken links</label>
      </div>
      <TypeChips selected={state.types} onToggle={toggleType} />
    </div>
  )
}

function TooMany({ built }) {
  if (!built.tooMany) return null
  return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="an-too-many">{built.message}</p>
}

export default function FilterBar({ state, update, built, activeCount, onClearAll }) {
  const compact = useIsCompactNav()
  if (compact) {
    return (
      <div className="space-y-3" data-testid="an-filter-bar">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="an-filters-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the anchors. Changes apply as you finish typing.</SheetDescription>
            </SheetHeader>
            <div className="px-4 py-2"><Controls state={state} update={update} built={built} /></div>
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
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4" data-testid="an-filter-bar">
      <Controls state={state} update={update} built={built} />
      <TooMany built={built} />
    </div>
  )
}

"use client"

import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { NumberInput, TextFilter, useDraft } from "../organic-keywords/FilterBar"
import { FLAGS, FLAG_FILTER_HINT, FLAG_IDS, FLAG_TONE } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (URL contains, exclude): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - number and date fields: only on leaving the field or Enter — "1", "10", "100" never become three requests;
 *  - the switch: at once (one click is one decision).
 * The OPPORTUNITY FLAG chips are different on purpose: the provider does not know our flags, so they narrow only the rows already on the page.
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
  return <Input id="tp-since" type="date" aria-invalid={error ? true : undefined} className="h-9" data-testid="tp-since" {...props} />
}

function FlagChips({ selected, onToggle }) {
  return (
    <div className="min-w-0 @min-[900px]/main:col-span-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id="tp-flags-label">Opportunity flags</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="tp-flags-label" data-testid="tp-filter-flags">
        {FLAG_IDS.map((id) => {
          const f = FLAGS[id]
          const active = selected.includes(id)
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              title={f.message}
              onClick={() => onToggle(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", FLAG_TONE[f.tone])} aria-hidden />
              {f.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="tp-flags-hint">{FLAG_FILTER_HINT}</p>
    </div>
  )
}

function Controls({ state, update, built }) {
  const toggleFlag = (id) => update({ flags: state.flags.includes(id) ? state.flags.filter((f) => f !== id) : [...state.flags, id], page: state.page }) // client-side: the page stays
  return (
    <div className="grid grid-cols-1 gap-4 @min-[640px]/main:grid-cols-2 @min-[1100px]/main:grid-cols-3">
      <TextFilter id="tp-q" label="URL contains" placeholder="e.g. /specialities/" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="tp-exclude" label="Exclude URL containing" placeholder="e.g. /blog/" value={state.exclude} onCommit={(exclude) => update({ exclude })} />
      <Field label="Min. referring domains" htmlFor="tp-rd" error={built.errors.minReferringDomains}>
        <NumberInput id="tp-rd" label="Minimum referring domains" placeholder="e.g. 5" value={state.minReferringDomains} onCommit={(minReferringDomains) => update({ minReferringDomains })} invalid={Boolean(built.errors.minReferringDomains)} />
      </Field>
      <Field label="Min. backlinks" htmlFor="tp-bl" error={built.errors.minBacklinks}>
        <NumberInput id="tp-bl" label="Minimum backlinks" placeholder="1 or more" value={state.minBacklinks} onCommit={(minBacklinks) => update({ minBacklinks })} invalid={Boolean(built.errors.minBacklinks)} />
      </Field>
      <Field label="First seen after" htmlFor="tp-since" error={built.errors.since}>
        <DateFilter value={state.since} onCommit={(since) => update({ since })} error={built.errors.since} />
      </Field>
      <div className="flex items-center gap-2.5 self-end pb-1.5" data-testid="tp-has-broken-row">
        <Switch id="tp-has-broken" checked={state.hasBroken} onCheckedChange={(hasBroken) => update({ hasBroken })} data-testid="tp-has-broken" />
        <label htmlFor="tp-has-broken" className="text-sm font-medium">Has broken backlinks</label>
      </div>
      <FlagChips selected={state.flags} onToggle={toggleFlag} />
    </div>
  )
}

function TooMany({ built }) {
  if (!built.tooMany) return null
  return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="tp-too-many">{built.message}</p>
}

export default function FilterBar({ state, update, built, activeCount, onClearAll }) {
  const compact = useIsCompactNav()
  if (compact) {
    return (
      <div className="space-y-3" data-testid="tp-filter-bar">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="tp-filters-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the pages. Changes apply as you finish typing.</SheetDescription>
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
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4" data-testid="tp-filter-bar">
      <Controls state={state} update={update} built={built} />
      <TooMany built={built} />
    </div>
  )
}

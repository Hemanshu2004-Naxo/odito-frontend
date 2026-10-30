"use client"

import { useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { BRAND_OPTIONS, INTENTS, MAX_TEXT_LENGTH, MOVEMENT_OPTIONS, POSITION_OPTIONS, SEARCH_DEBOUNCE_MS } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (search, exclude, URL): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - range fields (volume, KD): only on leaving the field or Enter — "1", "10", "100" never become three requests;
 *  - chips and intent pills: at once (one click is one decision).
 * Wide screens show the controls inline; on a compact screen they live in a "Filters" drawer (same controls, same behaviour).
 */

export function useDraft(value, commit, debounceMs = 0) {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const latest = useRef(value)
  const timer = useRef(null)
  latest.current = value
  // The committed value changed from outside (Clear all, a removed chip): the field follows it.
  if (seen.current !== value) { seen.current = value; setDraft(value) }
  useEffect(() => () => clearTimeout(timer.current), [])

  const flush = (v) => {
    clearTimeout(timer.current)
    if (v !== latest.current) commit(v)
  }
  return {
    value: draft,
    onChange: (e) => {
      const v = e.target.value
      setDraft(v)
      if (debounceMs) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => { if (v !== latest.current) commit(v) }, debounceMs)
      }
    },
    onBlur: () => flush(draft),
    onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); flush(draft) } },
  }
}

export function TextFilter({ id, label, placeholder, value, onCommit, icon }) {
  const props = useDraft(value, onCommit, SEARCH_DEBOUNCE_MS)
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        {icon ? <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /> : null}
        <Input id={id} type="text" placeholder={placeholder} maxLength={MAX_TEXT_LENGTH} autoComplete="off" className={cn("h-9", icon && "pl-8")} {...props} />
      </div>
    </div>
  )
}

export function NumberInput({ id, label, placeholder, value, onCommit, invalid }) {
  const props = useDraft(value, onCommit)
  return <Input id={id} aria-label={label} placeholder={placeholder} inputMode="numeric" autoComplete="off" maxLength={11} aria-invalid={invalid || undefined} className="h-9 min-w-0" {...props} />
}

function RangeFilter({ idPrefix, label, minValue, maxValue, onMin, onMax, error }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <NumberInput id={`${idPrefix}-min`} label={`Minimum ${label}`} placeholder="Min" value={minValue} onCommit={onMin} invalid={Boolean(error)} />
        <span className="text-muted-foreground" aria-hidden>–</span>
        <NumberInput id={`${idPrefix}-max`} label={`Maximum ${label}`} placeholder="Max" value={maxValue} onCommit={onMax} invalid={Boolean(error)} />
      </div>
      {error ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}

export function Chips({ label, options, value, onSelect, testId }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id={`${testId}-label`}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${testId}-label`} data-testid={testId}>
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(o.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function IntentPills({ selected, onToggle }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id="ok-intent-label">Intent</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="ok-intent-label" data-testid="ok-filter-intent">
        {INTENTS.map((i) => {
          const active = selected.includes(i.value)
          return (
            <button
              key={i.value}
              type="button"
              aria-pressed={active}
              title={i.hint}
              onClick={() => onToggle(i.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted",
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded text-[11px] font-semibold", active ? "bg-background/20" : "bg-muted")} aria-hidden>{i.letter}</span>
              {i.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilterFields({ state, update, errors, className, hasBrandTerms = false }) {
  const toggleIntent = (value) => update({ intents: state.intents.includes(value) ? state.intents.filter((v) => v !== value) : [...state.intents, value] })
  return (
    <div className={cn("grid gap-4", className)}>
      <TextFilter id="ok-q" label="Search keywords" placeholder="e.g. cataract surgery" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="ok-exclude" label="Exclude keywords containing" placeholder="e.g. cost" value={state.exclude} onCommit={(exclude) => update({ exclude })} />
      <TextFilter id="ok-url" label="Ranking URL contains" placeholder="e.g. /blog/" value={state.url} onCommit={(url) => update({ url })} />
      <Chips label="Position" options={POSITION_OPTIONS} value={state.position} onSelect={(position) => update({ position })} testId="ok-filter-position" />
      <Chips label="Movement" options={MOVEMENT_OPTIONS} value={state.movement} onSelect={(movement) => update({ movement })} testId="ok-filter-movement" />
      {hasBrandTerms ? <Chips label="Brand" options={BRAND_OPTIONS} value={state.brand} onSelect={(brand) => update({ brand })} testId="ok-filter-brand" /> : null}
      <IntentPills selected={state.intents} onToggle={toggleIntent} />
      <RangeFilter idPrefix="ok-vol" label="Volume" minValue={state.volMin} maxValue={state.volMax} onMin={(volMin) => update({ volMin })} onMax={(volMax) => update({ volMax })} error={errors.volume} />
      <RangeFilter idPrefix="ok-kd" label="KD" minValue={state.kdMin} maxValue={state.kdMax} onMin={(kdMin) => update({ kdMin })} onMax={(kdMax) => update({ kdMax })} error={errors.difficulty} />
    </div>
  )
}

/**
 * @param {{ state: import("./types").PageState, update: (patch: object) => void, built: ReturnType<typeof import("./buildKeywordFilters").buildKeywordFilters>,
 *   activeCount: number, onClearAll: () => void }} props
 */
export default function FilterBar({ state, update, built, activeCount, onClearAll, hasBrandTerms = false }) {
  const compact = useIsCompactNav()
  const [open, setOpen] = useState(false)
  const notice = built.tooMany ? (
    <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="ok-too-many">{built.message}</p>
  ) : null

  if (compact) {
    return (
      <div className="space-y-3" data-testid="ok-filter-bar">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="ok-filters-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters{activeCount ? <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums" aria-label={`${activeCount} applied`}>{activeCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Results update as you apply each filter.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <FilterFields state={state} update={update} errors={built.errors} hasBrandTerms={hasBrandTerms} />
              {notice}
            </div>
            <SheetFooter className="mt-6 gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={onClearAll} disabled={!activeCount}>Clear all</Button>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {notice && !open ? notice : null}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4" data-testid="ok-filter-bar">
      <FilterFields state={state} update={update} errors={built.errors} hasBrandTerms={hasBrandTerms} className="@min-[760px]/main:grid-cols-2 @min-[1000px]/main:grid-cols-3" />
      {notice}
    </div>
  )
}

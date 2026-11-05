"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Chips, TextFilter } from "../organic-keywords/FilterBar"
import { ITEM_TYPES, LINK_TYPE_OPTIONS, PLACEMENTS, SEARCH_DEBOUNCE_MS } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (source, anchor, target URL): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - chips: at once (one click is one decision).
 * Domain rank, spam score, country, first-seen date and "hide spammy" have no control here any more; a link that carries them in its URL
 * still applies them, and they show as removable chips.
 * Wide screens show the controls inline; on a compact screen they live in a "Filters" drawer (same controls, same behaviour).
 */

function MultiToggle({ label, options, selected, onToggle, testId }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground" id={`${testId}-label`}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${testId}-label`} data-testid={testId}>
        {options.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(o.value)}
              className={cn("rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-[#0d1a3a] bg-[#0d1a3a] text-white dark:border-indigo-500 dark:bg-indigo-500" : "border-border/70 bg-card text-foreground hover:bg-muted")}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Fields({ state, update, className }) {
  const toggle = (key, value) => update({ [key]: state[key].includes(value) ? state[key].filter((v) => v !== value) : [...state[key], value] })
  return (
    <div className={cn("grid gap-4", className)}>
      <TextFilter id="bl-q" label="Search source" placeholder="e.g. news site or a URL" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="bl-anchor" label="Anchor contains" placeholder="e.g. eye hospital" value={state.anchor} onCommit={(anchor) => update({ anchor })} />
      <TextFilter id="bl-target" label="Target URL contains" placeholder="e.g. /hospital/" value={state.target} onCommit={(target) => update({ target })} />
      <Chips label="Link type" options={LINK_TYPE_OPTIONS} value={state.follow} onSelect={(follow) => update({ follow })} testId="bl-filter-follow" />
      <MultiToggle label="Item type" options={ITEM_TYPES} selected={state.itemTypes} onToggle={(v) => toggle("itemTypes", v)} testId="bl-filter-types" />
      <MultiToggle label="Placement" options={PLACEMENTS} selected={state.placements} onToggle={(v) => toggle("placements", v)} testId="bl-filter-placement" />
    </div>
  )
}

/** @param {{ state: import("./types").PageState, update: Function, built: any, activeCount: number, onClearAll: () => void }} props */
export default function FilterBar({ state, update, built, activeCount, onClearAll }) {
  const compact = useIsCompactNav()
  const [open, setOpen] = useState(false)
  const notice = built.tooMany ? (
    <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="bl-too-many">{built.message}</p>
  ) : null

  if (compact) {
    return (
      <div className="space-y-3" data-testid="bl-filter-bar">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="bl-filters-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters{activeCount ? <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums" aria-label={`${activeCount} applied`}>{activeCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Results update as you apply each filter.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <Fields state={state} update={update} />
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
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" data-testid="bl-filter-bar">
      <h2 className="text-[15px] font-semibold tracking-tight">Filters</h2>
      <Fields state={state} update={update} className="@min-[760px]/main:grid-cols-2 @min-[1000px]/main:grid-cols-3" />
      {notice}
    </div>
  )
}

export { SEARCH_DEBOUNCE_MS }

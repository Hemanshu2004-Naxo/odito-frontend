"use client"

import { useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { countryInfo, searchCountries } from "@/lib/countries"
import { cn } from "@/lib/utils"
import { Chips, NumberInput, TextFilter, useDraft } from "../organic-keywords/FilterBar"
import { ITEM_TYPES, LINK_TYPE_OPTIONS, PLACEMENTS, SEARCH_DEBOUNCE_MS, SPAM_THRESHOLD } from "./constants"

/**
 * The filter controls. Typing is held in a local draft and only reaches the page state (and so the request) when it settles:
 *  - text fields (source, anchor, target URL): 400 ms after the last keystroke, or at once on Enter / leaving the field;
 *  - numbers and the date: only on leaving the field or Enter — "1", "10", "100" never become three billed requests;
 *  - chips, toggles and the country list: at once (one click is one decision).
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
              className={cn("rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-foreground bg-foreground text-background" : "border-border/70 bg-card text-foreground hover:bg-muted")}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Source country: type a country or its code, pick from the matches; the chosen ones are removable chips. */
function CountryFilter({ selected, onChange }) {
  const [text, setText] = useState("")
  const matches = searchCountries(text, { exclude: selected })
  const add = (code) => { onChange([...selected, code]); setText("") }
  return (
    <div className="min-w-0" data-testid="bl-filter-country">
      <label htmlFor="bl-country" className="mb-1 block text-xs font-medium text-muted-foreground">Source country</label>
      <Input
        id="bl-country"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0].code) } }}
        placeholder="e.g. India or IN"
        autoComplete="off"
        className="h-9"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls="bl-country-list"
      />
      {matches.length ? (
        <ul id="bl-country-list" role="listbox" aria-label="Matching countries" className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border/70 bg-popover p-1 text-sm shadow-sm">
          {matches.map((c) => (
            <li key={c.code} role="option" aria-selected={false}>
              <button type="button" onClick={() => add(c.code)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span aria-hidden>{c.flag}</span>{c.name}<span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-0.5 pl-2 pr-1 text-xs">
              <span aria-hidden>{countryInfo(code).flag}</span>{countryInfo(code).name}
              <button type="button" onClick={() => onChange(selected.filter((c) => c !== code))} aria-label={`Remove ${countryInfo(code).name}`} className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DateFilter({ value, onCommit, error }) {
  const props = useDraft(value, onCommit)
  return (
    <div className="min-w-0">
      <label htmlFor="bl-since" className="mb-1 block text-xs font-medium text-muted-foreground">First seen after</label>
      <Input id="bl-since" type="date" aria-invalid={error ? true : undefined} className="h-9" data-testid="bl-since" {...props} />
      {error ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}

function Fields({ state, update, errors, className }) {
  const toggle = (key, value) => update({ [key]: state[key].includes(value) ? state[key].filter((v) => v !== value) : [...state[key], value] })
  const numberError = (key) => (errors[key] ? <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[key]}</p> : null)
  return (
    <div className={cn("grid gap-4", className)}>
      <TextFilter id="bl-q" label="Search source" placeholder="e.g. news site or a URL" value={state.q} onCommit={(q) => update({ q })} icon />
      <TextFilter id="bl-anchor" label="Anchor contains" placeholder="e.g. eye hospital" value={state.anchor} onCommit={(anchor) => update({ anchor })} />
      <TextFilter id="bl-target" label="Target URL contains" placeholder="e.g. /hospital/" value={state.target} onCommit={(target) => update({ target })} />
      <Chips label="Link type" options={LINK_TYPE_OPTIONS} value={state.follow} onSelect={(follow) => update({ follow })} testId="bl-filter-follow" />
      <MultiToggle label="Item type" options={ITEM_TYPES} selected={state.itemTypes} onToggle={(v) => toggle("itemTypes", v)} testId="bl-filter-types" />
      <MultiToggle label="Placement" options={PLACEMENTS} selected={state.placements} onToggle={(v) => toggle("placements", v)} testId="bl-filter-placement" />
      <div className="min-w-0">
        <label htmlFor="bl-rank" className="mb-1 block text-xs font-medium text-muted-foreground">Min. domain rank</label>
        <NumberInput id="bl-rank" label="Minimum domain rank" placeholder="0–1000" value={state.minRank} onCommit={(minRank) => update({ minRank })} invalid={Boolean(errors.minRank)} />
        {numberError("minRank")}
      </div>
      <div className="min-w-0">
        <label htmlFor="bl-spam" className="mb-1 block text-xs font-medium text-muted-foreground">Max. spam score</label>
        <NumberInput id="bl-spam" label="Maximum spam score" placeholder="0–100" value={state.maxSpam} onCommit={(maxSpam) => update({ maxSpam })} invalid={Boolean(errors.maxSpam)} />
        {numberError("maxSpam")}
      </div>
      <CountryFilter selected={state.countries} onChange={(countries) => update({ countries })} />
      <DateFilter value={state.since} onCommit={(since) => update({ since })} error={errors.since} />
      <div className="flex items-center gap-2.5" data-testid="bl-hide-spammy-row">
        <Switch id="bl-hide-spammy" checked={state.hideSpammy} onCheckedChange={(hideSpammy) => update({ hideSpammy })} data-testid="bl-hide-spammy" />
        <label htmlFor="bl-hide-spammy" className="cursor-pointer text-sm font-medium">Hide spammy <span className="font-normal text-muted-foreground">(spam score under {SPAM_THRESHOLD})</span></label>
      </div>
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
              <Fields state={state} update={update} errors={built.errors} />
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
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4" data-testid="bl-filter-bar">
      <Fields state={state} update={update} errors={built.errors} className="@min-[760px]/main:grid-cols-2 @min-[1000px]/main:grid-cols-3" />
      {notice}
    </div>
  )
}

export { SEARCH_DEBOUNCE_MS }

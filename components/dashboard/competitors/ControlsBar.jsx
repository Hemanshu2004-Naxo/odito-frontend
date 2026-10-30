"use client"

import { useId, useState } from "react"
import { Ban, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useIsCompactNav } from "@/hooks/use-mobile"
import { formatExact } from "../domain-overview/format"
import InfoHint from "../referring-domains/InfoHint"
import { useDraft } from "../organic-keywords/FilterBar"
import { MIN_SHARED_MAX_DIGITS } from "./constants"

/**
 * The page's settings. Switches apply at once (one click is one decision). "Min. shared keywords" is held in a local draft and only
 * reaches the request on Enter or when the field is left — typing "1", "10", "100" never becomes three billed requests.
 * Wide screens show the controls in a row; on a compact screen they live in a "Controls" drawer (same controls, same behaviour).
 */

function Toggle({ label, hint, checked, onChange, testId }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2.5">
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={testId} />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium">{label}</label>
      <InfoHint label={label} text={hint} />
    </div>
  )
}

/** Digits only; "0" means no filter. Commits on Enter / blur. */
function MinShared({ value, onCommit }) {
  const id = useId()
  const props = useDraft(value, (v) => onCommit(v.replace(/\D/g, "").replace(/^0+/, "").slice(0, MIN_SHARED_MAX_DIGITS)))
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">Min. shared keywords</label>
      <Input id={id} inputMode="numeric" placeholder="e.g. 50" autoComplete="off" maxLength={MIN_SHARED_MAX_DIGITS} className="h-9 w-full sm:w-36" data-testid="cp-min-shared" {...props} />
    </div>
  )
}

function Fields({ state, update, excludedCount, onManage, layout }) {
  return (
    <div className={layout === "row" ? "flex flex-wrap items-end gap-x-6 gap-y-3" : "grid gap-4"}>
      <Toggle
        label="Hide large sites"
        hint="Hides the world's largest websites (YouTube, Facebook, Wikipedia, Reddit, Amazon and similar), which rank for almost everything and are not real competitors."
        checked={state.hideLarge}
        onChange={(hideLarge) => update({ hideLarge })}
        testId="cp-toggle-large"
      />
      <Toggle
        label="Top 10 competitors only"
        hint="Only counts sites that rank in Google's top 10 for the keywords you share. Off: sites ranking anywhere in the top 100 count."
        checked={state.top10}
        onChange={(top10) => update({ top10 })}
        testId="cp-toggle-top10"
      />
      <MinShared value={state.minShared} onCommit={(minShared) => update({ minShared })} />
      <Button type="button" variant="outline" onClick={onManage} data-testid="cp-manage">
        <Ban className="size-4" aria-hidden /> Manage exclusions
        {excludedCount ? <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums" aria-label={`${formatExact(excludedCount)} excluded`}>{formatExact(excludedCount)}</span> : null}
      </Button>
    </div>
  )
}

export default function ControlsBar({ state, update, excludedCount, onManage, activeCount, onReset }) {
  const compact = useIsCompactNav()
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <div data-testid="cp-controls">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-center sm:w-auto" data-testid="cp-controls-button">
              <SlidersHorizontal className="size-4" aria-hidden /> Controls
              {activeCount ? <span className="ml-1 rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums" aria-label={`${activeCount} changed`}>{activeCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Controls</SheetTitle>
              <SheetDescription>The list updates as you change each setting.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <Fields state={state} update={update} excludedCount={excludedCount} onManage={() => { setOpen(false); onManage() }} layout="stack" />
            </div>
            <SheetFooter className="mt-6 gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={onReset} disabled={!activeCount}>Reset settings</Button>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="cp-controls">
      <Fields state={state} update={update} excludedCount={excludedCount} onManage={onManage} layout="row" />
    </div>
  )
}

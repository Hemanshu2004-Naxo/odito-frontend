"use client"

import { useState } from "react"
import { ChevronDown, History, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useManualRefresh } from "@/hooks/useManualRefresh"
import ChangesPanel from "./ChangesPanel"
import DatasetFreshness from "./DatasetFreshness"
import KeywordLookup from "./KeywordLookup"
import { KeyedSnapshotDeltas, SnapshotDeltas } from "./SnapshotDeltas"

const REFUSED = {
  SCAN_IN_PROGRESS: "Data is being updated right now.",
  UNAVAILABLE: "Updates are unavailable right now.",
}

/** Informational: the page's data updates by itself. This optional, rate-limited action asks for a fresh collection of just this page's data. */
function RefreshNow({ projectId, page }) {
  const { refresh, pending, result } = useManualRefresh(projectId, page)
  let note = null
  if (result?.accepted) note = "Update started. It runs in the background and the page keeps showing the saved data until it finishes."
  else if (result?.reason === "COOLDOWN") note = `Data was refreshed manually recently. You can do it again ${result.retryAt ? `after ${new Date(result.retryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "later"}.`
  else if (result) note = REFUSED[result.reason] ?? "The update could not be started. It will be tried again automatically."
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="refresh-now">
      <span>Data updates by itself. You can also</span>
      <button type="button" onClick={refresh} disabled={pending} className="inline-flex items-center gap-1 rounded underline underline-offset-2 hover:text-foreground disabled:opacity-60" data-testid="refresh-now-button">
        <RefreshCw className={cn("size-3", pending && "animate-spin")} aria-hidden /> refresh this page&apos;s data now
      </button>
      {note ? <span role="status">{note}</span> : null}
    </div>
  )
}

export function ProjectPageHistory({ projectId, route, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = `history-${route.page}`
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/20" data-testid="page-history">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
      >
        <History className="size-4 text-muted-foreground" aria-hidden />
        History &amp; data freshness
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={id} className="space-y-3 border-t border-border p-3">
          <DatasetFreshness projectId={projectId} page={route.page} />
          <RefreshNow projectId={projectId} page={route.page} />
          {route.note ? <p className="text-xs text-muted-foreground" role="note">{route.note}</p> : null}
          {route.panels.map((panel, i) => {
            const key = `${panel.type}-${panel.dataset ?? panel.part ?? i}`
            if (panel.type === "changes") return <ChangesPanel key={key} projectId={projectId} spec={panel} />
            if (panel.type === "snapshot") return <SnapshotDeltas key={key} projectId={projectId} spec={panel} />
            if (panel.type === "keyed-snapshot") return <KeyedSnapshotDeltas key={key} projectId={projectId} spec={panel} />
            if (panel.type === "keyword-lookup") return <KeywordLookup key={key} projectId={projectId} />
            return null
          })}
        </div>
      ) : null}
    </div>
  )
}

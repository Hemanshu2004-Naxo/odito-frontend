"use client"

import { useState } from "react"
import { ChevronDown, History } from "lucide-react"
import { cn } from "@/lib/utils"
import ChangesPanel from "./ChangesPanel"
import DatasetFreshness from "./DatasetFreshness"
import KeywordLookup from "./KeywordLookup"
import { KeyedSnapshotDeltas, SnapshotDeltas } from "./SnapshotDeltas"

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

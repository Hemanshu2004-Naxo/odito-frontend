"use client"

import { ChevronDown, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatExact } from "../domain-overview/format"
import { EXPORT_ALL_LIMIT } from "./constants"

export const EXPORT_CAP_WARNING = `Exports the top ${EXPORT_ALL_LIMIT.toLocaleString("en-US")} by current sort.`

/**
 * Export CSV. "Export current page" uses rows already on screen (no request). "Export all with current filters" makes ONE request for up
 * to 1,000 rows with the same filters and sort; when more keywords match than that, the menu says so before the click.
 */
export default function ExportMenu({ pageRowCount, total, busy, disabled, onExportPage, onExportAll }) {
  const capped = typeof total === "number" && total > EXPORT_ALL_LIMIT
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled || busy} aria-busy={busy} data-testid="ok-export">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          {busy ? "Exporting…" : "Export CSV"}
          <ChevronDown className="size-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem onSelect={onExportPage} disabled={!pageRowCount} data-testid="ok-export-page">
          <div>
            <div className="font-medium">Export current page</div>
            <div className="text-xs text-muted-foreground">{formatExact(pageRowCount)} keywords on screen · no new request</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportAll} disabled={!total} data-testid="ok-export-all">
          <div>
            <div className="font-medium">Export all with current filters</div>
            <div className="text-xs text-muted-foreground">
              {capped ? <span data-testid="ok-export-cap">{EXPORT_CAP_WARNING} {formatExact(total)} match.</span> : `${formatExact(total)} keywords · one request`}
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

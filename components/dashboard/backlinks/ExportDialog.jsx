"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatExact } from "../domain-overview/format"
import { backlinksCsvFileName, estimateExport, formatCostEstimate } from "./exportCsv"
import { downloadBacklinksExport, saveBlob } from "./exportStream"
import { EXPORT } from "./constants"

/**
 * "Export with current filters". Nothing is bought until the user confirms: the first screen says how many rows it will fetch (never more
 * than the cap), in how many requests, and what that roughly costs. Then the SERVER fetches the batches and streams the file; this shows
 * the progress and can cancel — cancelling stops the server from fetching any further batch. The file is saved only if it arrived whole.
 */
export default function ExportDialog({
  open, onOpenChange, projectId, request, total, domain, tab,
  // The dialog is shared: the Backlinks page uses the defaults; another page says what it exports and how.
  noun = "backlinks", title = "Export backlinks", description = "Everything matching the current tab, group and filters, as a CSV file.",
  idPrefix = "bl", download = downloadBacklinksExport, fileName = (scopeLabel) => backlinksCsvFileName(domain, tab, scopeLabel),
}) {
  const plan = estimateExport(total)
  const [phase, setPhase] = useState("confirm") // confirm | running | done | cancelled | error
  const [progress, setProgress] = useState({ done: 0, expected: plan.rows })
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState(null)
  const controller = useRef(null)

  // Every time it opens it starts from the confirmation, with the row count of the view it was opened on.
  useEffect(() => {
    if (!open) return
    setPhase("confirm")
    setProgress({ done: 0, expected: estimateExport(total).rows })
    setOutcome(null)
    setError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- re-read `total` only when the dialog opens: it must not change under a running export

  const start = async () => {
    const ctl = new AbortController()
    controller.current = ctl
    setPhase("running")
    setProgress({ done: 0, expected: plan.rows })
    try {
      const out = await download(projectId, { request, maxRows: plan.rows }, {
        signal: ctl.signal,
        onStart: ({ rows }) => setProgress((p) => ({ ...p, expected: rows })),
        onProgress: (done) => setProgress((p) => ({ ...p, done })),
      })
      saveBlob(out.blob, fileName(plan.capped ? `top-${EXPORT.maxRows}` : "all"))
      setOutcome({ rows: out.rows, expected: out.expected })
      setPhase("done")
    } catch (err) {
      if (err?.name === "AbortError") setPhase("cancelled")
      else { setError(err?.message || "The export failed. Please try again."); setPhase("error") }
    } finally {
      controller.current = null
    }
  }
  const cancel = () => controller.current?.abort()
  const close = (next) => { if (!next) cancel(); onOpenChange(next) }
  const pct = progress.expected > 0 ? Math.min(100, Math.round((progress.done / progress.expected) * 100)) : 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md" data-testid={`${idPrefix}-export-dialog`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase === "confirm" ? (
          <div className="space-y-3 text-sm" data-testid={`${idPrefix}-export-confirm`}>
            <p>
              This will export <strong data-testid={`${idPrefix}-export-rows`}>{formatExact(plan.rows)}</strong> {noun}
              {plan.capped ? <> (the first {formatExact(EXPORT.maxRows)} by the current sort — {formatExact(total)} match)</> : null}.
            </p>
            <p className="text-muted-foreground" data-testid={`${idPrefix}-export-cost`}>
              The data provider is asked for them in {plan.batches} request{plan.batches === 1 ? "" : "s"} of up to {formatExact(EXPORT.batch)} rows, which costs <strong className="text-foreground">{formatCostEstimate(plan.cost)}</strong> (an estimate).
              Exporting the same view again within 24 hours costs nothing.
            </p>
          </div>
        ) : null}

        {phase === "running" ? (
          <div className="space-y-2 text-sm" data-testid={`${idPrefix}-export-running`}>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="flex items-center gap-2 tabular-nums text-muted-foreground" role="status" data-testid={`${idPrefix}-export-progress`}>
              <Loader2 className="size-4 animate-spin" aria-hidden /> {formatExact(progress.done)} of {formatExact(progress.expected)} {noun}
            </p>
          </div>
        ) : null}

        {phase === "done" ? (
          <p className="flex items-start gap-2 text-sm" role="status" data-testid={`${idPrefix}-export-done`}>
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Exported {formatExact(outcome?.rows)} {noun}{outcome && outcome.rows < outcome.expected ? ` (the data provider returned fewer than the ${formatExact(outcome.expected)} expected)` : ""}. The file was downloaded.</span>
          </p>
        ) : null}
        {phase === "cancelled" ? <p className="text-sm" role="status" data-testid={`${idPrefix}-export-cancelled`}>Export cancelled. Nothing was saved, and no further requests are made.</p> : null}
        {phase === "error" ? <p role="alert" className="text-sm text-red-700 dark:text-red-300" data-testid={`${idPrefix}-export-error`}>{error}</p> : null}

        <DialogFooter>
          {phase === "confirm" ? (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="button" onClick={start} disabled={!plan.rows} data-testid={`${idPrefix}-export-start`}>Export {formatExact(plan.rows)} {noun}</Button>
            </>
          ) : null}
          {phase === "running" ? <Button type="button" variant="outline" onClick={cancel} data-testid={`${idPrefix}-export-cancel`}>Cancel export</Button> : null}
          {phase === "done" || phase === "cancelled" ? <Button type="button" onClick={() => close(false)}>Close</Button> : null}
          {phase === "error" ? (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>Close</Button>
              <Button type="button" onClick={start}>Try again</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

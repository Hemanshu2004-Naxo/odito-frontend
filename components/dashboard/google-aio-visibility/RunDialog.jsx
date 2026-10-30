"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useStartGoogleAioRun, useQuestionSelection } from "@/hooks/useGoogleAioVisibility"
import { ErrorNote } from "../shared/parts"
import { SelectionDetails } from "./SelectionPanel"
import { DEVICES, QUESTIONS_PER_RUN, describeStartError } from "./format"

/**
 * Confirm-and-run. Shows exactly what will be asked (the server's five questions and verified location), warns that the searches cost
 * money, and sends ONLY the device: the server re-validates everything and applies its own location, language and limits. The button is
 * single-flight, so a double click cannot start two runs, and it stays disabled unless the server says exactly five questions are ready.
 */
export default function RunDialog({ open, onOpenChange, projectId, active, onEditProfile }) {
  const [device, setDevice] = useState("desktop")
  const selection = useQuestionSelection(projectId, device)
  const start = useStartGoogleAioRun(projectId)
  const inFlight = Boolean(active && (active.status === "queued" || active.status === "running"))
  const d = selection.data?.data
  const ready = Boolean(d?.ready) && d?.questions?.length === QUESTIONS_PER_RUN

  const run = () => start.mutate({ device }, { onSuccess: () => onOpenChange(false) })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!start.isPending) { if (!v) start.reset?.(); onOpenChange(v) } }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Run Google AI Overview check</DialogTitle>
          <DialogDescription>
            Odito searches Google for these {QUESTIONS_PER_RUN} questions and records whether Google shows an AI Overview, whether it names your business and whether it links to your website.
            Each search is a paid request to the data provider.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2" role="group" aria-label="Device">
          {Object.entries(DEVICES).map(([key, label]) => (
            <Button key={key} type="button" size="sm" variant={device === key ? "default" : "outline"} aria-pressed={device === key} onClick={() => setDevice(key)} disabled={start.isPending}>{label}</Button>
          ))}
        </div>
        <SelectionDetails selection={selection.data} loading={selection.isLoading} error={selection.error} />
        {d?.problem && onEditProfile && /^(LOCATION_|PROFILE_)/.test(d.problem.code) ? (
          <Button type="button" variant="outline" size="sm" onClick={onEditProfile}>Edit business profile (country, state, city)</Button>
        ) : null}
        {inFlight ? <ErrorNote>A run is already in progress for this project. Wait for it to finish or cancel it first.</ErrorNote> : null}
        {start.error ? <ErrorNote>{describeStartError(start.error)}</ErrorNote> : null}
        <DialogFooter>
          <Button variant="outline" disabled={start.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={run} disabled={start.isPending || inFlight || !ready}>
            {start.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {start.isPending ? "Starting…" : `Run ${QUESTIONS_PER_RUN} questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

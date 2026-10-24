"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useStartChatGptRun } from "@/hooks/useChatGptVisibility"
import { ErrorNote } from "./parts"
import { describeApprovedRunError } from "./format"

/**
 * Confirm-and-run for the APPROVED question set. It shows exactly what will be asked (version and enabled-question count, both taken from
 * the server's set), warns that provider requests cost money, and sends ONLY { questionSetId }: the server re-validates the set and applies
 * its own model, search, size and cost limits. The button is single-flight, so a double click cannot start two requests.
 */
export default function RunApprovedDialog({ open, onOpenChange, projectId, set, active }) {
  const start = useStartChatGptRun(projectId)
  const enabled = (set?.questions || []).filter((q) => q.enabled).length
  const inFlight = Boolean(active && (active.status === "queued" || active.status === "running"))

  const run = () => {
    start.mutate({ questionSetId: set.id }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!start.isPending) { if (!v) start.reset?.(); onOpenChange(v) } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run the approved questions</DialogTitle>
          <DialogDescription>
            Version {set?.version} · {enabled} enabled {enabled === 1 ? "question" : "questions"}. Each question is one paid request to the data provider that
            collects ChatGPT's answers, so a run has a cost. Odito applies its own per-run question and cost limits, and the run can be cancelled while it works.
          </DialogDescription>
        </DialogHeader>
        {inFlight ? <ErrorNote>A run is already in progress for this project. Wait for it to finish or cancel it first.</ErrorNote> : null}
        {start.error ? <ErrorNote>{describeApprovedRunError(start.error)}</ErrorNote> : null}
        <DialogFooter>
          <Button variant="outline" disabled={start.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={run} disabled={start.isPending || inFlight || enabled === 0 || !set?.id}>
            {start.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {start.isPending ? "Starting…" : "Run questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

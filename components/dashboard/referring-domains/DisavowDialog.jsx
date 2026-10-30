"use client"

import { useState } from "react"
import { AlertTriangle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { buildDisavowFile, disavowFileName, DISAVOW_WARNING } from "@/lib/referringDomains/buildDisavowFile"
import { formatExact } from "../domain-overview/format"
import { saveBlob } from "../backlinks/exportStream"

/**
 * "Export disavow file": a confirmation BEFORE anything is downloaded — how many domains the file holds and the warning — then the file in
 * Google's format (a comment line, then "domain:<domain>" per line), built in the browser from the project's saved list: no request.
 */
export default function DisavowDialog({ open, onOpenChange, domains, target, now }) {
  const [done, setDone] = useState(null)
  const preview = buildDisavowFile(domains, { target, now })

  const download = () => {
    const { text, count } = buildDisavowFile(domains, { target, now })
    saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), disavowFileName(target, now))
    setDone(count)
  }
  const close = (next) => { if (!next) setDone(null); onOpenChange(next) }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md" data-testid="rd-disavow-dialog">
        <DialogHeader>
          <DialogTitle>Export disavow file</DialogTitle>
          <DialogDescription>A text file for Google Search Console&apos;s Disavow Links tool.</DialogDescription>
        </DialogHeader>
        {done === null ? (
          <div className="space-y-3 text-sm">
            <p data-testid="rd-disavow-count">
              The file will list <strong>{formatExact(preview.count)}</strong> {preview.count === 1 ? "domain" : "domains"} from your disavow list.
            </p>
            <p className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" data-testid="rd-disavow-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{DISAVOW_WARNING}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm" role="status" data-testid="rd-disavow-done">Downloaded {formatExact(done)} {done === 1 ? "domain" : "domains"}.</p>
        )}
        <DialogFooter>
          {done === null ? (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="button" onClick={download} disabled={preview.count === 0} data-testid="rd-disavow-download"><Download className="size-4" aria-hidden /> Download file</Button>
            </>
          ) : <Button type="button" onClick={() => close(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

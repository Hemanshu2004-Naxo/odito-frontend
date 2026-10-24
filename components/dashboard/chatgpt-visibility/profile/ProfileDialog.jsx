"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import BusinessProfilePanel from "./BusinessProfilePanel"

/** The business profile in a dialog, for the dashboard and question pages. */
export default function ProfileDialog({ open, onOpenChange, projectId, showGenerate = true }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Business profile</DialogTitle>
          <DialogDescription>Confirm what your business offers and where. Questions use only what you confirm.</DialogDescription>
        </DialogHeader>
        {open ? <BusinessProfilePanel projectId={projectId} showGenerate={showGenerate} onGenerated={showGenerate ? undefined : () => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

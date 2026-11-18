"use client"

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * "Approve design" when slides (or the single image) are below the quality bar. The SERVER refused the plain approval and sent the list;
 * the reviewer either approves anyway (recorded with their name) or regenerates the flagged slide first. Nothing is approved silently.
 * `items` = [{ slide (1-based or null for a single image), key, score, reasons[] }].
 */
export function ApproveAttentionDialog({ open, items = [], pending = null, onApproveAnyway, onRegenerate, onClose }) {
  const n = items.length
  const single = n === 1 && items[0]?.slide == null
  const title = single ? 'This design needs attention' : `${n} slide${n === 1 ? ' needs' : 's need'} attention`
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.() }}>
      <DialogContent className="max-w-lg border-slate-200 bg-white" data-testid="approve-attention-dialog">
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900"><AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />{title}</DialogTitle>
        <DialogDescription className="text-sm text-slate-600">The quality check scored {single ? 'it' : 'these slides'} below 8. Approving the design approves every slide as it is.</DialogDescription>
        <ul className="mt-1 max-h-64 space-y-2 overflow-y-auto" data-testid="attention-list">
          {items.map((a) => (
            <li key={a.key || 'single'} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">{a.slide == null ? 'The image' : `Slide ${a.slide}`}{a.score != null ? ` · QC ${a.score}/10` : ''}</p>
              <ul className="mt-0.5 list-disc pl-5 text-xs">{(a.reasons || []).map((r) => <li key={r}>{r}</li>)}</ul>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onApproveAnyway} disabled={!!pending} data-testid="approve-anyway" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {pending === 'approve' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Approve anyway
          </button>
          <button type="button" onClick={onRegenerate} disabled={!!pending} data-testid="attention-regenerate" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {pending === 'regenerate' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{single ? 'Regenerate in Creative Studio' : `Regenerate slide ${items[0]?.slide ?? ''}`.trim()}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ApproveAttentionDialog

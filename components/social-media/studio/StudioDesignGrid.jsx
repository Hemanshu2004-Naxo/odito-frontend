"use client"

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ImageIcon, Loader2, Maximize2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { creativeLabel, DESIGN_NOTE_TEXT as NOTE_TEXT } from '@/lib/socialMedia/studio'


/** The three loading cards: the same size as a design, nothing invented inside. */
function SkeletonCard({ index }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="design-skeleton" aria-busy="true" aria-label={`Design ${index + 1} is being generated`}>
      <Skeleton className="aspect-[3/2] w-full rounded-none bg-slate-200" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3 bg-slate-200" />
        <Skeleton className="h-3 w-1/3 bg-slate-100" />
      </div>
    </li>
  )
}

function Lightbox({ candidate, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="design-lightbox" className="flex max-h-[95vh] w-[calc(100vw-1.5rem)] max-w-[1200px] flex-col items-center gap-3 border-slate-200 bg-white p-3 sm:p-4">
        <DialogTitle className="sr-only">{creativeLabel(candidate)} design</DialogTitle>
        <DialogDescription className="sr-only">The design at full size.</DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={candidate.imageUrl} alt={`${creativeLabel(candidate)} design, full size`} className="block h-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain" />
      </DialogContent>
    </Dialog>
  )
}

function DesignCard({ candidate, focused, hasCurrent, canAct, busyId, onFocus, onSelect, onRetry }) {
  const [errored, setErrored] = useState(false)
  const [zoom, setZoom] = useState(false)
  const label = creativeLabel(candidate)
  const failed = candidate.status === 'failed'
  const notes = (candidate.notes || []).filter((n) => NOTE_TEXT[n])

  if (failed) {
    return (
      <li className="flex flex-col overflow-hidden rounded-2xl border border-red-200 bg-red-50/60 shadow-sm" data-testid={`design-card-${candidate.slot}`} data-status="failed">
        <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden />
          <p className="text-sm font-semibold text-red-700">{label} could not be created</p>
          <p role="alert" className="text-xs text-red-600/90" data-testid="design-card-failure">{candidate.failure?.message}</p>
        </div>
        <div className="border-t border-red-100 p-3">
          <button type="button" onClick={() => onRetry(candidate)} disabled={!canAct || busyId === candidate.id} data-testid="design-card-retry" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw className="h-4 w-4" aria-hidden />Try again
          </button>
        </div>
      </li>
    )
  }

  const selectLabel = hasCurrent ? 'Replace design' : 'Select design'
  return (
    <li
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${focused ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200'}`}
      data-testid={`design-card-${candidate.slot}`}
      data-status="ready"
      data-current={candidate.current ? 'true' : 'false'}
      data-focused={focused ? 'true' : 'false'}
    >
      <div className="relative bg-slate-100">
        {errored ? (
          <div className="flex aspect-[3/2] w-full items-center justify-center text-slate-300" data-testid="design-card-image-error"><ImageIcon className="h-10 w-10" strokeWidth={1.5} /></div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageUrl} alt={`${label} design`} onError={() => setErrored(true)} data-testid="design-card-image" className="block aspect-[3/2] w-full object-contain" style={candidate.width && candidate.height ? { aspectRatio: `${candidate.width} / ${candidate.height}` } : undefined} />
        )}
        {!errored && (
          // icon-only and in the top-right corner: the bottom-right corner of a design is where the logo is placed, and the
          // headline is top-left, so nothing is ever covered by a control
          <button type="button" onClick={() => setZoom(true)} aria-label={`View the ${label} design full size`} title="Enlarge" data-testid="design-card-enlarge" className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-900/60 text-white hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <button type="button" onClick={() => onFocus(candidate.id)} aria-pressed={focused} data-testid="design-card-focus" className="-m-1 rounded-lg p-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900" data-testid="design-card-label">{label}</span>
            {candidate.current && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white" data-testid="design-card-current"><CheckCircle2 className="h-3 w-3" aria-hidden />Selected design</span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {candidate.current ? `Design v${candidate.attachedDesignVersion ?? ''}`.trim() : 'Not selected yet'}
            {candidate.revision > 1 ? ` · variation ${candidate.revision}` : ''}
            {focused ? ' · chosen for changes' : ''}
          </span>
        </button>
        {candidate.fallback && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900" data-testid="design-card-fallback">{candidate.fallback.message}</p>}
        {candidate.instruction && <p className="line-clamp-2 text-xs italic text-slate-500" data-testid="design-card-instruction">Last change asked: {candidate.instruction}</p>}
        {notes.length > 0 && <ul className="space-y-0.5 text-xs text-slate-500">{notes.map((n) => <li key={n}>{NOTE_TEXT[n]}</li>)}</ul>}
        {!candidate.current && (
          <button type="button" onClick={() => onSelect(candidate)} disabled={!canAct || busyId === candidate.id} data-testid="design-card-select" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busyId === candidate.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{selectLabel}
          </button>
        )}
      </div>
      {!errored && <Lightbox candidate={candidate} open={zoom} onOpenChange={setZoom} />}
    </li>
  )
}

/**
 * The three designs of the latest generation, exactly as the server returned them. While the server is generating, the cards in flight are
 * skeletons (all three for "generate", only the regenerated one for "regenerate"); nothing is shown that was not generated.
 */
export function StudioDesignGrid({ generation, generating, focusId, hasCurrent, canAct, busyId, onFocus, onSelect, onRetry }) {
  const candidates = generation?.candidates || []

  if (!candidates.length) {
    if (generating) {
      return <ul className="grid grid-cols-1 gap-4 @min-[900px]/main:grid-cols-3" data-testid="design-grid">{[0, 1, 2].map((i) => <SkeletonCard key={i} index={i} />)}</ul>
    }
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center" data-testid="design-grid-empty">
        <ImageIcon className="mx-auto h-8 w-8 text-slate-300" strokeWidth={1.5} aria-hidden />
        <p className="mt-2 text-sm font-semibold text-slate-700">No designs yet</p>
        <p className="mt-1 text-sm text-slate-500">Generate designs to get three creative directions for this post.</p>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-4 @min-[900px]/main:grid-cols-3" data-testid="design-grid">
      {candidates.map((c, i) => (
        (c.status === 'pending' || (generating && generation.activeCandidateId === c.id))
          ? <SkeletonCard key={c.id} index={i} />
          : <DesignCard key={c.id} candidate={c} focused={focusId === c.id} hasCurrent={hasCurrent} canAct={canAct} busyId={busyId} onFocus={onFocus} onSelect={onSelect} onRetry={onRetry} />
      ))}
    </ul>
  )
}

export default StudioDesignGrid

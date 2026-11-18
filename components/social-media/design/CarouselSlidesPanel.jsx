"use client"

import { useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { CarouselPreview } from './CarouselPreview'
import { DesignProgress } from './DesignProgress'
import { ConfirmActionDialog } from '@/components/social-media/ConfirmActionDialog'
import { useDesignSlides, useSlideRegenerate, useSlideReorder, useSlideDelete } from '@/hooks/useSocialMediaAI'
import { trackDesignJob, SLIDE_LABEL } from '@/lib/socialMedia/designJobs'
import { studioErrorMessage } from '@/lib/socialMedia/studio'

export const MIN_SLIDES = 2

/**
 * A post's carousel with per-slide controls: the "needs attention" badge with the quality check's reason, "Regenerate this slide", move
 * left / right and delete (at least 2 slides stay). Every change is a NEW design version made by the server - an approved carousel goes back
 * to Design Review, which the panel says before the change. `media` is the post's ordered media (the fallback when the slides' metadata is
 * not available, e.g. images uploaded by hand: then it is a plain preview without controls).
 */
export function CarouselSlidesPanel({ projectId, publicationId, media, versions, approvalState, canEdit = true, onNotice = null, wide = false, children = null }) {
  const slidesQuery = useDesignSlides(projectId, publicationId)
  const regenerate = useSlideRegenerate(projectId, publicationId)
  const reorder = useSlideReorder(projectId, publicationId)
  const remove = useSlideDelete(projectId, publicationId)
  const [index, setIndex] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState(null)

  const generation = slidesQuery.data?.generation || null
  const inPost = (generation?.slides || []).filter((s) => s.inPost)
  const known = generation && inPost.length === media.length
  // the post's media order is the truth; the slide metadata decorates it
  const slides = media.map((m, i) => {
    const s = known ? inPost.find((x) => x.url === m.url) : null
    return { key: s?.key || `m${i}`, url: m.url, label: s?.headline || null, needsAttention: !!s?.qc?.needsAttention, meta: s }
  })
  const current = slides[Math.min(index, slides.length - 1)] || null
  const busy = !!(slidesQuery.data?.busy || generation?.active || regenerate.isPending || reorder.isPending || remove.isPending)
  const approved = approvalState === 'design_approved'
  const base = { contentVersion: versions?.contentVersion, designVersion: versions?.designVersion }

  async function act(fn, success) {
    setError(null)
    try { await fn(); if (success) onNotice?.(success, 'success') } catch (e) { setError(studioErrorMessage(e).message) }
  }
  const guarded = (run, what) => (approved ? setConfirm({ run, what }) : run())

  const doRegenerate = () => guarded(() => act(async () => {
    await regenerate.mutateAsync({ ...base, slideKey: current.key })
    trackDesignJob({ projectId, publicationId, label: `Slide ${index + 1}` })
  }, `Regenerating slide ${index + 1}…`), 'regenerate this slide')
  const doMove = (dir) => guarded(() => act(async () => {
    const order = slides.map((s) => s.key)
    const j = index + dir
    ;[order[index], order[j]] = [order[j], order[index]]
    await reorder.mutateAsync({ ...base, order })
    setIndex(j)
  }, 'Slide order saved.'), 'change the slide order')
  const doDelete = () => setConfirm({ destructive: true, what: 'delete', run: () => act(async () => { await remove.mutateAsync({ ...base, slideKey: current.key }); setIndex(Math.max(0, index - 1)) }, 'Slide removed.') })

  const attention = current?.meta?.qc?.needsAttention
  const regenerating = generation?.active && generation?.phase === 'slide'

  return (
    // wide = a full-width band: the slides on the left, everything you do with them on the right
    <div className={wide ? 'grid grid-cols-1 items-start gap-5 @min-[900px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'space-y-3'} data-testid="carousel-slides-panel">
      <CarouselPreview slides={slides} index={index} onIndexChange={setIndex} />

      <div className={wide ? 'flex min-w-0 flex-col gap-3' : 'contents'}>
      {regenerating && <DesignProgress generation={generation} title={`Regenerating slide ${(inPost.findIndex((s) => s.key === generation.slideKey) + 1) || ''}`} />}

      {current && known && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="slide-controls" data-slide={current.key}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              Slide {index + 1} · {current.meta?.kind === 'point' ? `Point ${SLIDE_LABEL(current.meta)}` : SLIDE_LABEL(current.meta)}
              {current.meta?.qc?.score != null && <span className="ml-2 font-normal text-slate-500">QC {current.meta.qc.score}/10</span>}
            </p>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={doRegenerate} disabled={busy} data-testid="slide-regenerate" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {regenerate.isPending || regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}Regenerate this slide
                </button>
                <button type="button" onClick={() => doMove(-1)} disabled={busy || index === 0} aria-label="Move slide left" data-testid="slide-move-left" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ArrowLeft className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => doMove(1)} disabled={busy || index === slides.length - 1} aria-label="Move slide right" data-testid="slide-move-right" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ArrowRight className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={doDelete} disabled={busy || slides.length <= MIN_SLIDES} title={slides.length <= MIN_SLIDES ? `A carousel keeps at least ${MIN_SLIDES} slides` : undefined} aria-label="Delete slide" data-testid="slide-delete" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            )}
          </div>
          {attention && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="slide-needs-attention">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden />Needs attention · QC {attention.score ?? '—'}/10</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{attention.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
          {approved && canEdit && <p className="mt-2 text-xs text-slate-500">This carousel is approved. Changing any slide sends it back to design review.</p>}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {children}
      </div>

      <ConfirmActionDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o) setConfirm(null) }}
        title={confirm?.destructive ? `Delete slide ${index + 1}?` : 'Change the approved carousel?'}
        description={confirm?.destructive
          ? `The slide is removed from the post${approved ? ' and the carousel goes back to design review' : ''}. ${slides.length - 1} slides stay.`
          : `To ${confirm?.what}, Odito makes a new design version: the carousel goes back to design review and needs approval again.`}
        confirmLabel={confirm?.destructive ? 'Delete slide' : 'Continue'}
        cancelLabel="Cancel"
        destructive={!!confirm?.destructive}
        onConfirm={() => { const next = confirm; setConfirm(null); next?.run() }}
      />
    </div>
  )
}

export default CarouselSlidesPanel

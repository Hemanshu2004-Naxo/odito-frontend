"use client"

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, Maximize2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * A carousel shown the way it will be posted: one slide at a time (whole, never cropped), arrows, dots, "3 / 7", and the slide ORDER as a
 * numbered strip of thumbnails. A slide that needs attention carries an amber mark. Click the slide to see it full size.
 * `slides` = [{ key, url, label?, needsAttention? }] in the post's order; `index` / `onIndexChange` let a parent put controls under it.
 */
export function CarouselPreview({ slides, index: controlled = null, onIndexChange = null, maxHeightClass = 'max-h-[460px]' }) {
  const [own, setOwn] = useState(0)
  const [open, setOpen] = useState(false)
  const count = slides.length
  const index = Math.min(Math.max(0, controlled ?? own), Math.max(0, count - 1))
  const go = (i) => { const next = (i + count) % count; if (onIndexChange) onIndexChange(next); else setOwn(next) }
  useEffect(() => { if (controlled == null && own >= count) setOwn(0) }, [count, controlled, own])
  if (!count) return null
  const slide = slides[index]

  return (
    <div className="space-y-3" data-testid="carousel-preview" data-count={count} data-index={index}>
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-xl bg-slate-100"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Slide ${index + 1} of ${count}`}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(index - 1); if (e.key === 'ArrowRight') go(index + 1) }}
      >
        <button type="button" onClick={() => setOpen(true)} className="group relative block cursor-zoom-in focus:outline-none" aria-label="View slide full size" data-testid="carousel-open">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.url} alt={`Slide ${index + 1}${slide.label ? `: ${slide.label}` : ''}`} data-testid="carousel-image" className={`block h-auto w-auto max-w-full object-contain ${maxHeightClass}`} />
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-1 text-xs font-semibold text-white opacity-90"><Maximize2 className="h-3.5 w-3.5" aria-hidden />Enlarge</span>
        </button>
        <span className="absolute right-3 top-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-bold text-white" data-testid="carousel-count">{index + 1} / {count}</span>
        {slide.needsAttention && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950" data-testid="carousel-attention"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Needs attention</span>
        )}
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" data-testid="carousel-prev" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md ring-1 ring-slate-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" data-testid="carousel-next" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md ring-1 ring-slate-200 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5" data-testid="carousel-dots">
          {slides.map((s, i) => (
            <button key={s.key} type="button" onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index ? 'true' : undefined}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-violet-600' : s.needsAttention ? 'w-2 bg-amber-400' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />
          ))}
        </div>
      )}

      {count > 1 && (
        <ol className="flex flex-wrap justify-center gap-1.5" data-testid="carousel-order" aria-label="Slide order">
          {slides.map((s, i) => (
            <li key={s.key} className="shrink-0">
              <button type="button" onClick={() => go(i)} aria-label={`Slide ${i + 1}${s.label ? `, ${s.label}` : ''}`}
                className={`relative block overflow-hidden rounded-lg border-2 ${i === index ? 'border-violet-600' : s.needsAttention ? 'border-amber-400' : 'border-transparent'} focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="h-[60px] w-12 object-cover" />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-slate-900/80 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[95vh] w-[calc(100vw-1.5rem)] max-w-[1100px] flex-col items-center gap-3 border-slate-200 bg-white p-3 sm:p-4" data-testid="carousel-dialog">
          <DialogTitle className="sr-only">Slide {index + 1} of {count}</DialogTitle>
          <DialogDescription className="sr-only">The slide at full size.</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.url} alt={`Slide ${index + 1}`} className="block h-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CarouselPreview

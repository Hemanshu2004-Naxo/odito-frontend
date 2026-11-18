"use client"

import { Check, Loader2, AlertTriangle, X } from 'lucide-react'
import { stepsFor, currentStepIndex, SLIDE_LABEL } from '@/lib/socialMedia/designJobs'

/**
 * Live progress of a design job, from the SERVER's stages (the job runs on the server: leaving the page does not stop it, and this reads it
 * again when you come back): Writing concept -> Hook image -> Slides -> Quality check for a carousel, with one chip per slide.
 */
export function DesignProgress({ generation, title = null }) {
  if (!generation) return null
  const steps = stepsFor(generation)
  const current = currentStepIndex(generation)
  const slides = generation.slides || []
  const showSlides = generation.phase !== 'compare' && generation.format === 'carousel' && slides.length > 0

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4" data-testid="design-progress" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-violet-900">{title || (generation.active ? 'Working on your design' : 'Design finished')}</p>
        {generation.active && <p className="text-xs text-violet-700">You can leave this page - we will let you know when it is done.</p>}
      </div>

      <ol className="mt-3 grid gap-2 sm:grid-cols-2 @min-[900px]/main:grid-cols-4" data-testid="design-steps">
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current && generation.active ? 'current' : 'pending'
          return (
            <li key={s.key} data-testid={`design-step-${s.key}`} data-state={state} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${state === 'current' ? 'border-violet-300 bg-white font-semibold text-violet-900 shadow-sm' : state === 'done' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white/70 text-slate-500'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'current' ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'}`} aria-hidden="true">
                {state === 'done' ? <Check className="h-3 w-3" /> : state === 'current' ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
              </span>
              <span>{s.label}</span>
            </li>
          )
        })}
      </ol>

      {showSlides && (
        <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="design-slide-chips" aria-label="Slides">
          {slides.map((s) => {
            const attention = s.status === 'ready' && s.qc?.needsAttention
            const tone = s.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700'
              : attention ? 'border-amber-300 bg-amber-50 text-amber-800'
                : s.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : s.status === 'generating' ? 'border-violet-300 bg-white text-violet-800' : 'border-slate-200 bg-white text-slate-500'
            return (
              <li key={s.key} data-testid={`slide-chip-${s.key}`} data-status={s.status} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
                {s.status === 'generating' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : s.status === 'failed' ? <X className="h-3 w-3" aria-hidden="true" /> : attention ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : s.status === 'ready' ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                {SLIDE_LABEL(s)}
                {s.status === 'generating' && s.stage === 'quality' && <span className="font-normal">· checking</span>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default DesignProgress

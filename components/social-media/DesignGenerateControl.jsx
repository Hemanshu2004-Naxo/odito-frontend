"use client"

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles, Layers } from 'lucide-react'
import { useSocialAIDesign, useGenerateSocialAIDesign } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { DESIGN_NOTE_TEXT } from '@/lib/socialMedia/studio'

/**
 * "Generate design" / "Regenerate design" for an approved post. Everything shown is the server's: whether it is offered
 * (post.canGenerateDesign, from the approval state), the generating state (polled only while the server says so - no
 * percentages), the failure message, and the FORMAT (GET /status -> designFormat).
 *
 * Format: a Single image / Carousel switch. Its default is the server's rule (the calendar plan, else the caption's list); the
 * request carries `format` only once the person flips the switch, so every Generate / Regenerate is decided again on the server
 * (never inherited from the previous version). A carousel the caption cannot be split into is never quietly made as one image:
 * the server's question is shown ("Make a single image or edit the caption?").
 *
 * A post planned as a carousel whose current design is one image (made before formats were followed) shows a "Planned as
 * carousel" badge and a "Regenerate as carousel" button. Nothing is changed until the person clicks it.
 *
 * Once the CURRENT design came from a generation, its concept is shown in plain words (the big idea), with notes about the real
 * assets it could and could not use.
 */
const CREATIVE_NOTES = DESIGN_NOTE_TEXT
const FORMAT_CODES = new Set(['CAROUSEL_NEEDS_POINTS', 'CAROUSEL_UNAVAILABLE'])
// the server's own wording (designFormat.js FORMAT_MESSAGES.CHOSEN_NO_POINTS), for a carousel the person picked
const CHOSEN_NO_POINTS = 'This caption has no clear points to split into carousel slides. Make a single image or edit the caption?'

const SOURCE_TEXT = {
  plan: (f) => (f.plannedFormat === 'carousel' ? 'Planned as a carousel in your content calendar.' : 'Planned as a single image in your content calendar.'),
  caption: (f) => (f.recommended === 'carousel' ? `Your caption lists ${f.carousel.points} points: one slide each.` : 'Your caption has no list, so a single image.'),
}

function focusCaption() {
  const el = typeof document !== 'undefined' ? document.querySelector('[data-testid="caption-input"]') : null
  if (el) { el.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); el.focus?.() }
}

export function DesignGenerateControl({ projectId, post }) {
  const hasMedia = post.media.length > 0
  const state = post.approval.state
  const replaceApproved = state === 'design_approved' && hasMedia
  const design = useSocialAIDesign(projectId, post.id, { enabled: post.canGenerateDesign })
  const generate = useGenerateSocialAIDesign(projectId, post.id)
  const startInFlight = useRef(false)
  const [startedId, setStartedId] = useState(null)
  const [choice, setChoice] = useState(null) // null = follow the server's rule
  const [askDismissed, setAskDismissed] = useState(false)

  const data = design.data
  const fmt = data?.designFormat || null
  const serverGenerating = data?.status === 'generating'
  const busy = generate.isPending || serverGenerating
  const failed = data?.status === 'failed' && data.generation?.id === startedId ? data.generation.failure : null
  const creative = data?.status === 'ready' && data.generation?.designVersion === post.approval.designVersion ? data.generation.creative : null
  const startError = generate.isError ? describeApiError(generate.error, 'Could not start the design generation.') : null
  const formatQuestion = startError && FORMAT_CODES.has(startError.code) ? startError.message : null

  const selected = choice || fmt?.recommended || 'single'
  const carouselAvailable = fmt ? fmt.carousel.available : true
  // the question is asked BEFORE a click when the selected carousel cannot be made (the server would refuse it anyway)
  const askNow = !askDismissed && fmt && selected === 'carousel' && !fmt.carousel.allowed
    ? (!choice && fmt.needsChoice ? fmt.message : CHOSEN_NO_POINTS)
    : null
  const question = formatQuestion || askNow

  if (!post.canGenerateDesign) return null

  function start(format) {
    // synchronous guard: a fast double-click cannot send two requests before React re-renders the disabled button
    if (startInFlight.current || busy) return
    startInFlight.current = true
    generate.mutate({ contentVersion: post.approval.contentVersion, replaceApproved, ...(format ? { format } : {}) }, {
      onSuccess: (res) => setStartedId(res?.data?.generation?.id || null),
      onSettled: () => { startInFlight.current = false },
    })
  }
  const handleClick = () => start(choice)
  const pick = (f) => { setChoice(f); setAskDismissed(false); generate.reset?.() }

  return (
    <div className="mt-4" data-testid="design-generate">
      {fmt?.mismatch && !busy && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="format-mismatch">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-semibold" data-testid="planned-carousel-badge">Planned as carousel</span>
            The current design is a single image.
          </span>
          {carouselAvailable && fmt.carousel.allowed && (
            <button type="button" onClick={() => { setChoice('carousel'); start('carousel') }} data-testid="regenerate-as-carousel" className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700">Regenerate as carousel</button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Design format" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold" data-testid="design-format-switch">
          {[['single', 'Single image'], ['carousel', 'Carousel']].map(([id, label]) => {
            const on = selected === id
            const disabled = busy || (id === 'carousel' && !carouselAvailable)
            return (
              <button key={id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => pick(id)} data-testid={`design-format-${id}`}
                title={id === 'carousel' && !carouselAvailable ? 'Carousels can\'t be made for posts with real product photos yet.' : undefined}
                className={`rounded-md px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {id === 'carousel' && <Layers className="mr-1 inline h-3.5 w-3.5" />}{label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || !!question}
          data-testid="generate-design-button"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Generating…' : hasMedia ? 'Regenerate design' : 'Generate design'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500" data-testid="design-format-source">
        {choice ? (choice === 'carousel' ? 'You chose a carousel: a hook slide, one slide per point and a call-to-action slide.' : 'You chose a single image.') : fmt && SOURCE_TEXT[fmt.source] ? SOURCE_TEXT[fmt.source](fmt) : null}
        {' '}
        {replaceApproved
          ? 'Generating a new design sends this post back to design review.'
          : hasMedia ? 'Not right? Generate a new version, or upload your own.' : 'Odito designs it from the approved caption, your content plan and your brand.'}
      </p>
      <p className="mt-1 text-right text-xs">
        <Link href={`/app/social-media/creative-studio?publicationId=${encodeURIComponent(post.id)}`} data-testid="open-creative-studio" className="font-semibold text-violet-700 hover:text-violet-800">Compare 3 designs in Creative Studio</Link>
      </p>

      {question && !busy && (
        <div role="alertdialog" aria-label="Carousel can't be made" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" data-testid="format-question">
          <p>{question}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setChoice('single'); setAskDismissed(true); generate.reset?.(); start('single') }} data-testid="format-question-single" className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700">Make a single image</button>
            <button type="button" onClick={() => { setAskDismissed(true); generate.reset?.(); focusCaption() }} data-testid="format-question-edit" className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">Edit the caption</button>
          </div>
        </div>
      )}

      {serverGenerating && (
        <p role="status" data-testid="design-generating" className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-slate-700">
          {data?.generation?.mode === 'studio' || selected === 'carousel'
            ? 'Making your carousel on the server (the hook slide first, then every other slide). This takes a few minutes, and you can leave this page - it will be in Design review when it is done.'
            : 'Drawing your design on the server. This usually takes under a minute, and you can leave this page - it will be in Design review when it is done.'}
        </p>
      )}
      {creative && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="design-creative">
          <p>
            <span className="font-semibold text-slate-800" data-testid="design-concept">{creative.concept?.bigIdea || creative.label}</span>
            {creative.referencePhotos ? ' · built on your product photo' : ''}{creative.logoApplied ? ' · your logo added' : ''}
          </p>
          {creative.fallback && <p role="status" className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900" data-testid="design-fallback">{creative.fallback.message}</p>}
          {(creative.notes || []).filter((n) => CREATIVE_NOTES[n]).map((n) => <p key={n} className="mt-1 text-xs text-slate-500" data-testid={`design-note-${n}`}>{CREATIVE_NOTES[n]}</p>)}
        </div>
      )}
      {failed && <p role="alert" data-testid="design-failed" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{failed.message} Nothing was changed.</p>}
      {startError && !formatQuestion && <p role="alert" data-testid="design-start-error" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{startError.message}</p>}
    </div>
  )
}

export default DesignGenerateControl

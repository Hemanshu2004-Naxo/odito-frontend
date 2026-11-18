"use client"

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles } from 'lucide-react'
import { useSocialAIDesign, useGenerateSocialAIDesign } from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { DESIGN_NOTE_TEXT } from '@/lib/socialMedia/studio'

/**
 * "Generate design" for an approved post. Everything shown is the server's: whether it is offered (post.canGenerateDesign,
 * from the approval state), the generating state (polled only while the server says so - no percentages), and the
 * failure message. The generated image itself is shown by the design panel from the real publication once the list is
 * refetched; this control has no approve / schedule / publish action.
 *
 * A past failure is only shown if it came from a generation started in this visit.
 *
 * Once the CURRENT design came from a generation, the creative direction Odito chose for it is shown ("Educational list",
 * "Product showcase"...) with plain notes about the real assets it could and could not use (the product photo, the logo).
 * Those are codes and counts from the server; no text of the post is involved.
 */
const CREATIVE_NOTES = DESIGN_NOTE_TEXT
export function DesignGenerateControl({ projectId, post }) {
  const hasMedia = post.media.length > 0
  const state = post.approval.state
  const replaceApproved = state === 'design_approved' && hasMedia
  const design = useSocialAIDesign(projectId, post.id, { enabled: post.canGenerateDesign })
  const generate = useGenerateSocialAIDesign(projectId, post.id)
  const startInFlight = useRef(false)
  const [startedId, setStartedId] = useState(null)

  const data = design.data
  const serverGenerating = data?.status === 'generating'
  const busy = generate.isPending || serverGenerating
  const failed = data?.status === 'failed' && data.generation?.id === startedId ? data.generation.failure : null
  const creative = data?.status === 'ready' && data.generation?.designVersion === post.approval.designVersion ? data.generation.creative : null
  const startError = generate.isError ? describeApiError(generate.error, 'Could not start the design generation.') : null

  if (!post.canGenerateDesign) return null

  function handleClick() {
    // synchronous guard: a fast double-click cannot send two requests before React re-renders the disabled button
    if (startInFlight.current || busy) return
    startInFlight.current = true
    generate.mutate({ contentVersion: post.approval.contentVersion, replaceApproved }, {
      onSuccess: (res) => setStartedId(res?.data?.generation?.id || null),
      onSettled: () => { startInFlight.current = false },
    })
  }

  return (
    <div className="mt-4" data-testid="design-generate">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {replaceApproved
            ? 'Generating a new design sends this post back to design review.'
            : hasMedia ? 'Not right? Generate a new version, or upload your own.' : 'Odito designs a professional creative for this post from its approved caption, your content plan and your brand.'}
        </p>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          data-testid="generate-design-button"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Generating…' : hasMedia ? 'Regenerate design' : 'Generate design'}
        </button>
      </div>
      <p className="mt-2 text-right text-xs">
        <Link href={`/app/social-media/creative-studio?publicationId=${encodeURIComponent(post.id)}`} data-testid="open-creative-studio" className="font-semibold text-violet-700 hover:text-violet-800">Compare 3 designs in Creative Studio</Link>
      </p>
      {serverGenerating && (
        <p role="status" data-testid="design-generating" className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-slate-700">
          Drawing your design on the server. This usually takes under a minute, and you can leave this page - it will be in Design review when it is done.
        </p>
      )}
      {creative && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="design-creative">
          <p><span className="font-semibold text-slate-800">Creative direction: {creative.label}</span>{creative.referencePhotos ? ' · built on your product photo' : ''}{creative.logoApplied ? ' · your logo added' : ''}</p>
          {creative.fallback && <p role="status" className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900" data-testid="design-fallback">{creative.fallback.message}</p>}
          {(creative.notes || []).filter((n) => CREATIVE_NOTES[n]).map((n) => <p key={n} className="mt-1 text-xs text-slate-500" data-testid={`design-note-${n}`}>{CREATIVE_NOTES[n]}</p>)}
        </div>
      )}
      {failed && <p role="alert" data-testid="design-failed" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{failed.message} Nothing was changed.</p>}
      {startError && <p role="alert" data-testid="design-start-error" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{startError.message}</p>}
    </div>
  )
}

export default DesignGenerateControl

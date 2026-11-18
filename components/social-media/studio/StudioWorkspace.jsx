"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSocialStudio, useStudioGenerate, useStudioRegenerate, useStudioSelect } from '@/hooks/useSocialMediaAI'
import { useToastQueue } from '@/hooks/useToastQueue'
import SocialMediaToastStack from '@/components/social-media/SocialMediaToastStack'
import { ConfirmActionDialog } from '@/components/social-media/ConfirmActionDialog'
import {
  STUDIO_STATES, chosenProductPhotos, cleanInstruction, deriveStudioState, readyCandidates, studioErrorMessage,
} from '@/lib/socialMedia/studio'
import { StudioContentCard } from './StudioContentCard'
import { StudioDesignGrid } from './StudioDesignGrid'
import { StudioActions } from './StudioActions'
import { StudioRefinePanel } from './StudioRefinePanel'
import { StudioBrandPanel } from './StudioBrandPanel'
import { StudioProgress } from './StudioProgress'
import { StudioGateNotice, StudioLoading, StudioError, StudioNoContent } from './StudioNotices'
import { ConceptStudio } from './ConceptStudio'

/**
 * The real Creative Studio for ONE publication. Every fact on screen is the server's (GET /social/ai-design/studio): the post's approved
 * caption and hashtags, the brand kit, the product photos, the format, the approval gate and the three generated designs. Every button is
 * a real request through the existing design pipeline; the screen only reflects the answer. Nothing is generated, selected, approved or
 * remembered locally except what the user is typing and which design they have pointed at.
 *
 * Final actions: Generate designs, Regenerate all, Regenerate selected, Apply AI changes, Select design, Replace design,
 * View content details, Open approval.
 */
export function StudioWorkspace({ projectId, publicationId }) {
  const query = useSocialStudio(projectId, publicationId)
  const generate = useStudioGenerate(projectId, publicationId)
  const regenerate = useStudioRegenerate(projectId, publicationId)
  const select = useStudioSelect(projectId, publicationId)
  const { toasts, notify, dismiss } = useToastQueue()

  const studio = query.data
  const state = deriveStudioState(studio)
  const generation = studio?.generation || null
  const generating = state === STUDIO_STATES.GENERATING
  const candidates = useMemo(() => generation?.candidates || [], [generation])

  const [focusId, setFocusId] = useState(null)
  const [photoIds, setPhotoIds] = useState(null)
  const [instruction, setInstruction] = useState('')
  const [confirm, setConfirm] = useState(null) // { run } - waits for "replace the approved design?"
  const [actionError, setActionError] = useState(null) // { message, retry }
  const [dismissedFailure, setDismissedFailure] = useState(null)
  const inFlight = useRef(false)

  // The design pointed at: the user's pick if it still exists, else the design the post carries.
  const current = candidates.find((c) => c.current) || null
  const target = candidates.find((c) => c.id === focusId && c.status === 'ready') || (current && current.status === 'ready' ? current : null)

  // A finished generation is announced once (the server's own result, not a timer).
  const wasGenerating = useRef(false)
  useEffect(() => {
    if (wasGenerating.current && !generating && generation) {
      if (generation.status === 'ready') notify(generation.action === 'regenerate' ? 'Design updated.' : 'Your designs are ready.', 'success')
    }
    wasGenerating.current = generating
  }, [generating, generation, notify])

  const busy = generating || generate.isPending || regenerate.isPending || select.isPending
  const approvalState = studio?.content?.approvalState
  const approvedDesign = approvalState === 'design_approved' && !!studio?.currentDesign

  function failure(error, retry) {
    const { message } = studioErrorMessage(error)
    setActionError({ message, retry })
  }

  async function run(fn, retry) {
    if (inFlight.current || busy) return
    inFlight.current = true
    setActionError(null)
    try { await fn() } catch (error) { failure(error, retry) } finally { inFlight.current = false }
  }

  const base = () => ({ contentVersion: studio.content.contentVersion, productMediaIds: chosenProductPhotos(studio, photoIds) })

  function generateAll() {
    const go = () => run(async () => { await generate.mutateAsync(base()); setFocusId(null) }, go)
    go()
  }

  function regenerateOne(candidate, { text = null, replaceApproved = false } = {}) {
    const go = () => run(async () => {
      await regenerate.mutateAsync({ ...base(), generationId: generation.id, candidateId: candidate.id, instruction: text || undefined, replaceApproved })
      if (text) setInstruction('')
    }, go)
    // changing the design the post carries, while it is approved, is a deliberate replacement
    if (candidate.current && approvedDesign && !replaceApproved) setConfirm({ run: () => regenerateOne(candidate, { text, replaceApproved: true }) })
    else go()
  }

  function selectDesign(candidate, { replaceApproved = false } = {}) {
    const go = () => run(async () => {
      const res = await select.mutateAsync({
        generationId: generation.id, candidateId: candidate.id, contentVersion: studio.content.contentVersion, designVersion: studio.content.designVersion, replaceApproved,
      })
      notify(res?.data?.alreadySelected ? 'This design is already selected.' : 'Design selected. It is now in design review.', 'success')
      setFocusId(candidate.id)
    }, go)
    if (approvedDesign && !candidate.current && !replaceApproved) setConfirm({ run: () => selectDesign(candidate, { replaceApproved: true }) })
    else go()
  }

  if (query.isLoading) return <StudioLoading />

  if (query.isError && !studio) {
    const { message, code } = studioErrorMessage(query.error, 'Could not load Creative Studio.')
    const notFound = query.error?.status === 404 || code === 'NOT_FOUND'
    return notFound
      ? <StudioNoContent message="That post was not found." detail="It may have been deleted, or it belongs to another project.">
        <Link href="/app/social-media/creative-studio" className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">Choose another post</Link>
      </StudioNoContent>
      : <StudioError title="Couldn't load Creative Studio" message={message} onRetry={() => query.refetch()} retrying={query.isFetching} testId="studio-load-error" />
  }
  if (!studio) return null
  // Concept Studio: compare concepts -> pick -> single image or carousel (posts with real product photos keep the original studio)
  if (studio.pipeline === 'concept') return <ConceptStudio projectId={projectId} publicationId={publicationId} studio={studio} />

  const failedGeneration = state !== STUDIO_STATES.GENERATING && generation?.status === 'failed' && generation.failure && dismissedFailure !== `${generation.id}:${generation.finishedAt}` ? generation : null
  const showOpenApproval = state === STUDIO_STATES.DESIGN_REVIEW || state === STUDIO_STATES.DESIGN_APPROVED || state === STUDIO_STATES.DESIGN_SELECTED
  const hasDesigns = readyCandidates(generation).length > 0 || candidates.length > 0

  return (
    <div className="space-y-5" data-testid="studio-workspace" data-state={state}>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 @min-[900px]/main:flex-row @min-[900px]/main:items-start @min-[900px]/main:justify-between">
        <StudioProgress state={state} />
        {showOpenApproval && (
          <Link href="/app/social-media/content-approvals" data-testid="open-approval" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-100">Open approval</Link>
        )}
      </div>

      <StudioContentCard studio={studio} />

      {state === STUDIO_STATES.CONTENT_PENDING ? (
        <StudioGateNotice message={studio.gate.message} />
      ) : (
        <div className="flex flex-col gap-5 @min-[1100px]/main:flex-row @min-[1100px]/main:items-start">
          <div className="min-w-0 flex-1 space-y-5">
            {state === STUDIO_STATES.DESIGN_APPROVED && (
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" data-testid="design-approved-note">
                This design is approved. Choosing a different one or changing it starts a new design version and sends the post back to design review.
              </p>
            )}
            {(state === STUDIO_STATES.DESIGN_REVIEW) && (
              <p role="status" className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800" data-testid="design-review-note">
                The selected design is waiting for approval. Open approval to approve it, or keep refining it here.
              </p>
            )}

            <div>
              <h2 className="text-lg font-bold text-slate-900">{hasDesigns || generating ? 'Choose from 3 AI designs' : 'Create the design'}</h2>
              <div className="mt-4">
                <StudioDesignGrid
                  generation={generation}
                  generating={generating}
                  focusId={target?.id || null}
                  hasCurrent={!!studio.currentDesign}
                  canAct={!busy && studio.gate.allowed}
                  busyId={select.isPending ? select.variables?.candidateId : regenerate.isPending ? regenerate.variables?.candidateId : null}
                  onFocus={setFocusId}
                  onSelect={selectDesign}
                  onRetry={(c) => regenerateOne(c)}
                />
              </div>
            </div>

            {failedGeneration && (
              <StudioError
                title="The designs could not be created"
                message={failedGeneration.failure.message}
                onRetry={generateAll}
                retrying={busy}
                onDismiss={() => setDismissedFailure(`${failedGeneration.id}:${failedGeneration.finishedAt}`)}
                testId="generation-failed"
              />
            )}
            {actionError && <StudioError message={actionError.message} onRetry={actionError.retry ? () => { setActionError(null); actionError.retry() } : undefined} onDismiss={() => setActionError(null)} retrying={busy} />}

            <StudioActions
              hasDesigns={candidates.length > 0}
              busy={busy}
              generating={generating || generate.isPending}
              canGenerate={studio.gate.allowed}
              target={target}
              onGenerate={generateAll}
              onRegenerateSelected={() => target && regenerateOne(target)}
            />

            {candidates.length > 0 && (
              <StudioRefinePanel
                target={target}
                value={instruction}
                onChange={setInstruction}
                busy={regenerate.isPending || (generating && generation?.action === 'regenerate')}
                canAct={!busy && studio.gate.allowed}
                onApply={() => { const text = cleanInstruction(instruction); if (target && text) regenerateOne(target, { text }) }}
              />
            )}
          </div>

          <aside className="w-full shrink-0 @min-[1100px]/main:w-[320px]">
            <StudioBrandPanel studio={studio} photoIds={photoIds} onPhotosChange={setPhotoIds} disabled={busy} />
          </aside>
        </div>
      )}

      <ConfirmActionDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title="Replace the approved design?"
        description="This post's design is already approved. A new design starts a new design version and sends the post back to design review - it will need to be approved again."
        confirmLabel="Replace design"
        cancelLabel="Keep current design"
        onConfirm={() => { const next = confirm; setConfirm(null); next?.run() }}
      />
      <SocialMediaToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default StudioWorkspace

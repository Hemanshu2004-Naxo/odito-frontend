"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Check, GalleryHorizontalEnd, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Wallet } from 'lucide-react'
import { useStudioGenerate, useStudioRegenerate, useStudioSelect } from '@/hooks/useSocialMediaAI'
import { useToastQueue } from '@/hooks/useToastQueue'
import SocialMediaToastStack from '@/components/social-media/SocialMediaToastStack'
import { ConfirmActionDialog } from '@/components/social-media/ConfirmActionDialog'
import { studioErrorMessage } from '@/lib/socialMedia/studio'
import { trackDesignJob, formatUsd } from '@/lib/socialMedia/designJobs'
import { DesignProgress } from '@/components/social-media/design/DesignProgress'
import { CarouselSlidesPanel } from '@/components/social-media/design/CarouselSlidesPanel'
import { DesignPreview } from '@/components/social-media/DesignPreview'
import { StudioContentCard } from './StudioContentCard'
import { StudioGateNotice, StudioError } from './StudioNotices'

/**
 * CONCEPT STUDIO (Creative Studio on the concept pipeline). Every fact is the server's (GET /social/ai-design/studio):
 *   1. Format   single image or carousel (the caption's own 3-6 numbered/bulleted points, or Odito splits a longer caption into 3-6; the server says whether it can)
 *   2. Compare  3 DIFFERENT concepts as low-quality previews (cheap sketches: a picture, a headline, the idea)
 *   3. Pick     the chosen concept is rendered at full quality - one image, or a carousel whose hook is that concept - quality-checked and
 *               attached to the post for design review. Slides below the quality bar are marked "needs attention".
 * The jobs run on the server: leave the page and come back, or wait for the "done" notification.
 */
export function ConceptStudio({ projectId, publicationId, studio }) {
  const generate = useStudioGenerate(projectId, publicationId)
  const regenerate = useStudioRegenerate(projectId, publicationId)
  const select = useStudioSelect(projectId, publicationId)
  const { toasts, notify, dismiss } = useToastQueue()
  const generation = studio.generation
  // the default follows the server's rule (the calendar plan, else the caption's list) - the same as Content Approvals; never just 'single'
  const recommended = studio.formats?.recommended || null
  const [format, setFormat] = useState(recommended?.recommended === 'carousel' && studio.formats?.carousel?.allowed ? 'carousel' : 'single')
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const active = !!generation?.active
  const busy = active || generate.isPending || regenerate.isPending || select.isPending
  const allowed = studio.gate.allowed
  const approvedDesign = studio.content.approvalState === 'design_approved' && !!studio.currentDesign
  const carouselOk = !!studio.formats?.carousel?.allowed
  const candidates = generation?.candidates || []
  const comparing = generation?.phase === 'compare'
  const rendered = generation && generation.phase !== 'compare' && generation.status === 'ready'
  const label = `Design for this ${studio.content.platform === 'instagram' ? 'Instagram' : 'Facebook'} post`

  // a finished job is announced by DesignJobsWatcher (on this page or any other); here the progress and the result show it
  async function run(fn) {
    if (busy) return
    setError(null)
    try { await fn() } catch (e) { setError(studioErrorMessage(e).message) }
  }

  const startCompare = () => run(async () => {
    await generate.mutateAsync({ contentVersion: studio.content.contentVersion, format })
    trackDesignJob({ projectId, publicationId, label })
  })
  const another = (c) => run(async () => {
    await regenerate.mutateAsync({ contentVersion: studio.content.contentVersion, generationId: generation.id, candidateId: c.id })
  })
  const pick = (c, replaceApproved = false) => {
    if (approvedDesign && !replaceApproved) { setConfirm(() => () => pick(c, true)); return }
    run(async () => {
      await select.mutateAsync({ generationId: generation.id, candidateId: c.id, contentVersion: studio.content.contentVersion, designVersion: studio.content.designVersion, replaceApproved, format })
      trackDesignJob({ projectId, publicationId, label })
    })
  }

  return (
    <div className="space-y-5" data-testid="concept-studio" data-phase={generation?.phase || 'none'}>
      <StudioContentCard studio={studio} />

      {!allowed ? <StudioGateNotice message={studio.gate.message} /> : (
        <div className="flex flex-col gap-5 @min-[1100px]/main:flex-row @min-[1100px]/main:items-start">
          <div className="min-w-0 flex-1 space-y-5">
            {/* 1. format */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="format-title">
              <h2 id="format-title" className="text-base font-bold text-slate-900">1. Format</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Design format">
                {[
                  { id: 'single', icon: ImageIcon, title: 'Single image', text: 'One designed image for the post.' },
                  { id: 'carousel', icon: GalleryHorizontalEnd, title: 'Carousel', text: !carouselOk ? studio.formats?.carousel?.reason || 'Not available for this caption.'
                    : studio.formats.carousel.points ? `A hook slide, one slide per point (${studio.formats.carousel.points}), and a call-to-action slide.`
                      : 'A hook slide, 3 to 8 slides with the main points of your caption, and a call-to-action slide.' },
                ].map((o) => {
                  const disabled = busy || (o.id === 'carousel' && !carouselOk)
                  const on = format === o.id
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => setFormat(o.id)} data-testid={`format-${o.id}`}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${on ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-60`}>
                      <o.icon className={`mt-0.5 h-5 w-5 shrink-0 ${on ? 'text-violet-700' : 'text-slate-500'}`} aria-hidden />
                      <span><span className="block text-sm font-semibold text-slate-900">{o.title}</span><span className="mt-0.5 block text-xs text-slate-500">{o.text}</span></span>
                    </button>
                  )
                })}
              </div>
              {recommended?.source === 'plan' && recommended.plannedFormat === 'carousel' && (
                <p className="mt-2 text-xs text-slate-500" data-testid="format-planned">
                  {recommended.needsChoice ? recommended.message : 'Planned as a carousel in your content calendar.'}
                </p>
              )}
            </section>

            {/* 2. compare */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="compare-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="compare-title" className="text-base font-bold text-slate-900">2. Compare 3 concepts</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Quick low-quality previews of three different ideas. Only the one you pick is made at full quality.</p>
                </div>
                <button type="button" onClick={startCompare} disabled={busy} data-testid="create-concepts" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {generate.isPending || (active && comparing) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {candidates.length ? 'New concepts' : 'Create 3 concepts'}
                </button>
              </div>

              {active && comparing && <div className="mt-4"><DesignProgress generation={generation} title="Creating 3 concepts" /></div>}

              {candidates.length > 0 && (
                <ul className="mt-4 grid gap-4 @min-[700px]/main:grid-cols-3" data-testid="compare-grid">
                  {candidates.map((c) => (
                    <li key={c.id} data-testid="concept-card" data-status={c.status} className={`flex flex-col overflow-hidden rounded-xl border bg-white ${c.picked ? 'border-violet-500 ring-1 ring-violet-500' : 'border-slate-200'}`}>
                      <div className="relative flex aspect-[4/5] items-center justify-center bg-slate-100">
                        {c.status === 'ready' && c.preview?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.preview.url} alt={`Concept preview: ${c.concept?.headline || ''}`} className="h-full w-full object-contain" />
                        ) : c.status === 'pending' ? (
                          <span className="flex flex-col items-center gap-2 text-xs text-slate-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Sketching…</span>
                        ) : <span className="px-4 text-center text-xs text-red-600">{c.failure?.message || 'This preview could not be made.'}</span>}
                        <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Preview · low quality</span>
                        {c.picked && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white"><Check className="h-3 w-3" aria-hidden />Picked</span>}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{c.label || c.concept?.label || 'Concept'}</p>
                        <p className="text-sm font-bold leading-snug text-slate-900">{c.concept?.headline}</p>
                        <p className="text-xs leading-relaxed text-slate-500">{c.concept?.bigIdea}</p>
                        <div className="mt-auto flex gap-2 pt-2">
                          <button type="button" onClick={() => pick(c)} disabled={busy || c.status !== 'ready'} data-testid="use-concept" className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                            {format === 'carousel' ? 'Make the carousel' : 'Use this concept'}
                          </button>
                          <button type="button" onClick={() => another(c)} disabled={busy} aria-label="Try another idea for this concept" title="Try another idea" className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" aria-hidden /></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 3. the design */}
            {(active && !comparing) && <DesignProgress generation={generation} title={generation.phase === 'slide' ? 'Regenerating a slide' : generation.format === 'carousel' ? 'Making your carousel' : 'Making your design'} />}
            {error && <StudioError message={error} onDismiss={() => setError(null)} />}
            {generation?.status === 'failed' && !active && generation.failure && <StudioError title="The design could not be made" message={generation.failure.message} onRetry={startCompare} retrying={busy} testId="concept-failed" />}

            {rendered && studio.currentDesign && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="result-title" data-testid="concept-result">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="result-title" className="text-base font-bold text-slate-900">3. Your design {studio.currentDesign.format === 'carousel' ? `· ${studio.currentDesign.slides.length} slides` : ''}</h2>
                  <Link href="/app/social-media/content-approvals" data-testid="open-approval" className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">Open approval</Link>
                </div>
                <div className="mt-4">
                  {studio.currentDesign.format === 'carousel' ? (
                    <CarouselSlidesPanel projectId={projectId} publicationId={publicationId} media={studio.currentDesign.slides.map((url) => ({ url, type: 'image' }))}
                      versions={{ contentVersion: studio.content.contentVersion, designVersion: studio.content.designVersion }} approvalState={studio.content.approvalState} onNotice={notify} />
                  ) : (
                    <div className="space-y-2">
                      <DesignPreview src={studio.currentDesign.url} alt="Post design" />
                      {generation.single?.qc && (
                        <p className={`text-sm ${generation.single.qc.needsAttention ? 'text-amber-800' : 'text-slate-600'}`} data-testid="single-qc">
                          Quality check {generation.single.qc.score}/10{generation.single.qc.needsAttention ? ` · needs attention: ${generation.single.qc.needsAttention.reasons?.[0] || ''}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* costs */}
          <aside className="w-full shrink-0 space-y-4 @min-[1100px]/main:w-[300px]">
            {studio.brand?.fonts?.unavailable?.length > 0 && (
              <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="brand-font-unavailable">
                Your brand font{studio.brand.fonts.unavailable.length > 1 ? 's' : ''} {studio.brand.fonts.unavailable.map((f) => `“${f}”`).join(' and ')} {studio.brand.fonts.unavailable.length > 1 ? 'are' : 'is'} not available to the designer, so a fallback font is used.{' '}
                <Link href="/app/social-media/business-profile" className="font-semibold underline">Upload the font file in Brand Kit</Link>.
              </p>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="design-costs" aria-labelledby="cost-title">
              <h2 id="cost-title" className="flex items-center gap-2 text-sm font-bold text-slate-900"><Wallet className="h-4 w-4 text-slate-500" aria-hidden />Design cost</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-2"><dt className="text-slate-500">This post</dt><dd className="font-semibold text-slate-900" data-testid="cost-post">{formatUsd(studio.costs?.post?.usd ?? 0)}</dd></div>
                <p className="-mt-2 text-xs text-slate-400">{studio.costs?.post?.calls || 0} AI calls · brief, headline check, images, quality checks, retries</p>
                <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-3"><dt className="text-slate-500">This brand, {studio.costs?.month?.key || 'this month'}</dt><dd className="font-semibold text-slate-900" data-testid="cost-month">{formatUsd(studio.costs?.month?.usd ?? 0)}</dd></div>
                <p className="-mt-2 text-xs text-slate-400">{studio.costs?.month?.generations || 0} design jobs this month</p>
              </dl>
              {generation?.costUsd != null && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Latest job: {formatUsd(generation.costUsd)}</p>}
            </section>
          </aside>
        </div>
      )}

      <ConfirmActionDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o) setConfirm(null) }}
        title="Replace the approved design?"
        description="This post's design is already approved. The new design starts a new design version and sends the post back to design review."
        confirmLabel="Replace design"
        cancelLabel="Keep current design"
        onConfirm={() => { const next = confirm; setConfirm(null); next?.() }}
      />
      <SocialMediaToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

export default ConceptStudio

"use client"

import { useRef } from 'react'
import { ImagePlus, Loader2, Type, Upload } from 'lucide-react'
import { DesignPreview } from './DesignPreview'
import { DesignGenerateControl } from './DesignGenerateControl'
import { CarouselSlidesPanel } from './design/CarouselSlidesPanel'
import { CarouselPreview } from './design/CarouselPreview'

/**
 * The post's DESIGN as it exists today: its media (an image or video that was
 * uploaded through Odito's own upload endpoint). A design is either an image Odito's AI drew for the
 * approved caption (DesignGenerateControl) or a file uploaded by hand — the same upload the post composer
 * uses. Whatever the media is, it is what the backend versions and what a
 * design approval is bound to: replacing it creates a new design version and
 * withdraws any earlier design approval.
 */
export function DesignApprovalPanel({ post, projectId = null, uploading = false, error = null, onReplace, wide = false }) {
  const inputRef = useRef(null)
  const a = post.approval
  const hasMedia = post.media.length > 0
  const first = post.media[0]
  const canReplace = post.canEdit

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,video/*"
      className="sr-only"
      aria-label="Upload design file"
      data-testid="design-file-input"
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) onReplace(file)
      }}
    />
  )

  // A Facebook post without media is a complete text post: no design step, no empty box - one line, and an optional image.
  if (!hasMedia && post.platform !== 'instagram') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5" data-testid="design-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-800" data-testid="design-text-post">
          <Type className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span><span className="font-semibold">Text post</span> · no design needed</span>
        </p>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {canReplace && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title={a.managed && a.state !== 'content_review' ? 'Adding an image sends the post to design review' : undefined}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Add image'}
            </button>
            {fileInput}
          </>
        )}
      </div>
      {/* optional: an AI design for the approved caption (it then goes to design review) */}
      {projectId && <DesignGenerateControl projectId={projectId} post={post} />}
      </div>
    )
  }

  const designStatus = !a.managed
    ? null
    : a.state === 'design_approved'
      ? (a.designAutoApproved ? 'Approved automatically (design approval is not required)' : `Approved${a.designApprovedByName ? ` by ${a.designApprovedByName}` : ''}`)
      : a.state === 'design_review'
        ? (a.needsChanges ? 'Changes requested' : 'Waiting for approval')
        : a.state === 'content_approved'
          ? 'Not submitted yet'
          : 'Starts after content is approved'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="design-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">Design</h2>
        {a.managed && <span className="text-xs font-medium text-slate-500">Version {a.designVersion}</span>}
      </div>
      {designStatus && <p className="mt-1 text-sm text-slate-500" data-testid="design-status">{designStatus}</p>}

      {(() => {
        // the actions under the design: generate (AI), errors, replace (upload)
        const actions = (
          <>
            {projectId && <DesignGenerateControl projectId={projectId} post={post} />}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {canReplace && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{post.status === 'scheduled' ? 'Replacing the design removes the schedule and needs design approval again. ' : ''}Or upload the final image or video yourself.</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading…' : hasMedia ? 'Replace design' : 'Add design'}
                </button>
                {fileInput}
              </div>
            )}
          </>
        )
        const isCarousel = post.media.length > 1 && projectId
        const preview = (
      <div className={wide ? '' : 'mt-4'}>
        {post.media.length > 1 ? (
          // a CAROUSEL: approving the design approves every slide; each slide can be regenerated, moved or removed (back to review)
          projectId
            ? <CarouselSlidesPanel projectId={projectId} publicationId={post.id} media={post.media} versions={{ contentVersion: post.approval.contentVersion, designVersion: post.approval.designVersion }} approvalState={a.state} canEdit={canReplace} wide={wide}>{wide ? actions : null}</CarouselSlidesPanel>
            : <CarouselPreview slides={post.media.map((m, i) => ({ key: `m${i}`, url: m.url }))} />
        ) : hasMedia && first.type === 'image' ? (
          <DesignPreview src={first.url} alt="Post design" />
        ) : hasMedia && first.type === 'video' ? (
          <video src={first.url} controls className="aspect-video w-full rounded-xl bg-slate-900" aria-label="Post design video" />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-sm font-medium text-slate-600">No image or video on this post</p>
            <p className="text-xs text-slate-400">It will be published as a text post{post.platform === 'instagram' ? ' — Instagram needs media' : ''}.</p>
          </div>
        )}
      </div>
        )
        if (!wide) return <>{preview}{actions}</>
        // a full-width band: the design on the left, the actions on the right (a carousel lays itself out the same way)
        if (isCarousel) return <div className="mt-4">{preview}</div>
        return (
          <div className="mt-4 grid grid-cols-1 items-start gap-5 @min-[900px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {preview}
            <div className="min-w-0">{actions}</div>
          </div>
        )
      })()}
    </div>
  )
}

export default DesignApprovalPanel

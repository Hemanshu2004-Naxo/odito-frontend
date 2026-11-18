"use client"

import { useLayoutEffect, useRef } from 'react'
import { Check, Loader2, MessageSquareWarning } from 'lucide-react'
import { pluralize } from '@/lib/pluralize'
import { ContentField, CONTENT_FIELD_CLASS } from './ContentField'

const GREEN = 'bg-emerald-50 text-emerald-700 border-emerald-200'
const AMBER = 'bg-amber-50 text-amber-700 border-amber-200'
const SLATE = 'bg-slate-100 text-slate-600 border-slate-200'
const SKY = 'bg-sky-50 text-sky-700 border-sky-200'

/** Header badge from the backend's approval verdict — never a hardcoded "approved". */
function badgeFor(post) {
  const a = post.approval
  if (!a.managed) return { label: 'Not submitted', className: SLATE }
  if (a.needsChanges) return { label: a.label, className: AMBER }
  if (a.state === 'design_approved') return { label: post.status === 'scheduled' ? 'Approved · scheduled' : 'Approved · ready to schedule', className: GREEN }
  if (a.state === 'content_review') return { label: a.label, className: SKY }
  return { label: a.label, className: SKY }
}

/** Facebook shows about this many characters of a caption in the feed before "See more". */
export const FACEBOOK_FEED_CHARS = 125

/** A textarea that grows with its text up to `share` of the viewport, and opens scrolled to the top when another post is shown. */
function useAutoGrow(value, resetKey, share = 0.6) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const max = (typeof window !== 'undefined' ? window.innerHeight : 800) * share
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden'
  }, [value, share])
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = 0 }, [resetKey])
  return ref
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** The reviewer's last "request changes" (reason, who, when), while it is still unanswered. */
function ChangesRequestedNotice({ approval }) {
  const c = approval.changesRequested
  if (!c || !approval.needsChanges) return null
  return (
    <div role="status" data-testid="changes-requested" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm">
      <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="font-semibold text-amber-900">{c.stage === 'design' ? 'Design' : 'Content'} changes requested</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-amber-900">{c.reason}</p>
        <p className="mt-1 text-xs text-amber-700">
          {c.byName ? `${c.byName} · ` : ''}{formatWhen(c.at)}
        </p>
      </div>
    </div>
  )
}

/**
 * "Edit content" card for the selected REAL post. The caption is the post's
 * actual `content`; saving it goes through the existing edit endpoint, and the
 * BACKEND decides what an edit does to the approval (editing approved content
 * sends the post back to review). Topic / CTA / hashtags / AI regeneration are
 * not part of the post data model, so they are not offered.
 */
export function ContentEditor({ post, caption, onCaptionChange, dirty, saving, onSave, error, wide = false }) {
  const badge = badgeFor(post)
  const editable = post.canEdit
  // as a full-width band the caption box stays short (the feed preview and save sit beside it)
  const textRef = useAutoGrow(caption, post.id, wide ? 0.42 : 0.6)
  const length = caption.length
  const feed = post.platform === 'facebook' && length > FACEBOOK_FEED_CHARS ? caption.slice(0, FACEBOOK_FEED_CHARS) : null
  const approvedWarning = post.approval.managed && (post.approval.state === 'design_approved' || post.approval.state === 'content_approved') && editable

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">Edit content</h2>
        <span data-testid="approval-badge" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>
          <Check className="h-3.5 w-3.5" />
          {badge.label}
        </span>
      </div>

      <div className={wide ? 'mt-5 grid grid-cols-1 items-start gap-5 @min-[900px]/main:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]' : 'mt-5 flex flex-col gap-4'} data-testid="content-editor-body">
        {!wide && <ChangesRequestedNotice approval={post.approval} />}

        <ContentField label="Caption" helper={approvedWarning ? (post.status === 'scheduled' ? 'Editing approved content withdraws its approval and removes its schedule — it goes back to review and must be scheduled again.' : 'Editing approved content withdraws its approval — it goes back to review.') : undefined}>
          <textarea
            ref={textRef}
            aria-label="Caption"
            aria-describedby="caption-count"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            rows={8}
            disabled={!editable || saving}
            data-testid="caption-input"
            className={`${CONTENT_FIELD_CLASS} min-h-[12rem] resize-none leading-relaxed disabled:cursor-not-allowed disabled:bg-slate-50`}
          />
          <div id="caption-count" className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
            <span data-testid="caption-count">{pluralize(length, 'character')}</span>
            {post.platform === 'facebook' && <span>Facebook shows the first {FACEBOOK_FEED_CHARS} characters in the feed</span>}
          </div>
          {feed && !wide && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" data-testid="feed-preview">
              <span className="font-semibold text-slate-900">Shown in feed: </span>
              <span className="whitespace-pre-wrap">{feed}</span>
              <span className="font-semibold text-slate-500"> … See more</span>
            </p>
          )}
        </ContentField>

        <div className={wide ? 'flex min-w-0 flex-col gap-4' : 'contents'}>
        {wide && <ChangesRequestedNotice approval={post.approval} />}
        {feed && wide && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" data-testid="feed-preview">
            <span className="font-semibold text-slate-900">Shown in feed: </span>
            <span className="whitespace-pre-wrap">{feed}</span>
            <span className="font-semibold text-slate-500"> … See more</span>
          </p>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {editable && (
          <div className={`flex items-center gap-2 ${wide ? 'justify-start' : 'justify-end'}`}>
            {dirty && <span className="text-xs text-slate-600">Unsaved changes</span>}
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default ContentEditor

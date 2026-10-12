"use client"

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import {
  useSocialContentCalendar, useCalendarContentGenerationSync, useGenerateSocialCalendarItemContent, useSocialPublicationList,
} from '@/hooks/useSocialMediaAI'
import { mapPublicationToPost } from '@/lib/socialMedia/postMapper'
import { plannedCopyFor } from '@/lib/socialMedia/contentCalendar'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { Skeleton } from '@/components/ui/skeleton'
import { StudioWorkspace } from './StudioWorkspace'
import { StudioNoContent, StudioError } from './StudioNotices'

const PLATFORM_LABEL = { facebook: 'Facebook', instagram: 'Instagram' }
const CALENDAR_HREF = '/app/social-media/content-calendar'
const studioHref = (publicationId) => `/app/social-media/creative-studio?publicationId=${encodeURIComponent(publicationId)}`
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Opened from the Content Calendar (?itemId=&platform=): find the REAL publication(s) written from that plan item. One post opens its
 * studio; several (one per platform) let the user pick; none says "Content has not been generated yet." and offers to generate it through
 * the existing calendar content generator - nothing is invented, and the plan is never approved from here.
 */
function CalendarItemEntry({ projectId, itemId, platform }) {
  const calendar = useSocialContentCalendar(projectId)
  const content = useCalendarContentGenerationSync(projectId)
  const generate = useGenerateSocialCalendarItemContent(projectId)
  const inFlight = useRef(false)

  const item = useMemo(() => (calendar.data?.items || []).find((i) => i.id === itemId) || null, [calendar.data, itemId])
  const publications = useMemo(() => (item?.publications || []).filter((p) => p.status !== 'cancelled' && (!platform || p.platform === platform)), [item, platform])

  if (calendar.isLoading) return <Skeleton className="h-40 rounded-2xl bg-slate-200" aria-label="Finding the post" data-testid="studio-resolving" />
  if (calendar.isError && !calendar.data) return <StudioError title="Couldn't load your content plan" message={describeApiError(calendar.error, 'The request to Odito failed.').message} onRetry={() => calendar.refetch()} retrying={calendar.isFetching} />
  if (!item) return <StudioNoContent message="That calendar item was not found." detail="It may have been removed from the plan."><Link href={CALENDAR_HREF} className={buttonClass}>Open Content Calendar</Link></StudioNoContent>

  if (publications.length === 1) return <StudioWorkspace projectId={projectId} publicationId={publications[0].id} />

  if (publications.length > 1) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="studio-choose-platform">
        <p className="text-base font-semibold text-slate-800">This item has a post for each platform</p>
        <p className="mt-1 text-sm text-slate-500">Choose which one to design.</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {publications.map((p) => <li key={p.id}><Link href={studioHref(p.id)} className={buttonClass}>{PLATFORM_LABEL[p.platform] || p.platform}</Link></li>)}
        </ul>
      </div>
    )
  }

  // no post yet: the plan item's own content generator (it needs an approved plan; the server enforces it)
  const writing = content.data?.status === 'generating' && content.data.generation?.calendarItemId === itemId
  const failed = content.data?.status === 'failed' && content.data.generation?.calendarItemId === itemId ? content.data.generation.failure : null
  const target = platform || item.platforms?.[0]
  const planApproved = item.status === 'plan_approved' || item.status === 'content_generated'
  const hasPlanCaption = !!plannedCopyFor(item, target).caption
  const error = generate.isError ? describeApiError(generate.error, 'Could not start writing the content.').message : null

  function start() {
    if (inFlight.current || writing) return
    inFlight.current = true
    // no mode: the server uses the caption written in the plan when there is one (exactly as written, no AI), and AI only when there is none
    generate.mutate({ itemId, platform: target, expectedRevision: item.revision }, { onSettled: () => { inFlight.current = false } })
  }

  return (
    <StudioNoContent detail={planApproved ? (hasPlanCaption ? 'Odito will create the post from the caption written in this plan item, exactly as it is. Once the content is approved, you can design it here.' : 'This plan item has no caption yet, so Odito will write the post. Once the content is approved, you can design it here.') : 'This plan item has not been approved yet. Approve it in the Content Calendar, then generate its content.'}>
      {planApproved
        ? <button type="button" onClick={start} disabled={writing || generate.isPending} data-testid="generate-content-button" className={buttonClass}>{(writing || generate.isPending) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{writing ? 'Writing the post…' : (hasPlanCaption ? 'Create post from plan' : 'Generate Content')}</button>
        : <Link href={CALENDAR_HREF} className={buttonClass}>Open Content Calendar</Link>}
      {(error || failed) && <p role="alert" className="w-full text-sm text-red-600" data-testid="generate-content-error">{error || failed.message}</p>}
    </StudioNoContent>
  )
}

/** No post chosen: the real posts in the approval workflow, each opening its own studio. */
function PostPicker({ projectId }) {
  const list = useSocialPublicationList(projectId, { approval: 'managed' })
  const posts = useMemo(() => (list.data?.publications || []).filter((p) => p.status === 'draft').map(mapPublicationToPost).filter(Boolean), [list.data])

  if (list.isLoading) return <Skeleton className="h-40 rounded-2xl bg-slate-200" aria-label="Loading your posts" data-testid="studio-picker-loading" />
  if (list.isError && !list.data) return <StudioError title="Couldn't load your posts" message={describeApiError(list.error, 'The request to Odito failed.').message} onRetry={() => list.refetch()} retrying={list.isFetching} />
  if (!posts.length) return <StudioNoContent><Link href={CALENDAR_HREF} className={buttonClass} data-testid="generate-content-link">Generate Content</Link></StudioNoContent>

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="studio-picker">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-semibold text-slate-800">Choose a post to design</p>
        <p className="mt-0.5 text-sm text-slate-500">Designs are made for posts whose content is approved.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={studioHref(p.id)} data-testid={`studio-pick-${p.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-slate-50 @min-[641px]/main:flex-row @min-[641px]/main:items-center @min-[641px]/main:justify-between">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{p.title}</span>
                <span className="block text-xs text-slate-500">{PLATFORM_LABEL[p.platform] || p.platform}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-violet-700">{p.approval.label || 'Open'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Which post Creative Studio opens, from the URL: a publication, a calendar item, or a choice of real posts. */
export function StudioEntry({ projectId, publicationId, itemId, platform }) {
  if (publicationId) return <StudioWorkspace key={publicationId} projectId={projectId} publicationId={publicationId} />
  if (itemId) return <CalendarItemEntry projectId={projectId} itemId={itemId} platform={platform} />
  return <PostPicker projectId={projectId} />
}

export default StudioEntry

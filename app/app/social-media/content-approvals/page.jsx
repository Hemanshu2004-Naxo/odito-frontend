"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ApprovalTabs } from '@/components/social-media/ApprovalTabs'
import { ApprovalPostList } from '@/components/social-media/ApprovalPostList'
import { ContentEditor } from '@/components/social-media/ContentEditor'
import { DesignApprovalPanel } from '@/components/social-media/DesignApprovalPanel'
import { PostBrief } from '@/components/social-media/PostBrief'
import { ApprovalInfoCard } from '@/components/social-media/ApprovalInfoCard'
import { ApprovalActionBar } from '@/components/social-media/ApprovalActionBar'
import { RequestChangesDialog } from '@/components/social-media/RequestChangesDialog'
import { ConfirmSchedulePanel } from '@/components/social-media/ConfirmSchedulePanel'
import { PostListSkeleton, PostListError } from '@/components/social-media/ScheduledPostList'
import SocialMediaToastStack from '@/components/social-media/SocialMediaToastStack'
import { ApproveAttentionDialog } from '@/components/social-media/design/ApproveAttentionDialog'
import { useSlideRegenerate } from '@/hooks/useSocialMediaAI'
import { trackDesignJob } from '@/lib/socialMedia/designJobs'
import { useToastQueue } from '@/hooks/useToastQueue'
import { useProject } from '@/contexts/ProjectContext'
import { useUploadSocialMedia } from '@/hooks/useDashboardQueries'
import {
  useSocialAccounts, useApprovalPosts, useApprovalSettings, useSubmitContentForReview, useApproveContent, useRequestContentChanges,
  useSubmitDesignForReview, useApproveDesign, useRequestDesignChanges, useUpdatePostContent, useReschedulePost, useSocialContentCalendar,
  nextStateAfterContentApproval,
} from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { mapPublicationToApprovalPost, captionKey } from '@/lib/socialMedia/postMapper'
import { APPROVAL_TABS } from '@/lib/socialMediaAIDummyData'

const VALID_TAB_IDS = new Set(APPROVAL_TABS.map((tab) => tab.id))

const EMPTY_COPY = {
  'content-review': { title: 'No content waiting for review', message: 'Posts submitted for review appear here until their content is approved.' },
  'design-review': { title: 'No designs waiting for review', message: 'Posts whose design was submitted for approval appear here.' },
  'needs-changes': { title: 'Nothing needs changes', message: 'Posts where a reviewer requested changes appear here with the reason.' },
  approved: { title: 'Nothing approved yet', message: 'Posts whose content (and design) were approved appear here, ready to schedule.' },
  drafts: { title: 'No drafts to submit', message: 'Drafts that have not been submitted for approval appear here.' },
}

/**
 * Social Media AI — Content Approvals, driven by the real approval workflow
 * (backend: social_meta approvalWorkflow.js, exposed on /social/publishing).
 * Every row is a real SocialPublication; submit / approve / request-changes
 * call the real endpoints and the lists are refetched from the database
 * afterwards — nothing is edited in local state, and the backend (not this
 * page) decides what each stage allows. Approving sends the version the
 * reviewer actually saw, so a post edited in the meantime is refused rather
 * than silently approved.
 *
 * Not offered, because nothing backs them: topic / CTA / hashtags / goal /
 * voice fields and AI regeneration (the post data model has only a caption and
 * media), and AI design generation (no design backend; the design is the
 * uploaded media).
 */
function ContentApprovalsContent() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const { activeProjectId } = useProject()
  const { toasts, notify, dismiss } = useToastQueue()

  const accounts = useSocialAccounts(activeProjectId)
  const list = useApprovalPosts(activeProjectId)
  const settings = useApprovalSettings(activeProjectId)
  const calendar = useSocialContentCalendar(activeProjectId)
  const plannedDates = useMemo(() => {
    const map = new Map()
    for (const item of calendar.data?.items || []) {
      for (const id of item.publicationIds || []) map.set(String(id), item.date)
      map.set(`item:${item.id}`, item.date)
    }
    return map
  }, [calendar.data])
  const plannedDateOf = (post) => (post ? (plannedDates.get(String(post.id)) || (post.plan?.calendarItemId ? plannedDates.get(`item:${post.plan.calendarItemId}`) : null) || null) : null)

  const submitContent = useSubmitContentForReview(activeProjectId)
  const approveContent = useApproveContent(activeProjectId)
  const requestContentChanges = useRequestContentChanges(activeProjectId)
  const submitDesign = useSubmitDesignForReview(activeProjectId)
  const approveDesign = useApproveDesign(activeProjectId)
  const requestDesignChanges = useRequestDesignChanges(activeProjectId)
  const updatePost = useUpdatePostContent(activeProjectId)
  const reschedule = useReschedulePost(activeProjectId)
  const upload = useUploadSocialMedia(activeProjectId)

  const [activeTab, setActiveTab] = useState(VALID_TAB_IDS.has(requestedTab) ? requestedTab : 'content-review')
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [caption, setCaption] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [designError, setDesignError] = useState(null)
  const [changesStage, setChangesStage] = useState(null) // 'content' | 'design' | null — the dialog
  const [dialogError, setDialogError] = useState(null)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState(null)
  const [attention, setAttention] = useState(null) // { post, items } - the slides that need attention, from a refused approval
  const slideRegenerate = useSlideRegenerate(activeProjectId, attention?.post?.id)

  const tabPosts = useMemo(() => list.posts.filter((p) => p.approvalTabs.includes(activeTab)), [list.posts, activeTab])
  const counts = useMemo(
    () => Object.fromEntries(APPROVAL_TABS.map((tab) => [tab.id, list.posts.filter((p) => p.approvalTabs.includes(tab.id)).length])),
    [list.posts],
  )
  const tabCounts = list.isLoading || list.isError ? Object.fromEntries(APPROVAL_TABS.map((tab) => [tab.id, null])) : counts

  // Keep a valid selection: the selected post stays selected while it is in the
  // tab (a status change does not yank it away), otherwise fall to the first.
  const selectedPost = useMemo(() => tabPosts.find((p) => p.id === selectedPostId) || tabPosts[0] || null, [tabPosts, selectedPostId])
  const selectedId = selectedPost?.id ?? null

  // The editor shows the saved caption; it resets whenever the post or its
  // stored content changes (selection, a save, a refetch after another action).
  useEffect(() => {
    setCaption(selectedPost?.content ?? '')
    setActionError(null)
    setDesignError(null)
    setScheduling(false)
    setScheduleError(null)
  }, [selectedId, selectedPost?.content])

  const dirty = !!selectedPost && captionKey(caption) !== captionKey(selectedPost.content)
  const accountName = selectedPost ? accounts[selectedPost.platform]?.name : null

  function handleTabChange(tabId) {
    setActiveTab(tabId)
    setSelectedPostId(null)
  }

  /** One place for "run a mutation, toast the outcome, show the backend's refusal". */
  // Set synchronously: a fast double-click can reach this twice before React re-renders the disabled button.
  const actionInFlight = useRef(false)
  /**
   * "Approve design" with the quality guard: the server refuses a design whose slides need attention (DESIGN_NEEDS_ATTENTION + the list);
   * the reviewer then approves anyway (recorded with their name) or regenerates the flagged slide.
   */
  function approveDesignGuarded(post, acknowledgeAttention = false) {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setPendingAction('approve-design')
    setActionError(null)
    approveDesign.mutate({ publicationId: post.id, version: post.approval.designVersion, acknowledgeAttention }, {
      onSuccess: () => { notify(acknowledgeAttention ? 'Design approved, with the slides that need attention.' : 'Design approved.', 'success'); setAttention(null) },
      onError: (error) => {
        if ((error?.details?.code || error?.code) === 'DESIGN_NEEDS_ATTENTION') { setAttention({ post, items: error.details?.attention || [] }); return }
        const message = describeApiError(error, 'That action could not be completed.').message
        setActionError(message)
        notify(message, 'danger')
      },
      onSettled: () => { actionInFlight.current = false; setPendingAction(null) },
    })
  }

  async function regenerateFlagged() {
    const { post, items } = attention
    const first = items[0]
    if (!first?.key) { window.location.assign(`/app/social-media/creative-studio?publicationId=${encodeURIComponent(post.id)}`); return }
    try {
      await slideRegenerate.mutateAsync({ publicationId: post.id, contentVersion: post.approval.contentVersion, designVersion: post.approval.designVersion, slideKey: first.key })
      trackDesignJob({ projectId: activeProjectId, publicationId: post.id, label: `Slide ${first.slide}` })
      notify(`Regenerating slide ${first.slide}…`, 'default')
      setAttention(null)
    } catch (error) {
      notify(describeApiError(error, 'The slide could not be regenerated.').message, 'danger')
    }
  }

  function run(label, mutation, variables, { success, onSuccess } = {}) {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setPendingAction(label)
    setActionError(null)
    mutation.mutate(variables, {
      onSuccess: (res) => {
        if (success) notify(success, 'success')
        onSuccess?.(res)
      },
      onError: (error) => {
        const message = describeApiError(error, 'That action could not be completed.').message
        setActionError(message)
        notify(message, 'danger')
      },
      onSettled: () => { actionInFlight.current = false; setPendingAction(null) },
    })
  }

  /**
   * An edit can move the post to another tab (approval withdrawn; schedule removed). Follow it there, so the user sees where
   * it went and what it needs next instead of an empty list. The real post comes from the server's response.
   */
  function followPostToItsTab(publication) {
    if (!publication) return
    const tabs = mapPublicationToApprovalPost(publication).approvalTabs
    if (tabs.length && !tabs.includes(activeTab)) {
      setActiveTab(tabs[0])
      setSelectedPostId(publication.id)
    }
  }

  const MOVED_TO = { design_review: 'Content approved — moved to Design review.', design_approved: 'Content approved — moved to Approved.', content_approved: 'Content approved — moved to Approved. Add a design before it can be scheduled.' }

  function handleApproveContent(post = selectedPost) {
    if (!post || actionInFlight.current) return
    actionInFlight.current = true
    setPendingAction('approve-content')
    setActionError(null)
    const variables = { publicationId: post.id, version: post.approval.contentVersion, nextState: nextStateAfterContentApproval(post, settings.data) }
    approveContent.mutate(variables, {
      onSuccess: (res) => {
        const state = res?.data?.publication?.approval?.state
        notify(MOVED_TO[state] || 'Content approved.', 'success')
        // the post has left this tab: the next post waiting here is selected (or the empty state shows)
        setSelectedPostId(null)
      },
      onError: (error) => {
        const message = describeApiError(error, 'The content could not be approved.').message
        setActionError(message)
        notify(`Not approved: ${message}`, 'danger', { action: { label: 'Retry', onClick: () => handleApproveContent(post) } })
      },
      onSettled: () => { actionInFlight.current = false; setPendingAction(null) },
    })
  }

  const SCHEDULE_REMOVED = 'The change withdrew the post\'s approval, so its schedule was removed. Approve it again, then schedule it again.'

  function handleSave() {
    if (!selectedPost || !dirty) return
    run('save', updatePost, { publicationId: selectedPost.id, content: caption }, {
      onSuccess: (res) => {
        const after = res?.data?.publication?.approval
        const withdrawn = selectedPost.approval.managed && after && after.state !== selectedPost.approval.state
        if (res?.data?.scheduleCleared) notify(`Saved. ${SCHEDULE_REMOVED}`, 'default')
        else notify(withdrawn ? 'Saved. The change withdrew an earlier approval — it needs to be approved again.' : 'Changes saved.', withdrawn ? 'default' : 'success')
        followPostToItsTab(res?.data?.publication)
      },
    })
  }

  function handleReplaceDesign(file) {
    if (!selectedPost) return
    setDesignError(null)
    upload.mutate({ file }, {
      onSuccess: (res) => {
        const media = res?.data
        if (!media?.url) { setDesignError('The upload did not return a file. Please try again.'); return }
        updatePost.mutate({ publicationId: selectedPost.id, media: [{ url: media.url, type: media.type }] }, {
          onSuccess: (res) => {
            notify(res?.data?.scheduleCleared ? `Design replaced. ${SCHEDULE_REMOVED}` : 'Design replaced. It needs to be approved again.', 'default')
            followPostToItsTab(res?.data?.publication)
          },
          onError: (error) => setDesignError(describeApiError(error, 'Could not attach the new design.').message),
        })
      },
      onError: (error) => setDesignError(describeApiError(error, 'Upload failed.').message),
    })
  }

  function handleChangesSubmit(reason) {
    if (!selectedPost || !changesStage) return
    const isDesign = changesStage === 'design'
    const mutation = isDesign ? requestDesignChanges : requestContentChanges
    const version = isDesign ? selectedPost.approval.designVersion : selectedPost.approval.contentVersion
    setDialogError(null)
    setPendingAction('request-changes')
    mutation.mutate({ publicationId: selectedPost.id, version, reason }, {
      onSuccess: () => { setChangesStage(null); notify(`${isDesign ? 'Design' : 'Content'} changes requested.`, 'default') },
      onError: (error) => setDialogError(describeApiError(error, 'Could not request changes.').message),
      onSettled: () => setPendingAction(null),
    })
  }

  // Set synchronously on the first confirm so a fast double-click can never send two requests before React re-renders the disabled button.
  const scheduleInFlight = useRef(false)
  function handleConfirmSchedule({ scheduledAt, timezone }) {
    if (!selectedPost || scheduleInFlight.current) return
    scheduleInFlight.current = true
    setPendingAction('schedule')
    setScheduleError(null)
    reschedule.mutate({ publicationId: selectedPost.id, scheduledAt, timezone }, {
      onSuccess: () => { setScheduling(false); notify('Post scheduled.', 'success') },
      onError: (error) => setScheduleError(describeApiError(error).message),
      onSettled: () => { scheduleInFlight.current = false; setPendingAction(null) },
    })
  }

  if (!activeProjectId) {
    return (
      <div className="flex-1 space-y-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Approvals</h1>
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm" data-testid="no-project">
          <p className="text-sm font-semibold text-slate-700">No project selected</p>
          <p className="mt-1 text-sm text-slate-400">Select or create a project to review its posts.</p>
        </div>
      </div>
    )
  }

  const empty = EMPTY_COPY[activeTab]

  return (
    <div className="flex-1 space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">Approve the words, then the design, before anything is scheduled</p>
      </div>

      <ApprovalTabs tabs={APPROVAL_TABS} activeTab={activeTab} onChange={handleTabChange} counts={tabCounts} />

      {list.isLoading ? (
        <PostListSkeleton />
      ) : list.isError ? (
        <PostListError message={describeApiError(list.error, 'Posts could not be loaded.').message} onRetry={() => list.refetch()} retrying={list.isFetching} />
      ) : selectedPost ? (
        <>
          {/*
            Every section is a full-width horizontal band: the posts as a strip on top, then the selected post's design (slide left,
            controls right), its caption (editor left, feed preview right) and its brief (the facts in a row). While scheduling, the
            schedule band comes first. Inside each band the two sides stack below ~900px of main width.
          */}
          <div className="space-y-5" data-testid="approvals-layout">
            <ApprovalPostList horizontal posts={tabPosts} selectedPostId={selectedId} onSelectPost={setSelectedPostId} emptyTitle={empty.title} emptyMessage={empty.message} />

            <div className="flex min-w-0 flex-col gap-5" data-testid="approvals-workspace">
              {(() => {
                const editor = (
                  <ContentEditor
                    post={selectedPost}
                    caption={caption}
                    onCaptionChange={setCaption}
                    dirty={dirty}
                    saving={pendingAction === 'save' && updatePost.isPending}
                    onSave={handleSave}
                    error={actionError}
                    wide
                  />
                )
                const design = <DesignApprovalPanel wide post={selectedPost} projectId={activeProjectId} uploading={upload.isPending || (updatePost.isPending && pendingAction === null)} error={designError} onReplace={handleReplaceDesign} />
                const confirming = scheduling && selectedPost.canSchedule
                const schedule = confirming ? (
                  <ConfirmSchedulePanel
                    wide
                    key={selectedPost.id}
                    post={selectedPost}
                    accountName={accountName}
                    pendingAction={pendingAction === 'schedule' ? 'confirm' : null}
                    error={scheduleError}
                    onConfirm={handleConfirmSchedule}
                    onClose={() => setScheduling(false)}
                  />
                ) : null
                // full-width bands, top to bottom: (schedule, while scheduling) -> design -> edit content -> brief
                return (
                  <>
                    {schedule && <div className="min-w-0" data-testid="approvals-schedule">{schedule}</div>}
                    <div className="min-w-0" data-testid="approvals-primary">{design}</div>
                    <div className="min-w-0" data-testid="approvals-secondary">{editor}</div>
                    <div className="grid min-w-0 grid-cols-1 items-start gap-5 @min-[1000px]/main:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]" data-testid="approvals-tertiary">
                      <PostBrief wide post={selectedPost} plannedDate={plannedDateOf(selectedPost)} />
                      <ApprovalInfoCard settings={settings.data} />
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          <ApprovalActionBar
            post={selectedPost}
            pendingAction={pendingAction}
            unsaved={dirty}
            scheduling={scheduling}
            onSubmitContent={() => run('submit-content', submitContent, selectedPost.id, { success: 'Submitted for review.' })}
            onApproveContent={() => handleApproveContent()}
            onSubmitDesign={() => run('submit-design', submitDesign, selectedPost.id, { success: selectedPost.media.length === 0 && selectedPost.platform !== 'instagram' ? 'Approved — moved to Approved.' : 'Design submitted for review.' })}
            onApproveDesign={() => approveDesignGuarded(selectedPost)}
            onRequestChanges={(stage) => { setDialogError(null); setChangesStage(stage) }}
            onSchedule={() => { setScheduleError(null); setScheduling(true) }}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center" data-testid="approvals-empty">
          <p className="text-base font-semibold text-slate-800">{empty.title}</p>
          <p className="text-sm text-slate-500">{empty.message}</p>
        </div>
      )}

      {list.truncated && <p className="text-xs text-slate-400">Showing the first 500 posts.</p>}

      <RequestChangesDialog
        open={changesStage !== null}
        stage={changesStage}
        pending={pendingAction === 'request-changes'}
        error={dialogError}
        onOpenChange={(open) => { if (!open) setChangesStage(null) }}
        onSubmit={handleChangesSubmit}
      />

      <ApproveAttentionDialog
        open={!!attention}
        items={attention?.items || []}
        pending={pendingAction === 'approve-design' ? 'approve' : slideRegenerate.isPending ? 'regenerate' : null}
        onApproveAnyway={() => approveDesignGuarded(attention.post, true)}
        onRegenerate={regenerateFlagged}
        onClose={() => setAttention(null)}
      />

      <SocialMediaToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// useSearchParams needs a Suspense boundary in the Next app router.
export default function ContentApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <ContentApprovalsContent />
    </Suspense>
  )
}

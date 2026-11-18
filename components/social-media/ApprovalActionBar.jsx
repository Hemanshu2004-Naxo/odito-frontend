"use client"

import { ArrowRight, Check, Loader2 } from 'lucide-react'

const PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60'
const SECONDARY = 'inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60'

function Primary({ onClick, disabled, pending, pendingLabel, children, title, testId }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || pending} title={title} data-testid={testId} className={PRIMARY}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : children}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </button>
  )
}

/**
 * The stage-appropriate actions for the selected post. WHICH actions exist
 * comes from the backend's approval state (mapped into post.canXxx flags);
 * every click is still validated server-side and a refusal is shown. Approving
 * is disabled while the editor holds unsaved changes, so a reviewer can never
 * approve text they have not saved (and the approval always names the version
 * that is actually stored).
 */
export function ApprovalActionBar({ post, pendingAction = null, unsaved = false, onSubmitContent, onApproveContent, onSubmitDesign, onApproveDesign, onRequestChanges, onSchedule, scheduling = false }) {
  const busy = pendingAction !== null
  const unsavedHint = unsaved ? 'Save or discard your changes first' : undefined
  const a = post.approval

  let status = null
  let actions = null

  if (post.canSubmitContent) {
    status = 'This draft has not been submitted for approval.'
    actions = (
      <Primary testId="action-submit-content" onClick={onSubmitContent} disabled={unsaved || busy} title={unsavedHint} pending={pendingAction === 'submit-content'} pendingLabel="Submitting…">
        Submit for review
      </Primary>
    )
  } else if (post.canApproveContent) {
    status = a.needsChanges ? 'Changes were requested — waiting for a new version.' : 'Review the caption, then approve it or request changes.'
    actions = (
      <>
        <button type="button" data-testid="action-request-content-changes" onClick={() => onRequestChanges('content')} disabled={busy} className={SECONDARY}>Request changes</button>
        <Primary testId="action-approve-content" onClick={onApproveContent} disabled={unsaved || busy} title={unsavedHint} pending={pendingAction === 'approve-content'} pendingLabel="Approving…">
          Approve content
        </Primary>
      </>
    )
  } else if (post.canSubmitDesign && post.media.length === 0 && post.platform !== 'instagram') {
    // a text post approved before text posts skipped the design step: there is no design, so this completes the approval
    status = 'Content is approved. This is a text post, so there is no design to review.'
    actions = (
      <Primary testId="action-submit-design" onClick={onSubmitDesign} disabled={busy} pending={pendingAction === 'submit-design'} pendingLabel="Finishing…">
        Finish approval
      </Primary>
    )
  } else if (post.canSubmitDesign) {
    status = 'Content is approved. Submit the design for approval next.'
    actions = (
      <Primary testId="action-submit-design" onClick={onSubmitDesign} disabled={busy} pending={pendingAction === 'submit-design'} pendingLabel="Submitting…">
        Submit design for review
      </Primary>
    )
  } else if (post.canApproveDesign) {
    status = a.needsChanges ? 'Design changes were requested — waiting for a new design.' : 'Review the design, then approve it or request changes.'
    actions = (
      <>
        <button type="button" data-testid="action-request-design-changes" onClick={() => onRequestChanges('design')} disabled={busy} className={SECONDARY}>Request changes</button>
        <Primary testId="action-approve-design" onClick={onApproveDesign} pending={pendingAction === 'approve-design'} pendingLabel="Approving…">
          Approve design
        </Primary>
      </>
    )
  } else if (post.canSchedule) {
    status = 'Fully approved — ready to schedule.'
    actions = (
      <Primary testId="action-schedule" onClick={onSchedule} disabled={scheduling} pending={false}>
        Schedule post
      </Primary>
    )
  } else if (post.scheduleBlocked) {
    status = post.scheduleBlocked
    actions = (
      <span data-testid="schedule-blocked" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500">
        Can&apos;t schedule yet
      </span>
    )
  } else if (a.state === 'design_approved') {
    status = post.status === 'scheduled' ? 'Fully approved and scheduled.' : 'Fully approved.'
    actions = (
      <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
        <Check className="h-4 w-4" />
        Approved
      </span>
    )
  }

  if (!status) return null

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="approval-action-bar">
      <p className="text-sm text-slate-500">{status}</p>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">{actions}</div>
    </div>
  )
}

export default ApprovalActionBar

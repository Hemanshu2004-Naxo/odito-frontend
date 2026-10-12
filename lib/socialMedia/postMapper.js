import { DateTime } from 'luxon'
import { describeFailure } from './failureMessages'

/**
 * socialPostMapper — the ONE place a backend SocialPublication (as returned
 * by GET /social/publishing, see odito_backend socialPublishingService.js
 * toApiPublication) becomes the post model the Social Media AI components
 * render. Backend response shapes are never bent to fit the UI; the UI model
 * is derived here.
 *
 * Backend states (SocialPublication.STATUSES — nothing is invented):
 *   draft | scheduled | publishing | published | failed | cancelled
 * UI tabs: Scheduled (scheduled + publishing), Published, Failed. Drafts have
 * no date and cancelled posts are intentionally not listed.
 */

export const SCHEDULE_TAB_IDS = ['scheduled', 'published', 'failed']

export function tabForStatus(status) {
  if (status === 'scheduled' || status === 'publishing') return 'scheduled'
  if (status === 'published') return 'published'
  if (status === 'failed') return 'failed'
  return null
}

function zoned(iso, timezone) {
  if (!iso) return null
  const base = DateTime.fromJSDate(new Date(iso))
  if (!base.isValid) return null
  if (timezone) {
    const z = base.setZone(timezone)
    if (z.isValid) return z
  }
  return base
}

/** "yyyy-LL-dd" calendar day of an instant in `timezone` (viewer zone when none recorded). */
export function dayKey(iso, timezone) {
  return zoned(iso, timezone)?.toFormat('yyyy-LL-dd') || null
}

/** "10:00 AM" wall-clock time of an instant in `timezone` (viewer zone when none recorded). */
export function timeLabel(iso, timezone) {
  return zoned(iso, timezone)?.toFormat('hh:mm a') || null
}

/** Short zone label like "IST" / "GMT+5:30" for display next to a time. */
export function zoneLabel(iso, timezone) {
  const z = zoned(iso, timezone)
  return z ? z.toFormat('ZZZZ') : null
}

const TITLE_MAX = 90

/**
 * A post has one `content` string; the list UI shows a bold title and a
 * description line. The title is the first line (cut at a word boundary when
 * long) and the description is whatever remains — so the caption is shown in
 * full across the two, never invented or reworded.
 */
export function splitContent(content) {
  const text = (content || '').trim()
  if (!text) return { title: '', description: '' }
  const [firstLine, ...rest] = text.split(/\r?\n/)
  let title = firstLine.trim()
  let tail = rest.join(' ').trim()
  if (title.length > TITLE_MAX) {
    const cut = title.slice(0, TITLE_MAX)
    const lastSpace = cut.lastIndexOf(' ')
    const head = (lastSpace > TITLE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
    tail = `${title.slice(head.length).trim()} ${tail}`.trim()
    title = `${head}…`
  }
  return { title, description: tail }
}

function mediaSummary(media) {
  const first = Array.isArray(media) ? media[0] : null
  return {
    media: Array.isArray(media) ? media : [],
    mediaType: first?.type || null,
    // Only an image can be previewed as <img>; a video has no thumbnail from the backend.
    imageSrc: first?.type === 'image' ? first.url : null,
    format: first?.type === 'video' ? 'Video' : first?.type === 'image' ? 'Photo' : 'Text',
  }
}

/** Instant the list should place the post at: published => publishedAt, otherwise the scheduled time. */
function referenceInstant(pub) {
  if (pub.status === 'published') return pub.publishedAt || pub.scheduledAt
  if (pub.status === 'failed') return pub.scheduledAt || pub.failedAt || pub.createdAt
  return pub.scheduledAt || pub.createdAt
}

/**
 * The backend's approval block (toApiApproval) as the UI model. Everything is
 * the backend's own verdict: `publishable` / `needsChanges` / `stage` are never
 * re-derived here. A post that is not in the workflow (`managed:false`, e.g. a
 * legacy/direct post) is always publishable and has no review badge.
 */
const APPROVAL_LABEL = {
  content_review: 'Content in review',
  content_approved: 'Content approved — design not submitted',
  design_review: 'Design in review',
  design_approved: 'Fully approved',
}

export function mapApproval(pub) {
  const a = pub.approval
  if (!a || !a.managed) {
    return { managed: false, state: null, stage: null, publishable: true, needsChanges: false, label: null, contentVersion: 1, designVersion: 1, changesRequested: null }
  }
  let label = APPROVAL_LABEL[a.state] || null
  if (a.needsChanges) label = a.state === 'design_review' ? 'Design changes requested' : 'Content changes requested'
  return {
    managed: true,
    state: a.state,
    stage: a.stage,
    publishable: a.publishable === true,
    needsChanges: !!a.needsChanges,
    label,
    contentVersion: a.contentVersion || 1,
    designVersion: a.designVersion || 1,
    submittedAt: a.submittedAt || null,
    submittedByName: a.submittedByName || null,
    designSubmittedAt: a.designSubmittedAt || null,
    designSubmittedByName: a.designSubmittedByName || null,
    contentApprovedAt: a.contentApprovedAt || null,
    contentApprovedByName: a.contentApprovedByName || null,
    // an auto-approved stage (the project does not require it) has no approver
    contentAutoApproved: !!a.contentApprovedAt && !a.contentApprovedBy,
    designApprovedAt: a.designApprovedAt || null,
    designApprovedByName: a.designApprovedByName || null,
    designAutoApproved: !!a.designApprovedAt && !a.designApprovedBy,
    changesRequested: a.changesRequested
      ? { stage: a.changesRequested.stage, reason: a.changesRequested.reason || '', at: a.changesRequested.at || null, byName: a.changesRequested.byName || null, forVersion: a.changesRequested.forVersion }
      : null,
  }
}

/**
 * The canonical link to a post that is live on its platform, exactly as the backend stored it (the platform's own permalink,
 * never built from an id). Re-checked here before it can become an href: only a plain https facebook.com URL is ever linked,
 * anything else (missing, malformed, another host, a credential in it) is dropped so no fallback or unsafe link is rendered.
 */
export function safePermalink(value) {
  if (typeof value !== 'string' || !value || value.length > 500) return null
  let url
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || !/(^|\.)facebook\.com$/i.test(url.hostname)) return null
  if (url.username || url.password || url.searchParams.has('access_token')) return null
  return url.toString()
}

function retryInfo(pub) {
  if (pub.status !== 'scheduled' || !(pub.attempts > 0)) return null
  return {
    attempts: pub.attempts,
    nextRetryAt: pub.nextRetryAt || null,
    nextRetryLabel: pub.nextRetryAt ? `${dayKey(pub.nextRetryAt, pub.timezone)} ${timeLabel(pub.nextRetryAt, pub.timezone)}` : null,
    lastError: pub.lastError || null,
    lastErrorCode: pub.lastErrorCode || null,
  }
}

/**
 * Backend publication -> Social Media AI post (Scheduled / Published / Failed lists).
 */
export function mapPublicationToPost(pub) {
  const ref = referenceInstant(pub)
  const { title, description } = splitContent(pub.content)
  const m = mediaSummary(pub.media)
  const failure = describeFailure(pub)

  return {
    id: pub.id,
    platform: pub.platform,
    // real backend status, never re-labelled
    status: pub.status,
    tab: tabForStatus(pub.status),
    isPublishing: pub.status === 'publishing',

    title: title || (m.media.length ? 'Untitled post' : '(no text)'),
    description,
    content: pub.content || '',
    ...m,

    scheduledAt: pub.scheduledAt || null,
    publishedAt: pub.publishedAt || null,
    timezone: pub.timezone || null,
    date: dayKey(ref, pub.timezone),
    time: timeLabel(ref, pub.timezone),
    zone: zoneLabel(ref, pub.timezone),

    socialAccountId: pub.socialAccountId || null,
    externalPostId: pub.externalPostId || null,
    permalink: pub.status === 'published' ? safePermalink(pub.permalink) : null,

    // failure / retry — all decided by the backend
    failure,
    failReason: failure?.detail || null,
    retry: retryInfo(pub),
    attempts: pub.attempts || 0,
    canRetry: pub.canRetry === true,
    requiresReconnect: !!pub.requiresReconnect,
    outcomeUnknown: !!pub.outcomeUnknown,

    approval: mapApproval(pub),

    // set only on posts the AI wrote (single-post generation): { source, type, strategyVersion, contentPillar, objective }
    generation: pub.generation && pub.generation.source === 'ai' ? pub.generation : null,
    // set only on posts whose text IS the caption reviewed in the content calendar: { source, planRevision, planApprovedAt, contentPillar, ... }
    plan: pub.generation && pub.generation.source === 'calendar_plan' ? pub.generation : null,

    // set only while the media is the one an AI design generation produced: { source, designVersion, contentVersion, generatedAt }
    design: pub.design && pub.design.source === 'ai' ? pub.design : null,

    // what the UI may offer (the backend remains authoritative: every action
    // is re-validated server-side and its refusal is shown, not hidden)
    canEditSchedule: pub.status === 'scheduled',
    canCancel: pub.status === 'scheduled' || pub.status === 'draft',
    canDelete: pub.status !== 'publishing',
  }
}

/**
 * Calendar status keys: the backend's real statuses (drafts/cancelled never
 * appear on the calendar). A scheduled post in the approval workflow that is
 * not fully approved shows its approval stage instead of "Scheduled", because
 * the backend will not publish it until it is approved.
 */
const UNAPPROVED_CALENDAR_STATUS = { content_review: 'content-review', content_approved: 'design-pending', design_review: 'design-review' }

export function calendarStatusFor(status, approval = null) {
  if (status === 'scheduled' && approval?.managed && !approval.publishable) {
    return UNAPPROVED_CALENDAR_STATUS[approval.state] || 'scheduled'
  }
  return ['scheduled', 'publishing', 'published', 'failed'].includes(status) ? status : null
}

/**
 * Backend publication -> calendar post. Placed by its SCHEDULED instant in its
 * own timezone (the same rule the dashboard calendar uses), so a post never
 * jumps to a different day for a viewer in another timezone.
 */
export function mapPublicationToCalendarPost(pub) {
  const approval = mapApproval(pub)
  const status = calendarStatusFor(pub.status, approval)
  if (!status || !pub.scheduledAt) return null
  const { title } = splitContent(pub.content)
  const m = mediaSummary(pub.media)
  return {
    id: pub.id,
    title: title || (m.media.length ? 'Untitled post' : '(no text)'),
    platform: pub.platform,
    date: dayKey(pub.scheduledAt, pub.timezone),
    time: timeLabel(pub.scheduledAt, pub.timezone),
    zone: zoneLabel(pub.scheduledAt, pub.timezone),
    timezone: pub.timezone || null,
    status,
    caption: pub.content || '',
    contentFormat: m.format,
    imageSrc: m.imageSrc,
    failure: describeFailure(pub),
    attempts: pub.attempts || 0,
    approval,
    permalink: pub.status === 'published' ? safePermalink(pub.permalink) : null,
  }
}

/**
 * Backend publication -> Content Approvals page post. The workflow facts and
 * the actions the UI may OFFER come from the backend's approval block; every
 * action is still re-validated server-side and its refusal shown.
 */
export function mapPublicationToApprovalPost(pub) {
  const post = mapPublicationToPost(pub)
  const a = post.approval
  const open = pub.status === 'draft' || pub.status === 'scheduled' // only pre-publication posts can be reviewed/edited

  const tabs = []
  if (!a.managed) {
    if (pub.status === 'draft') tabs.push('drafts')
  } else if (open) {
    if (a.state === 'content_review') tabs.push('content-review')
    if (a.state === 'design_review') tabs.push('design-review')
    if (a.needsChanges) tabs.push('needs-changes')
    if (a.state === 'content_approved' || a.state === 'design_approved') tabs.push('approved')
  }

  return {
    ...post,
    approvalTabs: tabs,
    mediaUrls: post.media.map((m) => m.url),
    createdAt: pub.createdAt || null,
    canEdit: open,
    canSubmitContent: !a.managed && pub.status === 'draft',
    canApproveContent: open && a.state === 'content_review',
    canSubmitDesign: open && a.state === 'content_approved',
    // AI design: only a draft whose CONTENT is approved (the backend also requires the current caption to be the approved one)
    canGenerateDesign: pub.status === 'draft' && ['content_approved', 'design_review', 'design_approved'].includes(a.state),
    canApproveDesign: open && a.state === 'design_review',
    // Instagram has no text-only post: an approved Instagram draft without media cannot be scheduled (the backend refuses it
    // too - MEDIA_REQUIRED). `scheduleBlocked` carries the reason so the UI explains instead of offering a button that will fail.
    canSchedule: open && pub.status === 'draft' && a.state === 'design_approved' && !(pub.platform === 'instagram' && post.media.length === 0),
    scheduleBlocked: open && pub.status === 'draft' && a.state === 'design_approved' && pub.platform === 'instagram' && post.media.length === 0
      ? 'Instagram posts need an image or video. Generate or upload a design before scheduling.'
      : null,
  }
}

/** Earliest first, by the instant the post is scheduled for. */
export function sortByScheduledAsc(posts) {
  return [...posts].sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0))
}

/** Latest first (published / failed history). */
export function sortByReferenceDesc(posts) {
  return [...posts].sort((a, b) => new Date(b.publishedAt || b.scheduledAt || 0) - new Date(a.publishedAt || a.scheduledAt || 0))
}

/** The wall-clock fields the schedule editor needs, in the post's own timezone. */
export function toScheduleFormValues(post, fallbackTimezone) {
  const tz = post.timezone || fallbackTimezone || DateTime.local().zoneName
  const z = zoned(post.scheduledAt, tz)
  return {
    timezone: tz,
    date: z ? z.toFormat('yyyy-LL-dd') : '',
    time: z ? z.toFormat('HH:mm') : '',
  }
}

/**
 * Wall-clock date ("yyyy-LL-dd") + time ("HH:mm") in an IANA zone -> absolute
 * UTC ISO string, or null when it is not a real instant (e.g. Feb 30). The
 * backend independently rejects past times and bad zones; this is only the
 * conversion the API requires (an explicit-offset ISO, never a naive string).
 */
export function scheduleFormToUtcIso({ date, time, timezone }) {
  if (!date || !time || !timezone) return null
  const dt = DateTime.fromFormat(`${date} ${time}`, 'yyyy-LL-dd HH:mm', { zone: timezone })
  return dt.isValid ? dt.toUTC().toISO() : null
}

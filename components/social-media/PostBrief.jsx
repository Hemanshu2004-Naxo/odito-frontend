"use client"

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CALENDAR_PLATFORM_META, APPROVAL_BRIEF_ICONS } from '@/lib/socialMediaAIDummyData'
import { objectiveLabel } from '@/lib/socialMedia/aiContent'
import { formatPlanDate } from '@/lib/socialMedia/contentCalendar'

function BriefRow({ icon, label, value, wrap = false, testId, wide = false }) {
  if (wide) {
    // one fact as a column of a horizontal row: label above, value below
    return (
      <div className="min-w-0 border-slate-100 py-1 @min-[900px]/main:border-l @min-[900px]/main:pl-4 @min-[900px]/main:first:border-l-0 @min-[900px]/main:first:pl-0" data-testid={testId}>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</span>
        <span className="mt-0.5 block break-words text-sm font-semibold text-slate-900">{value}</span>
      </div>
    )
  }
  return (
    <div className={`flex justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 ${wrap ? 'flex-col items-start sm:flex-row' : 'items-center'}`} data-testid={testId}>
      <span className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
        {icon}
        {label}
      </span>
      <span className={`text-sm font-semibold text-slate-900 ${wrap ? 'break-words sm:text-right' : 'truncate'}`}>{value}</span>
    </div>
  )
}

/** The schedule when there is one, else the date the content calendar planned the post for; "Not scheduled" only when it has neither. */
function plannedLabel(post, plannedDate) {
  if (post.status === 'scheduled' && post.date) return `${post.date}${post.time ? ` · ${post.time}` : ''}`
  if (plannedDate) return `${formatPlanDate(plannedDate, { year: true })} · not scheduled yet`
  return 'Not scheduled'
}

/**
 * Right-side "Post brief": only facts the backend actually holds for the post. The five a reviewer needs (platform, format, planned date,
 * content pillar, who submitted it) are always shown; where it came from and its version numbers are under "Details".
 */
export function PostBrief({ post, plannedDate = null, wide = false }) {
  const [open, setOpen] = useState(false)
  const region = useId()
  const platform = CALENDAR_PLATFORM_META[post.platform]
  const PlatformIcon = platform?.icon
  const FormatIcon = APPROVAL_BRIEF_ICONS.format
  const DateIcon = APPROVAL_BRIEF_ICONS.plannedDate
  const a = post.approval
  const origin = post.generation || post.plan || null
  const pillar = origin?.contentPillar || null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="post-brief">
      <h2 className="text-base font-bold text-slate-900">Post brief</h2>
      <div className={wide ? 'mt-3 grid grid-cols-2 gap-3 @min-[900px]/main:grid-cols-5' : 'mt-3 flex flex-col'}>
        {platform && (
          <BriefRow
            wide={wide}
            icon={<span className={`flex h-4 w-4 items-center justify-center rounded-full ${platform.badgeClass}`} aria-hidden="true"><PlatformIcon className="h-2.5 w-2.5" /></span>}
            label="Platform"
            value={platform.label}
          />
        )}
        <BriefRow wide={wide} icon={<FormatIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />} label="Format" value={post.format} />
        <BriefRow wide={wide} icon={<DateIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />} label="Planned date" value={plannedLabel(post, plannedDate)} testId="brief-planned-date" wrap />
        {pillar && <BriefRow wide={wide} label="Content pillar" value={pillar} wrap />}
        {a.managed && a.submittedByName && <BriefRow wide={wide} label="Submitted by" value={a.submittedByName} />}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={region}
        data-testid="brief-details-toggle"
        className="mt-2 inline-flex items-center gap-1 rounded text-sm font-semibold text-violet-700 hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        Details
      </button>
      {open && (
        <div id={region} className="mt-1 flex flex-col" data-testid="brief-details">
          {post.generation && <BriefRow label="Source" value="AI-generated" wrap />}
          {post.plan && <BriefRow label="Source" value="Your content plan (caption used as written)" wrap />}
          {post.generation?.objective && <BriefRow label="Objective" value={objectiveLabel(post.generation.objective)} />}
          {post.plan?.planRevision != null && <BriefRow label="Plan revision" value={post.plan.planRevision} />}
          {origin?.strategyVersion != null && <BriefRow label="Strategy version" value={origin.strategyVersion} />}
          {a.managed && (
            <>
              <BriefRow label="Content version" value={a.contentVersion} />
              <BriefRow label="Design version" value={a.designVersion} />
              {a.contentApprovedAt && <BriefRow label="Content approved" value={a.contentAutoApproved ? 'Automatically' : (a.contentApprovedByName || 'Approved')} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PostBrief

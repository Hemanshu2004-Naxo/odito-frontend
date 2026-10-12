import { CALENDAR_PLATFORM_META, APPROVAL_BRIEF_ICONS } from '@/lib/socialMediaAIDummyData'
import { objectiveLabel } from '@/lib/socialMedia/aiContent'

function BriefRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        {label}
      </span>
      <span className="truncate text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function plannedLabel(post) {
  if (post.status === 'scheduled' && post.date) return `${post.date}${post.time ? ` · ${post.time}` : ''}`
  return 'Not scheduled'
}

/**
 * Right-side "Post brief": only facts the backend actually holds for the post
 * (platform, format, schedule, workflow versions). The old Goal / Voice rows
 * had no data behind them and are gone.
 */
export function PostBrief({ post }) {
  const platform = CALENDAR_PLATFORM_META[post.platform]
  const PlatformIcon = platform?.icon
  const FormatIcon = APPROVAL_BRIEF_ICONS.format
  const DateIcon = APPROVAL_BRIEF_ICONS.plannedDate
  const a = post.approval

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">Post brief</h2>
      <div className="mt-3 flex flex-col">
        {platform && (
          <BriefRow
            icon={
              <span className={`flex h-4 w-4 items-center justify-center rounded-full ${platform.badgeClass}`}>
                <PlatformIcon className="h-2.5 w-2.5" />
              </span>
            }
            label="Platform"
            value={platform.label}
          />
        )}
        <BriefRow icon={<FormatIcon className="h-4 w-4 text-slate-400" />} label="Format" value={post.format} />
        <BriefRow icon={<DateIcon className="h-4 w-4 text-slate-400" />} label="Planned date" value={plannedLabel(post)} />
        {post.generation && (
          <>
            <BriefRow label="Source" value="AI-generated" />
            {post.generation.contentPillar && <BriefRow label="Content pillar" value={post.generation.contentPillar} />}
            {post.generation.objective && <BriefRow label="Objective" value={objectiveLabel(post.generation.objective)} />}
            {post.generation.strategyVersion != null && <BriefRow label="Strategy version" value={post.generation.strategyVersion} />}
          </>
        )}
        {post.plan && (
          <>
            <BriefRow label="Source" value="Your content plan (caption used as written)" />
            {post.plan.planRevision != null && <BriefRow label="Plan revision" value={post.plan.planRevision} />}
            {post.plan.contentPillar && <BriefRow label="Content pillar" value={post.plan.contentPillar} />}
            {post.plan.strategyVersion != null && <BriefRow label="Strategy version" value={post.plan.strategyVersion} />}
          </>
        )}
        {a.managed && (
          <>
            <BriefRow label="Content version" value={a.contentVersion} />
            <BriefRow label="Design version" value={a.designVersion} />
            {a.submittedByName && <BriefRow label="Submitted by" value={a.submittedByName} />}
            {a.contentApprovedAt && (
              <BriefRow label="Content approved" value={a.contentAutoApproved ? 'Automatically' : (a.contentApprovedByName || 'Approved')} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PostBrief

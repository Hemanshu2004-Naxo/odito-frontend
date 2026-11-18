import { Film, Image as ImageIcon, Type } from 'lucide-react'
import { CALENDAR_PLATFORM_META } from '@/lib/socialMediaAIDummyData'
import { SocialMediaImage } from './SocialMediaImage'

function formatDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const FORMAT_ICON = { Text: Type, Photo: ImageIcon, Video: Film }
const TONE = {
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
}

/** The post's place in the workflow, in a few words, from the backend's approval verdict. */
function statusOf(post) {
  const a = post.approval
  if (!a.managed) return { label: 'Draft', tone: 'slate' }
  if (a.needsChanges) return { label: 'Changes requested', tone: 'amber' }
  if (a.state === 'content_review') return { label: 'Content review', tone: 'sky' }
  if (a.state === 'design_review') return { label: 'Design review', tone: 'sky' }
  if (a.state === 'content_approved') return { label: 'Needs a design', tone: 'amber' }
  if (a.state === 'design_approved') return { label: post.status === 'scheduled' ? 'Scheduled' : 'Approved', tone: 'green' }
  return { label: 'Draft', tone: 'slate' }
}

/** One row in the left-hand approvals post list — a REAL post. */
export function ApprovalPostItem({ post, selected, onSelect }) {
  const platform = CALENDAR_PLATFORM_META[post.platform]
  const PlatformIcon = platform?.icon
  const FormatIcon = FORMAT_ICON[post.format] || Type
  const when = post.status === 'scheduled' && post.date ? `Scheduled ${post.date}` : `Created ${formatDay(post.createdAt)}`
  const status = statusOf(post)

  return (
    <button
      type="button"
      onClick={() => onSelect(post.id)}
      aria-pressed={selected}
      aria-label={`${post.title}. ${platform?.label || post.platform}, ${post.format}. ${status.label}.`}
      data-testid={`approval-post-${post.id}`}
      className={`flex w-full items-start gap-3 border-l-[3px] px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
        selected ? 'border-violet-600 bg-violet-50' : 'border-transparent hover:bg-slate-50'
      }`}
    >
      {post.imageSrc ? (
        <SocialMediaImage src={post.imageSrc} className="h-11 w-11 shrink-0 rounded-lg" />
      ) : (
        // no image: what the post IS (its platform and format), not an empty placeholder
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50" data-testid="post-format-icon" aria-hidden="true">
          <FormatIcon className="h-5 w-5 text-slate-600" />
          {platform && (
            <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${platform.badgeClass}`}>
              <PlatformIcon className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 text-sm font-semibold ${selected ? 'text-violet-900' : 'text-slate-900'}`} title={post.title}>{post.title}</p>
        <p className="mt-0.5 text-xs text-slate-600">{when}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span data-testid="post-status" className={`rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${TONE[status.tone]}`}>{status.label}</span>
          {post.imageSrc && platform && (
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${platform.badgeClass}`} aria-hidden="true">
              <PlatformIcon className="h-3 w-3" />
            </span>
          )}
          {post.generation && (
            <span data-testid="ai-badge" className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">AI-generated</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default ApprovalPostItem

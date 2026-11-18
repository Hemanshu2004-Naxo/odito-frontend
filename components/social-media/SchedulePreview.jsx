import { GalleryHorizontalEnd } from 'lucide-react'
import { SocialMediaImage } from './SocialMediaImage'

/**
 * Compact preview of the REAL post at the top of the Confirm Schedule panel: the design (shown whole, never covered by text - a design
 * carries its own headline) as a thumbnail beside the account and the start of the caption. The full design is on the same screen; a
 * carousel shows its first slide and the slide count.
 */
export function SchedulePreview({ post, accountName }) {
  const slides = Array.isArray(post.media) ? post.media.length : 0
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-2.5" data-testid="schedule-preview">
      {post.imageSrc && (
        <div className="relative w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          <SocialMediaImage src={post.imageSrc} alt="" className="aspect-[4/5] w-full" imgClassName="object-contain" />
          {slides > 1 && (
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white" data-testid="schedule-preview-slides">
              <GalleryHorizontalEnd className="h-2.5 w-2.5" aria-hidden />{slides}
            </span>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        {accountName && (
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b2a52] text-[10px] font-bold text-white">
              {accountName.trim().charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-xs font-semibold text-slate-800">{accountName}</span>
          </div>
        )}
        <p className="line-clamp-3 break-words text-xs leading-relaxed text-slate-600">{post.title}</p>
        {slides > 1 && <p className="text-[11px] font-medium text-slate-500">Carousel · {slides} slides</p>}
      </div>
    </div>
  )
}

export default SchedulePreview

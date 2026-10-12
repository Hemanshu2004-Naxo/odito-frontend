"use client"

import { Star, FilePenLine, FileX2, Trash2 } from 'lucide-react'
import AnalyticsCard from './AnalyticsCard'
import AnalyticsDateRange from './AnalyticsDateRange'
import { NAVY, fmtInt, fmtRating, rangeLongLabel } from './analyticsFormat'

/** The multi-colour Google "G" (the reference shows it next to Google Reviews). */
function GoogleG({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z" />
      <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" />
    </svg>
  )
}

function Metric({ icon, label, value, caption, title }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-3 py-4 sm:px-5 @min-[960px]/main:border-l @min-[960px]/main:border-dotted @min-[960px]/main:border-[#c5d0e6] @min-[960px]/main:first:border-l-0 dark:@min-[960px]/main:border-border">
      <span className="mt-1 shrink-0" style={{ color: NAVY }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[14px] leading-tight text-[#44546a] sm:text-[15px] dark:text-muted-foreground">{label}</p>
        <p className="text-[22px] font-bold leading-tight tabular-nums text-[#1b2540] sm:text-[25px] dark:text-foreground" title={title}>{value}</p>
        <p className="mt-0.5 min-h-4 text-[11px] leading-snug text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

/**
 * "Review Insight Count Cards" - five metrics in one card. Values are LIFETIME
 * (every stored review); the caption under each gives the selected period, and
 * Google's own total is surfaced when it differs from what is stored so a
 * lagging sync is visible. "Deleted Reviews" is not tracked yet, so it shows "--".
 */
export default function ReviewInsightCards({ overview, rangeKey }) {
  const { lifetime, period, google } = overview
  const periodText = rangeLongLabel(rangeKey).toLowerCase()
  const googleDiffers = typeof google.totalReviewCount === 'number' && google.totalReviewCount !== lifetime.totalReviews

  return (
    <AnalyticsCard title="Review Insight Count Cards" actions={<AnalyticsDateRange />}>
      <section aria-label="Review insight cards" className="grid grid-cols-2 gap-y-3 @min-[560px]/main:grid-cols-3 @min-[960px]/main:grid-cols-5">
        <Metric
          icon={<GoogleG />}
          label="Google Reviews"
          value={fmtInt(lifetime.totalReviews)}
          title="Lifetime total of the reviews stored for this location"
          caption={googleDiffers ? `Lifetime · Google reports ${fmtInt(google.totalReviewCount)} · ${fmtInt(period.totalReviews)} in ${periodText}` : `Lifetime · ${fmtInt(period.totalReviews)} in ${periodText}`}
        />
        <Metric
          icon={<Star className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />}
          label="Avg Google Rating"
          value={lifetime.averageRating === null ? '—' : fmtRating(lifetime.averageRating)}
          title={lifetime.averageRating === null ? undefined : `${lifetime.averageRating} (average of stored reviews)`}
          caption={period.averageRating === null ? `Lifetime · no reviews in ${periodText}` : `Lifetime · ${fmtRating(period.averageRating)} in ${periodText}`}
        />
        <Metric
          icon={<FilePenLine className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />}
          label="With Text"
          value={fmtInt(lifetime.withText)}
          caption={`Lifetime · ${fmtInt(period.withText)} in ${periodText}`}
        />
        <Metric
          icon={<FileX2 className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />}
          label="Without Text"
          value={fmtInt(lifetime.withoutText)}
          caption={`Lifetime · ${fmtInt(period.withoutText)} in ${periodText}`}
        />
        <Metric
          icon={<Trash2 className="h-7 w-7" strokeWidth={1.6} aria-hidden="true" />}
          label="Deleted Reviews"
          value="--"
          title="Deleted-review tracking is not available yet"
          caption="Not tracked yet"
        />
      </section>
    </AnalyticsCard>
  )
}

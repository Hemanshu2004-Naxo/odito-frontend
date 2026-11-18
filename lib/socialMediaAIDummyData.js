/**
 * Static/dummy data for the Social Media AI module
 * (components/social-media/**, app/app/social-media/**).
 *
 * Frontend-only: no API calls, no React Query, no backend, no persistence.
 * This module is fully isolated from the real, OAuth-backed Social Media
 * Management feature at app/app/social/ (see lib/socialMediaDummyData.js) -
 * it is a separate, mocked "Social Media AI" product surface modeled after
 * an external reference screenshot.
 */

import {
  FileText,
  ImagePlus,
  Send,
  BarChart3,
  GraduationCap,
  Heart,
  Megaphone,
  Users,
  Facebook,
  Instagram,
  Calendar,
  Linkedin,
  Layers,
  Link2,
  UserCheck,
  Clock,
} from 'lucide-react'

// Overview tiles: labels/icons/links only. The NUMBERS come from the real
// backend (hooks/useSocialMediaAI.js useOverviewData) via `source`: scheduled /
// published are publication totals, contentReview / designReview are the
// approval workflow's database counts (GET /social/publishing/approvals/summary).
export const OVERVIEW_STATS = [
  { id: 'content-reviews', label: 'Content reviews', source: 'contentReview', icon: FileText, href: '/app/social-media/content-approvals?tab=content-review' },
  { id: 'designs-to-approve', label: 'Designs to approve', source: 'designReview', icon: ImagePlus, href: '/app/social-media/content-approvals?tab=design-review' },
  { id: 'scheduled', label: 'Scheduled', source: 'scheduled', icon: Send, href: '/app/social-media/scheduled-posts' },
  { id: 'published', label: 'Published', source: 'published', icon: BarChart3, href: '/app/social-media/scheduled-posts?tab=published' },
]

// ── Content Calendar ─────────────────────────────────────────────────
// Configuration only (labels/icons/colors) — the calendar's POSTS are real
// publications from the scheduler backend (hooks/useSocialMediaAI.js
// useCalendarPosts), never sample data.

export const CALENDAR_PLATFORM_META = {
  facebook: { label: 'Facebook', icon: Facebook, badgeClass: 'bg-[#1877F2] text-white' },
  instagram: { label: 'Instagram', icon: Instagram, badgeClass: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, badgeClass: 'bg-[#0A66C2] text-white' },
}

export const CALENDAR_PLATFORM_FILTERS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
]

// The backend's REAL publication states that have a date (SocialPublication:
// draft/scheduled/publishing/published/failed/cancelled — drafts have no date
// and cancelled posts are not shown).
export const CALENDAR_STATUS_META = {
  scheduled: { label: 'Scheduled', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  publishing: { label: 'Publishing', dotClass: 'bg-sky-500', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  published: { label: 'Published', dotClass: 'bg-violet-500', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  failed: { label: 'Failed', dotClass: 'bg-red-500', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  // A scheduled post whose approval is not (or is no longer) complete. The
  // backend will not publish it until it is approved; see postMapper's
  // calendarStatusFor. Never produced for a post that is not in the workflow.
  'content-review': { label: 'Content review', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  'design-pending': { label: 'Design pending', dotClass: 'bg-slate-400', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  'design-review': { label: 'Design review', dotClass: 'bg-sky-500', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
}

export const CALENDAR_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'content-review', label: 'Content review' },
  { value: 'design-pending', label: 'Design pending' },
  { value: 'design-review', label: 'Design review' },
]

// ── Content Approvals ────────────────────────────────────────────────
// Reuses CALENDAR_PLATFORM_META for platform icons/colors - one platform
// map for the whole module instead of a second copy here.

export const APPROVAL_BRIEF_ICONS = {
  format: Layers,
  plannedDate: Calendar,
}

// Tabs of the Content Approvals page. `match` is evaluated against the real
// post model (lib/socialMedia/postMapper.js mapPublicationToApprovalPost); the
// counts shown are computed from the real publications, never hard-coded.
export const APPROVAL_TABS = [
  { id: 'content-review', label: 'Content review' },
  { id: 'design-review', label: 'Design review' },
  { id: 'needs-changes', label: 'Needs changes' },
  { id: 'approved', label: 'Approved' },
  { id: 'drafts', label: 'Drafts' },
]

// ── Scheduled Posts ──────────────────────────────────────────────────
// `date` is a plain ISO date ('YYYY-MM-DD') - the list/panel format it into
// both the compact ("Wed, 23 Sep 2026") and full ("Wednesday, 23 September
// 2026") labels shown in the reference, so there is one source of truth
// per post instead of two hand-typed strings that could drift apart.

export const SCHEDULE_TABS = [
  { id: 'scheduled', label: 'Scheduled', status: 'scheduled' },
  { id: 'published', label: 'Published', status: 'published' },
  { id: 'failed', label: 'Failed', status: 'failed' },
]

export const SCHEDULE_TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
]

// ── Analytics ─────────────────────────────────────────────────────────

export const ANALYTICS_DATE_RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days', range: 'Sep 24 – Sep 30, 2026' },
  { id: '30d', label: 'Last 30 days', range: 'Sep 1, 2026 – Sep 30, 2026' },
  { id: '90d', label: 'Last 90 days', range: 'Jul 2 – Sep 30, 2026' },
  { id: 'this-month', label: 'This month', range: 'Sep 1 – Sep 30, 2026' },
  { id: 'prev-month', label: 'Previous month', range: 'Aug 1 – Aug 31, 2026' },
]

export const ANALYTICS_DEFAULT_DATE_RANGE = '30d'

export const ANALYTICS_PLATFORM_OPTIONS = [
  { id: 'all', label: 'Facebook + Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
]

// Scaled per platform filter (values for the combined view roughly equal
// the sum of the two single-platform views) so switching the filter
// visibly changes the numbers rather than just relabeling the same ones.
export const ANALYTICS_SUMMARY_BY_PLATFORM = {
  all: [
    { id: 'reach', label: 'Reach', value: '24.8K', change: '+12%', supportingText: 'vs previous 30 days', icon: Users, tint: 'bg-emerald-50 text-emerald-600' },
    { id: 'engagements', label: 'Engagements', value: '1.2K', change: '+18%', supportingText: 'vs previous 30 days', icon: Heart, tint: 'bg-rose-50 text-rose-500' },
    { id: 'link-clicks', label: 'Link clicks', value: '386', change: '+26%', supportingText: 'vs previous 30 days', icon: Link2, tint: 'bg-violet-50 text-violet-600' },
    { id: 'tracked-leads', label: 'Tracked leads', value: '24', change: '+33%', supportingText: 'vs previous 30 days', icon: UserCheck, tint: 'bg-emerald-50 text-emerald-600' },
  ],
  facebook: [
    { id: 'reach', label: 'Reach', value: '10.6K', change: '+9%', supportingText: 'vs previous 30 days', icon: Users, tint: 'bg-emerald-50 text-emerald-600' },
    { id: 'engagements', label: 'Engagements', value: '514', change: '+11%', supportingText: 'vs previous 30 days', icon: Heart, tint: 'bg-rose-50 text-rose-500' },
    { id: 'link-clicks', label: 'Link clicks', value: '155', change: '+19%', supportingText: 'vs previous 30 days', icon: Link2, tint: 'bg-violet-50 text-violet-600' },
    { id: 'tracked-leads', label: 'Tracked leads', value: '9', change: '+20%', supportingText: 'vs previous 30 days', icon: UserCheck, tint: 'bg-emerald-50 text-emerald-600' },
  ],
  instagram: [
    { id: 'reach', label: 'Reach', value: '14.2K', change: '+15%', supportingText: 'vs previous 30 days', icon: Users, tint: 'bg-emerald-50 text-emerald-600' },
    { id: 'engagements', label: 'Engagements', value: '686', change: '+23%', supportingText: 'vs previous 30 days', icon: Heart, tint: 'bg-rose-50 text-rose-500' },
    { id: 'link-clicks', label: 'Link clicks', value: '231', change: '+31%', supportingText: 'vs previous 30 days', icon: Link2, tint: 'bg-violet-50 text-violet-600' },
    { id: 'tracked-leads', label: 'Tracked leads', value: '15', change: '+41%', supportingText: 'vs previous 30 days', icon: UserCheck, tint: 'bg-emerald-50 text-emerald-600' },
  ],
}

export const TOP_PERFORMING_POSTS = [
  {
    id: 'perf-1',
    title: '5 social media tips for small businesses',
    date: 'Sep 12, 2026',
    platform: 'instagram',
    imageId: 'analytics-post-01',
    reach: '8.4K',
    engagement: '512',
    clicks: '167',
  },
  {
    id: 'perf-2',
    title: 'Why brand purpose still matters in 2026',
    date: 'Sep 5, 2026',
    platform: 'facebook',
    imageId: 'analytics-post-02',
    reach: '6.1K',
    engagement: '318',
    clicks: '102',
  },
  {
    id: 'perf-3',
    title: 'Behind the scenes: Our creative process',
    date: 'Sep 18, 2026',
    platform: 'instagram',
    imageId: 'analytics-post-03',
    reach: '5.3K',
    engagement: '274',
    clicks: '64',
  },
  {
    id: 'perf-4',
    title: 'From strategy to real results',
    date: 'Sep 22, 2026',
    platform: 'facebook',
    imageId: 'analytics-post-04',
    reach: '4.9K',
    engagement: '196',
    clicks: '53',
  },
]

export const AI_RECOMMENDATIONS = [
  {
    id: 'rec-1',
    title: 'Create more educational posts',
    description: 'Educational content drives 42% higher engagement. Share tips, how-tos and guides relevant to your audience.',
    icon: GraduationCap,
  },
  {
    id: 'rec-2',
    title: 'Test a stronger consultation CTA',
    description: 'Posts with a clear “Book a Consultation” CTA see 28% more clicks. Try alternate copy and visuals.',
    icon: Megaphone,
  },
  {
    id: 'rec-3',
    title: 'Compare morning and evening slots',
    description: 'Your evening posts are performing 34% better on average. Test more content in the 6–9 PM window.',
    icon: Clock,
  },
]

export const LEAD_TRACKING = {
  status: 'Connected',
  description: 'Track conversions from your website forms.',
  integration: { id: 'website-forms', label: 'Website forms', connectedNote: 'Connected on Sep 3, 2026', status: 'Active' },
  footerNote: 'Only tracked conversions appear as leads.',
}

export const STRATEGY_UPDATE = {
  eyebrow: 'Strategy update',
  title: 'Suggested next month: Awareness + lead generation',
  description: 'Based on your performance, we recommend focusing on brand awareness and lead generation in October 2026.',
  alertTitle: 'User approval required',
  alertDescription: 'Strategy changes need your approval before applying.',
  reviewSummary: [
    'Shift content mix to 40% educational, 35% trust-building, 25% promotional for October.',
    'Increase evening posting (6–9 PM) from 20% to 45% of the schedule.',
    'Add a consultation CTA to at least 2 posts per week.',
  ],
}

// ── Settings ──────────────────────────────────────────────────────────

// Application configuration only. The business, brand, services and products live in Business Profile.
export const SETTINGS_TABS = [
  { id: 'publishing', label: 'Publishing' },
  { id: 'team-approvals', label: 'Team & approvals' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'brand-kit', label: 'Brand kit' },
]

export const PUBLISHING_RULES_DEFAULTS = {
  contentApprovalRequired: true,
  designApprovalRequired: true,
  autoPublishApproved: true,
  timezone: 'asia-kolkata',
}

export const SETTINGS_TIMEZONE_OPTIONS = [
  { value: 'asia-kolkata', label: 'Asia/Kolkata (GMT +5:30)' },
  { value: 'utc', label: 'UTC' },
  { value: 'america-new-york', label: 'America/New_York' },
  { value: 'america-los-angeles', label: 'America/Los_Angeles' },
  { value: 'europe-london', label: 'Europe/London' },
  { value: 'asia-dubai', label: 'Asia/Dubai' },
  { value: 'asia-singapore', label: 'Asia/Singapore' },
]


export const DEFAULT_PUBLISHING_PLATFORMS = ['facebook', 'instagram']

export const TEAM_MEMBERS = [
  { id: 'team-1', name: 'Sarvesh Shah', email: 'sarvesh@sapphiredigitalagency.com', role: 'Admin', canApproveContent: true, canApproveDesign: true },
  { id: 'team-2', name: 'Priya Nair', email: 'priya@sapphiredigitalagency.com', role: 'Content reviewer', canApproveContent: true, canApproveDesign: false },
  { id: 'team-3', name: 'Rohan Mehta', email: 'rohan@sapphiredigitalagency.com', role: 'Designer', canApproveContent: false, canApproveDesign: true },
]

export const NOTIFICATION_SETTINGS_DEFAULTS = [
  { id: 'content-ready', label: 'Content ready for review', description: 'Get notified when AI-generated copy needs your approval.', enabled: true },
  { id: 'design-ready', label: 'Design ready for review', description: 'Get notified when AI-generated designs need your approval.', enabled: true },
  { id: 'post-published', label: 'Post successfully published', description: 'Get notified when a scheduled post goes live.', enabled: true },
  { id: 'publish-failed', label: 'Publishing failure', description: 'Get notified immediately if a post fails to publish.', enabled: true },
  { id: 'weekly-summary', label: 'Weekly analytics summary', description: 'A weekly digest of reach, engagement and leads.', enabled: false },
]

/**
 * Display helpers for the Social Media AI Content Calendar plan (GET /social/content-calendar).
 * The backend decides every value (dates, pillars, platforms, objectives, KPIs); this file only turns codes into
 * words and holds the defaults of the planning form.
 */
import { DateTime } from 'luxon'

export const FORMAT_LABELS = Object.freeze({ static_post: 'Static post', carousel: 'Carousel', reel: 'Reel', video: 'Video', text_post: 'Text post' })

export const OBJECTIVE_LABELS = Object.freeze({
  awareness: 'Awareness', engagement: 'Engagement', traffic: 'Traffic', lead_generation: 'Lead generation', conversion: 'Conversion',
})

export const KPI_LABELS = Object.freeze({
  reach: 'Reach', views: 'Views', comments: 'Comments', shares: 'Shares', saves: 'Saves', link_clicks: 'Link clicks',
  dms: 'DMs', calls: 'Calls', form_submissions: 'Form submissions', purchases: 'Purchases', bookings: 'Bookings',
})

export const ASSET_LABELS = Object.freeze({
  product_image: 'Product image', logo: 'Logo', team_photo: 'Team photo', customer_photo: 'Customer photo', testimonial: 'Testimonial',
  screenshot: 'Screenshot', stock_photo: 'Stock photo', video_clip: 'Video clip', infographic: 'Infographic',
})

/**
 * The ONE status a person sees for a planned post (the API's `effectiveStatus`): the planning status (planned / edited /
 * plan approved) until content exists, then the real state of the linked publication (review, approved, scheduled,
 * published). There is deliberately no second status system.
 */
export const ITEM_STATUS_LABELS = Object.freeze({
  planned: 'Planned', edited: 'Edited', plan_approved: 'Plan approved', draft: 'Draft', content_generated: 'Content generated', content_review: 'Content review',
  content_approved: 'Content approved', design_review: 'Design review', approved: 'Approved', scheduled: 'Scheduled', published: 'Published', failed: 'Failed', cancelled: 'Cancelled',
})

/** Badge colour per status (a Pill tone). */
export const ITEM_STATUS_TONE = Object.freeze({
  planned: 'slate', draft: 'slate', edited: 'amber', plan_approved: 'blue', content_generated: 'violet', content_review: 'amber', content_approved: 'blue',
  design_review: 'amber', approved: 'green', scheduled: 'blue', published: 'green', failed: 'red', cancelled: 'slate',
})

export const DISTRIBUTION_OPTIONS = Object.freeze([
  { value: 'ai_optimized', label: 'Follow your strategy', description: 'Every week follows the platform split in your strategy, one platform per post.' },
  { value: 'balanced', label: 'Even split', description: 'Posts are shared evenly across your platforms, one platform per post.' },
])

export const HOOK_CATEGORY_LABELS = Object.freeze({
  educational: 'Educational', curiosity: 'Curiosity', problem_solution: 'Problem / solution', contrarian: 'Contrarian', story: 'Story', proof: 'Proof', engagement: 'Engagement', promotional: 'Promotional',
})

export const POSTS_PER_WEEK_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7])

/** The calendar lengths a person can pick. The server enforces the same 1-6 (limits.minMonths / maxMonths). */
export const MIN_MONTHS = 1
export const MAX_MONTHS = 6
export const DURATION_OPTIONS = Object.freeze(Array.from({ length: MAX_MONTHS }, (_, i) => ({ months: i + 1, label: i === 0 ? '1 month' : `${i + 1} months` })))

const iso = (dt) => dt.toFormat('yyyy-LL-dd')

/** Tomorrow (local time) as a calendar date: where a new plan starts by default. */
export function defaultStartDate() {
  return iso(DateTime.local().plus({ days: 1 }).startOf('day'))
}

/**
 * The LAST day (inclusive) of a calendar that starts on `startDate` and covers `months` calendar months. The start day is
 * inclusive; the period runs up to (start + N months) exclusive, so Oct 13 + 1 month ends Nov 12. A start day that does not
 * exist in the target month is clamped to that month's last day (Jan 31 + 1 month -> Feb 28 exclusive -> ends Feb 27), so
 * February is never skipped and the period never overshoots. Pure calendar dates (UTC): no time zone or DST can shift one.
 * This is the same rule the server applies (calendarPlanner.periodEndDate); the server's answer is the one that counts.
 */
export function periodEndDate(startDate, months) {
  const start = DateTime.fromISO(startDate || '', { zone: 'utc' })
  if (!start.isValid || !Number.isInteger(months) || months < MIN_MONTHS) return ''
  return iso(start.plus({ months }).minus({ days: 1 }))
}

export function dayCount(startDate, endDate) {
  const a = DateTime.fromISO(startDate || '')
  const b = DateTime.fromISO(endDate || '')
  if (!a.isValid || !b.isValid || b < a) return 0
  return Math.round(b.diff(a, 'days').days) + 1
}

/** "Mon 7 Oct" for a calendar date string (no timezone conversion: it is a calendar date). */
export function formatPlanDate(date, { year = false } = {}) {
  const dt = DateTime.fromISO(date || '', { zone: 'utc' })
  return dt.isValid ? dt.toFormat(year ? 'ccc d LLL yyyy' : 'ccc d LLL') : String(date || '')
}

/** "Wednesday" for a calendar date string, or '' when it is not a date. */
export function weekdayName(date) {
  const dt = DateTime.fromISO(date || '', { zone: 'utc' })
  return dt.isValid ? dt.toFormat('cccc') : ''
}

/** A rough number, used only until the server's exact preview arrives (POST /social/content-calendar/preview is the source of truth). */
/**
 * One honest sentence about this month's allowance (null when no limit applies). `committed` is what was really generated; `reserved` is what a
 * calendar that is still being generated holds meanwhile - it is given back if that calendar does not produce it. Older servers send only `used`.
 */
export function describeQuota(quota) {
  if (!quota) return null
  const part = (scope, who) => {
    if (!scope || scope.limit == null) return null
    const reserved = Number.isFinite(scope.reserved) ? scope.reserved : 0
    const committed = Number.isFinite(scope.committed) ? scope.committed : Math.max(0, (scope.used || 0) - reserved)
    const held = reserved > 0 ? ` (${reserved} more ${reserved === 1 ? 'is' : 'are'} held for a calendar being generated)` : ''
    return `${committed} of ${scope.limit} calendar posts ${who}${held}`
  }
  const parts = [part(quota.user, 'on your account'), part(quota.project, 'on this project')].filter(Boolean)
  if (!parts.length) return null
  const resets = quota.resetsAt ? ` The allowance resets on ${formatPlanDate(String(quota.resetsAt).slice(0, 10), { year: true })}.` : ''
  return `This month you have used ${parts.join(' and ')}.${resets}`
}

export function estimatePosts(postsPerWeek, days) {
  if (!postsPerWeek || !days) return 0
  return Math.max(1, Math.round((postsPerWeek * days) / 7))
}

/** The default posts per week: the strategy's recommendation, kept inside 1-7, else 3. */
export function defaultPostsPerWeek(recommended) {
  const n = Number(recommended?.postsPerWeek)
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : 3
}

export function recommendedLabel(recommended) {
  const r = recommended?.range
  if (r && r.min && r.max) return r.min === r.max ? `${r.min} posts/week` : `${r.min}-${r.max} posts/week`
  const n = Number(recommended?.postsPerWeek)
  return n >= 1 && n <= 7 ? `${n} posts/week` : null
}

/**
 * The caption a person reviewed in the plan, as it would be posted on ONE platform: that platform's own copy when it has one, else the
 * shared caption (a blank platform field falls back to the shared one). Same rule as the server (plannedCopyFor): "Create post from this
 * plan" uses exactly this text, so the editor can say so and show whether there is anything to use.
 */
export function plannedCopyFor(item, platform) {
  const entry = (item?.platformContent || []).find((p) => p.platform === platform)
  const caption = String(entry?.caption || item?.caption || '').trim()
  const hashtags = [...((entry?.hashtags?.length ? entry.hashtags : item?.hashtags) || [])]
  return { caption, hashtags }
}

export const platformsLabel = (platforms) => (platforms || []).map((p) => (p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : p)).join(' + ')

export function groupByWeek(items) {
  const weeks = new Map()
  for (const item of items) {
    const dt = DateTime.fromISO(item.date, { zone: 'utc' })
    const key = dt.isValid ? dt.startOf('week').toFormat('yyyy-LL-dd') : item.date
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key).push(item)
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, list]) => ({ weekStart, items: list }))
}

// ── calendar view helpers (counts, plan state, status groups, pillar colours) ──

/** Today as a local calendar date ("YYYY-MM-DD"). */
export const todayDate = () => DateTime.local().toFormat('yyyy-LL-dd')

/**
 * How posts are shared between platforms, counting every post ONCE: "13 posts: 8 Facebook only, 5 Instagram only, 0 both". Adding up
 * per-platform counts would count a cross-post twice (8 + 9 = 17 for 13 posts), so that is never shown as a total.
 */
export function platformBreakdown(items) {
  const out = { total: 0, facebookOnly: 0, instagramOnly: 0, both: 0 }
  for (const item of items || []) {
    const p = item.platforms || []
    out.total += 1
    if (p.includes('facebook') && p.includes('instagram')) out.both += 1
    else if (p.includes('facebook')) out.facebookOnly += 1
    else if (p.includes('instagram')) out.instagramOnly += 1
  }
  return out
}

/** Has a plan ended? A plan is over once its last day is before today. */
export const planHasEnded = (config, today = todayDate()) => !!config?.endDate && config.endDate < today

/** The start of the next plan after one that ended: the day after it ended, but never in the past. */
export function nextPlanStart(config, today = todayDate()) {
  const after = config?.endDate ? iso(DateTime.fromISO(config.endDate, { zone: 'utc' }).plus({ days: 1 })) : null
  return after && after >= today ? after : iso(DateTime.local().plus({ days: 1 }).startOf('day'))
}

/**
 * The four stages a person follows a post through, from the ONE effective status: Draft (planned, not yet in review), In approval (content or
 * design being reviewed), Approved (ready to schedule), Scheduled, Published - plus Failed / Cancelled, which are shown as they are.
 */
export const STATUS_GROUPS = Object.freeze([
  { id: 'draft', label: 'Draft', tone: 'slate', statuses: ['planned', 'edited', 'plan_approved', 'draft', 'content_generated'] },
  { id: 'in_approval', label: 'In approval', tone: 'amber', statuses: ['content_review', 'design_review'] },
  { id: 'approved', label: 'Approved', tone: 'green', statuses: ['content_approved', 'approved'] },
  { id: 'scheduled', label: 'Scheduled', tone: 'blue', statuses: ['scheduled'] },
  { id: 'published', label: 'Published', tone: 'violet', statuses: ['published'] },
  { id: 'failed', label: 'Failed', tone: 'red', statuses: ['failed', 'cancelled'] },
])

export function statusGroupOf(item) {
  const status = item?.effectiveStatus || item?.status || 'planned'
  return STATUS_GROUPS.find((g) => g.statuses.includes(status)) || STATUS_GROUPS[0]
}

/**
 * One colour per content pillar, in the strategy's order, so a post card's marker and the content-mix legend always agree. Solid Tailwind
 * classes (listed in full so the build keeps them).
 */
export const PILLAR_COLORS = Object.freeze([
  { dot: 'bg-violet-500', border: 'border-l-violet-500', bar: 'bg-violet-500' },
  { dot: 'bg-sky-500', border: 'border-l-sky-500', bar: 'bg-sky-500' },
  { dot: 'bg-emerald-500', border: 'border-l-emerald-500', bar: 'bg-emerald-500' },
  { dot: 'bg-amber-500', border: 'border-l-amber-500', bar: 'bg-amber-500' },
  { dot: 'bg-rose-500', border: 'border-l-rose-500', bar: 'bg-rose-500' },
  { dot: 'bg-teal-600', border: 'border-l-teal-600', bar: 'bg-teal-600' },
  { dot: 'bg-indigo-500', border: 'border-l-indigo-500', bar: 'bg-indigo-500' },
  { dot: 'bg-orange-500', border: 'border-l-orange-500', bar: 'bg-orange-500' },
])
const NO_PILLAR = { dot: 'bg-slate-400', border: 'border-l-slate-300', bar: 'bg-slate-400' }

/** pillar name -> colour, from the calendar's pillar distribution (the strategy's order). */
export function pillarColorMap(distribution) {
  const map = new Map()
  ;(distribution || []).forEach((d, i) => map.set(d.pillar, PILLAR_COLORS[i % PILLAR_COLORS.length]))
  return { get: (name) => map.get(name) || NO_PILLAR }
}

/** A pillar whose planned share is more than this many percentage points away from its target is highlighted. */
export const MIX_TOLERANCE_POINTS = 5
export const mixOffTarget = (d) => Math.abs((d.plannedPercent ?? 0) - (d.targetPercent ?? 0)) > MIX_TOLERANCE_POINTS

/** "2026-10-20: the same format ..." -> { date: 'Tue 20 Oct', text: 'The same format ...' } (a warning without a date is kept whole). */
export function splitWarning(warning) {
  const m = /^(\d{4}-\d{2}-\d{2}):\s*(.*)$/.exec(String(warning || ''))
  if (!m) return { date: null, text: String(warning || '') }
  return { date: formatPlanDate(m[1]), text: m[2].charAt(0).toUpperCase() + m[2].slice(1) }
}

/**
 * The weeks a month grid shows: Monday-first rows covering the whole month, each cell a date with its flags. `range` is the plan's period
 * (days outside it are greyed out).
 */
export function monthGrid(monthStart, { range = null, today = todayDate() } = {}) {
  const first = DateTime.fromISO(monthStart, { zone: 'utc' }).startOf('month')
  const gridStart = first.minus({ days: first.weekday - 1 })
  const last = first.endOf('month')
  const gridEnd = last.plus({ days: 7 - last.weekday })
  const weeks = []
  for (let day = gridStart; day <= gridEnd; day = day.plus({ days: 7 })) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const d = day.plus({ days: i })
      const date = iso(d)
      return {
        date,
        day: d.day,
        inMonth: d.month === first.month,
        isToday: date === today,
        inRange: !range || (date >= range.startDate && date <= range.endDate),
        isPast: date < today,
      }
    }))
  }
  return weeks
}

export const monthLabel = (monthStart) => DateTime.fromISO(monthStart, { zone: 'utc' }).toFormat('LLLL yyyy')
export const monthOf = (date) => iso(DateTime.fromISO(date, { zone: 'utc' }).startOf('month'))
export const shiftMonth = (monthStart, n) => iso(DateTime.fromISO(monthStart, { zone: 'utc' }).plus({ months: n }).startOf('month'))

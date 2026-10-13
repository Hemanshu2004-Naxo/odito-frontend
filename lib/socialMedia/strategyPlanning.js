/**
 * Display helpers for the strategy wizard's planning choice (posts per week, months, platforms).
 *
 * Nothing here decides what is supported or how many posts a choice means: the SERVER's calendar planner does both
 * (POST /social/ai-strategy/plan-preview). These are only the words and the suggested shortcuts. The frequencies below are suggestions, not
 * plan entitlements; any whole number from 1 to 7 is accepted by the planner, so the wizard offers the others as "something else".
 */

export const FREQUENCY_OPTIONS = Object.freeze([
  { value: 1, title: 'Light', hint: 'About one post a week. Easy to keep up with, slow to build momentum.' },
  { value: 3, title: 'Recommended starting point', hint: 'A steady rhythm most small teams can keep. Enough to stay visible.' },
  { value: 5, title: 'Active', hint: 'Nearly every working day. Needs a regular time set aside each week.' },
  { value: 7, title: 'Daily', hint: 'A post every day. Best with a dedicated person or plenty of ready material.' },
])
export const OTHER_FREQUENCIES = Object.freeze([2, 4, 6])

export const DURATION_TAGS = Object.freeze({ 1: 'Quick start', 3: 'Recommended', 6: 'Long-term planning' })
export const DURATION_VALUES = Object.freeze([1, 2, 3, 4, 5, 6])

export const FREQUENCY_TAGS = Object.freeze({ 1: 'Light', 3: 'Recommended starting point', 5: 'Active', 7: 'Daily' })

export const postsPerWeekLabel = (n) => `${n} post${n === 1 ? '' : 's'} per week`
export const monthsLabel = (n) => `${n} month${n === 1 ? '' : 's'}`
export const platformList = (platforms) => (platforms || []).map((p) => (p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : p)).join(' + ')

/** The connection state of a platform in plain words, and what (if anything) it limits. */
export function platformStateView(state) {
  if (state === 'connected') return { tone: 'green', label: 'Connected', note: null }
  if (state === 'expired') return { tone: 'amber', label: 'Needs reconnecting', note: 'You can still create the strategy. Reconnect before you publish.' }
  return { tone: 'slate', label: 'Not connected', note: 'You can still create the strategy. Connect it before you publish.' }
}

/** A fresh idempotency key for one wizard confirmation: the same click sent twice is the same strategy version. */
export function newRequestId() {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `wiz_${random}`.slice(0, 60)
}

/** Whether two saved choices are the same (platform order does not matter). */
export function samePlanning(a, b) {
  if (!a || !b) return false
  return a.postsPerWeek === b.postsPerWeek && a.months === b.months && [...(a.platforms || [])].sort().join() === [...(b.platforms || [])].sort().join()
}

/**
 * The content-mix percentages as a person should read them: sorted, with a plain verdict on whether they add up (the server already
 * corrects small rounding, so a total other than 100 only shows for data that predates that rule).
 */
export function mixSummary(items, key = 'suggestedPercentage') {
  const list = [...(items || [])].map((i) => ({ ...i, percent: Number(i[key]) || 0 })).sort((a, b) => b.percent - a.percent)
  const total = list.reduce((s, i) => s + i.percent, 0)
  return { list, total, adds: total === 100, text: list.map((i) => `${i.name || i.type}: ${i.percent}%`).join(', ') }
}

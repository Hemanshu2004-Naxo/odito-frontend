export const PAGE_BASE = '/app/google-ai-overview'
export const QUESTIONS_PER_RUN = 5
/** Size of a generated question set for Google AI Overview: the five asked per run plus a couple of spares. */
export const SET_SIZE = 7

export const STATUS_LABELS = {
  queued: 'Queued', running: 'Running', completed: 'Completed', partial: 'Partial', failed: 'Failed', cancelled: 'Cancelled',
  skipped: 'Not sent', pending: 'Pending', succeeded: 'Returned',
}
export const isActiveStatus = (s) => s === 'queued' || s === 'running'

/** What Google showed (or what happened to the request) for one question. An absent AI Overview is NOT a failed request. */
export const OBSERVATION = {
  ai_overview: { label: 'AI Overview shown', tone: 'success' },
  no_ai_overview: { label: 'No AI Overview', tone: 'neutral' },
  request_failed: { label: 'Request failed', tone: 'danger' },
  not_sent: { label: 'Not sent', tone: 'warn' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'neutral' },
}

export const ERROR_TEXT = {
  GOOGLE_AIO_AUTH_FAILED: 'The data provider rejected the server credentials.',
  GOOGLE_AIO_INSUFFICIENT_CREDITS: 'The data provider account is out of credit.',
  GOOGLE_AIO_ACCOUNT_RESTRICTED: 'The data provider account is temporarily restricted.',
  GOOGLE_AIO_RATE_LIMITED: 'Rate limited by the data provider.',
  GOOGLE_AIO_TIMEOUT: 'The request timed out.',
  GOOGLE_AIO_NETWORK: 'A network error occurred.',
  GOOGLE_AIO_PROVIDER_UNAVAILABLE: 'The data provider was unavailable.',
  GOOGLE_AIO_REQUEST_REJECTED: 'The data provider rejected the request.',
  GOOGLE_AIO_TASK_FAILED: 'The data provider could not complete the search.',
  GOOGLE_AIO_SEARCH_ENGINE_ERROR: 'Google\'s search failed on the provider side (provider code 40101, "internal se server error"). This is temporary and not a credentials problem.',
  GOOGLE_AIO_TASK_EXECUTION_FAILED: 'The provider\'s search task failed and was retried without success.',
  GOOGLE_AIO_NO_SEARCH_RESULTS: 'The provider returned no search results at all for this query (this is not the same as "no AI Overview").',
  GOOGLE_AIO_COST_LIMIT_EXCEEDED: 'The data provider spending limit was reached.',
  GOOGLE_AIO_DUPLICATE_TASK_LIMIT: 'The data provider refused a repeated identical search (duplicate-task limit).',
  NOT_SENT_PROVIDER_ACCOUNT_ERROR: 'Not sent: the data provider account reported a problem on another question, so the remaining searches were stopped.',
  GOOGLE_AIO_MALFORMED_RESPONSE: 'The provider answered, but the response could not be read.',
  GOOGLE_AIO_UNEXPECTED_ERROR: 'An unexpected error occurred.',
  COST_LIMIT_REACHED: 'Stopped early: the run cost limit was reached.',
  RUN_CANCELLED: 'Cancelled before this question was sent.',
  RUN_ATTEMPTS_EXHAUSTED: 'The run was interrupted too many times.',
  NOT_EXECUTED: 'Not sent.',
  WORKER_INTERRUPTED: 'The run was interrupted while this question was being searched.',
  ALL_QUESTIONS_FAILED: 'None of the five questions could be searched.',
  SOME_QUESTIONS_NOT_ANSWERED: 'Some questions were not searched.',
  ALL_QUESTIONS_NAME_TRACKED_BUSINESS: 'Every selected question names your business, a competitor or your website, so none was sent.',
  BRAND_IN_QUESTION: 'Not sent: the question names your business.',
  COMPETITOR_IN_QUESTION: 'Not sent: the question names a competitor.',
  DOMAIN_IN_QUESTION: 'Not sent: the question contains your website address.',
  URL_IN_QUESTION: 'Not sent: the question contains a web address.',
  QUESTION_SNAPSHOT_INVALID: 'The run did not contain exactly five questions, so nothing was sent.',
}
export const errorText = (code) => (code ? ERROR_TEXT[code] || code : null)

/** The reason a question has no result, in words: why it failed, why it was never sent, or that the run was cancelled. null when it has a result. */
export function reasonText(row) {
  if (!row || row.observation === 'ai_overview' || row.observation === 'no_ai_overview') return null
  if (row.observation === 'not_sent' && row.skipCause) return `${errorText(row.errorCode)} (${errorText(row.skipCause)})`
  return errorText(row.errorCode) || (row.observation === 'pending' ? 'Waiting to be searched.' : null)
}

/** Questions that reached ANY terminal state (searched, failed, not sent or cancelled). 5/5 only when every question has settled. */
export const processedCount = (s) => (s ? (s.succeeded ?? 0) + (s.failed ?? 0) + (s.skipped ?? 0) + (s.cancelled ?? 0) : 0)

export const LIMITATION_TEXT = {
  BRAND_NAME_UNRELIABLE: 'The business name is too generic to match reliably in free text, so the mention rate is not reported.',
  NO_KNOWN_COMPETITORS: 'No competitors are saved for this business, so competitor visibility is not tracked.',
  NO_AI_OVERVIEWS_RETURNED: 'Google showed no AI Overview for any of the five questions in this run.',
  SOME_OVERVIEWS_HAVE_NO_SOURCE_REFERENCES: 'Some AI Overviews came back without source links. They are left out of the website citation rate rather than counted as "not cited".',
  SOME_OVERVIEWS_HAVE_NO_TEXT: 'Some AI Overviews came back without readable text. They are left out of the brand mention rate.',
}

/** What each figure means - shown next to the numbers so nobody has to guess the denominator. */
export const METRIC_HELP = {
  aiOverview: 'Of the questions Google returned results for, how many showed an AI Overview. A question with no AI Overview is a valid result, not an error.',
  brandMention: 'Of the AI Overviews Google showed, how many name your business in the text. Links do not count as mentions.',
  websiteCitation: 'Of the AI Overviews whose source links could be read, how many link to a page on your website. Overviews without readable sources are left out, not counted as "not cited".',
  uniquePages: 'Distinct pages of your website cited across the overviews in this run. The same page cited twice counts once.',
  questions: 'Every run asks exactly five questions. A question that fails is recorded as failed and is never replaced.',
}

export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const num = (v) => (v == null ? '—' : String(v))

export function formatDateTime(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Provider-reported cost; an unknown cost is "Not reported", never 0. */
export function formatCost(cost) {
  if (!cost || cost.amount == null) return cost?.unknownCount ? 'Not reported' : '—'
  return `${cost.amount.toFixed(4)}${cost.unit ? ` ${cost.unit}` : ''}`
}

/** "7 of 12 overviews" style basis for a rate object { count, denominator }. */
export function basis(m, noun) {
  if (!m || !m.denominator) return `No ${noun} to measure yet`
  return `${m.count} of ${m.denominator} ${noun}`
}

/** Only http(s) links are ever rendered as links; the server already filters, this is the second line of defence. */
export const safeHref = (url) => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null)
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }

export const INTENT_LABELS = {
  discovery: 'Discovery', specific_requirements: 'Specific requirements', problem_solving: 'Problem solving',
  comparison: 'Comparison', buying_decision: 'Buying decision', local_discovery: 'Local discovery',
}
export const intentLabel = (i) => INTENT_LABELS[i] || i

export const DEVICES = { desktop: 'Desktop', mobile: 'Mobile' }

/** Why a run could not start / be previewed (details.code) in plain language. */
export const REFUSAL_TEXT = {
  NO_APPROVED_QUESTION_SET: 'This project has no approved question set. Generate one, review it and approve it first.',
  NOT_ENOUGH_QUESTIONS: 'The approved question set has fewer than five usable questions. Enable more questions or generate a new set.',
  QUESTION_COUNT_INVALID: 'Exactly five questions are required.',
  QUESTION_IDS_INVALID: 'The question selection is not valid.',
  DUPLICATE_QUESTION: 'The same question was selected twice.',
  QUESTION_NOT_ELIGIBLE: 'A selected question is not in the approved set or no longer fits the business profile.',
  DEVICE_NOT_SUPPORTED: 'Choose desktop or mobile.',
  PROFILE_LOCATION_CONFLICT: 'Two different cities are on record for this project. Confirm the target city in the business profile.',
  LOCATION_COUNTRY_MISSING: 'Set the project\'s target country first.',
  LOCATION_CITY_MISSING: 'Confirm the project\'s target city first.',
  LOCATION_NOT_FOUND: 'Google has no location matching the project\'s target city. Check the city in the business profile; Odito will not search another place instead.',
  LOCATION_AMBIGUOUS: 'More than one Google location has this city name. Add the state to the business profile.',
  LOCATION_LOOKUP_FAILED: 'The location could not be verified with the data provider. Try again shortly.',
  INVALID_LANGUAGE_CODE: 'The project language is not valid for Google search.',
  PROJECT_DAILY_LIMIT: 'The daily run limit for this project was reached.',
}

export function describeStartError(error) {
  const code = error?.details?.code
  if (code && REFUSAL_TEXT[code]) return REFUSAL_TEXT[code]
  const status = error?.status
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 403 || status === 404) return 'This project is not available to your account.'
  if (status === 503) return 'Google AI Overview Visibility is not enabled on this server yet.'
  if (status === 409) return 'A run is already in progress for this project.'
  return error?.message || 'Could not start the run.'
}

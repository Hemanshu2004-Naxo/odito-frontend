export const CATEGORY_LABELS = {
  industry_discovery: 'Industry discovery',
  service_discovery: 'Service discovery',
  brand_recognition: 'Brand recognition',
  competitor_comparison: 'Competitor comparison',
  local_market_intent: 'Local / market intent',
}

export const CATEGORY_HINTS = {
  industry_discovery: 'Asks for the leading providers in your industry, without naming you.',
  service_discovery: 'Asks who offers one of your services, without naming you.',
  brand_recognition: 'Asks what ChatGPT knows about your business by name.',
  competitor_comparison: 'Asks ChatGPT to compare you with competitors.',
  local_market_intent: 'A buyer looking for a provider in your market, without naming you.',
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

export const STATUS_LABELS = {
  queued: 'Queued', running: 'Running', completed: 'Completed', partial: 'Partial',
  failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped',
  pending: 'Pending', succeeded: 'Answered',
}

/** Plain-language text for backend failure / error codes. Unknown codes are shown as-is rather than hidden. */
export const ERROR_TEXT = {
  CHATGPT_AUTH_FAILED: 'The data provider rejected the server credentials.',
  CHATGPT_INSUFFICIENT_CREDITS: 'The data provider account is out of credit.',
  CHATGPT_ACCOUNT_RESTRICTED: 'The data provider account is temporarily restricted.',
  CHATGPT_RATE_LIMITED: 'Rate limited by the data provider.',
  CHATGPT_TIMEOUT: 'The request timed out.',
  CHATGPT_NETWORK: 'A network error occurred.',
  CHATGPT_PROVIDER_UNAVAILABLE: 'The data provider was unavailable.',
  CHATGPT_REQUEST_REJECTED: 'The data provider rejected the request.',
  CHATGPT_MALFORMED_RESPONSE: 'The provider returned an answer that could not be read.',
  CHATGPT_UNEXPECTED_ERROR: 'An unexpected error occurred.',
  COST_LIMIT_REACHED: 'Stopped early: the run cost limit was reached.',
  RUN_CANCELLED: 'Cancelled.',
  RUN_ATTEMPTS_EXHAUSTED: 'The run was interrupted too many times.',
  NOT_EXECUTED: 'Not sent.',
  ALL_EXECUTIONS_FAILED: 'None of the prompts could be answered.',
  VISIBILITY_INSUFFICIENT_PROFILE: 'Add an industry or at least one service to the business profile so prompts can be written.',
  VISIBILITY_PROMPT_SET_INVALID: 'The prompts could not be validated.',
  VISIBILITY_PROJECT_NOT_FOUND: 'The project could not be found.',
  WORKER_INTERRUPTED: 'The run was interrupted while this question was being answered.',
  PROJECT_COOLDOWN: 'A run was started very recently.',
  PROJECT_DAILY_LIMIT: 'The daily run limit for this project was reached.',
  USER_DAILY_LIMIT: 'The daily run limit for this account was reached.',
}
export const errorText = (code) => (code ? ERROR_TEXT[code] || code : null)

export const LIMITATION_TEXT = {
  BRAND_NAME_UNRELIABLE: 'The business name is too generic to match reliably in free text, so the mention rate is not reported.',
  BRAND_NAME_UNVERIFIED: 'The business name is not verified against Google; mentions were matched on the name you entered.',
  NO_TARGET_HOST: 'No website host is known for this project, so citation metrics are not reported.',
  NO_SUCCESSFUL_RESPONSES: 'No prompt returned an answer, so no visibility rates can be calculated.',
  PARTIAL_EXECUTION: 'Some prompts failed. Rates use only the answers that came back; failures are not counted as "not visible".',
  NO_KNOWN_COMPETITORS: 'No competitors are saved for this business, so competitor mentions are not tracked.',
}

/** 0.6667 -> "67%"; null -> an en dash (unknown is not zero). */
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const num = (v) => (v == null ? '—' : String(v))

/** Provider-reported cost. The API states no currency, so none is shown unless the server was configured with one. */
export function formatCost(totalCost) {
  if (!totalCost || totalCost.amount == null) return totalCost?.unknownCount ? 'Not reported' : '—'
  const unit = totalCost.unit && totalCost.unit !== 'provider_reported' ? ` ${totalCost.unit}` : ''
  return `${totalCost.amount.toFixed(4)}${unit}`
}

export function formatDateTime(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export const isActiveStatus = (s) => s === 'queued' || s === 'running'

export const PROMPT_SOURCE_LABELS = { openai: 'Reworded by OpenAI', template: 'Template', template_fallback: 'Template (OpenAI unavailable)' }

export function describeStartError(error) {
  const status = error?.status
  if (status === 503) return 'ChatGPT Visibility is not enabled on this server yet.'
  if (status === 409) return 'A run is already in progress for this project.'
  if (status === 429) {
    const code = error?.details?.code
    return errorText(code) || 'The run limit has been reached. Try again later.'
  }
  return error?.message || 'Could not start the run.'
}

// ───────────────────────── approved-question system ─────────────────────────

/** Intent groups of the unbranded visibility questions, in display order, plus the separate brand group. Labels only: the server defines them. */
export const INTENT_LABELS = {
  discovery: 'Discovery',
  specific_requirements: 'Specific requirements',
  problem_solving: 'Problem solving',
  comparison: 'Comparison',
  buying_decision: 'Buying decision',
  local_discovery: 'Local discovery',
  brand_reputation: 'Brand reputation',
}
export const INTENT_ORDER = Object.keys(INTENT_LABELS)
export const INTENT_HINTS = {
  discovery: 'Which companies offer a service.',
  specific_requirements: 'Providers that meet a specific requirement.',
  problem_solving: 'Who can fix a particular problem.',
  comparison: 'Which providers suit a type of customer.',
  buying_decision: 'Providers that meet a buying requirement.',
  local_discovery: 'Providers serving a city or area.',
  brand_reputation: 'Names your business, so it shows what ChatGPT knows rather than unprompted visibility.',
}
export const intentLabel = (i) => INTENT_LABELS[i] || i

export const SET_STATUS_LABELS = { draft: 'Draft', approved: 'Approved', archived: 'Archived' }
export const GENERATED_BY_LABELS = { openai: 'Reworded by OpenAI', template: 'Template', template_fallback: 'Template (OpenAI unavailable)' }

/** What the server reports as missing from the business details (set.missingBusinessInformation). */
export const MISSING_INFO_TEXT = {
  business_category: 'Business category',
  services: 'Services',
  target_cities: 'Target cities',
  customer_types: 'Customer types',
  customer_problems: 'Customer problems',
  requirements: 'Requirements',
  buying_requirements: 'Buying requirements',
}
export const MISSING_INFO_EFFECT = {
  business_category: 'Questions that ask about a kind of provider are skipped.',
  services: 'Service-specific questions are skipped.',
  target_cities: 'Location-specific questions are skipped.',
  customer_types: 'Comparison questions are skipped.',
  customer_problems: 'Problem-solving questions are skipped.',
  requirements: 'Specific-requirement questions are skipped.',
  buying_requirements: 'Buying-decision questions are skipped.',
}

/** Set-level warnings from the server (set.warnings). Unknown ones are shown as-is. */
export const SET_WARNING_TEXT = {
  language_not_applied_templates_are_english: 'The questions are in English: the chosen language needs the OpenAI step, which was not available.',
}
export const setWarningText = (w) => SET_WARNING_TEXT[w]
  || (/_dropped_unsafe_value$/.test(w) ? `Some ${w.replace(/_dropped_unsafe_value$/, '').replace(/([A-Z])/g, ' $1').toLowerCase()} entries were ignored because they looked unsafe.` : w)

/** Validation issue codes the server returns when an edit or an approval is refused (details.issues[].code). */
export const ISSUE_TEXT = {
  EMPTY_QUESTION: 'The question is empty.',
  QUESTION_TOO_SHORT: 'The question is too short.',
  QUESTION_TOO_LONG: 'The question is too long (300 characters at most).',
  CONTROL_CHARACTERS: 'The question contains characters that are not allowed.',
  INSTRUCTION_LIKE_CONTENT: 'The question reads like an instruction to an AI system. Write it as a customer would ask it.',
  UNSUPPORTED_URL: 'Questions cannot contain web addresses.',
  BRAND_IN_VISIBILITY_QUESTION: 'This group must not name your business: that would inflate your visibility. Brand questions are a separate group.',
  COMPETITOR_IN_VISIBILITY_QUESTION: 'This group must not name a competitor.',
  DOMAIN_IN_VISIBILITY_QUESTION: 'This group must not contain your website address.',
  MISSING_BRAND_NAME: 'A brand question must name your business.',
  DUPLICATE_QUESTION: 'Another question in this set already says the same thing.',
  NO_ENABLED_QUESTIONS: 'Enable at least one visibility question before approving.',
  NO_CHANGES: 'Nothing was changed.',
}
export const issueText = (code) => ISSUE_TEXT[code] || code

/** Plain-language messages for question-set API errors (error.status + error.details.code). */
export function describeQuestionError(error) {
  const code = error?.details?.code
  const issues = Array.isArray(error?.details?.issues) ? error.details.issues.map((i) => issueText(i.code)) : []
  if (error?.status === 401) return 'Your session has expired. Sign in again.'
  if (error?.status === 403 || error?.status === 404) return 'This project or question set is not available to your account.'
  if (code === 'PROFILE_LOCATION_CONFLICT') return 'Two different cities are on record for this project. Confirm the main target city in the business profile first.'
  if (code === 'INVALID_PROFILE') return 'Some details could not be saved. Check the highlighted fields.'
  if (code === 'VISIBILITY_QUESTION_SET_LIMIT') return 'You have generated the maximum number of drafts for today. Review or approve one of the existing drafts.'
  if (code === 'VISIBILITY_INSUFFICIENT_PROFILE') return 'Add a business category or at least one service, so questions can be written.'
  if (code === 'VISIBILITY_QUESTION_SET_STATE') return error?.message || 'This question set changed. Reload to see its current state.'
  if (issues.length) return issues.join(' ')
  if (error?.status === 429) return 'Too many requests. Try again shortly.'
  return error?.message || 'Something went wrong. Try again.'
}

/** Why the server refused to start an approved-question run (details.code), else the generic start-error text. */
export const RUN_REFUSAL_TEXT = {
  NO_APPROVED_QUESTION_SET: 'This project has no approved question set. Approve one first.',
  QUESTION_SET_NOT_APPROVED: 'That question set is not approved (it is a draft, discarded or replaced by a newer version).',
  QUESTION_SET_NOT_FOUND: 'That question set could not be found.',
  QUESTION_SET_EMPTY: 'The approved question set has no enabled questions.',
  MODEL_NOT_SUPPORTED: 'The configured ChatGPT model is not supported by the data provider. Ask an administrator to change it.',
  MODEL_WEB_SEARCH_UNSUPPORTED: 'The configured ChatGPT model cannot search the web. Ask an administrator to change it.',
}
export function describeApprovedRunError(error) {
  const refusal = RUN_REFUSAL_TEXT[error?.details?.code]
  if (refusal) return refusal
  if (error?.status === 401) return 'Your session has expired. Sign in again.'
  if (error?.status === 403 || error?.status === 404) return 'This project is not available to your account.'
  return describeStartError(error)
}

export const COST_TEXT = (cost) => {
  if (!cost) return '—'
  const unit = cost.unit && cost.unit !== 'provider_reported' ? ` ${cost.unit}` : ''
  if (cost.knownTotal == null) return cost.unknownCostCount ? 'Not reported' : '—'
  return `${cost.knownTotal.toFixed(4)}${unit}`
}

/** Limitation codes of an approved-question run's metrics. */
export const APPROVED_LIMITATION_TEXT = {
  SAMPLED_QUESTIONS: 'Results are answers to the approved questions only, not everything ChatGPT says to every user.',
  BRAND_NAME_UNRELIABLE: 'The business name is too generic to match reliably in free text, so mention rates are not reported.',
  BRAND_NAME_UNVERIFIED: 'The business name is not verified against Google; mentions were matched on the name you entered.',
  NO_TARGET_HOST: 'No website host is known for this project, so citation metrics are not reported.',
  NO_SUCCESSFUL_VISIBILITY_ANSWERS: 'No question returned an answer, so no visibility rates can be calculated.',
  PARTIAL_EXECUTION: 'Some questions failed or were not sent. Rates use only the answers that came back; failures are not counted as "not visible".',
  NO_KNOWN_COMPETITORS: 'No competitors are saved for this business, so competitor mentions are not tracked.',
  UNKNOWN_COST_PRESENT: 'The provider did not report a cost for some answers, so the total counts only the costs it did report.',
  COST_BUDGET_NOT_FULLY_ENFORCEABLE: 'Because some costs are unknown, the per-run cost limit could not be fully enforced.',
}

/** Evidence error classes (evidence.errorClass). */
export const ERROR_CLASS_TEXT = {
  retryable: 'A temporary provider problem. A later run may succeed.',
  non_retryable: 'The provider rejected this question.',
  fatal: 'A provider account problem stopped the run.',
  parse: 'The provider answered, but the answer could not be read.',
  cancelled: 'The run was cancelled before this question was sent.',
  budget: 'Not sent: the run cost limit was reached.',
  not_executed: 'Not sent.',
}

export const EXTRA_ERROR_TEXT = { WORKER_INTERRUPTED: 'The run was interrupted while this question was being answered.' }

/** 0.4 -> "40%"; null -> an en dash (unknown is not zero). Same rule as pct(), named for the approved-question views. */
export const pct1 = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

/** Business-profile warnings the profile screen explains (codes from the backend's businessProfileService). */
export const PROFILE_WARNING_TEXT = {
  industry_is_generic_business_model: 'The saved industry is a business type (such as "Service-based"), not an industry. Choose the industry.',
  industry_is_legacy_free_text: 'The saved industry is free text from an older version. Choose an industry from the list.',
  industry_not_set: 'No industry is set.',
  target_city_needs_confirmation: 'The target city was taken from your website. Confirm it before relying on location questions.',
  city_source_unverified: 'The only city on record came from your website, not from you. Confirm the main target city.',
  physical_location_differs_from_target: 'Your Google listing is in a different city from your target city. That is fine; questions use the target city.',
}

/** A rate with the sample it was computed over: { value: "32%", basis: "8 of 25 eligible answers" }. Unavailable when n/N is unknown or N is 0. */
export function rateWithSample(rate, answers, eligible) {
  if (rate == null || !eligible) return { value: '—', basis: eligible === 0 ? 'No eligible answers yet' : 'Not available' }
  return { value: `${Math.round(rate * 100)}%`, basis: `${answers} of ${eligible} eligible ${eligible === 1 ? 'answer' : 'answers'}` }
}

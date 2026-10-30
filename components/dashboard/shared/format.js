/** Shared formatting for the AI Visibility question-set and business-profile screens and the small UI parts. */

export const STATUS_LABELS = {
  queued: 'Queued', running: 'Running', completed: 'Completed', partial: 'Partial',
  failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped', pending: 'Pending', succeeded: 'Answered',
}
export const isActiveStatus = (s) => s === 'queued' || s === 'running'

/** Plain-language text for backend error codes. Unknown codes are shown as-is rather than hidden. */
export const ERROR_TEXT = {
  VISIBILITY_INSUFFICIENT_PROFILE: 'Add an industry or at least one service to the business profile so questions can be written.',
  VISIBILITY_PROJECT_NOT_FOUND: 'The project could not be found.',
}
export const errorText = (code) => (code ? ERROR_TEXT[code] || code : null)

export function formatDateTime(v) {
  if (!v) return '—'
  return new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ───────────────────────── question sets ─────────────────────────

/** Intent groups of the unbranded visibility questions, in display order. Labels only: the server defines them. */
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
  brand_reputation: 'Names your business, so it shows what an AI knows rather than unprompted visibility.',
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
  // One sentence per distinct problem: the server reports an issue per affected question, so codes repeat.
  const issues = Array.isArray(error?.details?.issues) ? [...new Set(error.details.issues.map((i) => issueText(i.code)))] : []
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

/** Business-profile warnings the profile screen explains (codes from the backend's businessProfileService). */
export const PROFILE_WARNING_TEXT = {
  industry_is_generic_business_model: 'The saved industry is a business type (such as "Service-based"), not an industry. Choose the industry.',
  industry_is_legacy_free_text: 'The saved industry is free text from an older version. Choose an industry from the list.',
  industry_not_set: 'No industry is set.',
  target_city_needs_confirmation: 'The target city was taken from your website. Confirm it before relying on location questions.',
  city_source_unverified: 'The only city on record came from your website, not from you. Confirm the main target city.',
  physical_location_differs_from_target: 'Your Google listing is in a different city from your target city. That is fine; questions use the target city.',
}

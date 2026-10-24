/**
 * The business details question generation accepts (the `inputs` of POST .../question-sets). Field names and limits mirror
 * backend/.../shared/questions (questionInputs.js, questionConfig.js): at most 10 entries per list, 100 characters each. The server
 * re-validates everything and silently ignores entries that look unsafe, so these checks are for fast, meaningful feedback only.
 */

export const LIMITS = Object.freeze({ listItems: 10, itemLength: 100 })

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
]

export const LIST_FIELDS = [
  { key: 'services', label: 'Services', hint: 'What you offer, one per entry.', placeholder: 'e.g. LASIK surgery' },
  { key: 'cities', label: 'Target cities', hint: 'Cities you want to be found in.', placeholder: 'e.g. Ahmedabad' },
  { key: 'areas', label: 'Areas within those cities', hint: 'Neighbourhoods or districts you serve.', placeholder: 'e.g. Satellite' },
  { key: 'customerTypes', label: 'Customer types', hint: 'Who you serve.', placeholder: 'e.g. elderly patients' },
  { key: 'problems', label: 'Customer problems', hint: 'Problems you solve, as a customer would describe them.', placeholder: 'e.g. blurred vision' },
  { key: 'requirements', label: 'Requirements customers ask for', hint: 'Only capabilities you really have.', placeholder: 'e.g. cashless insurance' },
  { key: 'buyingRequirements', label: 'Buying requirements you meet', hint: 'Only what you can confirm, such as ongoing support.', placeholder: 'e.g. follow-up care' },
]

const URL_LIKE = /(https?:\/\/|www\.)|\b[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|in|app|dev|ai|info|biz)\b/i

export const emptyForm = () => ({
  category: '', services: [], cities: [], areas: [], customerTypes: [], problems: [], requirements: [], buyingRequirements: [], language: 'en',
})

/** Build the form from a stored set's confirmed inputs (the server stores them merged with profile fall-backs). */
export function formFromInputs(inputs) {
  if (!inputs) return emptyForm()
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  return {
    category: Array.isArray(inputs.categories) && typeof inputs.categories[0] === 'string' ? inputs.categories[0] : '',
    services: list(inputs.services),
    cities: list(inputs.cities),
    areas: list(inputs.areas),
    customerTypes: list(inputs.customerTypes),
    problems: list(inputs.problems),
    requirements: list(inputs.requirements),
    buyingRequirements: list(inputs.buyingRequirements),
    language: typeof inputs.language === 'string' && inputs.language ? inputs.language : 'en',
  }
}

/** Validate ONE entry before it is added to a list. Returns an error message or null. */
export function validateEntry(value, existing = []) {
  const v = String(value ?? '').trim()
  if (!v) return null
  if (v.length > LIMITS.itemLength) return `Keep each entry under ${LIMITS.itemLength} characters.`
  if (URL_LIKE.test(v)) return 'Web addresses are not allowed here.'
  if (existing.some((e) => e.toLowerCase() === v.toLowerCase())) return 'That entry is already in the list.'
  if (existing.length >= LIMITS.listItems) return `You can add up to ${LIMITS.listItems} entries.`
  return null
}

/** @returns {{ok:boolean, errors:Record<string,string>}} */
export function validateForm(form) {
  const errors = {}
  if (form.category.trim().length > LIMITS.itemLength) errors.category = `Keep the category under ${LIMITS.itemLength} characters.`
  else if (URL_LIKE.test(form.category)) errors.category = 'Web addresses are not allowed here.'
  for (const { key } of LIST_FIELDS) {
    const list = form[key]
    if (list.length > LIMITS.listItems) errors[key] = `You can add up to ${LIMITS.listItems} entries.`
    else if (list.some((v) => v.length > LIMITS.itemLength || URL_LIKE.test(v))) errors[key] = 'Some entries are too long or contain a web address.'
  }
  if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(form.language)) errors.language = 'Choose a language.'
  return { ok: Object.keys(errors).length === 0, errors }
}

/** The request body. Only confirmed business details: no questions, no model, no limits. */
export function toRequestInputs(form) {
  const out = { language: form.language }
  if (form.category.trim()) out.category = form.category.trim()
  for (const { key } of LIST_FIELDS) if (form[key].length) out[key] = form[key]
  return out
}

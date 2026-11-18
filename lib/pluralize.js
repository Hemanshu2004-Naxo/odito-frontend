/**
 * One place for "1 post" / "2 posts". `pluralize(3, 'post')` -> "3 posts"; irregular words pass their plural:
 * `pluralize(1, 'day', 'days')`. `plural(n, word)` returns only the word, for sentences that place the number themselves.
 */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return Number(count) === 1 ? singular : pluralForm
}

export function pluralize(count, singular, pluralForm) {
  return `${count} ${plural(count, singular, pluralForm)}`
}

export default pluralize

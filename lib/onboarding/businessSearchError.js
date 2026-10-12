/**
 * Classify a failed onboarding business search into something the chat can
 * explain. A failure is never the same thing as "no matches": the caller must
 * keep the user's inputs, offer the website fallback, and never replay the
 * "what's your business name?" question.
 *
 * Messages are written for end users - no API keys, project ids, or upstream
 * error text (the backend already withholds those; this keeps raw
 * `error.message` strings out of the chat too).
 *
 * @param {Error & { status?: number, code?: string }} error
 * @returns {{ kind: 'network'|'timeout'|'rate_limited'|'unavailable'|'config'|'auth'|'invalid_request', message: string, retryable: boolean }}
 */
export function classifyBusinessSearchError(error) {
  const status = typeof error?.status === 'number' ? error.status : null;
  const code = typeof error?.code === 'string' ? error.code : '';

  // fetch() rejected without ever getting an HTTP response.
  if (status === null) {
    return {
      kind: 'network',
      message: "I couldn't reach the search service. Check your connection and try again.",
      retryable: true,
    };
  }
  if (status === 401) {
    return { kind: 'auth', message: 'Your session has expired. Please sign in again to continue.', retryable: false };
  }
  if (status === 429 || /RATE_LIMIT/i.test(code)) {
    return { kind: 'rate_limited', message: 'Too many searches in a short time. Please wait a moment before trying again.', retryable: true };
  }
  if (status === 408 || status === 504 || /TIMEOUT/i.test(code)) {
    return { kind: 'timeout', message: 'The business search took too long to respond.', retryable: true };
  }
  if (
    status === 403 ||
    /ACCESS_DENIED|KEY_INVALID|NOT_CONFIGURED|BILLING|API_CONFIGURATION_ERROR/i.test(code)
  ) {
    return { kind: 'config', message: 'Business search is not available right now.', retryable: true };
  }
  if (status === 400 || /INVALID/i.test(code)) {
    return { kind: 'invalid_request', message: "I couldn't search with those details.", retryable: true };
  }
  return { kind: 'unavailable', message: 'Something went wrong while looking up your business.', retryable: true };
}

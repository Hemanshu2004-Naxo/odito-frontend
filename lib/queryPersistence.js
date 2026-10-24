/**
 * Social data that must NEVER come back from the persisted (localStorage) cache after a reload: it changes on the server
 * without anyone on the page (the scheduler publishes, a generation finishes) and an edit made on another screen only marks
 * these lists invalid in memory - the persisted copy would look fresh for the whole staleTime and show, for example, a post as
 * scheduled minutes after its schedule was removed. They are cheap to refetch.
 */
// 'content-calendar' carries a generation's live progress (saved posts so far, waiting to retry, partial): a copy from before a reload would show it as still running
const VOLATILE_SOCIAL_KEYS = new Set(['publishing', 'ai-content', 'ai-design', 'studio', 'content-calendar'])

/**
 * AI Visibility: question sets (draft / approved state is decided by the server and changes under the page), run progress, and the stored
 * answers + citations. A copy from before a reload would show a draft that was since approved, a run that has since finished, or answer text
 * that has since expired. Never persisted; refetched on demand.
 */
const VOLATILE_ROOTS = new Set(['ai-visibility-questions', 'chatgpt-visibility'])

/** What may be written to the persisted cache. */
export function shouldPersistQuery(query) {
  const key = query.queryKey
  if (Array.isArray(key) && VOLATILE_ROOTS.has(key[0])) return false
  if (Array.isArray(key) && key[0] === 'social' && VOLATILE_SOCIAL_KEYS.has(key[1])) return false
  return query.state.status === 'success' && !!query.state.data
}

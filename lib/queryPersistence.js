import { isDefaultCompetitorsRequest } from './competitorsRequest'

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
const VOLATILE_ROOTS = new Set(['ai-visibility-questions', 'google-aio-visibility'])

/**
 * Organic Keywords pages (and the 1,000-row "export all" response, ~1.5 MB): every page / sort / filter combination is its own query,
 * so persisting them would fill localStorage's ~5 MB quota and push out the data that is worth keeping. The server's cache makes a
 * refetch cheap, so they live in memory only. (The small top-5 / totals query keeps persisting.)
 */
const isKeywordPageQuery = (key) => Array.isArray(key) && key[0] === 'domain-overview' && (key[2] === 'keywords' || key[2] === 'backlinks-list' || key[2] === 'anchors' || key[2] === 'anchor-profile' || key[2] === 'referring-domains' || key[2] === 'rd-rank-buckets' || key[2] === 'rd-toxic-count' || key[2] === 'domain-pages' || key[2] === 'tp-counts' || key[2] === 'tp-fix-first' || key[2] === 'top-pages-traffic' || key[2] === 'bulk-traffic-peek' || key[2] === 'top-keywords')

/**
 * Competitors: only the DEFAULT view is worth keeping (it is the Domain Overview card's query); every other page / sort / toggle is its
 * own query and stays in memory. The project's saved lists decide which competitors query is the right one, so a copy of them from
 * before a reload could pair the wrong list with a cached answer: they are never persisted.
 */
const isNonDefaultCompetitorsQuery = (key) => Array.isArray(key) && key[0] === 'domain-overview' && key[2] === 'competitors' && !isDefaultCompetitorsRequest(key[5])
const isCompetitorSettingsQuery = (key) => Array.isArray(key) && (key[0] === 'competitor-settings' || key[0] === 'anchor-settings' || key[0] === 'domain-lists')

/** What may be written to the persisted cache. */
export function shouldPersistQuery(query) {
  const key = query.queryKey
  if (Array.isArray(key) && VOLATILE_ROOTS.has(key[0])) return false
  if (isKeywordPageQuery(key)) return false
  if (isNonDefaultCompetitorsQuery(key) || isCompetitorSettingsQuery(key)) return false
  if (Array.isArray(key) && key[0] === 'social' && VOLATILE_SOCIAL_KEYS.has(key[1])) return false
  return query.state.status === 'success' && !!query.state.data
}

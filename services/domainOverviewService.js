/**
 * Domain Overview API (DataForSEO, run by the Express backend).
 * Backend: /api/projects/:projectId/domain-overview/:section — the target domain and market are always derived server-side
 * from the project; the browser only picks the section and whether to skip the server cache. Credentials never reach the browser.
 */
import apiService from '@/lib/apiService'
import { DEFAULT_COMPETITORS_ORDER, DEFAULT_COMPETITORS_PAGE_SIZE } from '@/lib/competitorsRequest'

/** The history window the server returns when none is asked for. */
export const DEFAULT_HISTORY_MONTHS = 12

/** The five sections the page loads in parallel. The order is the order of the page's data (see mapDomainOverview). */
export const DOMAIN_OVERVIEW_SECTIONS = Object.freeze(['rank-overview', 'history', 'ranked-keywords', 'competitors', 'backlinks'])

/**
 * The competitors request as query parameters. Only what differs from the server's defaults is sent, so the default view (the dashboard
 * card's, and the page's first load) is parameter-free — the same URL, the same server cache entry.
 */
function setCompetitorsParams(query, c) {
  if (c.limit && c.limit !== DEFAULT_COMPETITORS_PAGE_SIZE) query.set('limit', String(c.limit))
  if (c.offset) query.set('offset', String(c.offset))
  if (c.order_by && c.order_by !== DEFAULT_COMPETITORS_ORDER) query.set('order_by', c.order_by)
  if (Array.isArray(c.filters) && c.filters.length) query.set('filters', JSON.stringify(c.filters))
  if (c.exclude_top_domains === false) query.set('exclude_top_domains', '0')
  if (c.max_rank_group && c.max_rank_group !== 100) query.set('max_rank_group', String(c.max_rank_group))
}

/** The referring-domains request as query parameters. Only what differs from the server's defaults is sent: the default view is parameter-free. */
function setReferringDomainsParams(query, r) {
  if (r.status && r.status !== 'live') query.set('status', r.status)
  if (r.dofollow) query.set('dofollow', '1')
  if (r.limit && r.limit !== 50) query.set('limit', String(r.limit))
  if (r.offset) query.set('offset', String(r.offset))
  if (r.order_by && r.order_by !== 'rank,desc') query.set('order_by', r.order_by)
  if (Array.isArray(r.filters) && r.filters.length) query.set('filters', JSON.stringify(r.filters))
}

/** The domain-pages request as query parameters. Only what differs from the server's defaults is sent. */
function setTopPagesParams(query, p) {
  if (p.limit && p.limit !== 50) query.set('limit', String(p.limit))
  if (p.offset) query.set('offset', String(p.offset))
  if (p.order_by && p.order_by !== 'page_summary.referring_domains,desc') query.set('order_by', p.order_by)
  if (Array.isArray(p.filters) && p.filters.length) query.set('filters', JSON.stringify(p.filters))
}

function setBacklinksListParams(query, b) {
  if (b.status && b.status !== 'live') query.set('status', b.status)
  if (b.mode && b.mode !== 'as_is') query.set('mode', b.mode)
  if (b.limit && b.limit !== 50) query.set('limit', String(b.limit))
  if (b.token) query.set('token', b.token)
  else if (b.offset) query.set('offset', String(b.offset))
  const order = Array.isArray(b.order_by) ? b.order_by : []
  if (!(order.length === 0 || (order.length === 1 && order[0] === 'rank,desc'))) for (const rule of order) query.append('order_by', rule)
  if (Array.isArray(b.filters) && b.filters.length) query.set('filters', JSON.stringify(b.filters))
}

/** The anchors section's request as query parameters. Only what differs from the server's defaults is sent: the default view is parameter-free. */
function setAnchorsParams(query, a) {
  if (a.status && a.status !== 'live') query.set('status', a.status)
  if (a.limit && a.limit !== 50) query.set('limit', String(a.limit))
  if (a.offset) query.set('offset', String(a.offset))
  if (a.order_by && a.order_by !== 'referring_domains,desc') query.set('order_by', a.order_by)
  if (Array.isArray(a.filters) && a.filters.length) query.set('filters', JSON.stringify(a.filters))
}

export const domainOverviewService = {
  /**
   * One section: { success, data: { section, target, market, fetchedAt, cached, refreshThrottled, ttlSeconds, result } }.
   * `refresh: true` asks the server to skip its cache (it still refuses to re-buy data fetched in the last minute).
   */
  getSection: (projectId, section, { refresh = false, peek = false, months, query: keywordQuery, competitors, targets, backlinks, backlinksList, anchors, referringDomains, topPages } = {}, { signal } = {}) => {
    // `months` (6 | 12 | 24) is for the history only; the default window (12) is requested with no parameter at all.
    const query = new URLSearchParams()
    if (refresh) query.set('refresh', '1')
    // `peek`: answered from the server's cache ONLY (anchor-profile, bulk-traffic) - never a provider call. A miss comes back as result: null.
    if (peek) query.set('peek', '1')
    if (months && months !== DEFAULT_HISTORY_MONTHS) query.set('months', String(months))
    // `query` is for ranked-keywords only: { limit, offset, order_by, filters } (filters = a DataForSEO filter array). Omitted parts take the
    // server defaults, so the dashboard's plain top-5 request stays parameter-free (and shares its cache entry).
    if (keywordQuery) {
      if (keywordQuery.limit) query.set('limit', String(keywordQuery.limit))
      if (keywordQuery.offset) query.set('offset', String(keywordQuery.offset))
      if (keywordQuery.order_by) query.set('order_by', keywordQuery.order_by)
      if (Array.isArray(keywordQuery.filters) && keywordQuery.filters.length) query.set('filters', JSON.stringify(keywordQuery.filters))
    }
    // `competitors` is for the competitors section only: { limit, offset, order_by, filters, exclude_top_domains, max_rank_group }.
    if (competitors) setCompetitorsParams(query, competitors)
    // `backlinks` is for the backlinks section only: { status: 'live' | 'lost' | 'all', dofollow }. The default view sends nothing.
    if (backlinks) {
      if (backlinks.status && backlinks.status !== 'live') query.set('status', backlinks.status)
      if (backlinks.dofollow) query.set('dofollow', '1')
    }
    // `backlinksList` is for the backlinks-list section only (the Backlinks page): { status, mode, limit, offset, token, order_by[], filters }.
    // The default view sends nothing; `token` replaces `offset` (never both).
    if (backlinksList) setBacklinksListParams(query, backlinksList)
    // `anchors` is for the anchors section only (the Anchors page): { status, limit, offset, order_by, filters }. The default view sends
    // nothing. The `anchor-profile` section takes no parameters at all.
    if (anchors) setAnchorsParams(query, anchors)
    // `referringDomains` is for the referring-domains section only (the Referring Domains page): { status, dofollow, limit, offset, order_by, filters }.
    // The two count cards (rd-rank-buckets, rd-toxic-count) take no parameters at all: they are profile-level.
    if (referringDomains) setReferringDomainsParams(query, referringDomains)
    // `topPages` is for the domain-pages section only (the Top Pages page): { limit, offset, order_by, filters }. The three profile pieces
    // (tp-counts, tp-fix-first, top-pages-traffic) take no parameters at all.
    if (topPages) setTopPagesParams(query, topPages)
    // `targets` is for bulk-traffic only: the competitors to compare with the project (the server adds the project itself).
    if (Array.isArray(targets) && targets.length) query.set('targets', targets.join(','))
    const qs = query.toString()
    return apiService.request(`/projects/${encodeURIComponent(projectId)}/domain-overview/${section}${qs ? `?${qs}` : ''}`, { method: 'GET', signal })
  },
}

export default domainOverviewService

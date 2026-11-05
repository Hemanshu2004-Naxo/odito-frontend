/**
 * Explicit SEO scans and stored history (backend: /api/projects/:projectId/seo-scans and /seo-snapshots). The scan POST is the one call
 * here that makes the server buy provider data; everything else reads what is already stored.
 */
import apiService from '@/lib/apiService'

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}`

export const seoScanService = {
  /** @returns {Promise<{ success: boolean, data: { scans: object[] } }>} newest first (max 20) */
  list: (projectId, { limit = 10, signal } = {}) => apiService.request(`${base(projectId)}/seo-scans?limit=${limit}`, { method: 'GET', signal }),

  /**
   * @param {{ scope?: 'overview'|'organic'|'competitors'|'offpage'|'full'|'dataset', datasets?: string[], force?: boolean, retryOf?: string }} input
   * @returns {Promise<{ success: boolean, data: { scan: object, deduped: boolean } }>} 202; an identical running scan comes back with `deduped: true`
   */
  start: (projectId, input) => apiService.request(`${base(projectId)}/seo-scans`, { method: 'POST', body: JSON.stringify(input) }),

  /** Stored snapshots of one dataset (MongoDB only). */
  snapshots: (projectId, { datasetType, part, from, to, limit } = {}, { signal } = {}) => {
    const q = new URLSearchParams({ datasetType })
    if (part) q.set('part', part)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    if (limit) q.set('limit', String(limit))
    return apiService.request(`${base(projectId)}/seo-snapshots?${q}`, { method: 'GET', signal })
  },

  /** What is stored per dataset (keywords, backlinks live / lost, referring domains live / lost): latest scan, rows, provider total, capped or not. */
  datasets: (projectId, { signal } = {}) => apiService.request(`${base(projectId)}/seo-datasets`, { method: 'GET', signal }),

  /**
   * Stored rows from MongoDB (never the provider). kind = keywords | backlinks | referring-domains | anchors | pages; `params` are the endpoint's
   * simple filters (q, sort, dir, page, limit, ...). A project with nothing collected gets `{ missing: true }`.
   */
  listDataset: (projectId, kind, params = {}, { signal } = {}) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    const qs = q.toString()
    return apiService.request(`${base(projectId)}/seo-datasets/${kind}${qs ? `?${qs}` : ''}`, { method: 'GET', signal })
  },

  /** Each dataset of one page on its own: fresh / stale / missing, last success and scan, rows, capped, last error (MongoDB only). */
  freshness: (projectId, page, { signal } = {}) => apiService.request(`${base(projectId)}/seo-datasets/freshness${page ? `?${new URLSearchParams({ page })}` : ''}`, { method: 'GET', signal }),

  /** What scans and explicit refreshes really bought: requests, failures, records, and the costs the provider reported. */
  usage: (projectId, { days, scanId } = {}, { signal } = {}) => {
    const q = new URLSearchParams()
    if (scanId) q.set('scanId', scanId)
    else if (days) q.set('days', String(days))
    const qs = q.toString()
    return apiService.request(`${base(projectId)}/seo-usage${qs ? `?${qs}` : ''}`, { method: 'GET', signal })
  },

  /** New / lost (and, for keywords, improved / declined) between the newest stored scan and the previous / a week-old / a month-old one. */
  changes: (projectId, { dataset, status, period = 'previous' }, { signal } = {}) => {
    const q = new URLSearchParams({ dataset, period })
    if (status) q.set('status', status)
    return apiService.request(`${base(projectId)}/seo-datasets/changes?${q}`, { method: 'GET', signal })
  },

  /** One keyword's stored positions over time and its best position. */
  keywordHistory: (projectId, keyword, { signal } = {}) => apiService.request(`${base(projectId)}/seo-datasets/keywords/history?${new URLSearchParams({ keyword })}`, { method: 'GET', signal }),

  /** The newest snapshot and the one from a week / month before it (previous is null when there is not enough history). */
  comparison: (projectId, { datasetType, part, period }, { signal } = {}) => {
    const q = new URLSearchParams({ datasetType, part, period })
    return apiService.request(`${base(projectId)}/seo-snapshots/comparison?${q}`, { method: 'GET', signal })
  },
}

export default seoScanService

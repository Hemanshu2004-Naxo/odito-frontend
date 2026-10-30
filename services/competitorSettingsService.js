/**
 * The project's saved competitor lists (backend: /api/projects/:projectId/competitor-settings): the domains pinned for the Compare
 * section (max 10) and the project's own exclude list (max 1,000), which the server sends to DataForSEO as exclude_domains.
 * Every call resolves to { success, data: { tracked: string[], excluded: string[], limits: { tracked, excluded } } } — both lists as saved.
 * Domains are cleaned by the server too; a full list answers 409 (TRACKED_LIMIT_REACHED / EXCLUDED_LIMIT_REACHED).
 */
import apiService from '@/lib/apiService'

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}/competitor-settings`

export const competitorSettingsService = {
  get: (projectId, { signal } = {}) => apiService.request(base(projectId), { method: 'GET', signal }),
  addTracked: (projectId, domain) => apiService.request(`${base(projectId)}/tracked`, { method: 'POST', body: JSON.stringify({ domain }) }),
  removeTracked: (projectId, domain) => apiService.request(`${base(projectId)}/tracked/${encodeURIComponent(domain)}`, { method: 'DELETE' }),
  /** @param {string[]} domains */
  addExcluded: (projectId, domains) => apiService.request(`${base(projectId)}/excluded`, { method: 'POST', body: JSON.stringify({ domains }) }),
  removeExcluded: (projectId, domain) => apiService.request(`${base(projectId)}/excluded/${encodeURIComponent(domain)}`, { method: 'DELETE' }),
}

export default competitorSettingsService

/**
 * The project's saved referring-domain lists (backend: /api/projects/:projectId/referring-domain-settings): the domains marked to disavow and
 * the domains marked "OK / keep". Stored on the project. Both calls resolve to { success, data: { disavowed: string[], reviewed: string[],
 * limits } } — both lists as saved, in the order they were added. A change is ONE request: { disavowed: { add, remove }, reviewed: { add, remove } }.
 * The server cleans every domain, refuses an invalid one for the whole change, and keeps the two lists apart (disavowing a domain takes it
 * out of "reviewed" and the other way round). It never calls the data provider.
 */
import apiService from '@/lib/apiService'

const path = (projectId) => `/projects/${encodeURIComponent(projectId)}/referring-domain-settings`

export const referringDomainSettingsService = {
  get: (projectId, { signal } = {}) => apiService.request(path(projectId), { method: 'GET', signal }),
  /** @param {{ disavowed?: { add?: string[], remove?: string[] }, reviewed?: { add?: string[], remove?: string[] } }} change */
  change: (projectId, change) => apiService.request(path(projectId), { method: 'PATCH', body: JSON.stringify(change) }),
}

export default referringDomainSettingsService

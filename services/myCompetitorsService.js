/**
 * My Competitors (backend: /api/projects/:projectId/my-competitors): the competitors the user chose, saved per project.
 * A competitor is { id, name, domain|null, address|null, placeId|null, source: "manual"|"seo"|"local", notes|null, createdAt, updatedAt }.
 * list resolves to { success, data: { competitors, limit } }; create / update to { success, data: { competitor } }; remove to { success, data: { id } }.
 * Errors carry the server's `code`: COMPETITOR_EXISTS and COMPETITOR_LIMIT_REACHED (409), OWN_DOMAIN and VALIDATION_ERROR (400).
 */
import apiService from "@/lib/apiService"

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}/my-competitors`

export const myCompetitorsService = {
  list: (projectId, { signal } = {}) => apiService.request(base(projectId), { method: "GET", signal }),
  /** One competitor with everything stored about it. Never causes a provider call. */
  get: (projectId, id, { signal } = {}) => apiService.request(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "GET", signal }),
  /** Queue a manual SEO refresh (202). The numbers arrive in the background; 409 ENRICHMENT_IN_PROGRESS, 429 REFRESH_COOLDOWN, 400 NO_WEBSITE. */
  refresh: (projectId, id) => apiService.request(`${base(projectId)}/${encodeURIComponent(id)}/refresh`, { method: "POST" }),
  /** A business found in the SEO list ({source:"seo",domain,name?}) or Local Competitors ({source:"local",placeId,name,address?,lat?,lng?,domain?}). The same business is MERGED into its existing record: 201 created, 200 merged. */
  addDiscovered: (projectId, candidate) => apiService.request(`${base(projectId)}/discovered`, { method: "POST", body: JSON.stringify(candidate) }),
  create: (projectId, input) => apiService.request(base(projectId), { method: "POST", body: JSON.stringify(input) }),
  update: (projectId, id, patch) => apiService.request(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (projectId, id) => apiService.request(`${base(projectId)}/${encodeURIComponent(id)}`, { method: "DELETE" }),
}

export default myCompetitorsService

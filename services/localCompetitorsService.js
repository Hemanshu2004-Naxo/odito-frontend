/**
 * Local Competitors (backend: /api/projects/:projectId/local-competitors): real businesses around the project's own location, from Google
 * Places. A search is one EXPLICIT call that makes 1-4 billed Google requests; options makes none.
 * search resolves to { success, data: { center: {lat,lng,source}, radiusKm, categories, results[], meta } }. Each result:
 * { placeId, name, address, lat, lng, types, primaryType, primaryTypeLabel, businessStatus, website, websiteDomain, phone, rating, reviewCount,
 *   mapsUrl, distanceMeters, relevance: "direct"|"related"|"unclassified", addedCompetitorId }. Google content is shown, never stored.
 * Errors carry the server's `code` (LOCATION_REQUIRED, LOCATION_NEEDS_CONFIRMATION, CATEGORY_REQUIRED, LOCAL_BUDGET_EXCEEDED, PLACES_*).
 */
import apiService from "@/lib/apiService"

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}/local-competitors`

export const localCompetitorsService = {
  options: (projectId, { signal } = {}) => apiService.request(`${base(projectId)}/options`, { method: "GET", signal }),
  search: (projectId, body) => apiService.request(`${base(projectId)}/search`, { method: "POST", body: JSON.stringify(body ?? {}) }),
}

export default localCompetitorsService

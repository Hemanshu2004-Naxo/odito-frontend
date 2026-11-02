/**
 * Business Information (backend: /api/projects/:projectId/business-info). Reads and saves the project's identity and its CONFIRMED business
 * location, and proxies Google Places address search (server-side: the browser never sees a Google key).
 * get / save resolve to { success, data: { identity, location, verification, targetLocation } }; see businessInfoController.js.
 * autocomplete -> { data: { suggestions: [{ placeId, text, primary, secondary }] } }; placeDetails -> { data: { place } } (nothing is saved).
 * Errors carry the server's `code` and `field`.
 */
import apiService from "@/lib/apiService"

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}/business-info`
const post = (url, body, signal) => apiService.request(url, { method: "POST", body: JSON.stringify(body), signal })

export const businessInfoService = {
  get: (projectId, { signal } = {}) => apiService.request(base(projectId), { method: "GET", signal }),
  save: (projectId, body) => apiService.request(base(projectId), { method: "PUT", body: JSON.stringify(body) }),
  autocomplete: (projectId, { input, sessionToken }, { signal } = {}) => post(`${base(projectId)}/places/autocomplete`, { input, sessionToken }, signal),
  placeDetails: (projectId, { placeId, sessionToken }) => post(`${base(projectId)}/places/details`, { placeId, sessionToken }),
}

export default businessInfoService

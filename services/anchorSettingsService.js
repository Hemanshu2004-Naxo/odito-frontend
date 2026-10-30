/**
 * The project's saved anchor settings (backend: /api/projects/:projectId/anchor-settings): the brand terms and target keywords the
 * Anchors page uses to give every anchor a type. Stored on the project.
 * Both calls resolve to { success, data: { saved, brand_terms, target_keywords, saved_at, limits } }. `saved: false` = the project never
 * saved any (the page then suggests terms from the domain). A save replaces BOTH lists; the server cleans the terms (lowercase, trimmed).
 */
import apiService from '@/lib/apiService'

const path = (projectId) => `/projects/${encodeURIComponent(projectId)}/anchor-settings`

export const anchorSettingsService = {
  get: (projectId, { signal } = {}) => apiService.request(path(projectId), { method: 'GET', signal }),
  /** @param {{ brandTerms: string[], targetKeywords: string[] }} settings */
  save: (projectId, { brandTerms, targetKeywords }) => apiService.request(path(projectId), {
    method: 'PUT',
    body: JSON.stringify({ brand_terms: brandTerms, target_keywords: targetKeywords }),
  }),
}

export default anchorSettingsService

/**
 * AI Visibility question sets (provider-independent): generate a draft, review and edit it, approve it, or discard it.
 * Backend: /api/ai-visibility/projects/:id/question-sets/... (backend/src/modules/ai_visibility/shared/questions/routes).
 *
 * The server is authoritative for every state change. Nothing here decides whether a set is approved: callers re-read the set the
 * server returns. Questions are generated from the project's STORED, confirmed business profile (GET/PUT .../profile); questions, templates, models and
 * limits are never sent.
 */
import apiService from '@/lib/apiService'

const base = (projectId) => `/ai-visibility/projects/${projectId}/question-sets`

export const aiVisibilityQuestionService = {
  list: (projectId, { page = 1, limit = 10 } = {}) => apiService.get(`${base(projectId)}?page=${page}&limit=${limit}`),
  get: (projectId, setId) => apiService.get(`${base(projectId)}/${setId}`),
  /** The single approved set (the one runs execute), or a response with no `data` when none exists. */
  getApproved: (projectId) => apiService.get(`${base(projectId)}/approved`),
  /** Generates from the STORED, confirmed business profile (save it first with saveProfile). Nothing else is sent. */
  /** maxQuestions (optional, 5-50): cap the size of the generated set; omitted = the default full set. */
  generate: (projectId, { maxQuestions } = {}) => apiService.post(base(projectId), maxQuestions ? { maxQuestions } : {}),
  getProfile: (projectId) => apiService.get(`/ai-visibility/projects/${projectId}/profile`),
  /** changes: only the fields to change (industry, subIndustry, targetCity, services, targetCities, ...); null clears one. */
  saveProfile: (projectId, changes) => apiService.request(`/ai-visibility/projects/${projectId}/profile`, { method: 'PUT', body: JSON.stringify(changes) }),
  /** changes: { enabled?: boolean, text?: string } - drafts only; the server rejects edits to anything else. */
  updateQuestion: (projectId, setId, questionId, changes) => apiService.request(
    `${base(projectId)}/${setId}/questions/${encodeURIComponent(questionId)}`,
    { method: 'PATCH', body: JSON.stringify(changes) },
  ),
  approve: (projectId, setId) => apiService.post(`${base(projectId)}/${setId}/approve`, {}),
  discard: (projectId, setId) => apiService.post(`${base(projectId)}/${setId}/discard`, {}),
}

export default aiVisibilityQuestionService

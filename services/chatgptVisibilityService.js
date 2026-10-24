/**
 * ChatGPT Visibility API (sampled ChatGPT answers and citations).
 * Backend: /api/ai-visibility/chatgpt/projects/:id/... — separate from the on-page AI readiness endpoints
 * (/app_user/projects/:id/ai-visibility/*) served by aiVisibilityService.
 */
import apiService from '@/lib/apiService'

const base = (projectId) => `/ai-visibility/chatgpt/projects/${projectId}`

export const chatgptVisibilityService = {
  getSummary: (projectId) => apiService.get(`${base(projectId)}/summary`),
  listRuns: (projectId, { page = 1, limit = 10 } = {}) => apiService.get(`${base(projectId)}/runs?page=${page}&limit=${limit}`),
  getRun: (projectId, runId) => apiService.get(`${base(projectId)}/runs/${runId}`),
  /**
   * No argument: the original five-prompt check. { questionSetId }: run the project's APPROVED question set. Only the mode and the set
   * id are sent - the server re-validates the id against the database and applies its own model, search, cost and size limits.
   */
  startRun: (projectId, { questionSetId } = {}) => apiService.post(
    `${base(projectId)}/runs`,
    questionSetId ? { mode: 'approved_questions', questionSetId } : {},
  ),
  /** Filters (all optional): status, group, intent, mentioned/recommended/cited ('true'|'false'), citedUrl, competitor, q (search). */
  listEvidence: (projectId, runId, { page = 1, limit = 20, ...filters } = {}) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) })
    for (const k of ['status', 'group', 'intent', 'mentioned', 'recommended', 'cited', 'citedUrl', 'competitor', 'q']) {
      const v = filters[k]
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    }
    return apiService.get(`${base(projectId)}/runs/${runId}/evidence?${q}`)
  },
  /** One point per finished approved-question run; range: 30d | 90d | 365d | all. */
  getTrend: (projectId, range = '90d') => apiService.get(`${base(projectId)}/trend?range=${encodeURIComponent(range)}`),
  /** The website's most-cited pages for one run (runId) or a range. */
  getCitedPages: (projectId, { runId, range } = {}) => {
    const q = new URLSearchParams()
    if (runId) q.set('runId', runId)
    else if (range) q.set('range', range)
    return apiService.get(`${base(projectId)}/cited-pages?${q}`)
  },
  compareRuns: (projectId, runA, runB) => apiService.get(`${base(projectId)}/compare?runA=${encodeURIComponent(runA)}&runB=${encodeURIComponent(runB)}`),
  getEvidence: (projectId, runId, questionId) => apiService.get(`${base(projectId)}/runs/${runId}/evidence/${encodeURIComponent(questionId)}`),
  getQuestionHistory: (projectId, questionId, { limit = 20 } = {}) => apiService.get(`${base(projectId)}/questions/${encodeURIComponent(questionId)}/history?limit=${limit}`),
  cancelRun: (projectId, runId) => apiService.post(`${base(projectId)}/runs/${runId}/cancel`, {}),
  listPromptSets: (projectId) => apiService.get(`${base(projectId)}/prompt-sets`),
}

export default chatgptVisibilityService

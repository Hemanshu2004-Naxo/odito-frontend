/**
 * Google AI Overview Visibility API (Google SERP AI Overviews collected through DataForSEO Google Organic SERP).
 * Backend: /api/ai-visibility/google-aio/projects/:id/....
 */
import apiService from '@/lib/apiService'

const base = (projectId) => `/ai-visibility/google-aio/projects/${projectId}`

export const googleAioVisibilityService = {
  getSummary: (projectId) => apiService.get(`${base(projectId)}/summary`),
  /** What the next run would ask (exactly five questions) and where; makes no paid request. */
  getQuestionSelection: (projectId, { device = 'desktop' } = {}) => apiService.get(`${base(projectId)}/question-selection?device=${encodeURIComponent(device)}`),
  listRuns: (projectId, { page = 1, limit = 10 } = {}) => apiService.get(`${base(projectId)}/runs?page=${page}&limit=${limit}`),
  getRun: (projectId, runId) => apiService.get(`${base(projectId)}/runs/${runId}`),
  /** Only the device (and optionally exactly five question ids) are sent; location, language and limits are the server's. */
  startRun: (projectId, { device = 'desktop', questionIds } = {}) => apiService.post(`${base(projectId)}/runs`, questionIds ? { device, questionIds } : { device }),
  cancelRun: (projectId, runId) => apiService.post(`${base(projectId)}/runs/${runId}/cancel`, {}),
  listEvidence: (projectId, runId) => apiService.get(`${base(projectId)}/runs/${runId}/evidence`),
  getEvidence: (projectId, runId, questionId) => apiService.get(`${base(projectId)}/runs/${runId}/evidence/${encodeURIComponent(questionId)}`),
  getQuestionHistory: (projectId, questionId, { limit = 20 } = {}) => apiService.get(`${base(projectId)}/questions/${encodeURIComponent(questionId)}/history?limit=${limit}`),
  getTrend: (projectId, range = '90d') => apiService.get(`${base(projectId)}/trend?range=${encodeURIComponent(range)}`),
}

export default googleAioVisibilityService

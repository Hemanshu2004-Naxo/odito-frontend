/**
 * Business relevance of websites (backend: /api/projects/:projectId/competitor-assessments). None of these calls costs provider money.
 * An assessment: { domain, status, class (effective), autoClass, overridden, override, confidence, level, reasons[{code,text,source}],
 * signals, facts, assessedAt, stale, errorCode }. At most 50 domains per call, so the helpers split longer lists.
 */
import apiService from "@/lib/apiService"

const base = (projectId) => `/projects/${encodeURIComponent(projectId)}/competitor-assessments`
export const MAX_DOMAINS = 50
const chunks = (list) => { const out = []; for (let i = 0; i < list.length; i += MAX_DOMAINS) out.push(list.slice(i, i + MAX_DOMAINS)); return out }

export const competitorAssessmentsService = {
  /** What is stored for these domains (no request to any site). */
  list: async (projectId, domains, { signal } = {}) => {
    const parts = await Promise.all(chunks(domains).map((part) => apiService.request(`${base(projectId)}?domains=${encodeURIComponent(part.join(","))}`, { method: "GET", signal })))
    return { success: true, data: { assessments: parts.flatMap((p) => p?.data?.assessments ?? []) } }
  },
  /** Queue the check for domains that have none (or a stale one); with { force: true } also for one that is fresh ("check this site again"). Resolves to the current assessments. */
  request: async (projectId, domains, { force = false } = {}) => {
    const parts = await Promise.all(chunks(domains).map((part) => apiService.request(`${base(projectId)}/request`, { method: "POST", body: JSON.stringify({ domains: part, ...(force ? { force: true } : {}) }) })))
    return { success: true, data: { assessments: parts.flatMap((p) => p?.data?.assessments ?? []) } }
  },
  /** The user's own decision for a domain. It always wins over the automatic class. */
  override: (projectId, domain, cls, note = null) => apiService.request(`${base(projectId)}/override`, { method: "PUT", body: JSON.stringify({ domain, class: cls, ...(note ? { note } : {}) }) }),
  clearOverride: (projectId, domain) => apiService.request(`${base(projectId)}/override?domain=${encodeURIComponent(domain)}`, { method: "DELETE" }),
}

export default competitorAssessmentsService

/**
 * Frontend access to the canonical report (GET /api/pdf/:projectId/report).
 *
 * This module only fetches and validates the payload. It contains no scoring,
 * counting or ranking logic: the server owns the data model, and pages render
 * it through reportViewModels.js.
 */

export const SUPPORTED_SCHEMA_MAJOR = 1;

const VALID_STATUS = ['available', 'partial', 'unavailable', 'not_configured'];
const REQUIRED_SECTIONS = [
  'executiveSummary', 'onPageSeo', 'technicalSeo', 'accessibility', 'pageSpeed',
  'keywords', 'searchConsole', 'aeo', 'geo', 'aiso', 'progress', 'recommendations',
];

export class ReportDataError extends Error {
  constructor(message, code = 'REPORT_DATA_ERROR') {
    super(message);
    this.name = 'ReportDataError';
    this.code = code;
  }
}

/**
 * Validate a canonical report. Throws ReportDataError on any contract
 * violation, so a malformed or mismatched response can never be rendered as a
 * valid-looking (zero-filled) report. Returns the report on success.
 */
export function validateCanonicalReport(report, expectedProjectId) {
  if (!report || typeof report !== 'object') {
    throw new ReportDataError('Report response is empty or not an object', 'INVALID_SHAPE');
  }
  const major = Number(String(report.schemaVersion || '').split('.')[0]);
  if (!Number.isInteger(major) || major !== SUPPORTED_SCHEMA_MAJOR) {
    throw new ReportDataError(
      `Unsupported report schema version: ${report.schemaVersion ?? 'missing'}`,
      'UNSUPPORTED_SCHEMA'
    );
  }
  if (!report.metadata || typeof report.metadata !== 'object' || !report.sections || typeof report.sections !== 'object') {
    throw new ReportDataError('Report is missing metadata or sections', 'INVALID_SHAPE');
  }
  if (expectedProjectId && String(report.metadata.projectId) !== String(expectedProjectId)) {
    // Never render another project's data.
    throw new ReportDataError('Report belongs to a different project than requested', 'PROJECT_MISMATCH');
  }
  for (const key of REQUIRED_SECTIONS) {
    const s = report.sections[key];
    if (!s || typeof s !== 'object' || !VALID_STATUS.includes(s.status)) {
      throw new ReportDataError(`Report section "${key}" is missing or has an invalid status`, 'INVALID_SECTION');
    }
  }
  return report;
}

/**
 * Fetch and validate the canonical report once. Not retried here: a retry
 * policy would multiply requests, and the endpoint never triggers an audit.
 *
 * @param {string} projectId
 * @param {{ auditNumber?: number|null, signal?: AbortSignal, api?: object }} [opts]
 */
export async function fetchCanonicalReport(projectId, { auditNumber = null, signal, api = null } = {}) {
  if (!projectId || projectId === 'undefined' || projectId === 'all') {
    throw new ReportDataError('Invalid project ID', 'INVALID_PROJECT');
  }
  // Resolved lazily so importing this module has no environment requirements.
  const client = api || (await import('../../lib/apiService')).default;
  const qs = auditNumber != null ? `?auditNumber=${encodeURIComponent(auditNumber)}` : '';
  let response;
  try {
    response = await client.request(`/pdf/${projectId}/report${qs}`, signal ? { signal } : {});
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ReportDataError(err?.message || 'Failed to load the report data', 'REQUEST_FAILED');
  }
  if (!response?.success || !response?.data) {
    throw new ReportDataError(response?.message || response?.error?.message || 'Report request was not successful', 'REQUEST_FAILED');
  }
  return validateCanonicalReport(response.data, projectId);
}

/**
 * One in-flight/finished request per (projectId, auditNumber) for the lifetime
 * of an export, so concurrent callers share a single request and an export for
 * one project can never reuse another project's report.
 */
export function createReportLoader(options = {}) {
  const cache = new Map();
  return {
    load(projectId, { auditNumber = null, signal } = {}) {
      const key = `${projectId}::${auditNumber ?? 'latest'}`;
      if (!cache.has(key)) {
        const p = fetchCanonicalReport(projectId, { auditNumber, signal, ...options });
        // Do not cache failures: the next explicit export attempt starts fresh.
        p.catch(() => cache.delete(key));
        cache.set(key, p);
      }
      return cache.get(key);
    },
    clear() { cache.clear(); },
  };
}

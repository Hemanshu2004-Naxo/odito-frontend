import { useState, useCallback, useRef } from 'react';
import API_BASE_URL from '../lib/apiConfig';
import { fetchAuditPdf, saveBlob, PdfDownloadError } from '../lib/pdfDownload';

/**
 * Export the Full Audit PDF.
 *
 * The backend renders the PDF (server-side Chromium) and returns it as an
 * attachment; this hook sends one authenticated request, then saves the bytes.
 * No page is rendered or captured in the browser.
 *
 * @returns {object} - { exportPDF, cancelExport, clearError, loading, error, progress }
 *   `progress` is kept for API compatibility; a single request has no
 *   percentage, so it stays 0 while `loading` is true.
 */
export function useExportPDF({ baseURL = API_BASE_URL, fetchImpl, save = saveBlob } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress] = useState(0);
  const abortControllerRef = useRef(null);
  const isExportingRef = useRef(false);

  // `reportType` is accepted for call-site compatibility; the Full Audit PDF has one form.
  const exportPDF = useCallback(async (projectId, reportType, { auditNumber = null } = {}) => {
    // Prevent concurrent exports (a second click while one is running is ignored)
    if (isExportingRef.current) return undefined;

    if (!projectId || projectId === 'undefined' || projectId === 'all') {
      const err = new PdfDownloadError('Select a project before exporting.', { code: 'INVALID_PROJECT' });
      setError(err.message);
      throw err;
    }

    isExportingRef.current = true;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { blob, filename, pages } = await fetchAuditPdf(projectId, {
        auditNumber, signal: controller.signal, baseURL, fetchImpl,
      });
      // A cancelled export must never download.
      if (controller.signal.aborted) return { success: false, cancelled: true };
      save(blob, filename);
      return { success: true, filename, pages };
    } catch (err) {
      if (err?.name === 'AbortError') return { success: false, cancelled: true };
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      isExportingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [baseURL, fetchImpl, save]);

  const cancelExport = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { exportPDF, cancelExport, clearError, loading, error, progress };
}

export default useExportPDF;

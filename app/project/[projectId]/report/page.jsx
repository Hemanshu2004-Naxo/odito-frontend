'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import apiService from '@/lib/apiService';

// Same page list, canonical report and metadata as the Export button
// (see pdf/src/reportPages.jsx and services/pdfGeneratorService.js).
import { getReportPages } from '../../../../pdf/src/reportPages';
import { ReportMetaProvider, CanonicalReportProvider, formatReportDate } from '../../../../pdf/src/reportMeta';
import { createReportLoader } from '../../../../pdf/src/reportData';

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [isExportMode, setIsExportMode] = useState(false);
  const [reportType, setReportType] = useState('seo');
  const [auditNumber, setAuditNumber] = useState(null);
  const [projectId, setProjectId] = useState(null);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params?.projectId) {
      setProjectId(params.projectId);
    }

    // Check if we're in export mode
    setIsExportMode(searchParams.get('export') === 'true');
    setReportType(searchParams.get('type') || 'seo');
    const n = searchParams.get('auditNumber');
    setAuditNumber(n && /^\d+$/.test(n) ? Number(n) : null);
  }, [params, searchParams]);

  // One canonical report request feeds every page.
  useEffect(() => {
    if (!projectId) return undefined;

    // Check authentication before fetching data
    if (!apiService.isAuthenticated()) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return undefined;
    }

    const controller = new AbortController();
    const loader = createReportLoader();
    setLoading(true);
    setError(null);
    setReport(null);

    loader
      .load(projectId, { auditNumber, signal: controller.signal })
      .then((r) => {
        setReport(r);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (/Access denied|No token provided|Unauthorized/i.test(err?.message || '')) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        // Tell the server-side PDF capture to abort instead of waiting for a ready signal.
        if (typeof window !== 'undefined') window.__PDF_ERROR__ = err.message || 'Report failed to load';
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [projectId, auditNumber]);

  // Readiness contract for the Puppeteer/email capture (backend services/pdfReadiness.js):
  // __PDF_READY__ = true once the canonical report is loaded and every page has been
  // rendered (pages are synchronous once the report is present); __PDF_ERROR__ on failure.
  useEffect(() => {
    if (isExportMode && report && typeof window !== 'undefined') {
      window.__PDF_READY__ = true;
    }
  }, [isExportMode, report]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#1e293b', marginBottom: '1rem' }}>
            Loading Report Data...
          </h2>
          <p style={{ color: '#64748b' }}>
            Fetching the audit report...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <h2>Error Loading Report</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (isExportMode) {
    // Export mode: render the same pages, in the same order, as the Export button.
    const reportPages = getReportPages(report);
    const total = reportPages.length;
    const domain = report.metadata.domain || null;
    const auditDate = formatReportDate(report.metadata.auditDate);
    const generated = formatReportDate(new Date());

    return (
      <div style={{ background: '#F1F5F9' }}>
        {reportPages.map((page, i) => (
          <div
            key={page.id}
            data-report-page={page.id}
            style={{
              pageBreakAfter: i < total - 1 ? 'always' : 'auto',
              background: '#fff',
              margin: '0',
              padding: '0',
              minHeight: '297mm', // A4 height
              width: '210mm', // A4 width
            }}
          >
            <CanonicalReportProvider report={report}>
              <ReportMetaProvider value={{ page: i + 1, total, domain, auditDate, generated }}>
                {page.element}
              </ReportMetaProvider>
            </CanonicalReportProvider>
          </div>
        ))}
      </div>
    );
  }

  // Normal mode: show a status message
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      background: '#f8fafc'
    }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ color: '#1e293b', marginBottom: '1rem' }}>
          PDF Report Generator
        </h1>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          Project ID: {projectId}
        </p>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          Report Type: {reportType}
        </p>
        <p style={{ color: '#059669', fontSize: '0.875rem' }}>
          Add ?export=true to generate PDF (optional: &auditNumber=N)
        </p>
        {report && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#e0f2fe', borderRadius: '8px' }}>
            <p style={{ color: '#0c4a6e', fontSize: '0.875rem' }}>
              Report data loaded for: {report.metadata.projectName || report.metadata.domain}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

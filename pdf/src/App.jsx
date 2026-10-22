import React, { useState, useEffect } from 'react';
import './styles/pdf.css';

import { getReportPages } from './reportPages';
import { ReportMetaProvider, CanonicalReportProvider, formatReportDate } from './reportMeta';
import { fetchCanonicalReport } from './reportData';

export default function App() {
  const [current, setCurrent] = useState(0);
  const [projectId, setProjectId] = useState(null);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);

  // Extract projectId from URL or use default
  useEffect(() => {
    // Try to get projectId from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('projectId');
    
    // Try to get from filename (fallback)
    const filename = window.location.pathname.split('/').pop();
    const filenameMatch = filename.match(/([a-f0-9]{24})/);
    
    const extractedProjectId = urlProjectId || (filenameMatch ? filenameMatch[1] : null);
    
    if (extractedProjectId) {
      setProjectId(extractedProjectId);
    } else {
      // Default project ID for testing
      setProjectId('69bd09a878159772d6a2e4de');
    }
  }, []);

  // Dev preview: load the canonical report for the project (read-only).
  useEffect(() => {
    if (!projectId) return undefined;
    const controller = new AbortController();
    setReport(null);
    setReportError(null);
    fetchCanonicalReport(projectId, { signal: controller.signal })
      .then(setReport)
      .catch((e) => { if (e.name !== 'AbortError') setReportError(e.message); });
    return () => controller.abort();
  }, [projectId]);

  const reportPages = getReportPages(report);
  const meta = (i) => ({
    page: i + 1,
    total: reportPages.length,
    domain: report?.metadata?.domain ?? null,
    auditDate: formatReportDate(report?.metadata?.auditDate),
    generated: formatReportDate(new Date()),
  });
  const pages = reportPages.map((p, i) => ({
    id: p.id,
    label: `p.${i + 1} — ${p.name}`,
    component: report ? (
      <CanonicalReportProvider report={report}>
        <ReportMetaProvider value={meta(i)}>{p.element}</ReportMetaProvider>
      </CanonicalReportProvider>
    ) : (
      <div style={{ padding: 40, color: reportError ? '#dc2626' : '#6B7280' }}>
        {reportError ? `Report failed to load: ${reportError}` : 'Loading report...'}
      </div>
    ),
  }));

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      <div style={{
        background: '#111827', color: '#fff', padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', marginRight: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4F6EF7' }} />
          <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>Odito AI Report</span>
        </div>
        <select value={current} onChange={e => setCurrent(Number(e.target.value))}
          style={{ background: '#1F2937', color: '#fff', border: '1px solid #374151', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', maxWidth: 340 }}>
          {pages.map((p, i) => <option key={p.id} value={i}>{p.label}</option>)}
        </select>
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          style={{ background: 'transparent', border: '1px solid #374151', color: '#9CA3AF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>← Prev</button>
        <button onClick={() => setCurrent(c => Math.min(pages.length - 1, c + 1))} disabled={current === pages.length - 1}
          style={{ background: '#4F6EF7', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Next →</button>
        <span style={{ color: '#6B7280', fontSize: 13, marginLeft: 'auto' }}>{current + 1} / {pages.length} pages</span>
      </div>
      <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
        {pages[current].component}
      </div>
    </div>
  );
}

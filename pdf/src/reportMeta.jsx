import React, { createContext, useContext } from 'react';

/**
 * Per-page report metadata supplied by whoever assembles the document
 * (pdfGeneratorService for the Export button, app/project/[projectId]/report
 * for the server-side path). Page components render PageHeader/PageFooter
 * from this instead of hardcoded values, so the page number, total, domain
 * and dates always describe the document actually being produced.
 *
 *   page       1-based position in the exported document
 *   total      number of pages in the exported document
 *   domain     audited website's domain (null if unknown)
 *   auditDate  formatted date of the audit (null if unknown)
 *   generated  formatted date this PDF was generated
 */
const ReportMetaContext = createContext(null);

export function ReportMetaProvider({ value, children }) {
  return <ReportMetaContext.Provider value={value}>{children}</ReportMetaContext.Provider>;
}

export function useReportMeta() {
  return useContext(ReportMetaContext);
}

export function formatReportDate(input) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function extractDomain(url) {
  if (!url || typeof url !== 'string') return null;
  const host = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return host || null;
}

/**
 * The canonical report for the document being produced. Pages read it from
 * context instead of fetching, so one request feeds every page.
 */
const CanonicalReportContext = createContext(null);

export function CanonicalReportProvider({ report, children }) {
  return <CanonicalReportContext.Provider value={report}>{children}</CanonicalReportContext.Provider>;
}

export function useCanonicalReport() {
  return useContext(CanonicalReportContext);
}

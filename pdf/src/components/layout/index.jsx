import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { useReportMeta } from '../../reportMeta';
import { LOGO_ON_DARK, LOGO_ASPECT } from '../../brandAssets';

/** Odito wordmark from the brand kit (bright version for dark bars). Height drives the size. */
export function BrandLogo({ height = 22, src = LOGO_ON_DARK }) {
  return <img src={src} alt="Odito" height={height} width={Math.round(height * LOGO_ASPECT)} style={{ height, width: 'auto', display: 'block' }} />;
}

// Page number, total, domain and dates come from the ReportMetaProvider that
// wraps each exported page (see pdf/src/reportMeta.jsx). The `page` prop is
// only a fallback for previews rendered without a provider.
export function PageHeader({ page }) {
  const meta = useReportMeta();
  const pageNo = meta?.page ?? page;
  const pageLabel = meta?.total ? `p.${pageNo}/${meta.total}` : `p.${pageNo}`;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 40px', background: '#111827', borderBottom: '2px solid #00D4FF',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <BrandLogo height={22} />
      <span style={{ color: '#8892C4', fontSize: 13 }}>SEO & AI Search Readiness Audit Report</span>
      <span style={{ color: '#8892C4', fontSize: 13 }}>{meta?.domain ? <>{meta.domain} &nbsp;|&nbsp; </> : null}{pageLabel}</span>
    </div>
  );
}

export function PageFooter({ page }) {
  const meta = useReportMeta();
  const pageNo = meta?.page ?? page;
  const dates = [
    meta?.auditDate ? `Audit date: ${meta.auditDate}` : null,
    meta?.generated ? `Generated: ${meta.generated}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 40px', borderTop: '1px solid #E5E7EB', marginTop: 'auto',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <span style={{ color: '#9CA3AF', fontSize: 12 }}>Odito AI Audit Report{dates ? <> &nbsp;|&nbsp; {dates}</> : null}</span>
      <span style={{ color: '#9CA3AF', fontSize: 12 }}>{meta?.domain || ''}</span>
      {pageNo && <span style={{ color: '#9CA3AF', fontSize: 12 }}>{meta?.total ? `Page ${pageNo} of ${meta.total}` : `Page ${pageNo}`}</span>}
    </div>
  );
}

export function SectionHeader({ num, title, subtitle, score }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: '#F9FAFB', border: '1px solid #E5E7EB',
      borderLeft: '4px solid #4F6EF7', borderRadius: 8,
      padding: '16px 20px', marginBottom: 24
    }}>
      <span style={{
        background: '#EEF2FF', color: '#4F6EF7', fontWeight: 700,
        fontSize: 13, padding: '4px 10px', borderRadius: 6,
        fontFamily: "'Inter', sans-serif", minWidth: 36, textAlign: 'center'
      }}>{num}</span>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: "'Inter', sans-serif" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {score !== undefined && (
        <div style={{
          background: '#EF4444', color: '#fff', borderRadius: 8,
          padding: '8px 16px', fontWeight: 700, fontSize: 16,
          fontFamily: "'Inter', sans-serif"
        }}>{score}</div>
      )}
    </div>
  );
}

export function StatCard({ value, label, sub, color = '#4F6EF7', borderColor }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderTop: `3px solid ${borderColor || color}`,
      borderRadius: 8, padding: '20px 16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function InsightBox({ title, children }) {
  return (
    <div style={{
      background: '#EEF2FF', border: '1px solid #C7D2FE',
      borderLeft: '4px solid #4F6EF7', borderRadius: 8, padding: '16px 20px', marginTop: 24
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#4F6EF7', fontSize: 14, fontFamily: "'Inter', sans-serif" }}>{title}</span>
        <span style={{
          background: '#4F6EF7', color: '#fff', fontSize: 12,
          // extra bottom padding: html2canvas draws this text ~4px low and would clip it
          padding: '2px 12px 7px', borderRadius: 20, fontWeight: 500
        }}>✦ Odito AI Insight</span>
      </div>
      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

export function DataTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #E5E7EB' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#111827' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '12px 14px', color: '#fff', fontWeight: 600,
                textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
                borderRight: i < headers.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '11px 14px', color: '#374151', verticalAlign: 'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ label, type = 'info' }) {
  const colors = {
    critical: { bg: '#F3E8FF', color: '#9333EA' }, // Purple
    high: { bg: '#FEE2E2', color: '#EF4444' },     // Red
    medium: { bg: '#FEF9C3', color: '#EAB308' },   // Yellow
    low: { bg: '#DBEAFE', color: '#3B82F6' },      // Blue
    info: { bg: '#DBEAFE', color: '#3B82F6' },     // Blue (same as low)
    pass: { bg: '#D1FAE5', color: '#059669' },
    warn: { bg: '#FEF3C7', color: '#D97706' },
    fail: { bg: '#FEE2E2', color: '#DC2626' },
  };
  const c = colors[type.toLowerCase()] || colors.info;
  return (
    <span style={{
      background: c.bg, color: c.color, fontWeight: 700,
      fontSize: 11, padding: '3px 10px', borderRadius: 20,
      display: 'inline-block', whiteSpace: 'nowrap'
    }}>{label}</span>
  );
}

export function Page({ children, style }) {
  return (
    <div style={{
      width: 960, minHeight: PAGE_HEIGHT, background: '#fff',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
      margin: '0 auto', ...style
    }}>
      {children}
    </div>
  );
}

export function PageContent({ children }) {
  return (
    <div style={{ padding: '32px 40px', flex: 1 }}>
      {children}
    </div>
  );
}

/**
 * Rendered by a page when the canonical report was not supplied. The export
 * pipeline validates and provides the report before rendering, so this should
 * only ever appear in a standalone preview.
 */
export function MissingReport({ title }) {
  return (
    <div style={{
      width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ color: '#EF4444', fontSize: 16 }}>{title}: report data was not provided.</div>
    </div>
  );
}

/**
 * In-page notice for a section whose data is unavailable or not configured.
 * Says why, instead of showing zeros or an empty chart.
 */
export function UnavailableSection({ title, message, tone = 'neutral' }) {
  const color = tone === 'warn' ? '#92400E' : '#374151';
  const bg = tone === 'warn' ? '#FFFBEB' : '#F9FAFB';
  const border = tone === 'warn' ? '#FDE68A' : '#E5E7EB';
  return (
    <div style={{
      border: `1px solid ${border}`, background: bg, borderRadius: 8,
      padding: '24px 28px', margin: '8px 0 24px', color
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</div>
    </div>
  );
}

/** Small caption for provenance / caveats (data source, snapshot notes). */
export function Caption({ children }) {
  if (!children) return null;
  return <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, margin: '10px 0 0' }}>{children}</p>;
}

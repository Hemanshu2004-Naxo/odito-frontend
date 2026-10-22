'use client';

import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader, StatCard, Badge, InsightBox, MissingReport, UnavailableSection, Caption } from '../layout';
import { useCanonicalReport } from '../../reportMeta';
import { onPageVM, unavailableText } from '../../reportViewModels';

const sevType = { critical: 'critical', high: 'high', medium: 'medium', warning: 'medium', low: 'low', info: 'low' };

// Colors per severity tier (display only).
const COLORS = { all: '#9333EA', criticalHigh: '#EF4444', medium: '#EAB308', lowInfo: '#3B82F6' };

const frame = {
  width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
  flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
  margin: '0 auto', fontFamily: "'DM Sans', sans-serif",
};

/**
 * On-page SEO. All counts come from the canonical report (distinct open issues
 * from onPageIssuesService), so they match the dashboard's On-Page Issues tab.
 * Accessibility issues are reported separately.
 */
export default function OnPageSEOPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="On-Page SEO" />;
  const vm = onPageVM(report);
  const widest = vm.hasData
    ? vm.rows.slice().sort((a, b) => (b.pagesAffected || 0) - (a.pagesAffected || 0))[0]
    : null;

  return (
    <div style={frame}>
      <PageHeader page={3} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader
          num="02"
          title="On-Page SEO Audit"
          subtitle={vm.hasData ? `${vm.totalIssues} open issues across ${vm.pagesAnalyzed ?? 'N/A'} analyzed pages` : 'On-page issue summary'}
        />

        {!vm.hasData ? (
          <UnavailableSection title="On-page SEO data unavailable" message={unavailableText(vm, 'on-page SEO')} tone="warn" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={vm.cards.all} label="All Issues" sub="Open, excl. accessibility" color={COLORS.all} borderColor={COLORS.all} />
              <StatCard value={vm.cards.criticalHigh} label="Critical / High" sub="Critical + high severity" color={COLORS.criticalHigh} borderColor={COLORS.criticalHigh} />
              <StatCard value={vm.cards.medium} label="Medium" sub="Medium severity" color={COLORS.medium} borderColor={COLORS.medium} />
              <StatCard value={vm.cards.lowInfo} label="Low / Info" sub="Low + info severity" color={COLORS.lowInfo} borderColor={COLORS.lowInfo} />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>Top Issues</h3>

            <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    {['#', 'Issue', 'Severity', 'Pages affected', '% of pages', 'Fix difficulty'].map((h, i) => (
                      <th key={i} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.rows.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#10B981' }}>
                        No open on-page issues were found in this audit.
                      </td>
                    </tr>
                  ) : vm.rows.map((r, i) => (
                    <tr key={r.key} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 14px', color: '#9CA3AF' }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{r.title}</td>
                      <td style={{ padding: '10px 14px' }}><Badge label={(r.severity || 'n/a').toUpperCase()} type={sevType[r.severity] || 'info'} /></td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{r.pagesAffected ?? 'N/A'}</td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{r.impactPercentage == null ? 'N/A' : `${r.impactPercentage}%`}</td>
                      <td style={{ padding: '10px 14px', color: '#6B7280', textTransform: 'capitalize' }}>{r.difficulty || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vm.evidence.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Example affected pages</h3>
                {vm.evidence.map((e) => (
                  <div key={e.issueCode} style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                    <strong>{e.title}</strong> — {e.totalUrls} page(s)
                    {e.sample.map((u) => (
                      <div key={u} style={{ color: '#6B7280', wordBreak: 'break-all' }}>{u}</div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {vm.status === 'partial' && <Caption>Some detail could not be loaded: {vm.message}</Caption>}

            {widest && (
              <InsightBox title="On-Page Priority">
                {`The most widespread open issue in this list is "${widest.title}", affecting ${widest.pagesAffected} page(s). Issues are ordered by severity first, then by pages affected.`}
              </InsightBox>
            )}
          </>
        )}
        <Caption>
          Counts are distinct open issues and exclude accessibility issues. They reflect the project's current state at report time
          {vm.snapshotRelation === 'after_run' ? ' (which may be newer than the selected audit run).' : '.'}
        </Caption>
      </div>
      <PageFooter page={3} />
    </div>
  );
}

'use client';

import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader, StatCard, InsightBox, MissingReport, UnavailableSection, Caption } from '../layout';
import { useCanonicalReport } from '../../reportMeta';
import { keywordsVM, unavailableText } from '../../reportViewModels';

const frame = {
  width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
  flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
  margin: '0 auto', fontFamily: "'DM Sans', sans-serif",
};

const rankColor = (rank) => {
  if (rank == null) return '#9CA3AF';
  if (rank <= 3) return '#10B981';
  if (rank <= 10) return '#4F6EF7';
  return '#F59E0B';
};
const rankText = (rank) => (rank == null ? '—' : `#${rank}`);
const STATE_LABEL = {
  ranking: { text: 'Ranking', color: '#10B981' },
  not_in_top_100: { text: 'Not in top 100', color: '#EF4444' },
  scan_error: { text: 'Scan failed', color: '#9CA3AF' },
};

/**
 * Keyword rankings from Odito's own tracking (SeoRankingCurrent + history).
 * Not Google Search Console data. Search volume and difficulty are not part of
 * the tracked data and are therefore not shown.
 */
export function KeywordRankingPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Keyword Ranking" />;
  const vm = keywordsVM(report);
  const sm = vm.hasData ? vm.summary : null;
  const scopeLabel = vm.hasData ? [vm.scope, vm.location].filter(Boolean).join(' · ') : '';

  return (
    <div style={frame}>
      <PageHeader page={8} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="07" title="Keyword Ranking Analysis" subtitle={vm.hasData ? `${sm.tracked} ${sm.tracked === 1 ? 'keyword' : 'keywords'} tracked${scopeLabel ? ` · ${scopeLabel}` : ''}` : 'Tracked keyword positions'} />

        {!vm.hasData ? (
          <UnavailableSection title="Keyword rankings unavailable" message={unavailableText(vm, 'keyword ranking')} tone="warn" />
        ) : (
          <>
            {vm.isLegacy && (
              <UnavailableSection
                title="Legacy ranking snapshot"
                message={vm.message || 'Only an older onboarding ranking snapshot exists; it is not kept up to date.'}
                tone="warn"
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={sm.tracked} label="Tracked" sub="keywords" color="#6B7280" borderColor="#6B7280" />
              <StatCard value={sm.ranking} label="Ranking" sub={`of ${sm.tracked}`} color="#10B981" borderColor="#10B981" />
              <StatCard value={sm.notInTop100} label="Not in Top 100" sub="last scan succeeded" color="#EF4444" borderColor="#EF4444" />
              <StatCard value={sm.top10 ?? 'N/A'} label="Top 10" sub={`of ${sm.tracked}`} color="#4F6EF7" borderColor="#4F6EF7" />
            </div>
            {sm.scanErrors > 0 && (
              <Caption>{sm.scanErrors} keyword(s) could not be checked in the last scan; their position is unknown and they are not counted as "not ranking".</Caption>
            )}

            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Keyword Position Table</h3>
            <div style={{ borderBottom: '2px solid #4F6EF7', marginBottom: 12 }} />

            <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    {['Keyword', 'Current', ...(vm.hasHistory ? ['Previous scan', 'Prev. week'] : []), 'Best', ...(vm.hasMaps ? ['Maps rank'] : []), 'Status'].map((h) => (
                      <th key={h} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.rows.map((r, i) => {
                    const st = STATE_LABEL[r.rankState] || { text: r.rankState, color: '#6B7280' };
                    return (
                      <tr key={r.keyword + i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111827' }}>{r.keyword}</td>
                        <td style={{ padding: '10px 14px', color: rankColor(r.currentRank), fontWeight: 700 }}>{rankText(r.currentRank)}</td>
                        {vm.hasHistory && <td style={{ padding: '10px 14px', color: '#6B7280' }}>{rankText(r.previousScanRank)}</td>}
                        {vm.hasHistory && <td style={{ padding: '10px 14px', color: '#6B7280' }}>{rankText(r.previousWeekRank)}</td>}
                        <td style={{ padding: '10px 14px', color: '#6B7280' }}>{rankText(r.bestRank)}</td>
                        {vm.hasMaps && <td style={{ padding: '10px 14px', color: '#6B7280' }}>{rankText(r.mapsRank)}</td>}
                        <td style={{ padding: '10px 14px', color: st.color, fontWeight: 600 }}>{st.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {vm.moreExist && <Caption>Showing the first {vm.rows.length} keywords; more are tracked in the dashboard.</Caption>}

            <InsightBox title="Keyword Ranking Insights">
              {sm.ranking === 0
                ? `None of the ${sm.tracked} tracked keywords ranked in the top 100 at the last scan.`
                : `${sm.ranking} of ${sm.tracked} tracked keywords rank in the top 100 (${sm.top10} in the top 10).`}
            </InsightBox>
          </>
        )}
        <Caption>
          Odito-tracked rankings{vm.hasData && vm.lastScanned ? `, last scanned ${vm.lastScanned}` : ''}; this is separate from Google Search Console data. Rankings are checked on their own schedule and may not match the audit date.
        </Caption>
      </div>
      <PageFooter page={8} />
    </div>
  );
}

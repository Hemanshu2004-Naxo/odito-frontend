'use client';

import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader, StatCard, InsightBox, MissingReport, UnavailableSection, Caption } from '../layout';
import { useCanonicalReport } from '../../reportMeta';
import { webVitalsVM, unavailableText } from '../../reportViewModels';

const frame = {
  width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
  flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
  margin: '0 auto', fontFamily: "'DM Sans', sans-serif",
};

const scoreColor = (score) => {
  if (score == null) return '#9CA3AF';
  if (score >= 90) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
};
const ratingColor = (r) => (r === 'Good' ? '#10B981' : r === 'Needs Work' ? '#F59E0B' : r === 'Unavailable' ? '#9CA3AF' : '#EF4444');
const fmtScore = (v) => (v == null ? 'N/A' : v);

/**
 * Core Web Vitals / PageSpeed. Values come from the canonical report; a device
 * that was not measured shows "N/A" and is never rated.
 */
export function CoreWebVitalsPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Core Web Vitals" />;
  const vm = webVitalsVM(report);

  const perf = vm.hasData ? vm.scores[0] : null;
  const lcpRating = vm.hasData ? vm.vitals.find((v) => v.key === 'lcp') : null;
  const tbtRating = vm.hasData ? vm.vitals.find((v) => v.key === 'tbt') : null;
  const missing = vm.hasData ? [!vm.desktopMeasured && 'desktop', !vm.mobileMeasured && 'mobile'].filter(Boolean) : [];

  return (
    <div style={frame}>
      <PageHeader page={7} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="06" title="Core Web Vitals" subtitle="Desktop and mobile Lighthouse analysis" />

        {!vm.hasData ? (
          <UnavailableSection title="PageSpeed data unavailable" message={unavailableText(vm, 'PageSpeed')} tone="warn" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={fmtScore(perf.d)} label="Desktop Score" sub="Lighthouse" color={scoreColor(perf.d)} borderColor={scoreColor(perf.d)} />
              <StatCard value={fmtScore(perf.m)} label="Mobile Score" sub="Lighthouse" color={scoreColor(perf.m)} borderColor={scoreColor(perf.m)} />
              <StatCard value={lcpRating.mobileValue} label="Mobile LCP" sub="Target < 2.5s" color={ratingColor(lcpRating.mobileRating)} borderColor={ratingColor(lcpRating.mobileRating)} />
              <StatCard value={tbtRating.mobileValue} label="Mobile TBT" sub="Target < 200ms" color={ratingColor(tbtRating.mobileRating)} borderColor={ratingColor(tbtRating.mobileRating)} />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Desktop vs Mobile Comparison</h3>
            <div style={{ borderBottom: '2px solid #4F6EF7', marginBottom: 20 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 28 }}>
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#4F6EF7', borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: '#6B7280' }}>Desktop</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, background: '#00D4FF', borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: '#6B7280' }}>Mobile</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', height: 160 }}>
                  {vm.scores.map(({ label, d, m }) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', justifyContent: 'center', height: 130 }}>
                        <div style={{ width: 26, height: `${Math.min((d ?? 0) * 1.2, 120)}px`, background: '#4F6EF7', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                          <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: '#374151' }}>{fmtScore(d)}</span>
                        </div>
                        <div style={{ width: 26, height: `${Math.min((m ?? 0) * 1.2, 120)}px`, background: '#00D4FF', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                          <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: '#374151' }}>{fmtScore(m)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                <p style={{ fontSize: 14, color: '#374151' }}>Desktop: <strong style={{ color: '#4F6EF7' }}>{perf.d == null ? 'N/A' : `${perf.d}/100`}</strong></p>
                <p style={{ fontSize: 14, color: '#374151' }}>Mobile: <strong style={{ color: scoreColor(perf.m) }}>{perf.m == null ? 'N/A' : `${perf.m}/100`}</strong></p>
                <p style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>Good: ≥90 &nbsp; Fair: 50-89 &nbsp; Poor: &lt;50</p>
              </div>
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Core Web Vitals — Detailed</h3>
            <div style={{ borderBottom: '2px solid #4F6EF7', marginBottom: 16 }} />

            <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    {['Metric', 'Desktop', 'Rating', 'Mobile', 'Rating'].map((h, i) => (
                      <th key={i} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.vitals.map((v, i) => (
                    <tr key={v.key} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{v.label}</td>
                      <td style={{ padding: '10px 14px', color: ratingColor(v.desktopRating), fontWeight: 600 }}>{v.desktopValue}</td>
                      <td style={{ padding: '10px 14px', color: ratingColor(v.desktopRating), fontWeight: 600 }}>{v.desktopRating}</td>
                      <td style={{ padding: '10px 14px', color: ratingColor(v.mobileRating), fontWeight: 600 }}>{v.mobileValue}</td>
                      <td style={{ padding: '10px 14px', color: ratingColor(v.mobileRating), fontWeight: 600 }}>{v.mobileRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InsightBox title="Core Web Vitals Summary">
              {missing.length
                ? `Not measured: ${missing.join(' and ')}. Ratings are shown only for measured devices.`
                : `Mobile performance scored ${perf.m}/100 and desktop ${perf.d}/100. Mobile LCP is ${lcpRating.mobileValue} (${lcpRating.mobileRating.toLowerCase()}) and mobile TBT is ${tbtRating.mobileValue} (${tbtRating.mobileRating.toLowerCase()}).`}
            </InsightBox>
          </>
        )}
        <Caption>
          Lighthouse results from the project's most recent PageSpeed run, which is overwritten on each re-crawl
          {vm.snapshotRelation === 'after_run' ? ' (may be newer than the selected audit run)' : ''}. Ratings use Google's published Core Web Vitals bands.
        </Caption>
      </div>
      <PageFooter page={7} />
    </div>
  );
}

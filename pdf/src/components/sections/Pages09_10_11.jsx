'use client';

import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader, StatCard, Badge, InsightBox, MissingReport, UnavailableSection, Caption } from '../layout';
import { useCanonicalReport } from '../../reportMeta';
import { structuredDataVM, technicalChecksVM, crawlabilityVM, unavailableText } from '../../reportViewModels';

const frame = {
  width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
  flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
  margin: '0 auto', fontFamily: "'DM Sans', sans-serif",
};

const h3 = { fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Inter', sans-serif" };
const rule = { borderBottom: '2px solid #4F6EF7', marginBottom: 20 };

const TECH_NOTE = 'Technical checks, crawlability and structured data reflect the project\'s current state at report time.';

// ---- Structured Data ----
export function StructuredDataPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Structured Data" />;
  const vm = structuredDataVM(report);

  return (
    <div style={frame}>
      <PageHeader page={4} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="03" title="Structured Data Analysis" subtitle={vm.mode === 'distribution' ? 'Schema type distribution' : 'JSON-LD / structured data coverage'} />

        {!vm.hasData ? (
          <UnavailableSection title="Structured data unavailable" message={unavailableText(vm, 'structured data')} tone="warn" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={vm.withSchema} label="With Schema" sub="Structured data detected" color="#10B981" borderColor="#10B981" />
              <StatCard value={vm.withoutSchema} label="Missing Schema" sub="No structured data" color={vm.withoutSchema > 0 ? '#EF4444' : '#10B981'} borderColor={vm.withoutSchema > 0 ? '#EF4444' : '#10B981'} />
              <StatCard value={`${vm.coverage}%`} label="Coverage" sub="of crawled pages" color={vm.coverage === 100 ? '#10B981' : '#F59E0B'} borderColor={vm.coverage === 100 ? '#10B981' : '#F59E0B'} />
              <StatCard value={vm.schemaIssueCount ?? 'N/A'} label="Schema Issues" sub="Open schema-related issues" color={vm.schemaIssueCount > 0 ? '#F97316' : '#10B981'} borderColor={vm.schemaIssueCount > 0 ? '#F97316' : '#10B981'} />
            </div>

            <h3 style={h3}>{vm.mode === 'distribution' ? 'Schema Type Distribution' : 'Schema Coverage Breakdown'}</h3>
            <div style={rule} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginBottom: 28 }}>
              <svg width={180} height={180} viewBox="0 0 180 180">
                {vm.mode === 'distribution'
                  ? (() => {
                      const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];
                      const top = vm.schemaTypes.slice(0, 5);
                      const total = top.reduce((sum, t) => sum + t.count, 0);
                      let offset = 0;
                      return top.map((type, i) => {
                        const r = 70; const c = 2 * Math.PI * r;
                        const pct = total > 0 ? type.count / total : 0;
                        const el = (
                          <circle key={type.type} cx={90} cy={90} r={r} fill="none" stroke={colors[i]} strokeWidth={24}
                            strokeDasharray={`${c * pct} ${c}`} strokeDashoffset={-c * offset} transform="rotate(-90 90 90)" />
                        );
                        offset += pct;
                        return el;
                      });
                    })()
                  : [
                      { pct: vm.coverage / 100, color: '#10B981', offset: 0 },
                      { pct: (100 - vm.coverage) / 100, color: '#EF4444', offset: vm.coverage / 100 },
                    ].map(({ pct, color, offset }, i) => {
                      const r = 70; const c = 2 * Math.PI * r;
                      return <circle key={i} cx={90} cy={90} r={r} fill="none" stroke={color} strokeWidth={24}
                        strokeDasharray={`${c * pct} ${c}`} strokeDashoffset={-c * offset} transform="rotate(-90 90 90)" />;
                    })}
                <circle cx={90} cy={90} r={56} fill="white" />
              </svg>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 2 }}>
                <div><span style={{ color: '#10B981' }}>■</span> {vm.withSchema} pages with schema ({vm.coverage}%)</div>
                {vm.mode === 'distribution'
                  ? <div><span style={{ color: '#10B981' }}>■</span> {vm.schemaTypes.length} schema types detected</div>
                  : <div><span style={{ color: '#EF4444' }}>■</span> {vm.withoutSchema} pages missing schema ({100 - vm.coverage}%)</div>}
                <div style={{ marginTop: 12, fontWeight: 600 }}>Detected types:</div>
                {vm.schemaTypes.length === 0 && <div style={{ color: '#6B7280' }}>— none —</div>}
                {vm.schemaTypes.slice(0, vm.mode === 'distribution' ? 8 : 4).map((type) => (
                  <div key={type.type} style={{ color: '#6B7280' }}>— {type.type} — {type.pages} pages</div>
                ))}
              </div>
            </div>

            <InsightBox title="Structured Data Summary">
              {vm.mode === 'distribution'
                ? `All ${vm.withSchema} crawled pages have structured data, across ${vm.schemaTypes.length} schema type(s). Validate that the markup is accurate and complete for each page type.`
                : `${vm.withSchema} of ${vm.withSchema + vm.withoutSchema} crawled pages have structured data (${vm.coverage}%).${vm.withoutSchema > 0 ? ` ${vm.withoutSchema} pages have none; adding accurate schema markup to them is a recommended improvement.` : ''}`}
              {vm.schemaIssueCount > 0 ? ` ${vm.schemaIssueCount} open schema-related issue(s) were detected.` : ''}
            </InsightBox>
          </>
        )}
        <Caption>{TECH_NOTE}</Caption>
      </div>
      <PageFooter page={4} />
    </div>
  );
}

// ---- Technical SEO ----
const CHECK_BADGE = {
  pass: { label: '✓ PASS', type: 'pass' },
  warn: { label: '▲ WARN', type: 'warn' },
  fail: { label: '✗ FAIL', type: 'fail' },
  unknown: { label: 'UNKNOWN', type: 'info' },
};

export function TechnicalSEOPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Technical SEO" />;
  const vm = technicalChecksVM(report);

  return (
    <div style={frame}>
      <PageHeader page={5} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="04" title="Technical SEO Health" subtitle="Server, security and indexation checks" score={vm.hasData ? vm.healthScore ?? undefined : undefined} />

        {!vm.hasData ? (
          <UnavailableSection title="Technical checks unavailable" message={unavailableText(vm, 'technical check')} tone="warn" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={vm.passed} label="Passed" sub={`of ${vm.checks.length} checks`} color="#10B981" borderColor="#10B981" />
              <StatCard value={vm.warnings} label="Warnings" sub="Need attention" color="#F59E0B" borderColor="#F59E0B" />
              <StatCard value={vm.failed} label="Failed" sub="Critical status" color="#EF4444" borderColor="#EF4444" />
              <StatCard value={vm.healthScore == null ? 'N/A' : `${vm.healthScore}%`} label="Tech Health" sub="Passed / total checks" color="#4F6EF7" borderColor="#4F6EF7" />
            </div>

            <h3 style={{ ...h3, marginBottom: 16 }}>Technical Check Results</h3>

            <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    {['Technical Check', 'Status', 'Finding'].map((h, i) => (
                      <th key={i} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.checks.map((check, i) => (
                    <tr key={check.name + i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>{check.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge label={CHECK_BADGE[check.state].label} type={CHECK_BADGE[check.state].type} />
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6B7280' }}>{check.message || 'No detail provided'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InsightBox title="Technical Priority Analysis">
              {vm.failed > 0
                ? `Checks in a critical state: ${vm.checks.filter((c) => c.state === 'fail').map((c) => c.name).join(', ')}.`
                : vm.warnings > 0
                  ? `Checks needing attention: ${vm.checks.filter((c) => c.state === 'warn').map((c) => c.name).join(', ')}.`
                  : `All ${vm.passed} technical checks passed.`}
            </InsightBox>
          </>
        )}
        <Caption>{TECH_NOTE}</Caption>
      </div>
      <PageFooter page={5} />
    </div>
  );
}

// ---- Crawlability ----
const impactType = (impact) => {
  const k = String(impact || '').toLowerCase();
  return k === 'critical' ? 'critical' : k === 'high' ? 'warn' : k === 'medium' ? 'medium' : 'pass';
};

export function CrawlabilityPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Crawlability" />;
  const vm = crawlabilityVM(report);
  const rateColor = vm.hasData ? (vm.indexRate >= 90 ? '#10B981' : vm.indexRate >= 70 ? '#F59E0B' : '#EF4444') : '#9CA3AF';

  return (
    <div style={frame}>
      <PageHeader page={6} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="05" title="Crawlability Analysis" subtitle="Indexability of crawled pages" />

        {!vm.hasData ? (
          <UnavailableSection title="Crawlability unavailable" message={unavailableText(vm, 'crawlability')} tone="warn" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard value={vm.totalPages} label="Pages Crawled" sub="Analyzed" color="#4F6EF7" borderColor="#4F6EF7" />
              <StatCard value={vm.indexablePages} label="Indexable" sub="No noindex tag" color="#10B981" borderColor="#10B981" />
              <StatCard value={vm.blockedPages} label="Blocked" sub="Noindex directive" color="#EF4444" borderColor="#EF4444" />
              <StatCard value={vm.indexRate == null ? 'N/A' : `${vm.indexRate}%`} label="Indexable Rate" sub="Indexable / crawled" color={rateColor} borderColor={rateColor} />
            </div>

            <h3 style={h3}>Crawl Status Distribution</h3>
            <div style={rule} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginBottom: 28 }}>
              <svg width={180} height={180} viewBox="0 0 180 180">
                {(() => {
                  const colors = ['#10B981', '#EF4444'];
                  let offset = 0;
                  return vm.chart.map((item, i) => {
                    const r = 70; const c = 2 * Math.PI * r;
                    const el = (
                      <circle key={item.label} cx={90} cy={90} r={r} fill="none" stroke={colors[i]} strokeWidth={24}
                        strokeDasharray={`${c * (item.percentage / 100)} ${c}`} strokeDashoffset={-c * offset} transform="rotate(-90 90 90)" />
                    );
                    offset += item.percentage / 100;
                    return el;
                  });
                })()}
                <circle cx={90} cy={90} r={56} fill="white" />
              </svg>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 2.2 }}>
                {vm.chart.map((item) => (
                  <div key={item.label}>
                    <span style={{ color: item.label === 'Indexable' ? '#10B981' : '#EF4444' }}>■</span> {item.value} {item.label.toLowerCase()} ({item.percentage}%)
                  </div>
                ))}
                <p style={{ fontSize: 13, color: '#6B7280', marginTop: 12 }}>
                  {vm.blockedPages > 0
                    ? `${vm.blockedPages} page(s) carry a noindex directive and cannot appear in search results.`
                    : 'No crawled page carries a noindex directive.'}
                </p>
              </div>
            </div>

            <h3 style={h3}>Open Indexation Issues</h3>
            <div style={{ ...rule, marginBottom: 16 }} />

            <div style={{ borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#111827' }}>
                    {['Reason', 'Open issues', 'Severity', 'Suggested action'].map((h, i) => (
                      <th key={i} style={{ padding: '11px 14px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vm.blockedReasons.length > 0 ? (
                    vm.blockedReasons.map((reason, i) => (
                      <tr key={reason.reason + i} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>{reason.reason}</td>
                        <td style={{ padding: '11px 14px', color: '#374151', textAlign: 'center' }}>{reason.affected}</td>
                        <td style={{ padding: '11px 14px' }}><Badge label={reason.impact} type={impactType(reason.impact)} /></td>
                        <td style={{ padding: '11px 14px', color: '#6B7280' }}>{reason.fix}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#10B981' }}>
                        No open crawlability or indexation issues were detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <InsightBox title="Crawlability Insight">
              {vm.blockedReasons.length > 0
                ? `"${vm.blockedReasons[0].reason}" accounts for the most open indexation issues (${vm.blockedReasons[0].affected}).`
                : `All ${vm.totalPages} crawled pages are indexable (${vm.indexRate}%).`}
            </InsightBox>
          </>
        )}
        <Caption>
          "Indexable" means the page has no noindex robots meta directive; Odito does not verify what Google has indexed. {TECH_NOTE}
        </Caption>
      </div>
      <PageFooter page={6} />
    </div>
  );
}

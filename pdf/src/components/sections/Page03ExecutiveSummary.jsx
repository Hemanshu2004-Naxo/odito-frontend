'use client';

import React from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader, StatCard, InsightBox } from '../layout';
import { useCanonicalReport } from '../../reportMeta';
import { executiveVM, unavailableText } from '../../reportViewModels';
import { MissingReport, UnavailableSection, Caption } from '../layout';

function DonutChart({ value, max = 100, color, size = 100 }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const unavailable = value == null;
  const pct = unavailable ? 0 : value / max;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#E5E7EB" strokeWidth={10} />
      {!unavailable && (
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)" />
      )}
      <text x={50} y={47} textAnchor="middle" fontSize={18} fontWeight={800} fill="#111827" fontFamily="'Inter', sans-serif">{unavailable ? 'N/A' : value}</text>
      {!unavailable && <text x={50} y={60} textAnchor="middle" fontSize={10} fill="#9CA3AF">/100</text>}
    </svg>
  );
}

export default function ExecutiveSummaryPage() {
  const report = useCanonicalReport();
  if (!report) return <MissingReport title="Executive Summary" />;
  const vm = executiveVM(report);
  const scores = vm.scores;
  const issues = vm.issues;
  const issueDistribution = { critical: issues.critical ?? 0, medium: issues.medium ?? 0, info: issues.low ?? 0 };

  // Dynamic score colors based on actual values
  const getScoreColor = (score) => {
    if (score == null) return '#9CA3AF';
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#4F6EF7';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{
      width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
      flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
      margin: '0 auto', fontFamily: "'DM Sans', sans-serif"
    }}>
      <PageHeader page={3} />

      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="01" title="Executive Summary" subtitle="Score and issue overview" />

        {/* 4 donut score cards - DYNAMIC VALUES */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16,
          border: '1px solid #E5E7EB', borderRadius: 8, padding: 24, marginBottom: 20
        }}>
          {[
            { v: scores.seoHealth, l: 'SEO Health', c: getScoreColor(scores.seoHealth) },
            { v: scores.aiReadiness, l: 'AI Search Readiness', c: getScoreColor(scores.aiReadiness) },
            { v: scores.performance, l: 'Performance', c: getScoreColor(scores.performance) },
            { v: scores.technicalHealth, l: 'Technical Health', c: getScoreColor(scores.technicalHealth) },
          ].map(({ v, l, c }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <DonutChart value={v} color={c} size={110} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 8 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Issue stats - UPDATED ORDER: Total Issues, Critical, Medium, Info */}
        <Caption>
          {scores.overallNote
            ? 'Overall score ' + (scores.overall ?? 'N/A') + ': ' + scores.overallNote + ' '
            : scores.overall != null ? 'Overall score ' + scores.overall + '/100 (mean of the four category scores). ' : null}
          Category scores come from {scores.source === 'audit_run' ? 'the audit run (' + (vm.auditLine || 'date not available') + ')' : 'live project data (no completed audit run)'}.
          AI Search Readiness is an on-site assessment, not a measure of AI platform citations.
        </Caption>
        <div style={{ height: 20 }} />

        {issues.hasData ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
            <StatCard value={issues.total} label="Open Issues" sub="Distinct open issues" color="#8B5CF6" borderColor="#8B5CF6" />
            <StatCard value={issues.critical} label="Critical / High" sub="Critical + high severity" color="#EF4444" borderColor="#EF4444" />
            <StatCard value={issues.medium} label="Medium" sub="Medium severity" color="#F59E0B" borderColor="#F59E0B" />
            <StatCard value={issues.low} label="Low / Info" sub="Low + info severity" color="#4F6EF7" borderColor="#4F6EF7" />
          </div>
        ) : (
          <UnavailableSection title="Issue counts unavailable" message={unavailableText(issues, 'issue count')} tone="warn" />
        )}

        {issues.hasData && (<>
        <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: 24 }} />

        {/* Issue Distribution - FIXED DONUT CHART */}
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '28px 0 16px', fontFamily: "'Inter', sans-serif" }}>Issue Distribution</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {/* Fixed donut chart with proper segments */}
          <svg width={180} height={180} viewBox="0 0 180 180">
            {(() => {
              // Prepare chart data - ONLY the segments, no total
              const chartData = [
                { name: "Critical", value: issueDistribution?.critical || 0, color: '#EF4444' },
                { name: "Medium", value: issueDistribution?.medium || 0, color: '#F59E0B' },
                { name: "Info", value: issueDistribution?.info || 0, color: '#4F6EF7' }
              ];
              
              
              // Calculate total for proportions
              const total = chartData.reduce((sum, item) => sum + item.value, 0);
              
              if (total === 0) {
                // Show empty state
                return (
                  <>
                    <circle cx={90} cy={90} r={70} fill="none" stroke="#E5E7EB" strokeWidth={22} />
                    <circle cx={90} cy={90} r={50} fill="white" />
                  </>
                );
              }
              
              // Calculate cumulative offsets for proper segment positioning
              let cumulativeOffset = 0;
              const r = 70;
              const circumference = 2 * Math.PI * r;
              
              return chartData.map((item, index) => {
                const percentage = item.value / total;
                const dashLength = circumference * percentage;
                const dashOffset = -circumference * cumulativeOffset;
                
                cumulativeOffset += percentage;
                
                return (
                  <circle
                    key={item.name}
                    cx={90}
                    cy={90}
                    r={r}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={22}
                    strokeDasharray={`${dashLength} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 90 90)"
                  />
                );
              });
            })()}
            <circle cx={90} cy={90} r={50} fill="white" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { color: '#EF4444', label: `Critical (${issueDistribution?.critical || 0})` },
              { color: '#F59E0B', label: `Medium (${issueDistribution?.medium || 0})` },
              { color: '#4F6EF7', label: `Low / Info (${issueDistribution?.info || 0})` },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
                <span style={{ fontSize: 14, color: '#374151' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        </>)}
        <Caption>{vm.snapshotNote}</Caption>
      </div>

      <PageFooter page={3} />
    </div>
  );
}

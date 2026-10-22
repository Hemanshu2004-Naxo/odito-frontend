import { formatReportDate } from './reportMeta';

/**
 * Pure mappers from the canonical report to what each PDF page renders.
 *
 * Rules:
 *  - values the server marked unavailable stay `null` (never 0, never "Good");
 *  - nothing here recomputes scores, issue counts or rankings - it only
 *    selects, relabels and applies fixed display thresholds;
 *  - every view model carries `status`/`reason`/`message` so a page can say
 *    exactly why data is missing.
 */

const AVAILABLE = new Set(['available', 'partial']);

const base = (section) => ({
  status: section?.status ?? 'unavailable',
  reason: section?.reason ?? null,
  message: section?.message ?? null,
  hasData: !!section && AVAILABLE.has(section.status) && !!section.data,
  asOf: section?.asOf ?? null,
  timeBasis: section?.timeBasis ?? null,
  snapshotRelation: section?.snapshotRelation ?? null,
});

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Why a section has no data, in customer wording. */
export function unavailableText(vm, label) {
  if (vm.status === 'not_configured') return vm.message || `${label} is not configured for this project.`;
  if (vm.reason === 'not_run') return vm.message || `${label} has not been run for this project.`;
  if (vm.reason === 'no_data' || vm.reason === 'no_audit_data') return vm.message || `No ${label} data is available yet.`;
  return vm.message || `${label} data could not be loaded for this report.`;
}

// ── Cover / executive ───────────────────────────────────────────────────────

export function scoresVM(report) {
  const exec = report.sections.executiveSummary;
  const sc = exec?.data?.scores;
  const cat = (k) => numOrNull(sc?.categories?.[k]?.value);
  const overall = numOrNull(sc?.overall?.value);
  const excluded = sc?.overall?.excluded ?? [];
  const labels = { seoHealth: 'SEO Health', performance: 'Performance', technicalHealth: 'Technical Health', aiReadiness: 'AI Search Readiness' };
  return {
    seoHealth: cat('seoHealth'),
    performance: cat('performance'),
    technicalHealth: cat('technicalHealth'),
    // On-site AI readiness (ai_projects.overall_score). Not AI-platform visibility.
    aiReadiness: cat('aiReadiness'),
    overall,
    overallComplete: sc?.overall?.complete ?? false,
    overallNote: overall === null
      ? 'No category scores are available.'
      : excluded.length
        ? `Based on ${sc.overall.basis.length} of 4 categories (not available: ${excluded.map((k) => labels[k] || k).join(', ')}).`
        : null,
    source: exec?.timeBasis === 'audit_snapshot' ? 'audit_run' : 'live',
  };
}

export function issuesVM(report) {
  const issues = report.sections.executiveSummary?.data?.issues;
  const d = issues?.data;
  return {
    ...base(issues),
    total: numOrNull(d?.totalOpen),
    critical: numOrNull(d?.bySeverity?.critical),
    medium: numOrNull(d?.bySeverity?.medium),
    low: numOrNull(d?.bySeverity?.low),
    resolved: numOrNull(d?.resolved),
  };
}

/** Snapshot caveat to show to the reader, or null when the data is aligned. */
export function snapshotNote(report) {
  const s = report.metadata?.snapshot;
  if (!s || s.consistency === 'aligned') return null;
  return s.note || null;
}

export function auditLine(report) {
  const a = report.metadata?.audit;
  const date = formatReportDate(report.metadata?.auditDate);
  if (!a) return date ? `Audit date: ${date}` : null;
  return `Audit #${a.auditNumber}${date ? ` · ${date}` : ''}`;
}

export function coverVM(report) {
  const m = report.metadata;
  return {
    domain: m.domain,
    companyName: m.projectName,
    auditDate: formatReportDate(m.auditDate),
    auditLine: auditLine(report),
    pagesCrawled: numOrNull(m.coverage?.pagesCrawled),
    grade: report.sections.executiveSummary?.data?.websiteGrade ?? null,
    scores: scoresVM(report),
    issues: issuesVM(report),
    snapshotNote: snapshotNote(report),
  };
}

export function executiveVM(report) {
  const issues = issuesVM(report);
  return {
    ...coverVM(report),
    distribution: issues.hasData
      ? [
          { name: 'Critical', value: issues.critical ?? 0, color: '#EF4444' },
          { name: 'Medium', value: issues.medium ?? 0, color: '#F59E0B' },
          { name: 'Low / Info', value: issues.low ?? 0, color: '#4F6EF7' },
        ]
      : null,
  };
}

// ── On-page SEO ─────────────────────────────────────────────────────────────

export function onPageVM(report) {
  const s = report.sections.onPageSeo;
  const vm = base(s);
  if (!vm.hasData) return vm;
  const d = s.data;
  const sev = (k) => d.bySeverity?.[k] || 0;
  return {
    ...vm,
    scope: d.scope,
    totalIssues: numOrNull(d.totalIssues),
    pagesAnalyzed: numOrNull(d.pagesAnalyzed),
    cards: {
      all: numOrNull(d.totalIssues),
      criticalHigh: sev('critical') + sev('high'),
      medium: sev('medium') + sev('warning'),
      lowInfo: sev('low') + sev('info'),
    },
    rows: (d.topIssues || []).slice(0, 10).map((i) => ({
      key: `${i.issueCode}|${i.dataPath ?? ''}`,
      issueCode: i.issueCode,
      title: i.title,
      severity: String(i.severity || '').toLowerCase(),
      pagesAffected: numOrNull(i.pagesAffected),
      impactPercentage: numOrNull(i.impactPercentage),
      difficulty: i.difficulty ?? null,
    })),
    evidence: Object.entries(d.affectedUrls || {}).slice(0, 3).map(([code, e]) => ({
      issueCode: code,
      title: (d.topIssues || []).find((t) => t.issueCode === code)?.title ?? code,
      totalUrls: e.totalUrls,
      sample: (e.sample || []).slice(0, 3).map((u) => u.url),
    })),
  };
}

// ── Technical: structured data, checks, crawlability ────────────────────────

export function structuredDataVM(report) {
  const t = report.sections.technicalSeo;
  const sd = t?.data?.structuredData;
  if (!AVAILABLE.has(t?.status) || !sd) {
    return { ...base(t), hasData: false, reason: t?.status === 'partial' || t?.status === 'available' ? 'structured_data_unavailable' : t?.reason ?? null };
  }
  const withSchema = numOrNull(sd.pagesWithSchema);
  const withoutSchema = numOrNull(sd.pagesWithoutSchema);
  return {
    ...base(t),
    hasData: true,
    withSchema,
    withoutSchema,
    coverage: numOrNull(sd.coveragePercent),
    schemaIssueCount: numOrNull(sd.schemaIssueCount),
    schemaTypes: sd.schemaTypes || [],
    mode: withoutSchema === 0 && withSchema > 0 ? 'distribution' : 'coverage',
  };
}

const CHECK_STATUS = { OK: 'pass', Warning: 'warn', Critical: 'fail' };

export function technicalChecksVM(report) {
  const t = report.sections.technicalSeo;
  const d = t?.data;
  if (!AVAILABLE.has(t?.status) || !Array.isArray(d?.checks)) {
    return { ...base(t), hasData: false, reason: AVAILABLE.has(t?.status) ? 'checks_unavailable' : t?.reason ?? null };
  }
  const checks = d.checks.map((c) => ({
    name: c.name,
    state: CHECK_STATUS[c.status] || 'unknown',
    message: c.message ?? null,
    affectedPages: numOrNull(c.affectedPages),
  }));
  const count = (s) => checks.filter((c) => c.state === s).length;
  return {
    ...base(t),
    hasData: true,
    checks,
    passed: count('pass'),
    warnings: count('warn'),
    failed: count('fail'),
    unknown: count('unknown'),
    // healthScore is null when the server had no checks to score.
    healthScore: numOrNull(d.healthScore),
  };
}

export function crawlabilityVM(report) {
  const t = report.sections.technicalSeo;
  const c = t?.data?.crawlability;
  if (!AVAILABLE.has(t?.status) || !c) {
    return { ...base(t), hasData: false, reason: AVAILABLE.has(t?.status) ? 'crawlability_unavailable' : t?.reason ?? null };
  }
  const pct = (n) => (c.totalPages > 0 ? Math.round((n / c.totalPages) * 100) : 0);
  return {
    ...base(t),
    hasData: true,
    totalPages: c.totalPages,
    indexablePages: c.indexedPages,
    blockedPages: c.blockedPages,
    indexRate: numOrNull(c.indexRate),
    chart: [
      { label: 'Indexable', value: c.indexedPages, percentage: pct(c.indexedPages) },
      { label: 'Blocked', value: c.blockedPages, percentage: pct(c.blockedPages) },
    ],
    blockedReasons: c.blockedReasons || [],
  };
}

// ── PageSpeed / Core Web Vitals ─────────────────────────────────────────────

// Google's published Core Web Vitals / Lighthouse bands (display only).
const BANDS = {
  lcp: [2.5, 4],
  tbt: [200, 600],
  cls: [0.1, 0.25],
  fcp: [1.8, 3.0],
  ttfb: [800, 1800],
};

export function vitalRating(metric, value) {
  if (value === null || value === undefined) return 'Unavailable';
  const [good, poor] = BANDS[metric];
  if (value < good) return 'Good';
  if (value < poor) return 'Needs Work';
  return 'Poor';
}

export function formatVital(metric, value) {
  if (value === null || value === undefined) return 'N/A';
  if (metric === 'tbt' || metric === 'ttfb') return `${Math.round(value)}ms`;
  if (metric === 'cls') return value.toFixed(3);
  return `${value.toFixed(1)}s`;
}

export function webVitalsVM(report) {
  const s = report.sections.pageSpeed;
  const vm = base(s);
  if (!vm.hasData) return vm;
  const { mobile, desktop } = s.data;
  const names = [
    ['fcp', 'First Contentful Paint (FCP)'],
    ['lcp', 'Largest Contentful Paint (LCP)'],
    ['tbt', 'Total Blocking Time (TBT)'],
    ['cls', 'Cumulative Layout Shift (CLS)'],
    ['ttfb', 'Time to First Byte (TTFB)'],
  ];
  const score = (d, k) => numOrNull(d?.scores?.[k]);
  return {
    ...vm,
    mobileMeasured: !!mobile,
    desktopMeasured: !!desktop,
    performanceScore: numOrNull(s.data.performanceScore),
    scores: [
      { label: 'Performance', d: score(desktop, 'performance'), m: score(mobile, 'performance') },
      { label: 'Best Practices', d: score(desktop, 'bestPractices'), m: score(mobile, 'bestPractices') },
      { label: 'Accessibility', d: score(desktop, 'accessibility'), m: score(mobile, 'accessibility') },
    ],
    vitals: names.map(([k, label]) => {
      const dv = numOrNull(desktop?.coreWebVitals?.[k]);
      const mv = numOrNull(mobile?.coreWebVitals?.[k]);
      return {
        key: k, label,
        desktopValue: formatVital(k, dv), desktopRating: vitalRating(k, dv),
        mobileValue: formatVital(k, mv), mobileRating: vitalRating(k, mv),
      };
    }),
    mobileLcp: numOrNull(mobile?.coreWebVitals?.lcp),
    mobileTbt: numOrNull(mobile?.coreWebVitals?.tbt),
  };
}

// ── Keywords ────────────────────────────────────────────────────────────────

export const KEYWORD_ROWS_ON_PAGE = 18;

export function keywordsVM(report) {
  const s = report.sections.keywords;
  const vm = base(s);
  if (!vm.hasData) return vm;
  const d = s.data;
  const rows = d.keywords || [];
  return {
    ...vm,
    origin: d.origin,
    isLegacy: d.origin === 'seo_rankings_legacy',
    location: d.location ?? null,
    country: d.country ?? null,
    scope: d.scope ?? null,
    summary: d.summary,
    hasMaps: rows.some((r) => r.mapsRank != null),
    hasHistory: rows.some((r) => r.previousScanRank != null || r.previousWeekRank != null || r.previousMonthRank != null),
    rows: rows.slice(0, KEYWORD_ROWS_ON_PAGE),
    moreExist: rows.length > KEYWORD_ROWS_ON_PAGE || !!d.truncated,
    totalRows: rows.length,
    lastScanned: formatReportDate(s.asOf),
  };
}

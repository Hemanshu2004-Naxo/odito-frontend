import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import fixture from './__fixtures__/canonicalReport.live.json';
import { getReportPages } from './reportPages';
import { ReportMetaProvider, CanonicalReportProvider } from './reportMeta';
import {
  validateCanonicalReport,
  fetchCanonicalReport,
  createReportLoader,
  ReportDataError,
} from './reportData';
import {
  coverVM, executiveVM, onPageVM, structuredDataVM, technicalChecksVM,
  crawlabilityVM, webVitalsVM, keywordsVM, vitalRating, formatVital,
} from './reportViewModels';

// `fixture` is a real response from GET /api/pdf/:projectId/report against the
// development database (trimmed). Variants are derived by mutation.
const clone = () => JSON.parse(JSON.stringify(fixture));
const PID = fixture.metadata.projectId;

const mount = (report, node, meta = {}) =>
  render(
    <CanonicalReportProvider report={report}>
      <ReportMetaProvider value={{ page: 1, total: 9, domain: report.metadata.domain, auditDate: 'May 2, 2026', generated: 'May 3, 2026', ...meta }}>
        {node}
      </ReportMetaProvider>
    </CanonicalReportProvider>
  );

// ── Contract validation / fetching ───────────────────────────────────────────

describe('canonical report validation', () => {
  test('accepts the real report', () => {
    expect(validateCanonicalReport(clone(), PID).schemaVersion).toBe('1.1.0');
  });

  test.each([
    ['empty', null],
    ['no sections', { schemaVersion: '1.0.0', metadata: {} }],
  ])('rejects an invalid shape (%s)', (_n, body) => {
    expect(() => validateCanonicalReport(body, PID)).toThrow(ReportDataError);
  });

  test('rejects an unsupported schema major version', () => {
    const r = clone(); r.schemaVersion = '2.0.0';
    expect(() => validateCanonicalReport(r, PID)).toThrow(/Unsupported report schema/);
  });

  test('rejects a section with a missing/invalid status', () => {
    const r = clone(); delete r.sections.pageSpeed.status;
    expect(() => validateCanonicalReport(r, PID)).toThrow(/pageSpeed/);
    const r2 = clone(); delete r2.sections.keywords;
    expect(() => validateCanonicalReport(r2, PID)).toThrow(/keywords/);
  });

  test('rejects another project\'s report', () => {
    expect(() => validateCanonicalReport(clone(), 'someOtherProject')).toThrow(/different project/);
  });
});

describe('fetching the canonical report', () => {
  const api = (impl) => ({ request: vi.fn(impl) });

  test('requests the report endpoint (with the audit number when given)', async () => {
    const a = api(async () => ({ success: true, data: clone() }));
    await fetchCanonicalReport(PID, { api: a });
    expect(a.request).toHaveBeenCalledWith(`/pdf/${PID}/report`, {});
    await fetchCanonicalReport(PID, { api: a, auditNumber: 1 });
    expect(a.request).toHaveBeenLastCalledWith(`/pdf/${PID}/report?auditNumber=1`, {});
  });

  test('a failed request is a ReportDataError, not an empty report', async () => {
    const a = api(async () => { throw new Error('HTTP 500'); });
    await expect(fetchCanonicalReport(PID, { api: a })).rejects.toMatchObject({ name: 'ReportDataError', code: 'REQUEST_FAILED' });
  });

  test('unknown audit / project responses (success:false) fail', async () => {
    const a = api(async () => ({ success: false, error: { message: 'Audit #99 not found for this project' } }));
    await expect(fetchCanonicalReport(PID, { api: a, auditNumber: 99 })).rejects.toThrow(/Audit #99/);
  });

  test('an invalid shape from the server fails', async () => {
    const a = api(async () => ({ success: true, data: { schemaVersion: '1.1.0' } }));
    await expect(fetchCanonicalReport(PID, { api: a })).rejects.toBeInstanceOf(ReportDataError);
  });

  test('abort is propagated as an AbortError, not wrapped', async () => {
    const a = api(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
    await expect(fetchCanonicalReport(PID, { api: a })).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('rejects an invalid project id without calling the API', async () => {
    const a = api(async () => ({}));
    await expect(fetchCanonicalReport('all', { api: a })).rejects.toThrow(/Invalid project/);
    expect(a.request).not.toHaveBeenCalled();
  });

  test('the loader shares one request per project, never reuses another project, and does not cache failures', async () => {
    const a = api(async (url) => ({ success: true, data: { ...clone(), metadata: { ...clone().metadata, projectId: url.split('/')[2] } } }));
    const loader = createReportLoader({ api: a });
    const [r1, r2] = await Promise.all([loader.load('p-a'), loader.load('p-a')]);
    expect(a.request).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    const rb = await loader.load('p-b');
    expect(a.request).toHaveBeenCalledTimes(2);
    expect(rb.metadata.projectId).toBe('p-b');

    let fail = true;
    const flaky = api(async () => (fail ? { success: false } : { success: true, data: clone() }));
    const l2 = createReportLoader({ api: flaky });
    await expect(l2.load(PID)).rejects.toBeDefined();
    fail = false;
    await expect(l2.load(PID)).resolves.toBeDefined();
    expect(flaky.request).toHaveBeenCalledTimes(2); // exactly one explicit re-attempt, no automatic retries
  });
});

// ── View models ──────────────────────────────────────────────────────────────

describe('view models: scores and issues', () => {
  test('cover/executive use the canonical audit-run scores and counts', () => {
    const vm = executiveVM(clone());
    expect(vm.scores).toMatchObject({ seoHealth: 71, performance: 40, technicalHealth: 70, aiReadiness: 45, overall: 57 });
    expect(vm.issues).toMatchObject({ hasData: true, total: 339, critical: 236, medium: 89, low: 14 });
    expect(vm.issues.critical + vm.issues.medium + vm.issues.low).toBe(vm.issues.total);
    expect(vm.domain).toBe('sapphiredigitalagency.com');
    expect(vm.auditLine).toMatch(/^Audit #2/);
  });

  test('a genuine zero-issue audit stays zero and is distinct from an unavailable issue count', () => {
    const zero = clone();
    zero.sections.executiveSummary.data.issues.data = { totalOpen: 0, resolved: 0, bySeverity: { critical: 0, medium: 0, low: 0 }, byCategory: [] };
    expect(executiveVM(zero).issues).toMatchObject({ hasData: true, total: 0, critical: 0 });

    const failed = clone();
    failed.sections.executiveSummary.data.issues = { status: 'unavailable', reason: 'query_failed', message: 'Issue counts could not be loaded.', data: null };
    const vm = executiveVM(failed);
    expect(vm.issues.hasData).toBe(false);
    expect(vm.issues.total).toBeNull();
    expect(vm.issues.reason).toBe('query_failed');
    expect(vm.distribution).toBeNull();
  });

  test('an unavailable category score is null and explained, not 0', () => {
    const r = clone();
    const sc = r.sections.executiveSummary.data.scores;
    sc.categories.aiReadiness = { value: null, available: false, source: 'audit_run' };
    sc.overall = { value: 60, method: 'mean_of_available_categories', basis: ['seoHealth', 'performance', 'technicalHealth'], excluded: ['aiReadiness'], complete: false };
    const vm = executiveVM(r);
    expect(vm.scores.aiReadiness).toBeNull();
    expect(vm.scores.overall).toBe(60);
    expect(vm.scores.overallNote).toMatch(/3 of 4/);
    expect(vm.scores.overallNote).toMatch(/AI Search Readiness/);
  });

  test('AI score is labelled as on-site readiness (no AI-platform visibility semantics)', () => {
    const { container } = mount(clone(), getReportPages().find((p) => p.id === 'executive-summary').element);
    expect(container.textContent).toMatch(/AI Search Readiness/);
    expect(container.textContent).toMatch(/not a measure of AI platform citations/);
    expect(container.textContent).not.toMatch(/AI Visibility/);
  });

  test('the snapshot caveat is surfaced only when live data may be newer than the run', () => {
    expect(coverVM(clone()).snapshotNote).toBeNull();
    const r = clone();
    r.metadata.snapshot = { ...r.metadata.snapshot, consistency: 'live_newer_than_snapshot', note: 'A newer audit has started.' };
    expect(coverVM(r).snapshotNote).toBe('A newer audit has started.');
  });
});

describe('view models: on-page, technical, crawlability', () => {
  test('on-page cards use the canonical issue counts and sum to the on-page total', () => {
    const vm = onPageVM(clone());
    expect(vm.hasData).toBe(true);
    expect(vm.cards.all).toBe(249);
    expect(vm.cards.criticalHigh + vm.cards.medium + vm.cards.lowInfo).toBe(vm.cards.all);
    expect(vm.rows.length).toBeLessThanOrEqual(10);
    expect(vm.rows.every((r) => r.title && r.severity)).toBe(true);
  });

  test('on-page unavailable keeps the reason, no counts', () => {
    const r = clone();
    r.sections.onPageSeo = { status: 'unavailable', reason: 'adapter_error', message: 'This section failed to load.', data: null };
    const vm = onPageVM(r);
    expect(vm.hasData).toBe(false);
    expect(vm.cards).toBeUndefined();
  });

  test('technical checks map the real status values and keep a null health score null', () => {
    const vm = technicalChecksVM(clone());
    expect(vm.passed + vm.warnings + vm.failed + vm.unknown).toBe(vm.checks.length);
    expect(vm.checks.find((c) => c.name === 'Security Headers')).toMatchObject({ state: 'fail' });
    expect(vm.checks.find((c) => c.name === 'SSL Certificate').message).toMatch(/valid/);
    const r = clone(); r.sections.technicalSeo.data.healthScore = null;
    expect(technicalChecksVM(r).healthScore).toBeNull();
  });

  test('technical partial: missing checks do not hide crawlability or structured data', () => {
    const r = clone();
    r.sections.technicalSeo.status = 'partial';
    delete r.sections.technicalSeo.data.checks;
    expect(technicalChecksVM(r).hasData).toBe(false);
    expect(crawlabilityVM(r).hasData).toBe(true);
    expect(structuredDataVM(r).hasData).toBe(true);
  });

  test('crawlability uses indexable wording and real counts', () => {
    const vm = crawlabilityVM(clone());
    expect(vm).toMatchObject({ hasData: true, totalPages: 35, indexablePages: 35, blockedPages: 0, indexRate: 100 });
  });
});

describe('view models: PageSpeed', () => {
  test('real measurements are mapped, including a measured zero', () => {
    const r = clone();
    r.sections.pageSpeed.data.mobile.coreWebVitals.cls = 0;
    const vm = webVitalsVM(r);
    const cls = vm.vitals.find((v) => v.key === 'cls');
    expect(cls.mobileValue).toBe('0.000');
    expect(cls.mobileRating).toBe('Good');
    expect(vm.scores[0]).toMatchObject({ d: 52, m: 35 });
  });

  test('missing performance data is unavailable, never zero or "Good"', () => {
    const r = clone();
    r.sections.pageSpeed = { status: 'unavailable', reason: 'no_data', message: 'No PageSpeed measurements are available.', data: null };
    expect(webVitalsVM(r).hasData).toBe(false);
    expect(vitalRating('lcp', null)).toBe('Unavailable');
    expect(formatVital('lcp', null)).toBe('N/A');
  });

  test('an unmeasured device shows N/A and is not rated', () => {
    const r = clone();
    r.sections.pageSpeed.status = 'partial';
    r.sections.pageSpeed.data.desktop = null;
    const vm = webVitalsVM(r);
    expect(vm.desktopMeasured).toBe(false);
    expect(vm.scores[0].d).toBeNull();
    expect(vm.vitals.every((v) => v.desktopValue === 'N/A' && v.desktopRating === 'Unavailable')).toBe(true);
  });
});

describe('view models: keywords vs Search Console', () => {
  test('current rankings are used and the legacy source is flagged', () => {
    const vm = keywordsVM(clone());
    expect(vm.isLegacy).toBe(false);
    expect(vm.summary.tracked).toBe(1);
    expect(vm.scope).toBe('local');

    const legacy = clone();
    legacy.sections.keywords.status = 'partial';
    legacy.sections.keywords.reason = 'legacy_source';
    legacy.sections.keywords.data = { origin: 'seo_rankings_legacy', summary: { tracked: 1, ranking: 0, notInTop100: 1 }, keywords: [{ keyword: 'k', currentRank: null, rankState: 'not_in_top_100' }], truncated: false };
    const lv = keywordsVM(legacy);
    expect(lv.isLegacy).toBe(true);
    expect(lv.hasHistory).toBe(false); // legacy rows have no history fields
    expect(lv.rows[0].previousScanRank).toBeUndefined();
  });

  test('missing optional fields are handled and history columns appear only when data exists', () => {
    const r = clone();
    r.sections.keywords.data.keywords = [{ keyword: 'a', currentRank: 4, rankState: 'ranking', previousScanRank: 6, previousWeekRank: null, bestRank: null }];
    expect(keywordsVM(r).hasHistory).toBe(true);
    r.sections.keywords.data.keywords = [{ keyword: 'a', currentRank: 4, rankState: 'ranking' }];
    expect(keywordsVM(r).hasHistory).toBe(false);
  });

  test('Search Console data never leaks into the tracked-keyword view', () => {
    const r = clone();
    r.sections.searchConsole = { status: 'available', data: { totalClicks: 999, totalImpressions: 99999 }, timeBasis: 'reporting_period' };
    expect(JSON.stringify(keywordsVM(r))).not.toMatch(/999/);
    expect(keywordsVM(r).summary.tracked).toBe(1);
  });

  test('no rankings -> unavailable with the server reason', () => {
    const r = clone();
    r.sections.keywords = { status: 'unavailable', reason: 'no_data', message: 'No tracked keywords with ranking data exist for this project.', data: null };
    const vm = keywordsVM(r);
    expect(vm.hasData).toBe(false);
    expect(vm.reason).toBe('no_data');
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('rendered pages', () => {
  test('all 9 pages render from one report with correct numbering and no loading/undefined/NaN output', () => {
    const report = clone();
    const pages = getReportPages();
    expect(pages.map((p) => p.id)).toEqual([
      'cover', 'executive-summary', 'on-page-seo', 'structured-data', 'technical-seo',
      'crawlability', 'core-web-vitals', 'keyword-ranking', 'about-odito',
    ]);
    pages.forEach((p, i) => {
      const { container, unmount } = mount(report, p.element, { page: i + 1, total: pages.length });
      const text = container.textContent;
      expect(text, p.id).not.toMatch(/Loading|undefined|NaN|\[object/);
      expect(text, p.id).not.toMatch(/agencyplatform|March 13, 2025/);
      if (p.id !== 'cover') expect(text, p.id).toContain(`Page ${i + 1} of ${pages.length}`);
      unmount();
    });
  });

  test('sections that are unavailable render an explanation, not zeros', () => {
    const r = clone();
    r.sections.pageSpeed = { status: 'unavailable', reason: 'no_data', message: 'No PageSpeed measurements are available.', data: null };
    r.sections.keywords = { status: 'unavailable', reason: 'no_data', message: 'No tracked keywords with ranking data exist for this project.', data: null };
    r.sections.onPageSeo = { status: 'unavailable', reason: 'adapter_error', message: 'This section failed to load.', data: null };
    r.sections.executiveSummary.data.issues = { status: 'unavailable', reason: 'query_failed', message: 'Issue counts could not be loaded.', data: null };
    const byId = Object.fromEntries(getReportPages().map((p) => [p.id, p.element]));

    const cwv = mount(r, byId['core-web-vitals']).container.textContent;
    expect(cwv).toMatch(/PageSpeed data unavailable/);
    expect(cwv).not.toMatch(/Good|Desktop Score/);

    expect(mount(r, byId['keyword-ranking']).container.textContent).toMatch(/Keyword rankings unavailable/);
    expect(mount(r, byId['on-page-seo']).container.textContent).toMatch(/On-page SEO data unavailable/);
    const exec = mount(r, byId['executive-summary']).container.textContent;
    expect(exec).toMatch(/Issue counts unavailable/);
    expect(exec).not.toMatch(/Open Issues/);
  });

  test('partial PageSpeed renders measured values and N/A for the unmeasured device', () => {
    const r = clone();
    r.sections.pageSpeed.status = 'partial';
    r.sections.pageSpeed.data.desktop = null;
    const text = mount(r, getReportPages().find((p) => p.id === 'core-web-vitals').element).container.textContent;
    expect(text).toMatch(/N\/A/);
    expect(text).toMatch(/Not measured: desktop/);
  });

  test('a page without a report says so instead of rendering empty scorecards', () => {
    const { container } = render(getReportPages().find((p) => p.id === 'executive-summary').element);
    expect(container.textContent).toMatch(/report data was not provided/);
  });

  test('no AI-platform citation claims appear in any page', () => {
    const report = clone();
    const all = getReportPages().map((p) => mount(report, p.element).container.textContent).join(' ');
    expect(all).not.toMatch(/citation rate|ChatGPT|Perplexity|Gemini|Claude|industry average/i);
  });
});

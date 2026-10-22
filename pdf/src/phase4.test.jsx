import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://localhost:0/api'; });

import fixture from './__fixtures__/canonicalReport.v12.json';
import { getReportPages } from './reportPages';
import { ReportMetaProvider, CanonicalReportProvider } from './reportMeta';
import { additionalPages } from './sectionPages';
import { paginate, tableRow, heading, textBlock, BODY_HEIGHT, LAYOUT } from './pagination';
import { validateCanonicalReport } from './reportData';

// `fixture` is a real GET /api/pdf/:id/report (schema 1.2.0) from the dev database.
const clone = () => JSON.parse(JSON.stringify(fixture));
const text = (report, pageDef, i = 0, total = 40) => {
  const { container, unmount } = render(
    <CanonicalReportProvider report={report}>
      <ReportMetaProvider value={{ page: i + 1, total, domain: 'x.test', auditDate: 'Jan 1, 2026', generated: 'Jan 2, 2026' }}>{pageDef.element}</ReportMetaProvider>
    </CanonicalReportProvider>
  );
  const t = container.textContent; unmount(); return t;
};
const byPrefix = (report, p) => additionalPages(report).filter((x) => x.id === p || x.id.startsWith(`${p}-`)).map((x) => text(report, x)).join(' ');
const SEC_UNAVAIL = (reason, message) => ({ status: 'unavailable', reason, message, data: null, source: 'x', asOf: null, timeBasis: 'live_current', snapshotRelation: 'not_applicable' });

describe('page order and counts', () => {
  test('the original eight pages come first, then the new sections in order, and About Odito is last', () => {
    const r = clone();
    validateCanonicalReport(r, r.metadata.projectId);
    const ids = getReportPages(r).map((p) => p.id);
    expect(ids.slice(0, 8)).toEqual(['cover', 'executive-summary', 'on-page-seo', 'structured-data', 'technical-seo', 'crawlability', 'core-web-vitals', 'keyword-ranking']);
    expect(ids[ids.length - 1]).toBe('about-odito');
    expect(ids.some((id) => id.startsWith('appendices'))).toBe(false);
    const order = ['accessibility', 'aeo', 'aiso', 'geo', 'recommendations'];
    const first = order.map((o) => ids.findIndex((id) => id === o || id.startsWith(`${o}-`)));
    expect(first.every((k) => k > 7 && k < ids.length - 1)).toBe(true);
    expect([...first].sort((x, y) => x - y)).toEqual(first);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('without a report only the nine original pages are returned', () => {
    expect(getReportPages().length).toBe(9);
  });

  test('every page footer matches the real total (no hardcoded "of 9")', () => {
    const r = clone();
    const pages = getReportPages(r);
    expect(pages.length).toBeGreaterThan(9);
    pages.forEach((p, i) => {
      const t = text(r, p, i, pages.length);
      if (p.id !== 'cover') expect(t, p.id).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(t, p.id).not.toMatch(/of 9\b/);
    });
  });
});

describe('section content from the canonical payload', () => {
  test('AEO, AISO and GEO show their own, distinct scores', () => {
    const r = clone();
    r.sections.aeo.data.score = 31; r.sections.aiso.data.score = 89; r.sections.geo.data.score = 14;
    expect(byPrefix(r, 'aeo')).toMatch(/31AEO Score/);
    expect(byPrefix(r, 'aiso')).toMatch(/89AISO Score/);
    expect(byPrefix(r, 'geo')).toMatch(/14GEO Score/);
    expect(byPrefix(r, 'aeo')).not.toMatch(/AISO Score|GEO Score/);
    expect(byPrefix(r, 'geo')).not.toMatch(/AEO Score|AISO Score/);
  });

  test('a missing hub score renders N/A, never 0', () => {
    const r = clone();
    r.sections.aeo.status = 'partial'; r.sections.aeo.data.score = null;
    expect(byPrefix(r, 'aeo')).toMatch(/N\/AAEO Score/);
  });

  test('not-run, failed and not-configured hubs explain themselves; other hubs are unaffected', () => {
    const r = clone();
    r.sections.aeo = SEC_UNAVAIL('not_run', 'The AEO analysis has not run for this project.');
    r.sections.geo = SEC_UNAVAIL('query_failed', 'GEO hub could not be loaded.');
    expect(byPrefix(r, 'aeo')).toMatch(/has not run/);
    expect(byPrefix(r, 'geo')).toMatch(/could not be loaded/);
    expect(byPrefix(r, 'aiso')).toMatch(/AISO Score/);
    const nc = clone();
    nc.sections.aiso = { ...SEC_UNAVAIL('not_connected', 'Not connected.'), status: 'not_configured' };
    expect(byPrefix(nc, 'aiso')).toMatch(/Not connected/);
  });

  test('accessibility: zero issues, unavailable and populated are distinct; no score or WCAG claim', () => {
    const zero = clone();
    zero.sections.accessibility.data = { ...zero.sections.accessibility.data, totalIssues: 0, issueTypes: 0, bySeverity: {}, topIssues: [], affectedUrls: {} };
    expect(byPrefix(zero, 'accessibility')).toMatch(/found no open accessibility issues/);

    const failed = clone();
    failed.sections.accessibility = SEC_UNAVAIL('query_failed', 'Accessibility service returned no issue list.');
    const ft = byPrefix(failed, 'accessibility');
    expect(ft).toMatch(/Accessibility unavailable/);
    expect(ft).not.toMatch(/found no open accessibility issues/);

    const t = byPrefix(clone(), 'accessibility');
    expect(t).toMatch(/does not produce an accessibility score/);
    expect(t).toMatch(/not a WCAG compliance result/);
    expect(t).toMatch(/Missing focus indicators/);
    expect(t).not.toMatch(/Level AA|WCAG 2/);
  });

  test('recommendations come from the payload; unavailable shows the reason; no outcome promises', () => {
    const r = clone();
    const t = byPrefix(r, 'recommendations');
    expect(t).toMatch(/Prioritised actions/);
    r.sections.recommendations.data.items.slice(0, 3).forEach((it) => expect(t).toContain(it.title));
    expect(t).toMatch(/Nothing here is marked as fixed/);
    expect(t).not.toMatch(/increase traffic|boost rankings|guarantee|revenue/i);

    const u = clone();
    u.sections.recommendations = SEC_UNAVAIL('no_findings_source', 'No findings were available, so no recommendations can be derived.');
    expect(byPrefix(u, 'recommendations')).toMatch(/no recommendations can be derived/);
  });

  test('no AI-platform citation or ranking claims in the new pages', () => {
    const r = clone();
    const all = additionalPages(r).map((p, i) => text(r, p, i)).join(' || ');
    expect(all).not.toMatch(/ChatGPT|Gemini|cited by|citation rate|industry average/i);
    expect(all).not.toMatch(/undefined|NaN|\[object/);
    expect(all).toMatch(/not measured AI-platform citations/);
  });
});

describe('pagination', () => {
  const COLS = [{ key: 'a', label: 'A', width: 0.5 }, { key: 'b', label: 'B', width: 0.5 }];
  const rows = (n, t = 'short', table = 't') => Array.from({ length: n }, (_, i) => tableRow(table, COLS, [{ text: `${i}` }, { text: t }]));

  test('short content stays on one page', () => {
    expect(paginate([heading('H'), ...rows(5)], { firstCapacity: BODY_HEIGHT - LAYOUT.sectionHeaderH }).pages.length).toBe(1);
  });

  test('long tables split across pages without losing a row or exceeding capacity', () => {
    const { pages } = paginate([heading('H'), ...rows(80)], { firstCapacity: 800 });
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'row').length).toBe(80);
    pages.forEach((p, i) => {
      const used = p.blocks.reduce((s, b) => s + b.h + (b.opensTable ? LAYOUT.tableHeaderH : 0), 0);
      expect(used).toBeLessThanOrEqual(i === 0 ? 800 : BODY_HEIGHT - LAYOUT.continuedHeaderH);
    });
  });

  test('every page with rows opens its table (header repeats); continuation is flagged', () => {
    const { pages } = paginate([heading('H'), ...rows(80)], { firstCapacity: 800 });
    pages.forEach((p) => expect(p.blocks.find((b) => b.kind === 'row').opensTable).toBe(true));
    expect(pages[1].continuedTables).toEqual(['t']);
    expect(pages[0].continuesTable).toBe('t');
    expect(pages[pages.length - 1].continuesTable).toBeNull();
  });

  test('a heading is never stranded at the bottom of a page', () => {
    const blocks = [...rows(14, 'x'), heading('Next table'), ...rows(3, 'x', 'u')];
    const { pages } = paginate(blocks, { firstCapacity: 14 * 40 + 60 + LAYOUT.tableHeaderH });
    pages.forEach((p) => expect(p.blocks[p.blocks.length - 1].kind).not.toBe('heading'));
  });

  test('long text is estimated taller; an oversized block is still placed, never dropped', () => {
    const tall = tableRow('t', COLS, [{ text: 'a' }, { text: 'word '.repeat(400) }]);
    const short = tableRow('t', COLS, [{ text: 'a' }, { text: 'word' }]);
    expect(tall.h).toBeGreaterThan(short.h * 5);
    expect(paginate([{ ...tall, h: 5000 }], { firstCapacity: 100 }).pages.flatMap((p) => p.blocks).length).toBe(1);
    expect(textBlock('x').h).toBeGreaterThan(0);
  });

  test('more data means more pages (variable totals) with unique ids', () => {
    const big = clone();
    const tpl = big.sections.accessibility.data.topIssues[0];
    big.sections.accessibility.data.topIssues = Array.from({ length: 25 }, (_, i) => ({ ...tpl, issueCode: `c${i}`, title: `Finding ${i} ${'long title '.repeat(8)}` }));
    const ids = getReportPages(big).map((p) => p.id);
    expect(ids.length).toBeGreaterThan(getReportPages(clone()).length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('Recommendations is always a single page: the top items that fit, with no continuation pages', () => {
    const big = clone();
    const tpl = big.sections.recommendations.data.items[0];
    big.sections.recommendations.data.items = Array.from({ length: 25 }, (_, i) => ({ ...tpl, ruleId: `r${i}`, title: `Finding ${i}`, whyItMatters: 'w '.repeat(150), action: 'a '.repeat(150) }));
    big.sections.recommendations.data.totalCandidates = 60;
    const recPages = getReportPages(big).filter((p) => p.id.startsWith('recommendations'));
    expect(recPages.length).toBe(1);
    const t = text(big, recPages[0]);
    expect(t).not.toMatch(/continued/i);
    expect(t).toMatch(/Showing the top [0-9]+ of 60 finding/);
    expect(t).toContain('Finding 0');
  });
});

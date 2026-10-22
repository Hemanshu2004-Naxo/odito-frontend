import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect, vi } from 'vitest';

// Page components read the API base URL at import time.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:0/api';
});
import { render, screen } from '@testing-library/react';

import { getReportPages } from './reportPages';
import { ReportMetaProvider, formatReportDate, extractDomain } from './reportMeta';
import { PageHeader, PageFooter } from './components/layout';

describe('Full Website Audit page list (Phase 0)', () => {
  const pages = getReportPages();

  test('contains only the intended report pages, in order', () => {
    expect(pages.map((p) => p.id)).toEqual([
      'cover',
      'executive-summary',
      'on-page-seo',
      'structured-data',
      'technical-seo',
      'crawlability',
      'core-web-vitals',
      'keyword-ranking',
      'about-odito',
    ]);
  });

  test('has no section dividers and unique ids/names', () => {
    expect(pages.some((p) => /divider/i.test(p.id))).toBe(false);
    expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.name)).size).toBe(pages.length);
  });

  test('no page waits on a readiness signal: all data comes from the one canonical report in context', () => {
    expect(pages.every((p) => p.needsData === false)).toBe(true);
  });
});

describe('PageHeader / PageFooter metadata', () => {
  test('use the supplied domain, dates, page number and total', () => {
    render(
      <ReportMetaProvider
        value={{ page: 3, total: 9, domain: 'example.org', auditDate: 'May 2, 2026', generated: 'May 3, 2026' }}
      >
        <PageHeader page={99} />
        <PageFooter page={99} />
      </ReportMetaProvider>
    );
    expect(screen.getByText(/p\.3\/9/)).toBeTruthy();
    expect(screen.getByText('Page 3 of 9')).toBeTruthy();
    expect(screen.getByText(/Audit date: May 2, 2026/)).toBeTruthy();
    expect(screen.getByText(/Generated: May 3, 2026/)).toBeTruthy();
    expect(screen.getAllByText(/example\.org/).length).toBeGreaterThan(0);
  });

  test('never fall back to a hardcoded domain, date or total', () => {
    const { container } = render(
      <>
        <PageHeader page={2} />
        <PageFooter page={2} />
      </>
    );
    const text = container.textContent;
    expect(text).not.toMatch(/agencyplatform/i);
    expect(text).not.toMatch(/March 13, 2025/);
    expect(text).not.toMatch(/of 31/);
  });

  test('date and domain helpers do not invent values', () => {
    expect(formatReportDate(null)).toBeNull();
    expect(formatReportDate('not a date')).toBeNull();
    expect(extractDomain(undefined)).toBeNull();
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
  });
});

describe('active PDF sources contain no fabricated customer-facing content', () => {
  const root = path.resolve(__dirname);
  const files = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name === 'homepage-audit') continue; // separate product
        walk(full);
      } else if (/\.jsx?$/.test(f.name) && !/\.test\./.test(f.name)) files.push(full);
    }
  };
  walk(root);

  const banned = [
    /agencyplatform/i,
    /March 13, 2025/,
    /12% vs 43%/,
    /seo audit software/i,
    /Citation Rate/,
    /industry avg/i,
    /\+\d+ pts/,
    /312 pages/,
    /Fix \d+ broken internal links/,
    /\b47 pages\b/,
    /\b31 images\b/,
    /White-Label Reports/,
  ];

  test.each(banned.map((b) => [String(b), b]))('no match for %s', (_label, re) => {
    const hits = files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    expect(hits).toEqual([]);
  });
});

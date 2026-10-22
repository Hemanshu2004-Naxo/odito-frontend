import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getReportPages } from './reportPages';
import { ReportMetaProvider, CanonicalReportProvider, formatReportDate } from './reportMeta';
import { PAGE_WIDTH, PAGE_HEIGHT } from './pageSize';

/**
 * Server-side rendering entry for the Full Audit PDF.
 *
 * Bundled (scripts/build-pdf-renderer.mjs) into a single CommonJS file the
 * backend loads, so the backend renders the SAME page components the report has
 * always used - straight from the canonical report object, with no HTTP hop, no
 * auth token and no public render route. The output is one self-contained HTML
 * document; Chromium prints it to PDF with `@page { size: A4 }`.
 *
 * Each page is a PAGE_WIDTH x PAGE_HEIGHT design canvas scaled to exactly one A4
 * sheet (210 x 297 mm).
 */

const A4_WIDTH_PX = (210 / 25.4) * 96; // 793.7 CSS px
const SCALE = A4_WIDTH_PX / PAGE_WIDTH;

const BASE_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif !important; }
html, body { background: #fff; color: #111827; -webkit-font-smoothing: antialiased; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, h4, h5, h6 { font-family: 'Inter', system-ui, sans-serif; }
.font-loaded .letter-spacing-neg1 { letter-spacing: -1px; }
.font-loaded .letter-spacing-neg10 { letter-spacing: -10px; }
.font-loaded .letter-spacing-1 { letter-spacing: 1px; }
.font-loaded .letter-spacing-2 { letter-spacing: 2px; }
.sheet { width: 210mm; height: 296.8mm; overflow: hidden; position: relative; break-after: page; page-break-after: always; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.canvas { width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT + 1}px; overflow: hidden; transform: scale(${SCALE}); transform-origin: 0 0; display: flex; flex-direction: column; }
.canvas > * { flex: 1 0 auto; box-shadow: none !important; }
`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object} report  canonical report (already validated by the backend)
 * @param {{ fontCss?: string, generatedAt?: Date|string }} [opts]
 * @returns {{ html: string, pageCount: number, pageIds: string[] }}
 */
export function renderReportDocument(report, { fontCss = '', generatedAt = new Date() } = {}) {
  const pages = getReportPages(report);
  const total = pages.length;
  const domain = report.metadata?.domain || null;
  const auditDate = formatReportDate(report.metadata?.auditDate);
  const generated = formatReportDate(generatedAt);

  const sheets = pages.map((p, i) => {
    const markup = renderToStaticMarkup(
      <CanonicalReportProvider report={report}>
        <ReportMetaProvider value={{ page: i + 1, total, domain, auditDate, generated }}>
          {p.element}
        </ReportMetaProvider>
      </CanonicalReportProvider>
    );
    return `<section class="sheet" data-page="${i + 1}" data-page-id="${esc(p.id)}"><div class="canvas">${markup}</div></section>`;
  });

  const title = esc(`Odito Full Audit - ${domain || 'report'}`);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${fontCss}${BASE_CSS}</style></head><body><div id="root" class="font-loaded" data-report-ready="true" data-page-count="${total}">${sheets.join('')}</div></body></html>`;
  return { html, pageCount: total, pageIds: pages.map((p) => p.id) };
}

import React from 'react';

import CoverPage from './components/sections/Page01Cover';
import ExecutiveSummaryPage from './components/sections/Page03ExecutiveSummary';
import OnPageSEOPage from './components/sections/Page08OnPageSEO';
import { StructuredDataPage, TechnicalSEOPage, CrawlabilityPage } from './components/sections/Pages09_10_11';
import { CoreWebVitalsPage } from './components/sections/Pages13_14';
import { KeywordRankingPage } from './components/sections/Pages16_17';
import AboutOditoPage from './components/sections/Page30About';
import { additionalPages } from './sectionPages';

/**
 * Single source of truth for the pages of the Full Website Audit PDF, shared
 * by the Export button (services/pdfGeneratorService.js) and the server-side
 * render route (app/project/[projectId]/report/page.jsx).
 *
 * Only pages backed by real audit data (or truthful static text) belong here.
 * Every data page reads the canonical report from context (one request made by
 * the caller), so no page fetches on its own and none needs to wait for a
 * readiness signal (`needsData: false`).
 *
 * Removed in Phase 0 (hardcoded sample content, no data source, or calling
 * endpoints that do not exist): section dividers, Key Strengths, Priority
 * Roadmap, SEO Health Overview, Performance Opportunities, Keyword
 * Opportunity, AI Visibility Overview, LLM Visibility, LLM Citation Forecast,
 * AI Content Readiness, AI Content Strategy, Knowledge Graph, AI
 * Optimisation, Growth Forecast, 30-Day Action Plan, Audit Methodology.
 */
/**
 * The first eight pages are fixed and About Odito is always last. When a canonical report is supplied, the
 * Accessibility, AEO, AISO, GEO, Recommendations and Appendices pages follow;
 * long sections paginate, so the total page count depends on the report.
 */
export function getReportPages(report = null) {
  const core = [
    { id: 'cover', name: 'Cover Page', needsData: false, element: <CoverPage /> },
    { id: 'executive-summary', name: 'Executive Summary', needsData: false, element: <ExecutiveSummaryPage /> },
    { id: 'on-page-seo', name: 'On-Page SEO', needsData: false, element: <OnPageSEOPage /> },
    { id: 'structured-data', name: 'Structured Data', needsData: false, element: <StructuredDataPage /> },
    { id: 'technical-seo', name: 'Technical SEO', needsData: false, element: <TechnicalSEOPage /> },
    { id: 'crawlability', name: 'Crawlability', needsData: false, element: <CrawlabilityPage /> },
    { id: 'core-web-vitals', name: 'Core Web Vitals', needsData: false, element: <CoreWebVitalsPage /> },
    { id: 'keyword-ranking', name: 'Keyword Ranking', needsData: false, element: <KeywordRankingPage /> },
    { id: 'about-odito', name: 'About Odito', needsData: false, element: <AboutOditoPage /> },
  ];
  // About Odito is always the last page: with a report it follows the added sections.
  if (!report) return core;
  const about = core[core.length - 1];
  return [...core.slice(0, -1), ...additionalPages(report), about];
}

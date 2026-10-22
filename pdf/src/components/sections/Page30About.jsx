'use client';

import React, { useEffect } from 'react';
import { PAGE_HEIGHT } from '../../pageSize';
import { PageHeader, PageFooter, SectionHeader } from '../layout';

const features = [
  { title: 'SEO Audit', desc: 'Site crawl with on-page and technical SEO checks, grouped by severity', color: '#F59E0B' },
  { title: 'Accessibility Checks', desc: 'Accessibility issues detected across crawled pages', color: '#10B981' },
  { title: 'PageSpeed', desc: 'Desktop and mobile Lighthouse results, including Core Web Vitals', color: '#10B981' },
  { title: 'Keyword Tracking', desc: 'Tracked keyword positions for your target locations', color: '#F59E0B' },
  { title: 'AI Search Readiness', desc: 'On-site AEO, GEO and AISO checks that assess how ready your content is for AI search', color: '#00D4FF' },
  { title: 'Structured Data', desc: 'Schema markup coverage and errors across crawled pages', color: '#4F6EF7' },
];

export default function AboutOditoPage() {
  useEffect(() => {
    
    // Register component with global ready system
    if (typeof window !== 'undefined' && window.__PDF_REGISTER_COMPONENT__) {
      window.__PDF_REGISTER_COMPONENT__('about-odito', 'About Odito');
    }
    
    // This component doesn't fetch data, so mark as ready immediately
    if (typeof window !== 'undefined' && window.__PDF_SET_READY__) {
      window.__PDF_SET_READY__('about-odito', true, 'About Odito');
    }
  }, []);
  return (
    <div style={{
      width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex',
      flexDirection: 'column', boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
      margin: '0 auto', fontFamily: "'DM Sans', sans-serif"
    }}>
      <PageHeader page={30} />
      <div style={{ padding: '32px 40px', flex: 1 }}>
        <SectionHeader num="14" title="About Odito AI" subtitle="SEO and AI search readiness auditing" />

        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>
          About This Report
        </h2>
        <div style={{ borderBottom: '2px solid #E5E7EB', marginBottom: 20 }} />

        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 32, maxWidth: 700 }}>
          Odito AI audits a website for traditional SEO health and on-site readiness for AI search. This report summarises the audit data available for the website named on each page at the time the report was generated. Scores and counts reflect the pages that were crawled and the checks that were run; sections without data are shown as unavailable rather than estimated.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          {features.map(({ title, desc, color }) => (
            <div key={title} style={{
              border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px 20px',
              display: 'flex', gap: 14, alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 18, color, marginTop: 2 }}>✦</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
      <PageFooter page={30} />
    </div>
  );
}

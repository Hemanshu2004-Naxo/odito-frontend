import React from 'react';
import BlockPage from './components/sections/BlockPage';
import { Badge, StatCard, UnavailableSection, Caption, PageHeader, PageFooter, SectionHeader } from './components/layout';
import { PAGE_HEIGHT } from './pageSize';
import { paginate, tableRow, heading, textBlock, BODY_HEIGHT, LAYOUT } from './pagination';
import { formatReportDate } from './reportMeta';
import { unavailableText } from './reportViewModels';

/**
 * Pages added after the original nine: Accessibility, AEO, AISO, GEO,
 * Recommendations and Appendices. Every value comes from the canonical report
 * (report.sections.*); a section that is unavailable renders its reason, never
 * zeros. Long content is paginated by pagination.js.
 */

const AVAILABLE = new Set(['available', 'partial']);
const hasData = (s) => !!s && AVAILABLE.has(s.status) && !!s.data;
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const show = (v, suffix = '') => (v === null || v === undefined ? 'N/A' : `${v}${suffix}`);
const sevType = { critical: 'critical', high: 'high', medium: 'medium', warning: 'medium', low: 'low', info: 'low' };
const sevLabel = (s) => (s ? String(s).toUpperCase() : 'N/A');
const SevBadge = ({ severity }) => <Badge label={sevLabel(severity)} type={sevType[String(severity || '').toLowerCase()] || 'info'} />;
const trunc = (u, max = 70) => (u && u.length > max ? `${u.slice(0, max - 1)}…` : u);

const KICKER = 'On-site readiness checks. These are not measured AI-platform citations, mentions or rankings.';

// ── Generic section builder ──────────────────────────────────────────────────

function buildSection({ id, name, num, title, subtitle, intro = null, introH = 0, blocks = [] }) {
  const firstCapacity = BODY_HEIGHT - LAYOUT.sectionHeaderH - introH;
  const { pages } = paginate(blocks, { firstCapacity, capacity: BODY_HEIGHT - LAYOUT.continuedHeaderH });
  return pages.map((page, i) => ({
    id: pages.length > 1 ? `${id}-${i + 1}` : id,
    name: pages.length > 1 ? `${name} (${i + 1}/${pages.length})` : name,
    needsData: false,
    element: (
      <BlockPage num={num} title={title} subtitle={subtitle} isFirst={i === 0} intro={intro} page={page} />
    ),
  }));
}

/** A one-page section stating why data is missing. */
function unavailablePage({ id, name, num, title, subtitle, vm, label }) {
  return [{
    id, name, needsData: false,
    element: (
      <div style={{ width: 960, minHeight: PAGE_HEIGHT, background: '#fff', display: 'flex', flexDirection: 'column', margin: '0 auto', boxShadow: '0 4px 40px rgba(0,0,0,0.12)', fontFamily: "'DM Sans', sans-serif" }}>
        <PageHeader />
        <div style={{ padding: '32px 40px', flex: 1 }}>
          <SectionHeader num={num} title={title} subtitle={subtitle} />
          <UnavailableSection title={`${label} unavailable`} message={unavailableText(vm, label)} tone={vm.status === 'not_configured' ? 'neutral' : 'warn'} />
        </div>
        <PageFooter />
      </div>
    ),
  }];
}

const meta = (s) => ({ status: s?.status ?? 'unavailable', reason: s?.reason ?? null, message: s?.message ?? null });

const grid = (cols) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, marginBottom: 20 });
const CARD_H = 150;

// ── Accessibility ────────────────────────────────────────────────────────────

const A11Y_COLS = [
  { key: 'issue', label: 'Finding', width: 0.46 },
  { key: 'sev', label: 'Severity', width: 0.14 },
  { key: 'pages', label: 'Pages affected', width: 0.14 },
  { key: 'pct', label: '% of pages', width: 0.12 },
  { key: 'diff', label: 'Fix difficulty', width: 0.14 },
];

export function accessibilityPages(report) {
  const s = report.sections.accessibility;
  const base = { id: 'accessibility', name: 'Accessibility', num: '09', title: 'Accessibility', subtitle: 'Accessibility issues found by the audit crawl' };
  if (!hasData(s)) return unavailablePage({ ...base, vm: meta(s), label: 'Accessibility' });
  const d = s.data;
  const sev = d.bySeverity || {};
  const high = (sev.critical || 0) + (sev.high || 0);
  const med = (sev.medium || 0) + (sev.warning || 0);
  const low = (sev.low || 0) + (sev.info || 0);

  const ps = report.sections.pageSpeed;
  const lh = hasData(ps)
    ? { desktop: n(ps.data.desktop?.scores?.accessibility), mobile: n(ps.data.mobile?.scores?.accessibility) }
    : null;

  const intro = (
    <>
      <div style={grid(4)}>
        <StatCard value={show(n(d.totalIssues))} label="Open Findings" sub="Distinct open issues" color="#8B5CF6" borderColor="#8B5CF6" />
        <StatCard value={high} label="Critical / High" sub="Critical + high severity" color="#EF4444" borderColor="#EF4444" />
        <StatCard value={med} label="Medium" sub="Medium severity" color="#EAB308" borderColor="#EAB308" />
        <StatCard value={show(n(d.pagesAnalyzed))} label="Pages Analyzed" sub={`${d.issueTypes ?? 0} finding types`} color="#3B82F6" borderColor="#3B82F6" />
      </div>
      <Caption>
        Odito's accessibility scan reports findings only: it does not produce an accessibility score and does not map findings to WCAG criteria
        {low ? ` (${low} low-severity finding(s) not shown separately)` : ''}.
        {lh && (lh.desktop !== null || lh.mobile !== null)
          ? ` Lighthouse's separate accessibility category scored desktop ${show(lh.desktop, '/100')} and mobile ${show(lh.mobile, '/100')} (automated checks only; not a WCAG compliance result).`
          : ''}
      </Caption>
      <div style={{ height: 16 }} />
    </>
  );
  const introH = CARD_H + 60;

  const blocks = [];
  if (d.totalIssues === 0 || (d.topIssues || []).length === 0) {
    blocks.push(textBlock('The accessibility scan completed and found no open accessibility issues on the crawled pages. This reflects the automated checks Odito runs; it is not a full manual accessibility audit.'));
  } else {
    blocks.push(heading('Findings'));
    for (const i of d.topIssues) {
      const ev = d.affectedUrls?.[i.issueCode];
      const examples = (ev?.sample || []).slice(0, 2).map((u) => trunc(u.url)).join('  ·  ');
      const text = `${i.title}${examples ? `\nExample: ${examples}` : ''}`;
      blocks.push(tableRow('a11y', A11Y_COLS, [
        { text, node: <><div style={{ fontWeight: 600, color: '#111827' }}>{i.title}</div>{examples && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, wordBreak: 'break-all' }}>Example: {examples}</div>}</> },
        { text: sevLabel(i.severity), node: <SevBadge severity={i.severity} /> },
        { text: String(i.pagesAffected ?? 'N/A') },
        { text: i.impactPercentage == null ? 'N/A' : `${i.impactPercentage}%` },
        { text: i.difficulty || 'N/A', node: <span style={{ textTransform: 'capitalize' }}>{i.difficulty || 'N/A'}</span> },
      ]));
    }
    if ((d.issueTypes || 0) > d.topIssues.length) blocks.push(textBlock(`Showing the ${d.topIssues.length} highest-priority of ${d.issueTypes} finding types.`));
    blocks.push(textBlock('Finding rows are per rule and location, as in the dashboard, so a rule can appear more than once. Recommended actions are in the Recommendations section.'));
  }
  if (s.status === 'partial') blocks.push(textBlock(`Some detail could not be loaded: ${s.message}`));
  return buildSection({ ...base, intro, introH, blocks });
}

// ── AI hubs ──────────────────────────────────────────────────────────────────

const dateOrNA = (d) => formatReportDate(d) || 'N/A';
const shortDate = (d) => { const t = d ? new Date(d) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'; };
const cap = (str) => (str ? String(str).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'N/A');
const statusColor = (st) => {
  const k = String(st || '').toLowerCase();
  if (['pass', 'optimal', 'ok'].includes(k)) return '#10B981';
  if (['warning', 'needs work', 'partial'].includes(k)) return '#F59E0B';
  if (['fail', 'critical'].includes(k)) return '#EF4444';
  return '#6B7280';
};
const Status = ({ v }) => <span style={{ color: statusColor(v), fontWeight: 600 }}>{cap(v)}</span>;
const scoreColor = (v) => (v === null ? '#9CA3AF' : v >= 70 ? '#10B981' : v >= 40 ? '#F59E0B' : '#EF4444');

const FINDING_COLS = [
  { key: 'rule', label: 'Finding', width: 0.30 },
  { key: 'sev', label: 'Severity', width: 0.12 },
  { key: 'pages', label: 'Pages', width: 0.09 },
  { key: 'action', label: 'Recommended action (from the audit)', width: 0.49 },
];

function findingBlocks(table, issues) {
  if (!issues) return [textBlock('Rule-level findings could not be loaded for this section.')];
  if (issues.length === 0) return [textBlock('No rule-level findings were reported.')];
  return [
    heading('Findings and recommended actions'),
    ...issues.map((i) => tableRow(table, FINDING_COLS, [
      { text: `${i.title}\n${i.ruleId || ''}`, node: <><div style={{ fontWeight: 600, color: '#111827' }}>{i.title}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>{[i.ruleId, i.card && cap(i.card)].filter(Boolean).join(' · ')}</div></> },
      { text: sevLabel(i.severity), node: <SevBadge severity={i.severity} /> },
      { text: String(i.pagesAffected ?? 'N/A') },
      { text: i.recommendation || 'No recommendation provided by the audit.' },
    ])),
  ];
}

const HUB_BASE = {
  aeo: { id: 'aeo', name: 'AEO', num: '10', title: 'AEO — Answer Engine Optimization', subtitle: 'How well content is structured to be extracted as a direct answer', label: 'AEO' },
  aiso: { id: 'aiso', name: 'AISO', num: '11', title: 'AISO — AI Search Optimization', subtitle: 'How accessible and citable the site is to AI search systems', label: 'AISO' },
  geo: { id: 'geo', name: 'GEO', num: '12', title: 'GEO — Generative Engine Optimization', subtitle: 'Entity, knowledge-graph and brand signals used by generative engines', label: 'GEO' },
};

function hubIntro(hub, d, cards, s) {
  return (
    <>
      <div style={grid(cards.length)}>
        {cards.map(([label, value, sub, color]) => (
          <StatCard key={label} value={value} label={label} sub={sub} color={color} borderColor={color} />
        ))}
      </div>
      <Caption>
        {KICKER} Assessed {dateOrNA(d.computedAt)} on {show(d.pagesScored)} page(s)
        {s.snapshotRelation === 'after_run' ? '; this may be newer than the selected audit run' : ''}.
        {s.status === 'partial' ? ` ${s.message}` : ''}
      </Caption>
      <div style={{ height: 16 }} />
    </>
  );
}

export function aeoPages(report) {
  const s = report.sections.aeo;
  const b = HUB_BASE.aeo;
  if (!hasData(s)) return unavailablePage({ ...b, vm: meta(s) });
  const d = s.data;
  const intro = hubIntro('aeo', d, [
    ['AEO Score', show(d.score), 'Answer-readiness score', scoreColor(d.score)],
    ['Pages Scored', show(d.pagesScored), 'Pages assessed', '#4F6EF7'],
    ['Rule Findings', show(d.issueDistribution?.total), 'All severities', '#8B5CF6'],
    ['Assessed', shortDate(d.computedAt), 'Hub run date', '#6B7280'],
  ], s);
  const CARD = [{ key: 'c', label: 'Category', width: 0.34 }, { key: 's', label: 'Score', width: 0.16 }, { key: 'st', label: 'Status', width: 0.2 }, { key: 'f', label: 'Failed checks', width: 0.3 }];
  const SIG = [{ key: 'sig', label: 'Signal (rule)', width: 0.34 }, { key: 'st', label: 'Result', width: 0.16 }, { key: 'pf', label: 'Pages failing', width: 0.2 }, { key: 'ap', label: 'Applicable pages', width: 0.3 }];
  const KV = [{ key: 'k', label: 'Measure', width: 0.6 }, { key: 'v', label: 'Value', width: 0.4 }];
  const SIGNAL_NAMES = { direct_answer: 'Direct answer in opening', question_h2: 'Question-style headings', faq_schema: 'FAQ schema', howto_schema: 'HowTo schema', speakable_schema: 'Speakable schema' };
  const st = d.structure || {};
  const blocks = [
    heading('Score by category'),
    ...Object.entries(d.cards || {}).map(([k, c]) => tableRow('aeo-cards', CARD, [
      { text: cap(k) }, { text: show(c?.score), node: <b style={{ color: scoreColor(n(c?.score)) }}>{show(c?.score)}</b> },
      { text: cap(c?.status), node: <Status v={c?.status} /> }, { text: show(c?.failedChecks) },
    ])),
    heading('Answer signals'),
    ...(d.signals || []).map((x) => tableRow('aeo-signals', SIG, [
      { text: `${SIGNAL_NAMES[x.key] || cap(x.key)} (${x.ruleId || 'n/a'})` }, { text: cap(x.status), node: <Status v={x.status} /> },
      { text: show(x.pagesFailing) }, { text: show(x.applicablePages) },
    ])),
    heading('Content structure'),
    tableRow('aeo-kv', KV, [{ text: 'Question-style H2 headings / all H2 headings' }, { text: `${show(st.questionHeadings)} / ${show(st.totalH2)}` }]),
    tableRow('aeo-kv', KV, [{ text: 'Pages with FAQ schema' }, { text: show(st.pagesWithFaqSchema) }]),
    tableRow('aeo-kv', KV, [{ text: 'FAQ entries in schema vs visible on page' }, { text: `${show(st.schemaQaTotal)} vs ${show(st.visibleQaTotal)}` }]),
    tableRow('aeo-kv', KV, [{ text: 'Pages with speakable markup' }, { text: `${show(st.pagesWithSpeakable)} (${show(st.speakableCoveragePercent, '%')})` }]),
  ];
  if ((d.faqOpportunities || []).length) {
    const FAQ = [{ key: 'q', label: 'Question', width: 0.38 }, { key: 'st', label: 'State', width: 0.16 }, { key: 'u', label: 'Pages', width: 0.1 }, { key: 'r', label: 'Recommendation', width: 0.36 }];
    blocks.push(heading('FAQ opportunities'));
    for (const o of d.faqOpportunities) blocks.push(tableRow('aeo-faq', FAQ, [{ text: o.question || 'N/A' }, { text: cap(o.status) }, { text: show(o.affectedUrlCount) }, { text: o.recommendation || 'N/A' }]));
  }
  blocks.push(...findingBlocks('aeo-findings', d.issues));
  return buildSection({ ...b, intro, introH: CARD_H + 70, blocks });
}

export function aisoPages(report) {
  const s = report.sections.aiso;
  const b = HUB_BASE.aiso;
  if (!hasData(s)) return unavailablePage({ ...b, vm: meta(s) });
  const d = s.data;
  const h = d.hero || {};
  const intro = hubIntro('aiso', d, [
    ['AISO Score', show(d.score), 'Overall AI-search readiness', scoreColor(d.score)],
    ['Crawlability', show(h.crawlability), 'Bot access & fetchability', scoreColor(n(h.crawlability))],
    ['Citability', show(h.citability), 'Quotable structure', scoreColor(n(h.citability))],
    ['Authority', show(h.authority), 'Trust signals', scoreColor(n(h.authority))],
    ['Coverage', show(h.coverage), 'Topic & page coverage', scoreColor(n(h.coverage))],
  ], s);
  const CARD = [{ key: 'c', label: 'Category', width: 0.25 }, { key: 's', label: 'Score', width: 0.15 }, { key: 'e', label: 'Checks run', width: 0.2 }, { key: 'p', label: 'Passed', width: 0.2 }, { key: 'f', label: 'Failed', width: 0.2 }];
  const BOT = [{ key: 'b', label: 'AI crawler / file', width: 0.5 }, { key: 'r', label: 'Check result', width: 0.5 }];
  const BOT_NAMES = { gptbot: 'GPTBot', claudebot: 'ClaudeBot', perplexitybot: 'PerplexityBot', google_extended: 'Google-Extended', bingbot: 'Bingbot', llms_txt: 'llms.txt' };
  const blocks = [heading('Score by category'),
    ...Object.entries(d.cards || {}).map(([k, c]) => tableRow('aiso-cards', CARD, [
      { text: cap(k) }, { text: show(c?.score), node: <b style={{ color: scoreColor(n(c?.score)) }}>{show(c?.score)}</b> },
      { text: show(c?.checksExecuted) }, { text: show(c?.passed) }, { text: show(c?.failed) },
    ]))];
  if (d.bots) {
    blocks.push(heading('AI crawler access'));
    for (const [k, v] of Object.entries(d.bots)) blocks.push(tableRow('aiso-bots', BOT, [{ text: BOT_NAMES[k] || k }, { text: cap(v), node: <Status v={v} /> }]));
    blocks.push(textBlock('Results come from Odito\'s robots.txt / llms.txt checks. They show whether these crawlers can access the site, not whether any AI platform has used or cited it.'));
  }
  blocks.push(...findingBlocks('aiso-findings', d.issues));
  return buildSection({ ...b, intro, introH: CARD_H + 70, blocks });
}

export function geoPages(report) {
  const s = report.sections.geo;
  const b = HUB_BASE.geo;
  if (!hasData(s)) return unavailablePage({ ...b, vm: meta(s) });
  const d = s.data;
  const intro = hubIntro('geo', d, [
    ['GEO Score', show(d.score), 'Entity & brand readiness', scoreColor(d.score)],
    ['Entity Trust Grade', d.entityTrustGrade ?? 'N/A', 'Grade supplied by the hub', '#4F6EF7'],
    ['Validated Entities', show(d.validatedEntities), 'Entities confirmed', '#10B981'],
    ['Missing Links', show(d.missingLinks), 'Entity links not found', '#F59E0B'],
  ], s);
  const KG = [{ key: 'l', label: 'Signal', width: 0.4 }, { key: 's', label: 'Score', width: 0.2 }, { key: 'p', label: 'Passed', width: 0.2 }, { key: 'f', label: 'Failed', width: 0.2 }];
  const VAL = [{ key: 'l', label: 'Check', width: 0.26 }, { key: 'st', label: 'Result', width: 0.12 }, { key: 'pf', label: 'Pages failing / applicable', width: 0.18 }, { key: 'd', label: 'Detail', width: 0.44 }];
  const SC = [{ key: 't', label: 'Schema type', width: 0.3 }, { key: 'a', label: 'Applicable pages', width: 0.2 }, { key: 'w', label: 'With schema', width: 0.2 }, { key: 'c', label: 'Coverage', width: 0.3 }];
  const OP = [{ key: 'p', label: 'Priority', width: 0.14 }, { key: 't', label: 'Opportunity', width: 0.3 }, { key: 'd', label: 'Why it matters', width: 0.56 }];
  const blocks = [];
  if ((d.cards || []).length) {
    blocks.push(heading('Knowledge-graph signals'));
    for (const c of d.cards) blocks.push(tableRow('geo-kg', KG, [{ text: c.label || c.id }, { text: show(c.score), node: <b style={{ color: scoreColor(c.score) }}>{show(c.score)}</b> }, { text: show(c.passed) }, { text: show(c.failed) }]));
  }
  if ((d.validation || []).length) {
    blocks.push(heading('Entity validation checks'));
    for (const v of d.validation) blocks.push(tableRow('geo-val', VAL, [{ text: v.label || v.id }, { text: cap(v.status), node: <Status v={v.status} /> }, { text: `${show(v.pagesFailing)} / ${show(v.applicablePages)}` }, { text: v.description || '' }]));
  }
  if ((d.schemaCoverage || []).length) {
    blocks.push(heading('Entity schema coverage'));
    for (const c of d.schemaCoverage) blocks.push(tableRow('geo-sc', SC, [{ text: c.schemaType }, { text: show(c.applicablePages) }, { text: show(c.pagesWithSchema) }, { text: show(c.coveragePercent, '%') }]));
  }
  if ((d.opportunities || []).length) {
    blocks.push(heading('Opportunities'));
    for (const o of d.opportunities) blocks.push(tableRow('geo-op', OP, [{ text: cap(o.priority), node: <SevBadge severity={o.priority} /> }, { text: o.title || '' }, { text: o.description || '' }]));
  }
  blocks.push(...findingBlocks('geo-findings', d.issues));
  return buildSection({ ...b, intro, introH: CARD_H + 70, blocks });
}

// ── Recommendations ──────────────────────────────────────────────────────────

const REC_COLS = [
  { key: 'n', label: '#', width: 0.05 },
  { key: 'rec', label: 'Recommendation', width: 0.31 },
  { key: 'sev', label: 'Priority (severity)', width: 0.12 },
  { key: 'pg', label: 'Pages', width: 0.08 },
  { key: 'act', label: 'Why it matters and recommended action', width: 0.44 },
];

export function recommendationsPages(report) {
  const s = report.sections.recommendations;
  const base = { id: 'recommendations', name: 'Recommendations', num: '13', title: 'Recommendations', subtitle: 'Prioritised from the findings in this report' };
  if (!hasData(s)) return unavailablePage({ ...base, vm: meta(s), label: 'Recommendations' });
  const d = s.data;
  const rowFor = (it, idx) => {
    const action = it.action || (it.expectedValue ? `Expected: ${it.expectedValue}` : 'No remediation guidance is stored for this finding.');
    const why = it.whyItMatters ? `${it.whyItMatters}
` : '';
    return tableRow('recs', REC_COLS, [
      { text: String(idx + 1) },
      { text: `${it.title}
${it.sourceLabel} ${it.ruleId || ''} ${it.category || ''}`, node: <><div style={{ fontWeight: 600, color: '#111827' }}>{it.title}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>{[it.sourceLabel, it.ruleId, it.category].filter(Boolean).join(' · ')}</div></> },
      { text: sevLabel(it.severity), node: <SevBadge severity={it.severity} /> },
      { text: show(it.pagesAffected) },
      { text: `${why}${action}`, node: <>{it.whyItMatters && <div style={{ color: '#6B7280', marginBottom: 4 }}>{it.whyItMatters}</div>}<div style={{ color: it.action || it.expectedValue ? '#111827' : '#9CA3AF' }}>{action}</div></> },
    ], { minH: 52 });
  };
  const introFor = (shown) => (
    <Caption>
      {d.basis} Showing the top {shown} of {d.totalCandidates} finding(s); the full list is in the dashboard.
      {s.status === 'partial' ? ` ${s.message}` : ''} Nothing here is marked as fixed: fixes are only confirmed by a later audit.
    </Caption>
  );

  // The Recommendations section is a single page: keep the highest-priority items that fit.
  const rows = d.items.map(rowFor);
  const capacity = BODY_HEIGHT - LAYOUT.sectionHeaderH - 70 - heading('x').h - LAYOUT.tableHeaderH;
  let used = 0;
  let fit = 0;
  for (const r of rows) { if (used + r.h > capacity) break; used += r.h; fit += 1; }
  fit = Math.max(fit, Math.min(1, rows.length)); // always show at least the top item
  const blocks = rows.length === 0
    ? [textBlock('No open findings were available to derive recommendations from.')]
    : [heading('Prioritised actions'), ...rows.slice(0, fit)];
  return buildSection({ ...base, intro: introFor(fit), introH: 70, blocks });
}

// ── Appendices ───────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  executiveSummary: 'Executive summary', onPageSeo: 'On-page SEO', technicalSeo: 'Technical SEO', accessibility: 'Accessibility',
  pageSpeed: 'PageSpeed', keywords: 'Keywords', searchConsole: 'Search Console', aeo: 'AEO', geo: 'GEO', aiso: 'AISO',
  progress: 'Progress', recommendations: 'Recommendations',
};

export function appendixPages(report) {
  const m = report.metadata;
  const KV = [{ key: 'k', label: 'Item', width: 0.3 }, { key: 'v', label: 'Detail', width: 0.7 }];
  const kv = (table, k, v) => tableRow(table, KV, [{ text: k }, { text: String(v ?? 'N/A') }]);
  const blocks = [];

  blocks.push(heading('A. Audit scope and coverage'));
  blocks.push(kv('scope', 'Website', m.domain));
  if (m.audit) {
    blocks.push(kv('scope', 'Audit run', `#${m.audit.auditNumber}${m.audit.isLatest ? ' (latest)' : ' (historical)'}`));
    blocks.push(kv('scope', 'Audit started / completed', `${dateOrNA(m.audit.startedAt)} / ${dateOrNA(m.audit.completedAt)}`));
  } else {
    blocks.push(kv('scope', 'Audit run', 'No completed audit run is recorded; scores are live values.'));
  }
  blocks.push(kv('scope', 'Pages discovered / crawled / analyzed', `${show(m.coverage?.pagesDiscovered)} / ${show(m.coverage?.pagesCrawled)} / ${show(m.coverage?.pagesAnalyzed)}`));
  blocks.push(kv('scope', 'Scoring versions', `SEO ${m.scoringVersion ?? 'not recorded'}; AI ${m.aiScoringVersion ?? 'not recorded'}`));
  blocks.push(kv('scope', 'Report generated', dateOrNA(m.generatedAt)));
  blocks.push(kv('scope', 'Report schema', report.schemaVersion));

  blocks.push(heading('B. Severity and scoring definitions'));
  const mt = report.methodology || {};
  if (mt.issueCounts) blocks.push(kv('defs', 'Issue counts and severity buckets', mt.issueCounts));
  if (mt.overallScore) blocks.push(kv('defs', 'Overall score', mt.overallScore));
  if (mt.aiReadiness) blocks.push(kv('defs', 'AEO, GEO and AISO', mt.aiReadiness));
  if (mt.timeSemantics) blocks.push(kv('defs', 'Data timing', mt.timeSemantics));

  const checks = report.sections.technicalSeo?.data?.checks;
  if (hasData(report.sections.technicalSeo) && Array.isArray(checks) && checks.length) {
    const TC = [{ key: 'id', label: 'Check id', width: 0.24 }, { key: 'n', label: 'Check', width: 0.22 }, { key: 's', label: 'Status', width: 0.1 }, { key: 'b', label: 'Impact basis', width: 0.18 }, { key: 'm', label: 'Result', width: 0.26 }];
    blocks.push(heading('C. Technical checks'));
    for (const c of checks) blocks.push(tableRow('tech', TC, [{ text: c.id || 'n/a' }, { text: c.name }, { text: c.status }, { text: c.impactBasis === 'severity_tier' ? 'Severity tier' : c.impactBasis === 'pages_affected_ratio' ? '% of pages' : c.impactBasis || 'n/a' }, { text: c.message || '' }]));
  }

  const AV = [{ key: 's', label: 'Section', width: 0.18 }, { key: 'st', label: 'Status', width: 0.14 }, { key: 'tb', label: 'Data timing', width: 0.2 }, { key: 'a', label: 'As of', width: 0.18 }, { key: 'n', label: 'Note', width: 0.3 }];
  blocks.push(heading('D. Data availability and freshness'));
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    const sec = report.sections[key];
    if (!sec) continue;
    blocks.push(tableRow('avail', AV, [
      { text: label }, { text: cap(sec.status) },
      { text: cap(sec.timeBasis) + (sec.snapshotRelation === 'after_run' ? ' (may be newer than run)' : '') },
      { text: dateOrNA(sec.asOf) }, { text: sec.message || sec.reason || '' },
    ]));
  }
  const notes = [m.snapshot?.note, ...(report.integrity?.warnings || [])].filter(Boolean);
  const snap = report.integrity?.snapshotIssueTotal;
  if (snap?.checked && !snap.match) notes.push(`The audit run recorded ${snap.auditRunTotal} issues, while the current canonical count is ${snap.canonicalTotal}. This report uses the canonical count; the cause of the difference has not been established.`);
  if (notes.length) {
    blocks.push(heading('E. Integrity and snapshot notes'));
    [...new Set(notes)].forEach((t, i) => blocks.push(kv('notes', `Note ${i + 1}`, t)));
  }

  // Additional affected URLs that do not fit in the main report pages.
  const urlSets = [];
  const collect = (secKey, label) => {
    const sec = report.sections[secKey];
    if (!hasData(sec)) return;
    for (const t of (sec.data.topIssues || []).slice(0, 6)) {
      const ev = sec.data.affectedUrls?.[t.issueCode];
      if (ev && ev.sample.length > 0 && !urlSets.some((u) => u.code === t.issueCode)) urlSets.push({ label, code: t.issueCode, title: t.title, ev });
    }
  };
  collect('onPageSeo', 'On-page');
  collect('accessibility', 'Accessibility');
  if (urlSets.length) {
    const UC = [{ key: 'u', label: 'URL', width: 1 }];
    blocks.push(heading('F. Additional affected URLs'));
    for (const u of urlSets) {
      blocks.push(heading(`${u.label}: ${u.title} (${u.ev.totalUrls} page${u.ev.totalUrls === 1 ? '' : 's'}${u.ev.sample.length < u.ev.totalUrls ? `, first ${u.ev.sample.length} shown` : ''})`, 4));
      for (const x of u.ev.sample) blocks.push(tableRow(`urls-${u.code}`, UC, [{ text: x.url }], { minH: 30 }));
    }
  }

  return buildSection({ id: 'appendices', name: 'Appendices', num: '14', title: 'Appendices', subtitle: 'Scope, definitions, checks, data freshness and extra evidence', introH: 0, blocks });
}

/** All pages added after the original nine, in report order. */
export function additionalPages(report) {
  return [
    ...accessibilityPages(report),
    ...aeoPages(report),
    ...aisoPages(report),
    ...geoPages(report),
    ...recommendationsPages(report),
  ];
}

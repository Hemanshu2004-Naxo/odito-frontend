// Builds the prioritised "what to fix" plan from a device's Lighthouse data.
import { buildEvidence, cleanDescription, detectPlatform, findChecklist, findNode, findTable, hostOf } from './evidence'
import { buildScoreBreakdown, formatBytes, formatMs } from './metrics'
import { LEGACY_ALIASES, playbookFor } from './playbook'

const METRIC_AUDIT_IDS = new Set([
  'first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
  'cumulative-layout-shift', 'speed-index', 'interactive', 'max-potential-fid',
])
const NEVER_ACTIONS = new Set([
  'network-requests', 'resource-summary', 'user-timings', 'main-thread-tasks', 'network-rtt',
  'network-server-latency', 'diagnostics', 'metrics', 'screenshot-thumbnails', 'final-screenshot',
  'script-treemap-data', 'layout-shifts', 'long-tasks', 'non-composited-animations',
  'lcp-breakdown-insight', 'inp-breakdown-insight',
])
// Lighthouse metricSavings keys → our metric keys (INP is measured as TBT in the lab).
const SAVINGS_KEY = { LCP: 'lcp', FCP: 'fcp', TBT: 'tbt', CLS: 'cls', INP: 'tbt' }

/** True when this scan was made by the Lighthouse-13-aware worker. */
export function hasFullAudits(device) {
  return Array.isArray(device?.audits)
}

/** All non-metric audits for a device, from new or legacy scan shapes. */
export function getAudits(device) {
  if (!device) return []
  if (hasFullAudits(device)) return device.audits.filter(a => a && !METRIC_AUDIT_IDS.has(a.id))
  const seen = new Set()
  return [...(device.opportunities || []), ...(device.diagnostics || [])].filter(a => {
    if (!a?.id || METRIC_AUDIT_IDS.has(a.id) || seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })
}

function findAudit(device, id) {
  return getAudits(device).find(a => a.id === id) || null
}

export function siteHostOf(device, domain) {
  return hostOf(device?.lab_environment?.final_url || '') || String(domain || '').replace(/^www\./, '')
}

/** What the LCP element is and where its time went (Lighthouse 12+ only). */
export function buildLcpDetail(device) {
  const breakdown = findAudit(device, 'lcp-breakdown-insight')
  const discovery = findAudit(device, 'lcp-discovery-insight')
  const node = findNode(breakdown?.details) || findNode(discovery?.details)
  const label = node ? (node.nodeLabel || '').split('\n')[0].trim() || node.selector || '' : ''
  const phases = (findTable(breakdown?.details)?.items || [])
    .filter(it => it && typeof it.duration === 'number')
    .map(it => ({ label: it.label || it.subpart, ms: it.duration, subpart: it.subpart }))
  return {
    element: label ? (label.length > 90 ? `${label.slice(0, 87)}…` : label) : null,
    inSlider: /slick|swiper|slider|carousel|owl-|splide|flickity/i.test(`${node?.selector || ''} ${node?.snippet || ''}`),
    phases,
  }
}

export function buildPageWeight(device) {
  const rs = findAudit(device, 'resource-summary')
  const its = findTable(rs?.details)?.items || []
  const total = its.find(it => it.resourceType === 'total')
  if (!total) return null
  const types = its
    .filter(it => it.resourceType !== 'total' && it.resourceType !== 'third-party' && (it.transferSize || 0) > 0)
    .sort((a, b) => b.transferSize - a.transferSize)
    .map(it => ({ type: it.resourceType, label: it.label, requests: it.requestCount, bytes: it.transferSize, size: formatBytes(it.transferSize) }))
  const thirdParty = its.find(it => it.resourceType === 'third-party')
  return {
    totalBytes: total.transferSize,
    total: formatBytes(total.transferSize),
    requests: total.requestCount,
    types,
    thirdParty: thirdParty ? { requests: thirdParty.requestCount, size: formatBytes(thirdParty.transferSize), bytes: thirdParty.transferSize } : null,
  }
}

function affectedMetrics(audit, pb) {
  const s = audit.metricSavings
  const fromSavings = s && typeof s === 'object'
    ? [...new Set(Object.entries(s).filter(([, v]) => Number(v) > 0).map(([k]) => SAVINGS_KEY[k]).filter(Boolean))]
    : []
  return fromSavings.length ? fromSavings : (pb?.metrics || [])
}

function savingsText(audit) {
  if (typeof audit.displayValue === 'string' && /^est/i.test(audit.displayValue)) {
    // Lighthouse uses non-breaking spaces ("2,260 ms")
    return audit.displayValue.replace(/\s+/g, ' ').replace(/^Est(\.|imated)? savings of /i, 'Saves ~')
  }
  const s = audit.metricSavings
  if (s && typeof s === 'object') {
    const parts = Object.entries(s).filter(([k, v]) => Number(v) > 0 && k !== 'CLS').map(([k, v]) => `${k} −${formatMs(v)}`)
    if (parts.length) return parts.join(', ')
  }
  return null
}

function savingsMagnitude(audit) {
  const s = audit.metricSavings
  if (!s || typeof s !== 'object') return null
  const ms = Math.max(0, ...Object.entries(s).filter(([k]) => k !== 'CLS').map(([, v]) => Number(v) || 0))
  if (s.CLS > 0) return Math.min(1, s.CLS / 0.1)
  return ms > 0 ? Math.min(1, Math.max(0.15, ms / 2000)) : null
}

function isFinding(audit, pb) {
  const mode = audit.scoreDisplayMode
  if (NEVER_ACTIONS.has(audit.id)) return false
  if (pb?.include) return pb.include(audit)
  if (mode === 'informative' || mode === 'notApplicable' || mode === 'manual' || mode === 'error') return false
  return typeof audit.score === 'number' && audit.score < 0.9
}

/**
 * @param {object} device  one device of the /performance response
 * @param {{domain?: string}} opts
 */
export function buildActionPlan(device, { domain } = {}) {
  if (!device) return { items: [], passed: [], platform: { wordpress: false }, full: false }
  const breakdown = buildScoreBreakdown(device)
  const lost = Object.fromEntries((breakdown?.rows || []).map(r => [r.key, r.lost]))
  const platform = detectPlatform(device)
  const siteHost = siteHostOf(device, domain)
  const lcp = buildLcpDetail(device)
  const ctx = { platform, siteHost, lcpElement: lcp.element, lcpInSlider: lcp.inSlider }

  const items = []
  const passed = []
  const usedPlaybooks = new Set()

  for (const audit of getAudits(device)) {
    const pb = playbookFor(audit.id)
    const pbKey = pb ? (LEGACY_ALIASES[audit.id] || audit.id) : audit.id
    if (!isFinding(audit, pb)) {
      const mode = audit.scoreDisplayMode
      if (!NEVER_ACTIONS.has(audit.id) && typeof audit.score === 'number' && audit.score >= 0.9 &&
          mode !== 'informative' && mode !== 'notApplicable') {
        passed.push({ id: audit.id, title: audit.title })
      }
      continue
    }
    if (!pb && !(typeof audit.score === 'number' && audit.score < 0.5)) continue
    if (usedPlaybooks.has(pbKey)) continue
    usedPlaybooks.add(pbKey)

    const metrics = affectedMetrics(audit, pb)
    const mag = Math.max(savingsMagnitude(audit) ?? 0, pb?.magnitude?.(audit) ?? 0) || pb?.base || 0.3
    const severity = typeof audit.score === 'number' && audit.score < 0.5 ? 1 : 0.7
    const impact = metrics.reduce((t, m) => t + (lost[m] || 0), 0) * mag * severity
    const desc = cleanDescription(audit.description)
    const dyn = pb?.dynamicSteps?.(audit, ctx)
    let summary = desc.text
    try { if (pb?.summary) summary = pb.summary(audit, ctx) } catch { /* keep Google's description */ }

    const checks = findChecklist(audit.details)
    items.push({
      checklist: checks
        ? Object.values(checks).filter(c => c && typeof c.label === 'string').map(c => ({ label: c.label, ok: c.value === true }))
        : null,
      // false = Lighthouse flags it, but the metrics it affects already score full points
      costsPoints: impact > 0,
      id: audit.id,
      title: pb?.title || audit.title,
      googleTitle: audit.title,
      summary,
      metrics,
      impact: Math.round(impact * 10) / 10,
      priority: impact >= 12 ? 'high' : impact >= 5 ? 'medium' : 'low',
      savings: savingsText(audit),
      evidence: buildEvidence(audit, siteHost),
      steps: dyn?.steps || pb?.steps || [],
      wordpressSteps: platform.wordpress ? (dyn?.wordpress ?? pb?.wordpress ?? []) : [],
      learnMore: desc.link,
      googleDescription: desc.text,
    })
  }

  items.sort((a, b) => b.impact - a.impact)
  return { items, passed, platform, full: hasFullAudits(device), lcp }
}

/** Plan items that affect a given metric (for "what's causing this"). */
export function causesForMetric(plan, key) {
  return (plan?.items || []).filter(it => it.metrics.includes(key))
}

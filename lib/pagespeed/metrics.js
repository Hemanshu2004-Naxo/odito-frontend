// Pure PageSpeed metric logic: definitions, exact score breakdown, field data.
// Everything here is computed from the stored Lighthouse result — no guesses.

// Lighthouse 10–13 performance weights. Used only when a scan predates the
// worker storing the real weights from categories.performance.auditRefs.
export const DEFAULT_WEIGHTS = {
  'first-contentful-paint': 10,
  'speed-index': 10,
  'largest-contentful-paint': 25,
  'total-blocking-time': 30,
  'cumulative-layout-shift': 25,
}

// Good / Poor boundaries (web.dev). Values: seconds for time metrics except
// TBT/TTFB (ms), CLS unitless.
export const METRICS = [
  {
    key: 'lcp', auditId: 'largest-contentful-paint', short: 'LCP', label: 'Largest Contentful Paint',
    unit: 's', good: 2.5, poor: 4.0, coreWebVital: true,
    what: 'How long until the biggest thing on screen (usually the hero image, banner or headline) has appeared. This is when a visitor feels the page has loaded.',
    why: 'A Core Web Vital that Google uses in ranking. Slow LCP is the most common reason visitors leave before seeing anything.',
  },
  {
    key: 'tbt', auditId: 'total-blocking-time', short: 'TBT', label: 'Total Blocking Time',
    unit: 'ms', good: 200, poor: 600, coreWebVital: false,
    what: 'How long the page is frozen by JavaScript while loading — taps and scrolls do nothing during this time.',
    why: 'The heaviest metric in the score (30%). It is the lab stand-in for INP, the Core Web Vital that measures how quickly the page responds to real taps.',
  },
  {
    key: 'cls', auditId: 'cumulative-layout-shift', short: 'CLS', label: 'Cumulative Layout Shift',
    unit: '', good: 0.1, poor: 0.25, coreWebVital: true,
    what: 'How much the content jumps around while the page loads (for example a button moving just as someone tries to tap it).',
    why: 'A Core Web Vital that Google uses in ranking. Layout jumps cause mis-taps and make the site feel broken.',
  },
  {
    key: 'fcp', auditId: 'first-contentful-paint', short: 'FCP', label: 'First Contentful Paint',
    unit: 's', good: 1.8, poor: 3.0, coreWebVital: false,
    what: 'How long the visitor stares at a blank screen before the first text or image appears.',
    why: 'Long blank screens make people think the site is broken and hit Back.',
  },
  {
    key: 'speed_index', auditId: 'speed-index', short: 'SI', label: 'Speed Index',
    unit: 's', good: 3.4, poor: 5.8, coreWebVital: false,
    what: 'How quickly the visible part of the page fills in overall, not just the first or largest element.',
    why: 'A high Speed Index means the page keeps changing and loading for a long time after it first appears.',
  },
  {
    key: 'ttfb', auditId: 'server-response-time', short: 'TTFB', label: 'Time to First Byte',
    unit: 'ms', good: 800, poor: 1800, coreWebVital: false, notScored: true,
    what: 'How long your server takes to start sending the page after it is requested.',
    why: 'Not part of the score, but every other metric waits for it — a slow server delays everything.',
  },
]

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map(m => [m.key, m]))

export function metricStatus(key, value) {
  const m = METRIC_BY_KEY[key]
  if (!m || value === null || value === undefined || Number.isNaN(Number(value))) return 'missing'
  const v = Number(value)
  if (v <= m.good) return 'good'
  if (v > m.poor) return 'poor'
  return 'needs_improvement'
}

export function formatMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—'
  const v = Number(ms)
  if (v < 1000) return `${Math.round(v)} ms`
  return `${(v / 1000).toFixed(1).replace(/\.0$/, '')} s`
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return '—'
  const v = Number(bytes)
  if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
  if (v >= 1024) return `${Math.round(v / 1024)} KB`
  return `${Math.round(v)} B`
}

export function formatMetricValue(key, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
  const v = Number(value)
  const m = METRIC_BY_KEY[key]
  if (!m) return String(value)
  if (m.unit === 's') return `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '')} s`
  if (m.unit === 'ms') return `${Math.round(v).toLocaleString('en-US')} ms`
  return (Math.round(v * 1000) / 1000).toString()
}

export function formatThreshold(key, which) {
  const m = METRIC_BY_KEY[key]
  const v = m[which]
  if (m.unit === 's') return `${v} s`
  if (m.unit === 'ms') return `${v} ms`
  return String(v)
}

function legacyDiag(device, auditId) {
  return (device?.diagnostics || []).find(d => d?.id === auditId) || null
}

/** Value of one metric for a device (seconds / ms / unitless as METRICS says). */
export function metricValue(device, key) {
  if (!device) return null
  if (key === 'ttfb') return device.ttfb?.value ?? null
  const v = device[key]?.value ?? device.metrics?.[key]?.value
  return v === undefined ? null : v
}

/** Lighthouse's own 0..1 score for a metric (null if unknown). */
export function metricScore(device, key) {
  const m = METRIC_BY_KEY[key]
  if (!m || !device) return null
  const direct = device.metrics?.[key]?.score ?? device[key]?.score
  if (typeof direct === 'number') return direct
  const diag = legacyDiag(device, m.auditId)
  return typeof diag?.score === 'number' ? diag.score : null
}

/**
 * Exactly how the 100 points were earned and lost. The performance score is
 * the weighted average of the metric scores, so the "earned" column sums to
 * the score Google reported (±1 from rounding).
 */
export function buildScoreBreakdown(device) {
  if (!device) return null
  const weights = device.score_weights && Object.keys(device.score_weights).length
    ? device.score_weights
    : DEFAULT_WEIGHTS
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 100
  const rows = []
  for (const m of METRICS) {
    const weight = weights[m.auditId]
    if (!weight) continue
    const score = metricScore(device, m.key)
    if (score === null) return null // can't explain honestly without every metric score
    const max = (weight / totalWeight) * 100
    const earned = max * score
    rows.push({
      key: m.key, short: m.short, label: m.label,
      weight: Math.round(max),
      score,
      earned: Math.round(earned * 10) / 10,
      lost: Math.round((max - earned) * 10) / 10,
      value: metricValue(device, m.key),
      status: metricStatus(m.key, metricValue(device, m.key)),
    })
  }
  if (!rows.length) return null
  rows.sort((a, b) => b.lost - a.lost)
  const computed = Math.round(rows.reduce((a, r) => a + (r.weight * r.score), 0))
  return { rows, computedScore: computed, usesDefaultWeights: weights === DEFAULT_WEIGHTS }
}

export function scoreBand(score) {
  if (score >= 90) return { status: 'good', label: 'Good', range: '90–100' }
  if (score >= 50) return { status: 'needs_improvement', label: 'Needs improvement', range: '50–89' }
  return { status: 'poor', label: 'Poor', range: '0–49' }
}

// ── Real-visitor (CrUX) data ────────────────────────────────────────────────

export const FIELD_METRICS = [
  { key: 'lcp', label: 'Largest Contentful Paint', short: 'LCP', good: 2500, poor: 4000, unit: 'ms', core: true },
  { key: 'inp', label: 'Interaction to Next Paint', short: 'INP', good: 200, poor: 500, unit: 'ms', core: true,
    what: 'How quickly the page reacts when a real visitor taps or clicks.' },
  { key: 'cls', label: 'Cumulative Layout Shift', short: 'CLS', good: 0.1, poor: 0.25, unit: '', core: true },
  { key: 'fcp', label: 'First Contentful Paint', short: 'FCP', good: 1800, poor: 3000, unit: 'ms', core: false },
  { key: 'ttfb', label: 'Time to First Byte', short: 'TTFB', good: 800, poor: 1800, unit: 'ms', core: false },
]

const CRUX_STATUS = { FAST: 'good', AVERAGE: 'needs_improvement', SLOW: 'poor' }

/**
 * @returns {null | {state:'not_scanned'} | {state:'no_data'} |
 *   {state:'ok', scope, assessment:'passed'|'failed'|'insufficient', metrics:[...] }}
 */
export function buildFieldSummary(device) {
  if (!device) return null
  if (device.field_data === undefined) return { state: 'not_scanned' }
  if (!device.field_data) return { state: 'no_data' }
  const fd = device.field_data
  const block = fd.scope === 'origin' ? fd.origin : fd.url
  if (!block?.metrics) return { state: 'no_data' }
  const metrics = FIELD_METRICS
    .filter(m => block.metrics[m.key])
    .map(m => {
      const raw = block.metrics[m.key]
      const v = Number(raw.p75)
      const status = CRUX_STATUS[raw.category] || (v <= m.good ? 'good' : v > m.poor ? 'poor' : 'needs_improvement')
      return {
        ...m,
        p75: v,
        display: m.unit === 'ms' ? formatMs(v) : String(Math.round(v * 100) / 100),
        status,
        distribution: Array.isArray(raw.distribution) ? raw.distribution : [],
      }
    })
  const core = metrics.filter(m => m.core)
  const hasLcp = core.some(m => m.key === 'lcp')
  const hasCls = core.some(m => m.key === 'cls')
  let assessment = 'insufficient'
  if (hasLcp && hasCls) assessment = core.every(m => m.status === 'good') ? 'passed' : 'failed'
  return { state: 'ok', scope: fd.scope, assessment, metrics, failing: core.filter(m => m.status !== 'good') }
}

/** Human description of how Lighthouse simulated the device. */
export function describeLab(device, deviceName) {
  const env = device?.lab_environment
  if (!env) {
    return deviceName === 'mobile'
      ? 'Google tests on a simulated mid-range phone over a slow 4G connection.'
      : 'Google tests on a simulated desktop computer over a fast connection.'
  }
  const parts = []
  if (env.throughput_kbps) parts.push(`${(env.throughput_kbps / 1024).toFixed(1)} Mbps`)
  if (env.rtt_ms) parts.push(`${env.rtt_ms} ms latency`)
  if (env.cpu_slowdown && env.cpu_slowdown > 1) parts.push(`${env.cpu_slowdown}× slower CPU`)
  const isMobile = env.form_factor === 'mobile'
  // e.g. "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) …" → "moto g power (2022)"
  const model = isMobile ? (String(env.network_user_agent || '').match(/Android [\d.]+; ([^;]+?)\)\s*AppleWebKit/)?.[1] || '').trim() : ''
  const what = isMobile
    ? `a simulated mid-range phone${model ? ` (${model})` : ''} on a throttled mobile connection`
    : 'a simulated desktop computer'
  return `Google tests on ${what}${parts.length ? ` (${parts.join(', ')})` : ''}${env.lighthouse_version ? ` using Lighthouse ${env.lighthouse_version}` : ''}, so lab numbers are usually slower than what most visitors see.`
}

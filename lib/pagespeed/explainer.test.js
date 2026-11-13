import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { buildScoreBreakdown, buildFieldSummary, describeLab, formatMetricValue, metricStatus } from './metrics'
import { buildActionPlan, buildPageWeight, buildLcpDetail, causesForMetric } from './actionPlan'
import { buildEvidence, cleanDescription, detectPlatform, shortUrl } from './evidence'
import { buildSummaryLines } from '@/components/dashboard/pagespeed/ScoreSummary'

// Real Lighthouse 13.6 mobile result (asgeyehospital.com) as /performance returns it.
const lh13 = () => JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'lh13-mobile.json'), 'utf8'))

// The shape stored by the worker before this change: no audits/weights/field
// data and no per-metric score — the metric scores only exist in diagnostics.
function legacy() {
  const d = lh13()
  delete d.audits; delete d.score_weights; delete d.field_data; delete d.lab_environment
  for (const k of Object.keys(d.metrics)) delete d.metrics[k].score
  for (const k of ['fcp', 'lcp', 'cls', 'tbt', 'speed_index', 'tti']) if (d[k]) delete d[k].score
  return d
}

describe('score breakdown', () => {
  it('earned points add up to the reported score', () => {
    const d = lh13()
    const b = buildScoreBreakdown(d)
    expect(b.computedScore).toBe(d.performance_score)
    expect(b.rows.map(r => r.weight).reduce((a, c) => a + c, 0)).toBe(100)
    expect(b.rows[0].key).toBe('tbt') // biggest loss first
    expect(b.usesDefaultWeights).toBe(false)
  })

  it('works on legacy scans from diagnostics scores with default weights', () => {
    const d = legacy()
    const b = buildScoreBreakdown(d)
    expect(b.computedScore).toBe(d.performance_score)
    expect(b.usesDefaultWeights).toBe(true)
  })

  it('refuses to explain when a metric score is unknown', () => {
    const d = legacy()
    d.diagnostics = d.diagnostics.filter(x => x.id !== 'total-blocking-time')
    expect(buildScoreBreakdown(d)).toBeNull()
  })
})

describe('metric formatting', () => {
  it('formats values without float noise', () => {
    expect(formatMetricValue('lcp', 8.85200560100007)).toBe('8.9 s')
    expect(formatMetricValue('tbt', 4935.5)).toBe('4,936 ms')
    expect(formatMetricValue('cls', 0.21186)).toBe('0.212')
    expect(metricStatus('lcp', 2.5)).toBe('good')
    expect(metricStatus('lcp', 3)).toBe('needs_improvement')
    expect(metricStatus('lcp', 4.1)).toBe('poor')
  })
})

describe('field data', () => {
  it('reports the real-visitor Core Web Vitals assessment', () => {
    const f = buildFieldSummary(lh13())
    expect(f.state).toBe('ok')
    expect(f.scope).toBe('url')
    expect(f.assessment).toBe('failed')
    expect(f.metrics.find(m => m.key === 'lcp').display).toBe('2.6 s')
    expect(f.metrics.find(m => m.key === 'cls').p75).toBe(0.12)
  })
  it('distinguishes old scans from sites with no CrUX data', () => {
    expect(buildFieldSummary(legacy()).state).toBe('not_scanned')
    expect(buildFieldSummary({ ...lh13(), field_data: null }).state).toBe('no_data')
  })
  it('describes the lab conditions from the scan', () => {
    expect(describeLab(lh13(), 'mobile')).toMatch(/mid-range phone \(moto g power \(2022\)\) on a throttled mobile connection using Lighthouse 13\.6\.0/)
    const withThrottle = { ...lh13(), lab_environment: { form_factor: 'mobile', rtt_ms: 150, throughput_kbps: 1638.4, cpu_slowdown: 4 } }
    expect(describeLab(withThrottle, 'mobile')).toMatch(/1\.6 Mbps, 150 ms latency, 4× slower CPU/)
    expect(describeLab({}, 'desktop')).toMatch(/desktop/)
  })
})

describe('action plan', () => {
  const plan = buildActionPlan(lh13(), { domain: 'asgeyehospital.com' })

  it('detects WordPress + Elementor from the real file URLs', () => {
    expect(plan.platform).toMatchObject({ wordpress: true, elementor: true })
    expect(plan.full).toBe(true)
  })

  it('finds the Lighthouse 13 insights the old extractor missed', () => {
    const ids = plan.items.map(i => i.id)
    for (const id of ['render-blocking-insight', 'image-delivery-insight', 'cache-insight', 'third-parties-insight', 'lcp-discovery-insight']) {
      expect(ids).toContain(id)
    }
    expect(ids).not.toContain('network-requests')
    expect(ids).not.toContain('largest-contentful-paint')
  })

  it('ranks the YouTube / JavaScript problems first with real numbers', () => {
    const top = plan.items.slice(0, 3).map(i => i.id)
    expect(top).toContain('third-parties-insight')
    const tp = plan.items.find(i => i.id === 'third-parties-insight')
    expect(tp.summary).toMatch(/YouTube \(9\.6 MB, 4\.8 s CPU\)/)
    expect(tp.steps.join(' ')).toMatch(/click to play/)
    expect(tp.wordpressSteps.join(' ')).toMatch(/WP Rocket/)
    expect(tp.priority).toBe('high')
  })

  it('uses the true file count, not the stored (capped) rows', () => {
    const rb = plan.items.find(i => i.id === 'render-blocking-insight')
    expect(rb.summary).toMatch(/^40 CSS\/JavaScript files/)
    expect(rb.evidence.total).toBe(20)
    expect(rb.evidence.rows.length).toBe(8)
    expect(rb.savings).toBe('Saves ~2,260 ms')
  })

  it('names the hero element and the slider problem', () => {
    const lcp = buildLcpDetail(lh13())
    expect(lcp.element).toMatch(/Most Trusted Name In Eye Care/)
    expect(lcp.inSlider).toBe(true)
    const disc = plan.items.find(i => i.id === 'lcp-discovery-insight')
    expect(disc.summary).toMatch(/fetchpriority=high/)
    expect(disc.checklist.some(c => !c.ok)).toBe(true)
    expect(disc.steps.join(' ')).toMatch(/slider/)
  })

  it('calls out the autoloading video by name', () => {
    const tbw = plan.items.find(i => i.id === 'total-byte-weight')
    expect(tbw.summary).toMatch(/ASG_main_hindi2\.mp4/)
    expect(tbw.steps[0]).toMatch(/preload="none"/)
  })

  it('marks findings whose metric already has full points as not costing points', () => {
    const cls = plan.items.find(i => i.id === 'cls-culprits-insight')
    expect(cls.costsPoints).toBe(false)
    expect(cls.priority).toBe('low')
    expect(causesForMetric(plan, 'tbt').length).toBeGreaterThan(2)
  })

  it('passed list holds only real scored checks', () => {
    const titles = plan.passed.map(p => p.id)
    expect(titles).toContain('server-response-time')
    expect(titles).not.toContain('network-requests')
    expect(titles).not.toContain('resource-summary')
  })

  it('still builds a plan from a legacy scan', () => {
    const p = buildActionPlan(legacy(), { domain: 'asgeyehospital.com' })
    expect(p.full).toBe(false)
    expect(p.items.map(i => i.id)).toEqual(expect.arrayContaining(['unused-javascript', 'bootup-time']))
    expect(p.items.every(i => !['network-requests', 'interactive', 'speed-index'].includes(i.id))).toBe(true)
  })
})

describe('page weight + evidence helpers', () => {
  it('summarises downloads by type', () => {
    const w = buildPageWeight(lh13())
    expect(w.requests).toBeGreaterThan(100)
    expect(w.types[0].type).toBe('script')
  })
  it('labels inline code and strips markdown links', () => {
    expect(shortUrl('\n  document.addEventListener("x")')).toMatch(/^Inline code: document/)
    expect(shortUrl('https://www.example.com/a/b/file.js?v=1')).toBe('example.com › file.js')
    expect(cleanDescription('Fix it. [Learn more](https://web.dev/x).')).toEqual({ text: 'Fix it. Learn more.', link: 'https://web.dev/x' })
  })
  it('marks third-party rows', () => {
    const a = lh13().audits.find(x => x.id === 'unused-javascript')
    const ev = buildEvidence(a, 'asgeyehospital.com')
    expect(ev.rows[0].thirdParty).toBe(true)
  })
  it('does not detect WordPress on a non-WP site', () => {
    expect(detectPlatform({ audits: [{ details: { items: [{ url: 'https://a.test/app.js' }] } }] }).wordpress).toBe(false)
  })
})

describe('summary lines', () => {
  it('only states facts from the scan (no invented traffic loss)', () => {
    const d = lh13()
    const lines = buildSummaryLines({
      score: d.performance_score, device: 'mobile', breakdown: buildScoreBreakdown(d),
      field: buildFieldSummary(d), plan: buildActionPlan(d, { domain: 'asgeyehospital.com' }),
    })
    const text = lines.join(' ')
    expect(text).toMatch(/Google rates 0–49 as “Poor”/)
    expect(text).toMatch(/Total Blocking Time/)
    expect(text).toMatch(/fail Google’s Core Web Vitals/)
    expect(text).not.toMatch(/traffic loss|sessions/i)
  })
})

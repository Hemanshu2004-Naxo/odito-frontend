"use client"
import { useId, useState } from "react"
import { METRICS, formatMetricValue, formatMs, formatThreshold, metricStatus, metricValue } from "@/lib/pagespeed/metrics"
import { causesForMetric } from "@/lib/pagespeed/actionPlan"

const STATUS_ICON = { good: '✅', needs_improvement: '⚠️', poor: '❌' }
const STATUS_TEXT = { good: 'Good', needs_improvement: 'Needs improvement', poor: 'Poor' }

function MetricRow({ m, device, breakdownRow, plan, lcp, onJump, open, onToggle }) {
  const id = useId()
  const value = metricValue(device, m.key)
  const status = metricStatus(m.key, value)
  const causes = causesForMetric(plan, m.key).filter(c => c.costsPoints).slice(0, 4)
  const lcpTotal = (lcp?.phases || []).reduce((t, p) => t + p.ms, 0)

  return (
    <div className="psx-metric">
      <button type="button" className="psx-metric-btn" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <div className="psx-metric-label">{m.short}<span>{m.label}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`psx-metric-val psx-${status}`}>{formatMetricValue(m.key, value)}</div>
          <span aria-hidden="true" style={{ fontSize: 16 }}>{STATUS_ICON[status] || ''}</span>
          <span className="psx-caret" aria-hidden="true">▾</span>
        </div>
      </button>
      {open && (
        <div className="psx-metric-body" id={id}>
          <div><b>What it measures:</b> {m.what}</div>
          <div><b>Why it matters:</b> {m.why}</div>
          <div className="psx-bands" aria-label="Google thresholds">
            <span className="psx-chip good">Good ≤ {formatThreshold(m.key, 'good')}</span>
            <span className="psx-chip needs_improvement">Needs work ≤ {formatThreshold(m.key, 'poor')}</span>
            <span className="psx-chip poor">Poor &gt; {formatThreshold(m.key, 'poor')}</span>
            {status !== 'missing' && <span className={`psx-chip ${status}`}>You: {formatMetricValue(m.key, value)} · {STATUS_TEXT[status]}</span>}
          </div>
          {breakdownRow && (
            <div>
              <b>Score impact:</b> worth {breakdownRow.weight} of 100 points — you earn {breakdownRow.earned}
              {breakdownRow.lost >= 1 ? `, losing ${breakdownRow.lost}.` : ' (full marks).'}
            </div>
          )}
          {m.notScored && <div className="psx-muted">Not counted in the score.</div>}

          {m.key === 'lcp' && lcp?.element && (
            <div><b>Your largest element:</b> “{lcp.element}”{lcp.inSlider ? ' — it sits inside a slider/carousel.' : ''}</div>
          )}
          {m.key === 'lcp' && lcp?.phases?.length > 0 && lcpTotal > 0 && (
            <div>
              <b>Where the LCP time goes:</b>
              <div className="psx-phases" style={{ marginTop: 6 }}>
                {lcp.phases.map(p => (
                  <div key={p.label} className="psx-phase">
                    <span>{p.label}</span><span>{formatMs(p.ms)}</span>
                    <div className="psx-phase-bar"><div style={{ width: `${Math.round((p.ms / lcpTotal) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              {lcp.phases.find(p => p.subpart === 'resourceLoadDelay' && p.ms > 500) && (
                <div className="psx-note" style={{ marginTop: 6 }}>
                  A long “resource load delay” means the browser found the hero content late — see “The main hero content is not prioritised” below.
                </div>
              )}
            </div>
          )}

          {status !== 'good' && causes.length > 0 && (
            <div>
              <b>What is causing it on your site:</b>
              <ul className="psx-causes" style={{ marginTop: 4 }}>
                {causes.map(c => (
                  <li key={c.id}>
                    <button type="button" className="psx-link-btn" onClick={() => onJump?.(c.id)}>{c.title}</button>
                    {c.savings ? <span className="psx-muted"> · {c.savings}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status !== 'good' && causes.length === 0 && m.key === 'speed_index' && (
            <div className="psx-muted">Speed Index improves as a side effect of fixing LCP, FCP and blocking JavaScript.</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CoreMetricsExplained({ device, breakdown, plan, onJump }) {
  const [openKey, setOpenKey] = useState(null)
  const rows = Object.fromEntries((breakdown?.rows || []).map(r => [r.key, r]))
  const metrics = METRICS.filter(m => m.key === 'ttfb' ? metricValue(device, 'ttfb') !== null : metricStatus(m.key, metricValue(device, m.key)) !== 'missing')

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>Core Metrics</div>
      <div className="psx-note" style={{ marginTop: 4, marginBottom: 4 }}>Tap a metric to see what it means and what is causing it.</div>
      {metrics.map(m => (
        <MetricRow
          key={m.key} m={m} device={device} breakdownRow={rows[m.key]} plan={plan} lcp={plan?.lcp}
          onJump={onJump} open={openKey === m.key}
          onToggle={() => setOpenKey(k => (k === m.key ? null : m.key))}
        />
      ))}
      {metrics.length === 0 && <div className="psx-muted" style={{ textAlign: 'center', padding: 20 }}>No metrics data available</div>}
    </div>
  )
}

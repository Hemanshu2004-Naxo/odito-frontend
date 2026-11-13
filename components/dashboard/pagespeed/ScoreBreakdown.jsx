"use client"
import { formatMetricValue } from "@/lib/pagespeed/metrics"

/** "Why your score is N" — exactly which metric earned/lost which points. */
export default function ScoreBreakdown({ breakdown, score, deviceLabel }) {
  if (!breakdown) return null
  const order = ['fcp', 'speed_index', 'lcp', 'tbt', 'cls']
  const byKey = Object.fromEntries(breakdown.rows.map(r => [r.key, r]))
  const segments = order.map(k => byKey[k]).filter(Boolean)
  const worst = breakdown.rows.filter(r => r.lost >= 1)

  return (
    <section className="psx-card" aria-labelledby="psx-breakdown-h">
      <h2 className="psx-h" id="psx-breakdown-h">Why your {deviceLabel} score is {score}</h2>
      <p className="psx-sub">
        Google’s score is made of 5 lab measurements, each worth a fixed share of the 100 points.
        Green is what you earned; grey is what you are losing.
        {worst.length > 0 && <> The biggest loss is <b>{worst[0].label}</b>, costing <b>{worst[0].lost} points</b> — start there.</>}
      </p>

      <div className="psx-stack" role="img" aria-label={`Score ${score} of 100: ${segments.map(s => `${s.short} ${s.earned} of ${s.weight}`).join(', ')}`}>
        {segments.map(s => (
          <div key={s.key} className="psx-stack-seg" style={{ flex: s.weight }}>
            <div className="psx-stack-fill" style={{ width: `${Math.round(s.score * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="psx-stack-legend" aria-hidden="true">
        {segments.map(s => <span key={s.key} style={{ flex: s.weight }}>{s.short} · {s.weight}</span>)}
      </div>

      <div className="psx-brk-row head">
        <div>Metric</div><div>Your result</div><div>Points earned</div><div style={{ textAlign: 'right' }}>Lost</div>
      </div>
      {breakdown.rows.map(r => (
        <div key={r.key} className="psx-brk-row">
          <div className="psx-brk-name">{r.label}<small>Worth {r.weight} points</small></div>
          <div className={`psx-${r.status}`} style={{ fontWeight: 700 }}>{formatMetricValue(r.key, r.value)}</div>
          <div>
            <div className="psx-pts">{r.earned} / {r.weight}</div>
            <div className="psx-pts-bar"><div style={{ width: `${Math.round(r.score * 100)}%` }} /></div>
          </div>
          <div className={`psx-lost ${r.lost >= 1 ? 'psx-poor' : 'psx-good'}`}>{r.lost >= 1 ? `−${r.lost}` : '0'}</div>
        </div>
      ))}
      <p className="psx-note">
        Each metric scores on a curve: reaching Google’s “good” value earns most of its points, and the last few
        points need a near-perfect result. Fixing a metric can win back at most the points shown in “Lost”.
        {breakdown.usesDefaultWeights && ' Weights shown are the standard Lighthouse weights; rescan to read them from your latest test.'}
      </p>
    </section>
  )
}

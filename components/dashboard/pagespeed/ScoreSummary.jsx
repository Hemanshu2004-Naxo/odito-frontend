"use client"
import { formatMetricValue, scoreBand } from "@/lib/pagespeed/metrics"

/**
 * Plain-English verdict built only from this scan's numbers
 * (replaces the old made-up "estimated traffic loss" card).
 */
export function buildSummaryLines({ score, device, breakdown, field, plan }) {
  const lines = []
  const band = scoreBand(score)
  lines.push(`Your ${device} score is ${score}/100 — Google rates ${band.range} as “${band.label}”.`)

  const losing = (breakdown?.rows || []).filter(r => r.lost >= 5).slice(0, 2)
  if (losing.length) {
    lines.push(`Most points are lost on ${losing.map(r => `${r.label} (${formatMetricValue(r.key, r.value)}, −${r.lost} pts)`).join(' and ')}.`)
  }

  if (field?.state === 'ok' && field.assessment !== 'insufficient') {
    const scope = field.scope === 'origin' ? 'across your whole site' : 'on this page'
    if (field.assessment === 'passed') {
      lines.push(`Real Chrome visitors ${scope} pass Google’s Core Web Vitals — this is the part that counts for rankings.`)
    } else {
      const f = field.failing.map(m => `${m.short} ${m.display}`).join(', ')
      lines.push(`Real Chrome visitors ${scope} fail Google’s Core Web Vitals (${f}) — this is what Google uses in rankings.`)
    }
  }

  const top = (plan?.items || []).filter(i => i.priority === 'high').slice(0, 2)
  if (top.length) lines.push(`Start with: ${top.map(t => t.title.charAt(0).toLowerCase() + t.title.slice(1)).join('; ')}.`)
  else if (score >= 90) lines.push('No high-priority fixes — keep an eye on new plugins, scripts and large images.')
  return lines
}

export default function ScoreSummary(props) {
  const lines = buildSummaryLines(props)
  return (
    <div className="ai-card">
      <div className="ai-card-label">✦ What this means</div>
      <ul className="psx-summary" style={{ marginTop: 8 }}>
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  )
}


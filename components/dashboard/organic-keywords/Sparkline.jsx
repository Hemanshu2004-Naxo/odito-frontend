"use client"

/**
 * A tiny trend line for the monthly searches shown in a tooltip. Decorative (the exact volume is printed next to it and the expanded
 * row has the full chart and a table), so it is hidden from assistive technology. A month with no figure leaves a gap rather than a
 * dip to zero. The colour is `currentColor`: the parent decides.
 */
export default function Sparkline({ points, className }) {
  const values = points.map((p) => p.volume)
  const known = values.filter((v) => v !== null)
  if (known.length < 2) return null
  const W = 100
  const H = 28
  const PAD = 2
  const lo = Math.min(...known)
  const hi = Math.max(...known)
  const x = (i) => (values.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (values.length - 1))
  const y = (v) => (hi === lo ? H / 2 : H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2))
  // Break the line at a missing month.
  const segments = []
  let current = []
  values.forEach((v, i) => {
    if (v === null) { if (current.length) segments.push(current); current = [] } else current.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  })
  if (current.length) segments.push(current)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden focusable="false" data-testid="ok-sparkline">
      {segments.map((s, i) => (s.length > 1
        ? <polyline key={i} points={s.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        : <circle key={i} cx={s[0].split(",")[0]} cy={s[0].split(",")[1]} r="1.5" fill="currentColor" />))}
    </svg>
  )
}

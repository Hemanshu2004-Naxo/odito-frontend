"use client"

/** What the page downloads, by type (from Lighthouse's resource summary). */
export default function PageWeightCard({ weight }) {
  if (!weight) return null
  const max = Math.max(1, ...weight.types.map(t => t.bytes))
  return (
    <section className="psx-card" aria-labelledby="psx-weight-h">
      <h2 className="psx-h" id="psx-weight-h">What the page downloads</h2>
      <p className="psx-sub" style={{ marginBottom: 12 }}>
        <span className="psx-big">{weight.total}</span> in {weight.requests} requests
        {weight.thirdParty ? <> · {weight.thirdParty.size} from other companies’ servers</> : null}
      </p>
      {weight.types.map(t => (
        <div key={t.type} className="psx-weight-row">
          <span>{t.label}</span>
          <div className="psx-weight-bar"><div style={{ width: `${Math.round((t.bytes / max) * 100)}%` }} /></div>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.size} · {t.requests}</span>
        </div>
      ))}
      <p className="psx-note">Every megabyte costs a phone on mobile data noticeable time. Scripts are the most expensive type because the phone must also run them.</p>
    </section>
  )
}

"use client"

const STATUS_TEXT = { good: 'Good', needs_improvement: 'Needs improvement', poor: 'Poor' }

/** Real-visitor Core Web Vitals (Chrome UX Report) vs the lab test. */
export default function FieldDataCard({ field, labText }) {
  if (!field) return null

  return (
    <section className="psx-card" aria-labelledby="psx-field-h">
      <h2 className="psx-h" id="psx-field-h">What real visitors experience</h2>
      <p className="psx-sub">
        The score above comes from one lab test. {labText} Google’s ranking signal (Core Web Vitals) uses
        real Chrome visitors over the last 28 days instead — that is the number to move.
      </p>

      {field.state === 'not_scanned' && (
        <div className="psx-muted" style={{ fontSize: 13 }}>Rescan to load real-visitor data for this site.</div>
      )}
      {field.state === 'no_data' && (
        <div className="psx-muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Google does not have enough real-visitor data for this site yet (it needs a steady amount of Chrome traffic).
          Until then, the lab metrics above are the best guide.
        </div>
      )}
      {field.state === 'ok' && (
        <>
          <div className="psx-assess">
            <b>Core Web Vitals assessment:</b>
            {field.assessment === 'passed' && <span className="psx-chip good">Passed</span>}
            {field.assessment === 'failed' && <span className="psx-chip poor">Failed</span>}
            {field.assessment === 'insufficient' && <span className="psx-chip">Not enough data</span>}
            <span className="psx-muted" style={{ fontSize: 12 }}>
              {field.scope === 'origin' ? 'Whole-site data (this page has too little traffic on its own)' : 'Data for this page'} · 75% of visits are at or faster than the value shown
            </span>
          </div>
          <div className="psx-field-grid">
            {field.metrics.map(m => {
              const [good = 0, mid = 0, poor = 0] = m.distribution
              return (
                <div key={m.key} className="psx-field">
                  <div className="psx-field-top">
                    <span className="psx-field-name">{m.short}{m.core ? ' · Core Web Vital' : ''}</span>
                    <span className={`psx-chip ${m.status}`}>{STATUS_TEXT[m.status]}</span>
                  </div>
                  <div className={`psx-field-val psx-${m.status}`}>{m.display}</div>
                  {m.distribution.length === 3 && (
                    <>
                      <div className="psx-dist" role="img" aria-label={`${Math.round(good * 100)}% good, ${Math.round(mid * 100)}% needs improvement, ${Math.round(poor * 100)}% poor`}>
                        <div style={{ flex: good }} /><div style={{ flex: mid }} /><div style={{ flex: poor }} />
                      </div>
                      <div className="psx-dist-cap">{Math.round(good * 100)}% of visits good · {Math.round(poor * 100)}% poor</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {field.metrics.some(m => m.key === 'inp') && (
            <p className="psx-note">INP (how fast the page reacts to taps) can only be measured on real visitors. In the lab it shows up as Total Blocking Time — fixing blocking JavaScript improves both.</p>
          )}
        </>
      )}
    </section>
  )
}

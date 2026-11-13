"use client"
import { useId } from "react"
import { METRIC_BY_KEY } from "@/lib/pagespeed/metrics"

const GROUPS = [
  { key: 'high', title: 'Fix first — biggest score impact' },
  { key: 'medium', title: 'Then fix' },
  { key: 'low', title: 'Lower impact' },
]
const PRIORITY_TEXT = { high: 'High priority', medium: 'Medium', low: 'Low' }

function Evidence({ evidence }) {
  if (!evidence?.rows?.length) return null
  return (
    <div>
      <div className="psx-sec-h">Found on your page{evidence.total > evidence.rows.length ? ` (top ${evidence.rows.length} of ${evidence.total})` : ''}</div>
      <div className="psx-ev-wrap">
        <table className="psx-ev">
          <thead><tr>{evidence.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {evidence.rows.map((r, i) => (
              <tr key={i}>
                {r.cells.map((c, j) => (
                  <td key={j} title={c.title || undefined}>
                    {c.text || '—'}
                    {j === 0 && r.thirdParty && <span className="psx-tp">3rd party</span>}
                    {j === 0 && r.note && <span className="psx-ev-note">{r.note}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlanItem({ item, open, onToggle, platformName }) {
  const id = useId()
  return (
    <div className={`psx-item ${item.priority}`} id={`psx-item-${item.id}`}>
      <button type="button" className="psx-item-btn" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <div>
          <div className="psx-item-title">{item.title}</div>
          <div className="psx-item-sum">{item.summary}</div>
          <div className="psx-item-meta">
            {item.metrics.map(k => (
              <span key={k} className="psx-chip">Affects {METRIC_BY_KEY[k]?.short || k.toUpperCase()}</span>
            ))}
            {item.savings && <span className="psx-chip info">{item.savings}</span>}
            {!item.costsPoints && <span className="psx-chip">Not costing points right now</span>}
          </div>
        </div>
        <div className="psx-item-side">
          <span className={`psx-chip ${item.priority}`}>{PRIORITY_TEXT[item.priority]}</span>
          <span className="psx-caret" aria-hidden="true">▾</span>
        </div>
      </button>
      {open && (
        <div className="psx-item-body" id={id}>
          {item.steps.length > 0 && (
            <div>
              <div className="psx-sec-h">How to fix it</div>
              <ol className="psx-steps">{item.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          {item.wordpressSteps.length > 0 && (
            <div>
              <div className="psx-sec-h">On {platformName}</div>
              <ol className="psx-steps">{item.wordpressSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          {item.checklist?.length > 0 && (
            <div>
              <div className="psx-sec-h">Google’s checks</div>
              <ul className="psx-checklist">
                {item.checklist.map((c, i) => (
                  <li key={i}><span aria-hidden="true">{c.ok ? '✅' : '❌'}</span> <span className="sr-only">{c.ok ? 'Passed: ' : 'Failed: '}</span>{c.label}</li>
                ))}
              </ul>
            </div>
          )}
          <Evidence evidence={item.evidence} />
          <div className="psx-note" style={{ marginTop: 0 }}>
            Google’s check: “{item.googleTitle}”.{' '}
            {item.learnMore && <a className="psx-ext" href={item.learnMore} target="_blank" rel="noopener noreferrer">Google’s guide ↗</a>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FixPlan({ plan, openIds, onToggle }) {
  if (!plan) return null
  const platformName = plan.platform?.elementor ? 'WordPress + Elementor' : 'WordPress'
  return (
    <section aria-labelledby="psx-plan-h" style={{ marginTop: 32 }}>
      <div className="section-head">
        <h2 className="section-title" id="psx-plan-h" style={{ margin: 0 }}>Your fix plan</h2>
        <div className="section-tag">{plan.items.length} {plan.items.length === 1 ? 'ISSUE' : 'ISSUES'}</div>
        {plan.platform?.wordpress && <div className="section-tag">{platformName.toUpperCase()} DETECTED</div>}
      </div>
      <p className="psx-sub">
        Every issue Google found on this page, ordered by how many score points the metrics it affects are losing.
        Open an issue to see the exact files involved and how to fix it.
      </p>
      {plan.items.length === 0 && <div className="psx-card psx-muted">No performance issues found in this scan.</div>}
      {GROUPS.map(g => {
        const its = plan.items.filter(i => i.priority === g.key)
        if (!its.length) return null
        return (
          <div key={g.key}>
            <div className="psx-group-title">{g.title}</div>
            {its.map(it => (
              <PlanItem key={it.id} item={it} platformName={platformName} open={openIds.has(it.id)} onToggle={() => onToggle(it.id)} />
            ))}
          </div>
        )
      })}
    </section>
  )
}

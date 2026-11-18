"use client"

import { useId, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { gapLabel, PRIORITY_LABELS } from '@/lib/socialMedia/aiStrategy'
import { gapAction } from '@/lib/socialMedia/businessProfile'
import { pluralize } from '@/lib/pluralize'

const TONE = { high: 'border-red-200 bg-red-50 text-red-800', medium: 'border-amber-200 bg-amber-50 text-amber-800', low: 'border-slate-200 bg-slate-50 text-slate-700' }
const ORDER = { high: 0, medium: 1, low: 2 }
const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'

/** One entry per missing thing (the server already merged duplicates; this guards against an older response too). */
function uniqueGaps(gaps) {
  const seen = new Map()
  for (const g of gaps || []) {
    const key = String(g.field || '').toLowerCase()
    if (!seen.has(key)) seen.set(key, g)
  }
  return [...seen.values()].sort((a, b) => (ORDER[a.importance] ?? 3) - (ORDER[b.importance] ?? 3))
}

/**
 * What would make the strategy more specific. Each gap is real (the server computes them from the Business Profile, and the AI may add ones it
 * noticed - never filled with an invention): its reason, and a button straight to the field that fills it. Collapsible, with the count in
 * the header.
 */
export function StrategyGapsCard({ gaps, title = 'Improve this strategy', subtitle = null, defaultOpen = true, testId = 'strategy-gaps' }) {
  const [open, setOpen] = useState(defaultOpen)
  const region = useId()
  const list = uniqueGaps(gaps)
  if (!list.length) return null
  return (
    <section className="rounded-2xl border border-slate-200 bg-white" data-testid={testId} aria-labelledby={`${region}-title`}>
      <h2 id={`${region}-title`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={region}
          data-testid={`${testId}-toggle`}
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5 ${FOCUS_RING}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700" aria-hidden="true"><Lightbulb className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-slate-900">{title} <span className="ml-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-semibold text-slate-700" data-testid={`${testId}-count`}>{pluralize(list.length, 'gap')}</span></span>
            {subtitle && <span className="mt-0.5 block text-sm text-slate-700">{subtitle}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <ul id={region} className="flex flex-col divide-y divide-slate-100 border-t border-slate-100 px-4 sm:px-5">
          {list.map((gap) => {
            const action = gapAction(gap.field)
            return (
              <li key={gap.field} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4" data-testid={`gap-${gap.field}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {gap.label || gapLabel(gap.field)}
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[gap.importance] || TONE.low}`}>{PRIORITY_LABELS[gap.importance] || 'Low'} impact</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{gap.reason}</p>
                </div>
                <Link href={action.href} className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-100 ${FOCUS_RING}`} data-testid={`gap-action-${gap.field}`}>
                  {action.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default StrategyGapsCard

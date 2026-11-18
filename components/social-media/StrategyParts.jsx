"use client"

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Compact building blocks for the AI Strategy view. The strategy is a concise strategic document, so every block is
 * small by default: short lists, tags, and an expandable "details" area for the secondary information.
 */

export function StrategyCard({ icon: Icon, title, subtitle, children, testId, className = '', action = null }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`} data-testid={testId}>
      <div className="flex items-start gap-3">
        {Icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span>}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-700">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export const Bullets = ({ items }) => (items?.length ? (
  <ul className="flex flex-col gap-1">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden="true" />{item}</li>
    ))}
  </ul>
) : null)

export const Chips = ({ items, testId, tone = 'slate' }) => (items?.length ? (
  <div className="flex flex-wrap gap-1.5" data-testid={testId}>
    {items.map((item) => (
      <span key={item} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone === 'violet' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{item}</span>
    ))}
  </div>
) : null)

export function Labelled({ label, children }) {
  if (!children) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800">{children}</div>
    </div>
  )
}

/**
 * Secondary detail behind a toggle (collapsed by default). The button reports its state (`aria-expanded`) and is
 * tied to the region it controls; the content is not rendered while collapsed, so it adds nothing to the page.
 */
export function Expandable({ children, label = 'Show details', openLabel = 'Hide details', testId }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!children) return null
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? openLabel : label}
      </button>
      {open && <div id={id} className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3" data-testid={testId}>{children}</div>}
    </div>
  )
}

/** A heading that groups related cards ("Content strategy", "Execution strategy", ...). */
export function Group({ title, description, children, testId }) {
  return (
    <section className="space-y-3" data-testid={testId} aria-label={title}>
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-700">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function Pill({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate} ${className}`}>{children}</span>
}

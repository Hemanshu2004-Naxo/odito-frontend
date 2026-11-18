"use client"

const TONE_DOT = { default: 'bg-violet-500', success: 'bg-emerald-500', danger: 'bg-red-500' }

/**
 * Light-styled counterpart to components/shared/ToastStack.jsx - that
 * component is themed for the dark-by-default dashboard shell
 * (bg-popover/text-foreground), which would render as a mismatched dark
 * box over this module's always-light surface. Pairs with the same
 * hooks/useToastQueue.js state hook, just a different render layer.
 * A toast may carry one action (e.g. "Retry"); an error toast is announced assertively.
 */
export default function SocialMediaToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'danger' ? 'alert' : 'status'}
          data-testid="toast"
          className="flex min-w-[240px] max-w-sm items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[t.tone] || TONE_DOT.default}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">{t.message}</div>
          {t.action && (
            <button
              type="button"
              onClick={() => { onDismiss(t.id); t.action.onClick() }}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded-md px-1 text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">×</button>
        </div>
      ))}
    </div>
  )
}

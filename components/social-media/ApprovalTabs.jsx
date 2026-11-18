"use client"

/**
 * Underline tab strip with live counts. `counts` (optional, id -> number)
 * overrides the count derived from `posts` — used by lists whose real total
 * comes from the server rather than the rows currently loaded.
 *
 * The base line is an inset shadow, not a border the tabs overlap with a negative margin: that 1px overlap made the strip taller than
 * itself, so `overflow-x-auto` also scrolled vertically and the browser drew stray ▲▼ scroll arrows. The strip only scrolls sideways.
 */
export function ApprovalTabs({ tabs, posts = [], activeTab, onChange, counts }) {
  return (
    <div className="flex items-end gap-6 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_0_rgb(226,232,240)] [scrollbar-width:thin]" data-testid="approval-tabs">
      {tabs.map((tab) => {
        const count = counts && counts[tab.id] !== undefined && counts[tab.id] !== null
          ? counts[tab.id]
          : counts ? '–' : posts.filter((p) => p.status === tab.status).length
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-violet-500 ${
              active ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label} ({count})
          </button>
        )
      })}
    </div>
  )
}

export default ApprovalTabs

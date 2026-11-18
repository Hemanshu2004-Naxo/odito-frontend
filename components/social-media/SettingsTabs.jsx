/** Underline tab strip for the Settings page (no counts, unlike ApprovalTabs). */
export function SettingsTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex items-end gap-6 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">
      {tabs.map((tab) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors ${
              active ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default SettingsTabs

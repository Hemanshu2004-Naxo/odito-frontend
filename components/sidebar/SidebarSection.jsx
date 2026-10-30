"use client"

import { cn } from "@/lib/utils"
import { SidebarItem } from "./SidebarItem"
import { SidebarGroupItem } from "./SidebarGroupItem"

export function SidebarSection({ section, isCollapsed = false }) {
  return (
    <div className="px-2 py-0.5">
      {/* Section label */}
      {section.label && !isCollapsed && (
        <div className="mb-0.5 px-3 pt-2 pb-0.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-sidebar-label">
            {section.label}
          </span>
        </div>
      )}

      {/* Collapsed separator */}
      {section.label && isCollapsed && (
        <div className="mx-auto my-1 h-px w-5 bg-sidebar-border" />
      )}

      {/* Nav items */}
      <nav className="flex flex-col gap-0" role="navigation" aria-label={section.ariaLabel || section.label || "Navigation"}>
        {section.items.map((item) =>
          item.children && !isCollapsed ? (
            <SidebarGroupItem key={item.id} item={item} />
          ) : (
            <SidebarItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
            />
          )
        )}
      </nav>
    </div>
  )
}

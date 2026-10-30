"use client"

import { useEffect, useId, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Expandable sidebar item: the label/icon is a normal link to `item.href`,
 * the chevron is a separate button that only toggles `item.children`
 * (a button can't live inside a link, and clicking it must not navigate).
 *
 * Active state is derived from the pathname - no duplicated route state:
 *  - on the parent's own route the parent gets the full active style and the
 *    matching child a subtle one;
 *  - on any other child route the parent stays open with only a subtle
 *    highlight and the child gets the full active style.
 *
 * Only rendered for the expanded sidebar; the collapsed icon rail falls
 * back to a plain SidebarItem linking to `item.href`.
 */
export function SidebarGroupItem({ item }) {
  const pathname = usePathname()
  const submenuId = useId()

  const isParentRoute = pathname === item.href
  // Inside the group = on the parent's own route or branch, OR on any child's route (a group's children need not live under its href:
  // Off-Page's pages are /app/backlinks/*, /app/referring-domains).
  const onRoute = (href) => pathname === href || pathname.startsWith(`${href}/`)
  const isInside = isParentRoute || onRoute(item.href) || item.children.some((c) => onRoute(c.href))
  const isChildRoute = isInside && !isParentRoute

  // Starts open when the page loads inside the group (refresh on a child
  // route); manual toggles stick until the user navigates into the group again.
  const [open, setOpen] = useState(isInside)
  useEffect(() => {
    if (isInside) setOpen(true)
  }, [isInside])

  return (
    <div>
      <div
        className={cn(
          "group/item relative flex items-center rounded-lg text-[15px] font-medium transition-colors duration-200 ease-out",
          isParentRoute
            ? "bg-sidebar-active text-sidebar-active-foreground shadow-sidebar-active"
            : isChildRoute
              ? "text-sidebar-active-foreground hover:bg-sidebar-hover"
              : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-hover-foreground"
        )}
      >
        <AnimatePresence>
          {isParentRoute && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-current"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
        </AnimatePresence>

        <Link
          href={item.href}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
          aria-current={isParentRoute ? "page" : undefined}
        >
          <item.icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors duration-200",
              isParentRoute || isChildRoute
                ? "text-sidebar-active-foreground"
                : "text-sidebar-icon group-hover/item:text-sidebar-hover-foreground"
            )}
            strokeWidth={isParentRoute ? 2.2 : 1.8}
          />
          <span className="truncate">{item.label}</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={submenuId}
          aria-label={`${open ? "Collapse" : "Expand"} ${item.label} menu`}
          className="mr-1.5 shrink-0 rounded-md p-1 outline-none transition-colors duration-150 hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-sidebar-accent"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 ease-out",
              open ? "rotate-0" : "-rotate-90"
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* grid-rows 0fr -> 1fr animates height without measuring or layout shift;
          `invisible` keeps collapsed links out of the tab order. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,visibility] duration-200 ease-out",
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        )}
      >
        <ul id={submenuId} className="min-h-0 overflow-hidden">
          <li className="ml-[21px] mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
            {item.children.map((child) => {
              const isActive = pathname === child.href
              // The child that mirrors the parent's own route is only
              // subtly highlighted - the parent already carries the strong state.
              const isMirror = child.href === item.href
              return (
                <Link
                  key={child.id}
                  href={child.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[14px] font-medium transition-colors duration-150",
                    "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent",
                    isActive && !isMirror
                      ? "bg-sidebar-active text-sidebar-active-foreground"
                      : isActive
                        ? "text-sidebar-active-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-hover-foreground"
                  )}
                >
                  {child.label}
                </Link>
              )
            })}
          </li>
        </ul>
      </div>
    </div>
  )
}

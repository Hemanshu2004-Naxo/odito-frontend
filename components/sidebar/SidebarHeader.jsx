"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import { useSidebarStore } from "./sidebar-store"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function SidebarHeader({ isCollapsed = false }) {
  const toggleCollapse = useSidebarStore((s) => s.toggleCollapse)

  return (
    <div
      className={cn(
        "flex items-center  border-sidebar-border px-4 py-2",
        isCollapsed ? "justify-center px-2" : "justify-between"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2", isCollapsed && "justify-center")}>
        {/* Brand kit: deep-colour wordmark on light themes, bright wordmark on dark. Collapsed = the mark. */}
        <Image
          src={isCollapsed ? "/logo/odito-mark-on-light.png" : "/logo/odito-logo-on-light.png"}
          alt="Odito AI"
          width={isCollapsed ? 512 : 1200}
          height={isCollapsed ? 512 : 424}
          className="object-contain dark:hidden"
          style={{ height: "auto", width: isCollapsed ? 28 : 100 }}
          priority
        />
        <Image
          src={isCollapsed ? "/logo/odito-mark-on-dark.png" : "/logo/odito-logo-on-dark.png"}
          alt=""
          aria-hidden="true"
          width={isCollapsed ? 512 : 1200}
          height={isCollapsed ? 512 : 424}
          className="hidden object-contain dark:block"
          style={{ height: "auto", width: isCollapsed ? 28 : 100 }}
          priority
        />
      </div>

      {/* Collapse toggle button */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={toggleCollapse}
            className={cn(
              "hidden rounded-md p-1.5 text-sidebar-icon transition-colors duration-200 hover:bg-sidebar-hover hover:text-sidebar-hover-foreground md:flex",
              isCollapsed && "mx-auto mt-2"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="bg-popover text-popover-foreground border border-border text-xs">
          {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

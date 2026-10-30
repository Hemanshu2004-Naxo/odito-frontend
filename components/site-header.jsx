"use client"

import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { usePathname, useRouter } from "next/navigation"
import { IconDownload, IconLogout } from "@tabler/icons-react"
import { Menu, Plus, User, Settings, CreditCard } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useExportPDF } from "@/hooks/useExportPDF"
import { useProject } from "@/contexts/ProjectContext"
import { useAuth } from "@/contexts/AuthContext"
import { useSidebarStore } from "@/components/sidebar/sidebar-store"
import { useIsCompactNav } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { CreditLimitDialog } from "@/components/dashboard/CreditLimitDialog"
import { getRemainingCredits, getRemainingPages } from "@/lib/subscription"

export function SiteHeader({ user, onLogout }) {
  const pathname = usePathname()
  const router = useRouter()
  const { exportPDF, loading, error, progress } = useExportPDF()
  const { activeProjectId } = useProject()
  const { logout } = useAuth()
  const toggleMobile = useSidebarStore((s) => s.toggleMobile)
  // Hamburger shows whenever the sidebar is an overlay drawer (< 1024px)
  const isMobile = useIsCompactNav()
  const [showCreditDialog, setShowCreditDialog] = useState(false)

  const getPageTitle = () => {
    if (pathname === "/") return "Dashboard"
    if (pathname === "/app/dashboard") return "Dashboard"
    if (pathname === "/projects") return "Projects"
    if (pathname === "/app/analytics") return "Analytics"
    if (pathname === "/app/onpage") return "On-Page Issues"
    if (pathname === "/app/accessibility") return "Accessibility Issues"
    if (pathname === "/app/technicalchecks") return "Technical Checks"
    if (pathname === "/app/pagespeed") return "PageSpeed Insights"
    if (pathname === "/app/keywords") return "Keywords"
    if (pathname === "/app/domain-overview") return "Domain Overview"
    if (pathname === "/app/traffic-history") return "Traffic History"
    if (pathname === "/app/organic-keywords") return "Organic Keywords"
    if (pathname === "/app/competitors") return "Competitors"
    if (pathname === "/app/referring-domains") return "Referring Domains"
    if (pathname === "/off-page-links") return "Off-Page & Links"
    return "Dashboard"
  }

  const handleExport = async () => {
    if (!activeProjectId) {
      console.error('No active project found');
      return;
    }

    try {
      // Determine report type based on current page
      let reportType = 'seo'; // default

      if (pathname.includes('ai-visibility') || pathname.includes('ai-search')) {
        reportType = 'ai';
      }

      await exportPDF(activeProjectId, reportType);
    } catch (err) {
      console.error('Export failed:', err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = '/login'
    } catch (e) {
      console.error('Logout failed', e)
    }
  };

  return (
    <header
      className="bg-card/95 text-foreground flex h-14 shrink-0 items-center gap-2 border-b border-border/40 backdrop-blur transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between gap-2 px-3 sm:px-4 lg:gap-2 lg:px-6">
        {/* min-w-0 lets the title shrink/truncate instead of forcing the action cluster out */}
        <div className="flex min-w-0 items-center gap-1">
          {/* Mobile menu trigger */}
          {isMobile && (
            <button
              onClick={toggleMobile}
              className="tap-target -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Separator orientation="vertical" className="mx-1 shrink-0 sm:mx-2 data-[orientation=vertical]:h-4" />

          <h1 className="min-w-0 truncate text-sm font-medium sm:text-base" title={getPageTitle()}>{getPageTitle()}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  if (getRemainingCredits(user) <= 0) {
                    setShowCreditDialog(true);
                  } else {
                    router.push("/onboarding");
                  }
                }}
                className="tap-target flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-4 sm:py-2.5"
                style={{ fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="hidden sm:inline">Add project</span>
              </button>

              <button
                onClick={handleExport}
                disabled={loading || !activeProjectId}
                className="tap-target px-2.5 py-2 sm:px-4"
                style={{
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg,#7c3aed,#00e5ff)',
                  border: 'none',
                  borderRadius: 9,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: loading || !activeProjectId ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: loading || !activeProjectId ? 0.7 : 1
                }}
              >
                <IconDownload size={16} />
                <span className="hidden sm:inline">
                  {loading ? "Generating PDF..." : "Export"}
                </span>
              </button>

              {error && (
                <span className="text-red-500 text-xs hidden sm:inline">
                  {error}
                </span>
              )}
            </div>

            <ThemeToggle />

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="tap-target shrink-0 cursor-pointer outline-none" aria-label="Open account menu">
                    <Avatar className="h-9 w-9 rounded-full hover:opacity-80 transition-opacity border border-border sm:h-12 sm:w-12">
                      <AvatarImage src={user.avatar || undefined} alt="" />
                      <AvatarFallback className="rounded-full text-base font-semibold bg-accent/40 text-foreground">
                        {`${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2 bg-popover border border-border text-popover-foreground">
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-2.5 py-2.5">
                      <Avatar className="h-14 w-14 rounded-full border border-border">
                        <AvatarImage src={user.avatar || undefined} alt="" />
                        <AvatarFallback className="rounded-full text-lg font-bold bg-accent/40 text-foreground">
                          {`${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-base font-semibold text-foreground leading-tight truncate">
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User'}
                        </span>
                        <span className="text-sm text-muted-foreground mt-0.5 truncate">
                          {user.email || 'user@example.com'}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <div className="px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm bg-muted border border-border/40 rounded-lg">
                      <span className="text-muted-foreground font-medium">Credits Remaining</span>
                      <span className="font-bold text-primary font-mono">{getRemainingCredits(user)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm bg-muted border border-border/40 rounded-lg">
                      <span className="text-muted-foreground font-medium">Pages Remaining</span>
                      <span className="font-bold text-primary font-mono">{getRemainingPages(user)}</span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="my-1.5" />

                  <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-3.5 rounded-lg text-base text-foreground/90 hover:text-foreground cursor-pointer transition-colors focus:bg-accent/40 focus:text-foreground">
                    <User size={18} className="text-muted-foreground" />
                    Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/app/settings")}
                    className="flex items-center gap-3 py-2.5 px-3.5 rounded-lg text-base text-foreground/90 hover:text-foreground cursor-pointer transition-colors focus:bg-accent/40 focus:text-foreground"
                  >
                    <Settings size={18} className="text-muted-foreground" />
                    Settings
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/app/settings/subscription")}
                    className="flex items-center gap-3 py-2.5 px-3.5 rounded-lg text-base text-foreground/90 hover:text-foreground cursor-pointer transition-colors focus:bg-accent/40 focus:text-foreground"
                  >
                    <CreditCard size={18} className="text-muted-foreground" />
                    Billing
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1.5" />

                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-3 py-2.5 px-3.5 rounded-lg text-base text-red-400 hover:text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400 cursor-pointer transition-colors">
                    <IconLogout size={18} />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
      </div>
      <CreditLimitDialog
        open={showCreditDialog}
        onClose={() => setShowCreditDialog(false)}
      />
    </header>
  );
}

import { DashboardProviders } from "@/providers/dashboard-providers"
import { DashboardThemeProvider } from "@/providers/DashboardThemeProvider"
import DashboardLayout from "@/components/layout/dashboard-layout"
import { AuthGuard } from "@/components/guards/AuthGuard"
import { ProjectAuditGuard } from "@/components/guards/ProjectAuditGuard"
import SeoScanBar from "@/components/dashboard/seo-scan/SeoScanBar"

// Every route under /app/* is an authenticated, per-user application screen
// (dashboard, settings, project data, ...), never public marketing content —
// applied once here rather than per-page so no future route under /app/*
// can accidentally end up indexable. Canonical URLs are not a fix for these
// pages; they should not appear in search results at all.
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Shared layout for all dashboard routes.
 *
 * DashboardThemeProvider is intentionally scoped here — it manages the user's
 * light/dark preference only while they are inside the dashboard. On unmount it
 * restores the landing dark theme automatically.
 */
export default function DashboardGroupLayout({ children }) {
  return (
    <DashboardThemeProvider>
      <AuthGuard>
        <DashboardProviders>
          <DashboardLayout>
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  <div className="px-2 sm:px-4 lg:px-6">
                    <ProjectAuditGuard>
                      <SeoScanBar />
                      {children}
                    </ProjectAuditGuard>
                  </div>
                </div>
              </div>
            </div>
          </DashboardLayout>
        </DashboardProviders>
      </AuthGuard>
    </DashboardThemeProvider>
  )
}

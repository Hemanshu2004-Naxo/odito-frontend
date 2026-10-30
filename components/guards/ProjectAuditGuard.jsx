"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useProject } from "@/contexts/ProjectContext";

// Route prefixes that render data produced by an audit run. Only these are
// gated on crawl_status — settings, deleted-projects, pre-audit,
// notifications, etc. are intentionally NOT in this list and pass straight
// through untouched (see isProtectedPath below).
const AUDIT_PROTECTED_PREFIXES = [
  // The default landing page: guarded so a project that is still being set up or audited is sent to onboarding/processing, not to a
  // half-empty overview.
  "/app/domain-overview",
  "/app/traffic-history",
  "/app/organic-keywords",
  "/app/competitors",
  "/app/backlinks",
  "/app/dashboard",
  "/app/onpage",
  "/app/accessibility",
  "/app/technicalchecks",
  "/app/pagespeed",
  "/app/keywords",
  "/app/google-visibility",
  "/app/aiso",
  "/app/aeo-hub",
  "/app/geo-hub",
  "/app/ai-video",
  "/app/history-logs",
  "/app/analytics",
  "/app/comparison",
];

// crawl_status values that mean the audit has reached a resolved end state —
// the dashboard's (possibly partial, e.g. a failed run) data is the correct
// thing to show. Every other value, including ones outside this list that
// aren't explicitly routed elsewhere below (SeoProject.crawl_status enum
// currently also has 'pending', 'discovered', 'crawled' — none of which are
// a finished audit) is treated as "audit still in progress" and sent to the
// processing screen. This fail-closed default is deliberate: it's the same
// class of bug being fixed here, just for a different crawl_status value.
const TERMINAL_ALLOW_STATUSES = new Set(["completed", "failed", "cancelled"]);

function isProtectedPath(pathname) {
  return AUDIT_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function resolveRedirectTarget(crawlStatus, projectId) {
  if (crawlStatus === "draft") return "/onboarding";
  if (crawlStatus === "awaiting_url_selection") return `/projects/${projectId}/url-selection`;
  if (TERMINAL_ALLOW_STATUSES.has(crawlStatus)) return null;
  return `/processing/${projectId}`;
}

function GuardLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );
}

export function ProjectAuditGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProject, isLoading } = useProject();
  const lastRedirectRef = useRef(null);

  const protectedRoute = isProtectedPath(pathname);
  const crawlStatus = activeProject?.crawl_status;
  const target = protectedRoute && activeProject
    ? resolveRedirectTarget(crawlStatus, activeProject._id)
    : null;

  useEffect(() => {
    if (!target) {
      lastRedirectRef.current = null;
      return;
    }
    // Skip re-issuing the same redirect on every re-render (e.g. a background
    // refetch of the active project resolving to the same crawl_status) —
    // router.replace() is otherwise safe to call repeatedly, but this keeps
    // the effect a no-op once the redirect it wanted has already been sent.
    if (lastRedirectRef.current === target) return;
    lastRedirectRef.current = target;
    router.replace(target);
  }, [target, router]);

  if (!protectedRoute) {
    return children;
  }

  // Wait for ProjectContext to resolve the project list AND settle on an
  // active project before deciding anything — prevents a flash of dashboard
  // content (with stale/zeroed data) during the brief window right after
  // login or a hard refresh, before activeProject has been restored from
  // localStorage or defaulted to projects[0].
  if (isLoading || !activeProject) {
    return <GuardLoadingState />;
  }

  if (target) {
    return <GuardLoadingState />;
  }

  return children;
}

export default ProjectAuditGuard;

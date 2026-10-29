
"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";

import ScoreGrid from "@/components/dashboard/overview/ScoreGrid";
import AIScoreSummaryPanel from "@/components/dashboard/overview/AIScoreSummaryPanel";
import SEOSummaryPanel from "@/components/dashboard/overview/SEOSummaryPanel";
import AuditTimeline from "@/components/dashboard/overview/AuditTimeline";

import {
  useProjectOverview,
  useIssueCounts,
  useLatestComparison,
  useAISOHub,
  useAEOHub,
  useGEOHub,
} from "@/hooks/useDashboardQueries";

import { useAuditTrigger } from "@/hooks/useAuditTrigger";

export default function DashboardPageContent() {
  const { user } = useAuth();
  const { activeProject } = useProject();

  const projectId = activeProject?._id;

  // Quick recheck
  const {
    isVerifying,
    verifyError,
    startQuickRecheck,
  } = useAuditTrigger(projectId);

  // Existing dashboard data
  const {
    data: overviewResponse,
    isLoading: overviewLoading,
  } = useProjectOverview(projectId);

  const {
    data: issueCountsResponse,
    isLoading: issueCountsLoading,
    isError: issueCountsErrored,
  } = useIssueCounts(projectId);

  const { data: comparisonRes } = useLatestComparison(projectId);

  // Real scores from the existing AISO, AEO and GEO hub queries
  const {
    data: aisoResponse,
    isLoading: aisoLoading,
    isError: aisoError,
  } = useAISOHub(projectId);

  const {
    data: aeoResponse,
    isLoading: aeoLoading,
    isError: aeoError,
  } = useAEOHub(projectId);

  const {
    data: geoResponse,
    isLoading: geoLoading,
    isError: geoError,
  } = useGEOHub(projectId);

  // Project overview values
  const project = overviewResponse?.data?.project || null;

  const dashboardData = overviewResponse?.data?.performance
    ? {
        performance: overviewResponse.data.performance,
      }
    : null;

  const technicalHealth =
    overviewResponse?.data?.technical?.summary?.healthScore || 0;

  const issueCounts = issueCountsResponse?.data || null;

  const loading = overviewLoading || issueCountsLoading;

  const seoHealth = project
    ? Math.round(project.website_score || 0)
    : 0;

  const aiVisibility =
    overviewResponse?.data?.ai_visibility?.score != null
      ? Math.round(overviewResponse.data.ai_visibility.score)
      : 0;

  const performance =
    dashboardData?.performance?.summary?.performanceScore || 0;

  const technicalHealthScore = technicalHealth;

  const pagesCrawled = project
    ? project.pages_crawled || 0
    : 0;

  // Issue counts and fallback handling
  let totalIssuesState = "loading";
  let totalIssuesValue = null;

  if (issueCounts?.totalIssues != null) {
    totalIssuesState = "live";
    totalIssuesValue = issueCounts.totalIssues;
  } else if (issueCountsErrored) {
    if (project?.total_issues != null) {
      totalIssuesState = "stale";
      totalIssuesValue = project.total_issues;
    } else {
      totalIssuesState = "error";
    }
  }

  const criticalIssues = issueCounts
    ? issueCounts.critical || 0
    : 0;

  // Extract the actual score values used by each hub page.
  const aiScores = {
    aiso: aisoResponse?.data?.hero?.aiso ?? null,

    aeo: aeoResponse?.data?.aeo_score ?? null,

    geo:
      geoResponse?.data?.hero?.geo_score ??
      geoResponse?.data?.geo_score ??
      null,
  };

  const aiScoresLoading =
    aisoLoading || aeoLoading || geoLoading;

  const aiScoresError =
    aisoError || aeoError || geoError;

  // Loading state for the existing dashboard sections
  if (loading) {
    return (
      <div className="flex-1 space-y-6 skeleton-fade-in">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded skeleton-base skeleton-shimmer" />
            <div className="h-4 w-40 rounded skeleton-base skeleton-shimmer" />
          </div>

          <div className="h-10 w-36 rounded-full skeleton-base skeleton-shimmer" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-48 rounded-xl skeleton-base skeleton-shimmer"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="h-40 rounded-xl skeleton-base skeleton-shimmer" />
          <div className="h-40 rounded-xl skeleton-base skeleton-shimmer" />
        </div>

        <div className="h-16 rounded-xl skeleton-base skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 skeleton-fade-in">
      {/* Dashboard header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Overview Dashboard
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            SEO &amp; AI Visibility Audit
          </p>
        </div>

        <Button
          onClick={startQuickRecheck}
          disabled={!projectId || isVerifying}
          className="gap-2 rounded-full"
        >
          {isVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}

          {isVerifying ? "Checking..." : "Quick Recheck"}
        </Button>
      </div>

      {verifyError && (
        <p className="text-sm text-destructive" role="alert">
          {typeof verifyError === "string"
            ? verifyError
            : verifyError?.message || "Quick recheck failed. Please try again."}
        </p>
      )}

      {/* Existing overview score cards */}
      <ScoreGrid
        seoHealth={seoHealth}
        aiVisibility={aiVisibility}
        performance={performance}
        technicalHealth={technicalHealthScore}
      />

      {/* SEO Summary and AI Summary */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="min-w-0">
          <SEOSummaryPanel
            pagesCrawled={pagesCrawled}
            totalIssues={totalIssuesValue}
            totalIssuesState={totalIssuesState}
            criticalIssues={criticalIssues}
          />
        </section>

        <aside className="min-w-0">
          <AIScoreSummaryPanel
            scores={aiScores}
            loading={aiScoresLoading}
          />

          {aiScoresError && !aiScoresLoading && (
            <p className="mt-3 text-xs text-muted-foreground">
              Some AI scores could not be loaded. Check the corresponding
              hub page and try again.
            </p>
          )}
        </aside>
      </div>

      {/* Existing audit history */}
      <AuditTimeline />
    </div>
  );
}

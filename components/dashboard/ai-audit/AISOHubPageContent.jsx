"use client"

import { useAISOHub, useAISOHubIssues } from "../../../hooks/useDashboardQueries"
import AISOHeroSection          from "./aiso/AISOHeroSection"
import CrawlabilityCenter       from "./aiso/CrawlabilityCenter"
import IssueDistributionSection from "./aiso/IssueDistributionSection"
import OptimizationPipeline     from "./aiso/OptimizationPipeline"

export default function AISOHubPageContent({ projectId }) {
  const { data: hubResponse, isLoading, error } = useAISOHub(projectId)
  const { data: issuesResponse }                = useAISOHubIssues(projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>Loading AISO data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-sm" style={{ color: "var(--color-status-error)" }}>Failed to load AISO data.</p>
      </div>
    )
  }

  const hub    = hubResponse?.data
  const issues = issuesResponse?.data?.issues ?? []

  if (!hub) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          No AI analysis data found. Run a scan to see results.
        </p>
      </div>
    )
  }

  // CrawlabilityCenter uses hyphenated compound keys; API returns underscored ones
  const bots = {
    gptbot:            hub.bots.gptbot,
    claudebot:         hub.bots.claudebot,
    perplexitybot:     hub.bots.perplexitybot,
    "google-extended": hub.bots.google_extended,
    bingbot:           hub.bots.bingbot,
    "llms-txt":        hub.bots.llms_txt,
  }

  // Issues already sorted by pages_affected DESC from the API
  const topIssues = issues.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div className="section-title">AISO Hub</div>
        <span className="glow-pill violet">✦ AI SEARCH OPTIMIZATION</span>
      </div>

      {/* Section 1 — Score hero + hub metric cards */}
      <AISOHeroSection
        overallScore={hub.hero.aiso}
        crawlability={hub.hero.crawlability}
        citability={hub.hero.citability}
        authority={hub.hero.authority}
        coverage={hub.hero.coverage}
        deltas={{}}
        scoreTrend={null}
      />

      {/* Section 2 — AI Crawlability Center */}
      <CrawlabilityCenter bots={bots} />

      {/* Section 4 — Issue Distribution donut + Severity Landscape */}
      <IssueDistributionSection distribution={hub.issue_distribution} />

      {/* Section 5 — Optimization Pipeline table */}
      <OptimizationPipeline issues={topIssues} />

    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { useAEOHub, useAEOHubIssues } from "@/hooks/useDashboardQueries"
import AEOHeroSection          from "./AEOHeroSection"
import AnswerReadinessCenter   from "./AnswerReadinessCenter"
import ContentStructureSection from "./ContentStructureSection"
import AEOIssueDistribution    from "./AEOIssueDistribution"
import FAQIntelligenceCenter   from "./FAQIntelligenceCenter"
import AEOOptimizationPipeline from "./AEOOptimizationPipeline"

// Static labels and descriptions for the 4 readiness signal cards
const SIGNAL_META = {
  question_h2:      {
    label:       "Question H2",
    description: "Interrogative H2 headings guide AI extraction. Target ≥ 30% question ratio.",
  },
  faq_schema:       {
    label:       "FAQ Schema",
    description: "FAQPage schema validated and matched to visible page content.",
  },
  howto_schema:     {
    label:       "HowTo Schema",
    description: "Step-by-step markup present on process and documentation pages.",
  },
  speakable_schema: {
    label:       "Speakable Schema",
    description: "Voice assistants can identify and narrate key content sections.",
  },
}

export default function AEOHubPageContent() {
  const { activeProject } = useProject()
  const router = useRouter()
  const projectId = activeProject?._id

  const { data: hubResponse,    isLoading: hubLoading,    isError: hubError    } = useAEOHub(projectId)
  const { data: issuesResponse, isLoading: issuesLoading, isError: issuesError } = useAEOHubIssues(projectId)

  const hub    = hubResponse?.data
  const issues = issuesResponse?.data?.issues ?? []

  // ── Derive props for each section ─────────────────────────────────────────

  const heroCards = hub ? {
    answer_readiness:  hub.cards.answer_readiness,
    question_coverage: hub.cards.question_coverage,
    faq_coverage:      hub.cards.faq_coverage,
    snippet_score:     hub.cards.snippet_score,
    voice_search:      hub.cards.voice_search,
  } : null

  const signalsArray = hub
    ? Object.entries(hub.signals).map(([id, sig]) => ({
        id,
        label:           SIGNAL_META[id]?.label       ?? id,
        description:     SIGNAL_META[id]?.description ?? '',
        status:          sig.status,
        score:           sig.score,
        applicablePages: sig.applicable_pages,
        pagesFailing:    sig.pages_failing,
      }))
    : []

  const structureProps = hub ? {
    question_coverage: {
      ratio:        hub.structure.question_coverage.ratio_display,
      question_h2s: hub.structure.question_coverage.question_h2_sum,
      total_h2s:    hub.structure.question_coverage.total_h2_sum,
    },
    faq_intelligence: {
      schema_match_pct: hub.structure.faq_intelligence.schema_match_pct,
      schema_qs:        hub.structure.faq_intelligence.schema_qa_total,
      visible_qs:       hub.structure.faq_intelligence.visible_qa_total,
    },
    snippet_readiness: {
      lists:           hub.structure.snippet_readiness.lists_total,
      tables:          hub.structure.snippet_readiness.tables_total,
      authority_links: hub.structure.snippet_readiness.authority_links_total,
    },
    voice_readiness: {
      speakable_active:      hub.structure.voice_readiness.speakable_active,
      conversational_signal: hub.structure.voice_readiness.conversational_label,
      natural_signals_pct:   hub.structure.voice_readiness.speakable_coverage_pct,
    },
  } : null

  const faqProps = hub ? {
    schema_questions:  hub.structure.faq_intelligence.schema_qa_total,
    visible_questions: hub.structure.faq_intelligence.visible_qa_total,
    matched:           hub.structure.faq_intelligence.matched_qa_total,
    pages_with_faq:    hub.structure.faq_intelligence.pages_with_faq_schema,
    opportunities:     (hub.faq_opportunities ?? []).map((opp, i) => ({
      ...opp,
      id: `opp-${i}`,
    })),
  } : null

  const handleFix = (ruleId) => router.push(`/app/aeo-hub?issue=${encodeURIComponent(ruleId)}`)

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (hubLoading || issuesLoading) {
    return (
      <div className="space-y-8 skeleton-fade-in">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6 h-72 skeleton-base skeleton-shimmer rounded-xl" />
          <div className="col-span-12 lg:col-span-6 grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 skeleton-base skeleton-shimmer rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 skeleton-base skeleton-shimmer rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 skeleton-base skeleton-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // An API/network failure must never look like "no audit run yet" — see
  // the identical fix in GeoHubPageContent.jsx.
  if (hubError || issuesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3">
        <p className="text-sm" style={{ color: "var(--color-status-error)" }}>
          Failed to load AEO Hub data. Please try again.
        </p>
      </div>
    )
  }

  if (!hub) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3">
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          No AEO Hub data found for this project. Run an audit to generate insights.
        </p>
      </div>
    )
  }

  // ── Page composition ───────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div className="section-title">AEO Hub</div>
        <span className="glow-pill violet">✦ ANSWER ENGINE OPTIMIZATION</span>
      </div>

      {/* Section 1 — Score hero + 5 card metrics */}
      <AEOHeroSection
        aeoScore={hub.aeo_score}
        cards={heroCards}
      />

      {/* Section 2 — Answer Readiness Center */}
      <AnswerReadinessCenter signals={signalsArray} />

      {/* Section 3 — Content Structure Intelligence */}
      <ContentStructureSection structure={structureProps} />

      {/* Section 4 — Issue Distribution */}
      <AEOIssueDistribution distribution={hub.issue_distribution} />

      {/* Section 5 — FAQ Intelligence Center */}
      <FAQIntelligenceCenter faq={faqProps} />

      {/* Section 6 — Optimization Pipeline */}
      <AEOOptimizationPipeline issues={issues} onFix={handleFix} />
    </div>
  )
}

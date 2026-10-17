"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 3500)
    return () => clearTimeout(id)
  }, [onClose])
  // 'warning' is distinct from both 'success' and 'error': used when
  // WordPress accepted a write (HTTP 200, no thrown error) but the
  // immediate read-back could not confirm the value actually persisted as
  // sent — a real, distinct outcome from a confirmed success, and must
  // never be shown with the same green checkmark (see the applyWordPress
  // FixMutation success handler below).
  const bg     = type === 'success' ? 'rgba(0,245,160,0.12)'  : type === 'warning' ? 'rgba(255,184,0,0.12)' : 'rgba(255,56,96,0.12)'
  const border = type === 'success' ? 'rgba(0,245,160,0.28)'  : type === 'warning' ? 'rgba(255,184,0,0.28)' : 'rgba(255,56,96,0.28)'
  const color  = type === 'success' ? '#00f5a0'               : type === 'warning' ? '#ffb800'              : '#ff3860'
  const icon   = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕'
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: bg, border: `1px solid ${border}`, color,
      borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 8,
      backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <span>{icon}</span>
      {message}
    </div>
  )
}
import { createPortal } from "react-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useProject } from "@/contexts/ProjectContext"
import apiService from "@/lib/apiService"
import { queryKeys } from "@/lib/query/keys"
import { IssueRecommendationPanel } from "@/components/recommendations"
import DIYRenderer from "@/components/diy/DIYRenderer"
import CurrentStateRenderer from "@/components/issue-context/CurrentStateRenderer"
import { useIssueContext } from "@/hooks/useIssueContext"
import { useIssueUrls, useActiveTaskUrls, useWordPressCapabilities, useWordPressSeoData, useWordPressSiteSchema, useWordPressH1Context, useWordPressPageResolution, useLinkTaskRecommendation, useRecommendationById } from "@/hooks/useDashboardQueries"
import { useTaskRealtimeSync } from "@/hooks/useTaskRealtimeSync"
import { useScrollIntoViewWhenStacked } from "@/hooks/useScrollIntoViewWhenStacked"
import { describeApplyError } from "./wordPressApplyError"
import FaqSchemaApplyDialog from "./FaqSchemaApplyDialog"
import RatingSchemaApplyDialog from "./RatingSchemaApplyDialog"
import SameAsFixPanel from "./SameAsFixPanel"
import BreadcrumbFixCard from "./BreadcrumbFixCard"
import { BREADCRUMB_DIY_POINTER, BREADCRUMB_ISSUE_ID } from "./breadcrumbFix"
import { SAMEAS_DIY_POINTER, SAMEAS_ISSUE_ID } from "./sameAsFix"
import H1ApplyDialog from "./H1ApplyDialog"
import { FAQ_ISSUE_ID, getFaqDetection } from "@/components/issue-context/faqDetection"
import { RATING_ISSUE_ID, getRatingDetection } from "@/components/issue-context/ratingDetection"
import OrganizationFixPanel from "./OrganizationFixPanel"
import { ORGANIZATION_FIX_ISSUE_ID } from "./organizationFix"
import ImageAltFixPanel from "./ImageAltFixPanel"
import { IMAGE_ALT_ISSUE_ID, ALT_DIY_POINTER, ALT_NOT_APPLICABLE_MESSAGE, ALT_NOT_APPLICABLE_TITLE, getAltPanelAvailability, isAltFindingNotApplicable } from "./imageAltFix"
import AuditIqHelpPanel from "./AuditIqHelpPanel"

// issueKey -> the field WordPress fixes can target, mirrored from the
// backend's own providerCapabilityRegistry.js/issueSnapshotTypes.js. Kept in
// sync manually (no shared package between frontend/backend exists) —
// deliberately only the types wordPressSeoFixService.js currently supports,
// NOT the full snapshot-type set TaskVerificationService verifies (image_alt
// and multiple_h1_tags are not auto-applied; Organization's individual
// fields and Person remain architecturally scaffolded but not yet
// implemented — see providerCapabilityRegistry.js). h1_missing is the one
// page-CONTENT fix (see CONTENT_FIELD_TYPES below).
const WORDPRESS_FIXABLE_ISSUE_TYPES = {
  title_missing: "title", title_too_short: "title", title_too_long: "title",
  meta_description_missing: "meta_description", meta_description_too_short: "meta_description", meta_description_too_long: "meta_description",
  canonical_tag_errors: "canonical",
  noindex_key_pages: "robots", noindex_tags: "robots",
  sameas_array: "same_as",
  breadcrumblist_schema: "breadcrumb",
  // Page-scoped, applied through the Bridge's own FAQ-schema route (not an SEO
  // plugin field) — see wordPressSeoFixService.js's `channel: 'faq_schema'`.
  faq_schema: "faq_schema",
  aggregate_rating_schema: "aggregate_rating",
  // PAGE CONTENT, not an SEO-plugin field: only h1_missing (never multiple_h1_tags), and only offered
  // when the backend's content adapter reports the page as safely changeable — see CONTENT_CHANNELS.
  h1_missing: "h1",
}
// Page-content fixes (the H1): eligibility is decided PER PAGE by the backend's builder adapter
// (GET /wordpress/h1-context), not by the SEO plugin or the Bridge. The dialog shows exactly what
// would change; the only thing sent back is the fingerprint of the page state that was reviewed.
const CONTENT_FIELD_TYPES = new Set(["h1"])
// Schema fixes applied through the Bridge's own routes (not an SEO plugin field):
// capability comes from the Bridge itself, the dialog previews the exact JSON-LD,
// and nothing is read from / compared against an SEO plugin's live value.
const SCHEMA_CHANNELS = {
  faq_schema: { capabilityFlag: "faqSchemaSupported", requirementKey: "faq_schema", regenerateToast: "Regenerating the FAQ schema from the current page — review it, then apply again." },
  aggregate_rating: { capabilityFlag: "ratingSchemaSupported", requirementKey: "rating_schema", regenerateToast: "Regenerating the AggregateRating schema from the current page — review it, then apply again." },
}
const WORDPRESS_CAPABILITY_KEY = { title: "title", meta_description: "metaDescription", canonical: "canonical", robots: "robots" }
const WORDPRESS_FIELD_LABEL = { title: "Title", meta_description: "Meta description", canonical: "Canonical URL", robots: "Robots meta", same_as: "Organization sameAs", breadcrumb: "Breadcrumbs", faq_schema: "FAQ schema", aggregate_rating: "AggregateRating schema", h1: "H1 heading" }

// same_as/breadcrumb write to WordPress OPTIONS (one site-wide state),
// never post meta — mirrors providerCapabilityRegistry.js's `scope: 'site'`
// marker exactly. Drives which capability-detection hook and which
// confirmation dialog this component uses for a given field type (Section
// 13's capability-driven-UI requirement: provider -> bridge version ->
// capability -> scope -> issue type, never a hardcoded "if rank_math show
// everything").
const SITE_SCOPED_FIELD_TYPES = new Set(["same_as", "breadcrumb"])

// robots is the only WordPress-fixable field whose wire value (what's sent
// to/from the backend as expectedCurrentValue — see oditoSeoBridgeService.js's
// toLegacySeoShape) isn't already human-readable text: the Bridge only ever
// lists RESTRICTIVE directives, alphabetically sorted ("", "noindex",
// "nofollow", "nofollow, noindex" — see valueNormalization.js's
// robotsValueToWireString), while the
// recommendation's own recommendedVersion text (the "New" value, generated
// per PromptBuilder.js's strict 4-string mandate) always spells out both
// axes explicitly ("index, follow", "noindex, follow", ...). This renders the
// CURRENT value in that same explicit vocabulary for display only — the raw
// wire string (wpLiveValue) is still what's sent back as expectedCurrentValue,
// unchanged.
function formatRobotsWireValueForDisplay(wire) {
  if (typeof wire !== "string") return wire
  const noindex = wire.includes("noindex")
  const nofollow = wire.includes("nofollow")
  return `${noindex ? "noindex" : "index"}, ${nofollow ? "nofollow" : "follow"}`
}

/**
 * Apply-via-WordPress confirmation modal. Deliberately shows the CURRENT
 * value as freshly read live from WordPress (not a possibly-stale crawled
 * snapshot) — the exact same value sent back to the server as
 * `expectedCurrentValue`, so what the user approves here is what the
 * backend's read-before-write check compares against (see
 * wordPressSeoFixService.js's CONFLICT handling).
 */
function WordPressApplyConfirmDialog({ open, onOpenChange, fieldLabel, siteLabel, providerLabel, currentValue, currentValueLoading, currentValueUnavailable, newValue, onConfirm, onRefreshLiveValue, isApplying, errorInfo }) {
  if (!open) return null
  // A conflict (live value changed, or the WordPress write succeeded but
  // recording it on the Task lost a concurrency race) must be explicitly
  // acknowledged by refreshing the live value before trying again — never
  // silently re-fetched, and the primary button is replaced (not just
  // re-enabled) so re-clicking "Apply Fix" blindly with the same stale
  // expectedCurrentValue can't just conflict again in a loop. A failed
  // live-read gets the SAME "must explicitly retry" treatment, for the
  // same reason: applying with expectedCurrentValue silently defaulted to
  // null (because the read failed, not because the field is empty) is
  // exactly how a real value gets misread as "(empty)".
  const showRefreshAction = errorInfo?.requiresRefresh || currentValueUnavailable
  // Bug fix: a RECOMMENDATION_REQUIRED rejection (or any other
  // nonRetryable error) previously left "Apply Fix" fully clickable —
  // retrying the identical request against the identical missing-link
  // state can never succeed, so the primary action is disabled outright
  // rather than inviting a guaranteed-repeat failure.
  const applyDisabledByError = !!errorInfo?.nonRetryable
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ width: "min(440px, 92vw)", background: "var(--card, var(--s))", border: "1px solid var(--b)", borderRadius: 14, padding: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>Apply SEO Fix?</div>
        <div style={{ fontSize: 11.5, color: "var(--t3)", marginBottom: 14 }}>
          {siteLabel ? `Website: ${siteLabel}` : null}{providerLabel ? ` · Provider: ${providerLabel}` : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Current {fieldLabel}
            </div>
            <div style={{ fontSize: 12.5, color: currentValueUnavailable ? "#ff3860" : "var(--t)", padding: "8px 10px", background: "var(--s2)", borderRadius: 8, border: "1px solid var(--b)", minHeight: 20 }}>
              {currentValueLoading
                ? "Loading current value…"
                : currentValueUnavailable
                  ? "Unable to read the current WordPress value. Refresh and try again."
                  : (currentValue || "(empty)")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#00f5a0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              New {fieldLabel}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--t)", padding: "8px 10px", background: "rgba(0,245,160,0.06)", borderRadius: 8, border: "1px solid rgba(0,245,160,0.2)", minHeight: 20 }}>
              {newValue || "(empty)"}
            </div>
          </div>
        </div>

        {errorInfo && (
          <div style={{
            fontSize: 11.5, lineHeight: 1.5, marginBottom: 12, padding: "8px 10px", borderRadius: 8,
            color: errorInfo.isConflict ? "#f5a623" : "#ff3860",
            background: errorInfo.isConflict ? "rgba(245,166,35,0.1)" : "rgba(255,56,96,0.08)",
          }}>
            {errorInfo.wordpressWriteSucceeded
              ? "The WordPress change may have already been applied, but Odito couldn't record it because the task changed at the same time. Refresh the live value and check WordPress before trying again."
              : errorInfo.isConflict
                ? "This value changed on WordPress before the fix was applied. Refresh the live value and review the recommendation before applying again."
                : errorInfo.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "1px solid var(--b)", background: "var(--s2)", color: "var(--t2)", cursor: isApplying ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          {showRefreshAction ? (
            <button
              type="button"
              onClick={onRefreshLiveValue}
              disabled={currentValueLoading}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", background: "#f5a623", color: "#1a1a1a", cursor: currentValueLoading ? "not-allowed" : "pointer", opacity: currentValueLoading ? 0.7 : 1 }}
            >
              {currentValueLoading ? "Refreshing…" : "Refresh Live Value"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isApplying || currentValueLoading || applyDisabledByError}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", background: "linear-gradient(135deg,#7730ed,#00dfff)", color: "#fff", cursor: (isApplying || currentValueLoading || applyDisabledByError) ? "not-allowed" : "pointer", opacity: (isApplying || currentValueLoading || applyDisabledByError) ? 0.5 : 1 }}
            >
              {isApplying ? "Applying…" : "Apply Fix"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function IssueDetailView({
  issue,
  onBack,
  onOpenUrl,
  issueTypeName = "On-Page Issues",
  initialSelUrl = null,
  initialMode = "ai",
}) {
  const { activeProject } = useProject()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(initialMode)
  const [selUrl, setSelUrl] = useState(initialSelUrl)
  const fixPanelRef = useRef(null)
  useScrollIntoViewWhenStacked(fixPanelRef, selUrl)
  const [toast, setToast] = useState(null)
  // The AuditIQ tab mounts on first visit and then stays mounted (hidden), so its state survives tab switches
  // without issuing its request-status query for people who never open it.
  const [auditIqVisited, setAuditIqVisited] = useState(initialMode === "help")
  if (mode === "help" && !auditIqVisited) setAuditIqVisited(true)

  // Closes the pre-existing gap where a task silently verified/reopened in
  // the background (a routine recrawl) never reached this view without a
  // manual refresh — see useTaskRealtimeSync.js.
  // onNotice: the crawler's verdict on an automated sameAs fix (see describeVerificationNotice).
  useTaskRealtimeSync(activeProject?._id, { onNotice: setToast })

  // Resolve issueId once for reuse in both the issue context hook and mutation
  const issueId = issue.issue_code || issue.rule_id || issue.issue

  // API-backed task/fix tracking
  const { data: activeTaskUrlsResponse } = useActiveTaskUrls(activeProject?._id, issueId)
  const taskMap = activeTaskUrlsResponse?.data?.taskMap || {}
  const fixedUrlsSet = useMemo(() => new Set(activeTaskUrlsResponse?.data?.fixedUrls || []), [activeTaskUrlsResponse])
  const fixedCount = activeTaskUrlsResponse?.data?.fixedCount || 0

  // Creates a new task with status TASK_CREATED (AI recommendation panel "Create Task" button)
  const createTaskMutation = useMutation({
    mutationFn: async (url) => {
      const existingTask = taskMap[url]
      if (existingTask) {
        return { success: true, data: existingTask, alreadyExists: true }
      }
      return apiService.createTask({
        projectId: activeProject._id,
        issueKey: issueId,
        issueName: issue.title || issue.issue || issue.issue_message || issueId,
        issueCategory: issue.category || issueTypeName,
        pageUrl: url,
        status: 'task_created',
        origin: 'ai_fix',
        // Bug fix: recommendationService._formatOutput() (the actual shape
        // /recommendations/generate returns) names this field `id`, never
        // `_id` — confirmed by reading that function directly, not
        // assumed. `recommendation._id` was always undefined here, so
        // every task created alongside a freshly-generated recommendation
        // silently got recommendationId: null from day one, regardless of
        // anything else in this file.
        recommendationId: recommendation?.id || null,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activeUrls(activeProject._id, issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(activeProject._id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(activeProject._id) })
      if (result?.alreadyExists) {
        setToast({ message: 'Task already exists — use DIY Guide or History Logs to mark as implemented', type: 'success' })
      } else {
        setToast({ message: 'Task created — use the DIY Guide or History Logs to mark as implemented', type: 'success' })
      }
    },
    onError: (err) => {
      setToast({ message: err?.message || 'Failed to create task.', type: 'error' })
    },
  })

  // Transitions an existing task to IMPLEMENTED (DIY Guide "Mark as Implemented" button)
  const markImplementedMutation = useMutation({
    mutationFn: async (url) => {
      const existingTask = taskMap[url]
      if (existingTask?._id) {
        return apiService.updateTaskStatus(existingTask._id, 'implemented')
      }
      return apiService.createTask({
        projectId: activeProject._id,
        issueKey: issueId,
        issueName: issue.title || issue.issue || issue.issue_message || issueId,
        issueCategory: issue.category || issueTypeName,
        pageUrl: url,
        status: 'implemented',
        origin: 'diy_guide',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activeUrls(activeProject._id, issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(activeProject._id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(activeProject._id) })
      setToast({ message: 'Task marked as implemented — pending verification on next recrawl', type: 'success' })
    },
    onError: (err) => {
      setToast({ message: err?.message || 'Failed to mark as implemented.', type: 'error' })
    },
  })

  // Fetch the live issue context (same query that CurrentStateRenderer uses).
  // React Query deduplicates this — no extra network call when the sub-component
  // also renders CurrentStateRenderer for the same key.
  const { data: issueContextData, isLoading: issueContextLoading } = useIssueContext(activeProject?._id, issueId, selUrl)

  // Resolve the issueCode
  const issueCode = useMemo(() => {
    if (issue.issue_code) return issue.issue_code
    const codeMap = {
      "Images missing ALT text": "missing_alt",
      "Meta descriptions missing / empty": "missing_meta_description",
      "H1 missing or empty": "missing_h1",
      "Schema markup missing / invalid": "missing_schema",
      "Broken links (404)": "broken_links",
      "Noindex on key pages": "noindex_key_pages",
      "Canonical misconfigurations": "canonical_issues",
      "Multiple title tags": "multiple_titles"
    }
    return codeMap[issue.issue] || issue.issue
  }, [issue])

  // Fetch issue URLs using the centralized TanStack Query hook
  const { data: urlsResponse, isLoading: loadingUrls } = useIssueUrls(
    activeProject?._id,
    issue.affected_urls && Array.isArray(issue.affected_urls) ? null : issueCode
  )

  // Normalizes any of this hook's possible shapes into one consistent
  // { url, issue_message, severity, detected_value, data_path } shape, so
  // rendering below never has to branch on where a row came from. Plain
  // strings (issue.affected_urls, the mock fallback) become { url: str }
  // with no page-specific override — they fall back to the aggregate
  // `issue` object's message exactly like before this fix. Rules whose
  // backend endpoint returns per-page detail (see getIssueUrls in
  // onPageIssuesService.js) get their own accurate message/severity here
  // instead of the same aggregate text repeated for every row.
  const toUrlEntry = (item) =>
    typeof item === 'string' ? { url: item } : { url: item.url, ...item }

  const urls = useMemo(() => {
    if (issue.affected_urls && Array.isArray(issue.affected_urls)) {
      return issue.affected_urls.map(toUrlEntry)
    }
    if (urlsResponse?.success && Array.isArray(urlsResponse.data)) {
      return urlsResponse.data.map(toUrlEntry)
    }
    if (Array.isArray(urlsResponse)) {
      return urlsResponse.map(toUrlEntry)
    }
    // Fallback to mock data if query fails or loading is done and we have no data
    if (!loadingUrls && !urlsResponse) {
      return [
        "/about-us",
        "/services/seo-audit",
        "/blog/ai-search-2025",
        "/team",
        "/case-studies/techcorp",
        "/pricing",
        "/contact",
        "/features/white-label"
      ].map(toUrlEntry)
    }
    return []
  }, [urlsResponse, issue.affected_urls, loadingUrls])

  const openUrls = useMemo(
    () => urls.filter(u => !fixedUrlsSet.has(u.url)),
    [urls, fixedUrlsSet]
  )

  // Mutation state lifted to parent (persists across tab switches)
  const recommendationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiService.request('/recommendations/generate', {
        method: 'POST',
        body: JSON.stringify({
          projectId: activeProject?._id,
          issueId,
          issueSource: issue.rule_id ? "ai_visibility" : "on_page",
          pageUrl: selUrl || undefined,
          ruleMetadata: {
            title: issue.title || issue.issue || issue.issue_message,
            description: issue.description || issue.issue_message,
            category: issue.category,
            severity: issue.severity,
            difficulty: issue.difficulty,
          },
          // Pass resolved issue context so Claude generates from actual detected values,
          // not just issue metadata. Only sent when a URL is selected and context loaded.
          issueContext: issueContextData ? {
            currentState: issueContextData.currentState,
            expectedState: issueContextData.expectedState,
            pageContext: issueContextData.pageContext,
          } : undefined,
        }),
      });
      if (!response.success) throw new Error(response.message || 'Generation failed');
      return response;
    },
    retry: 1,
  });

  const { data, isIdle, isPending, isSuccess, isError, error } = recommendationMutation;
  // A breadcrumb hierarchy confirmed by the site owner regenerates the recommendation WITHOUT re-running the generation
  // mutation above (see BreadcrumbHierarchyPanel). Held here, next to the mutation state, so the DIY guide follows it too.
  const [replacedResult, setReplacedResult] = useState(null)
  // Local, ephemeral result of THIS component instance's own "Generate
  // Recommendation" click — NOT the source of truth for whether a
  // recommendation is linked to the task. Kept only to (a) display
  // freshly-generated content immediately, before the by-id fetch below
  // has round-tripped, and (b) drive the auto-link effect further down.
  const recommendation = replacedResult?.data ?? data?.data;
  const meta = replacedResult?.meta ?? data?.meta;

  // ── Apply via WordPress (Phase 4) ─────────────────────────────────────
  // Only offered when: a WordPress connection exists, the detected SEO
  // provider (unambiguously) supports writing this specific field, a task
  // already exists for the selected URL, and an AI recommendation is
  // linked to it — otherwise the existing "Mark as Implemented" (DIY) flow
  // is the only option, unchanged.
  const wordPressFieldType = WORDPRESS_FIXABLE_ISSUE_TYPES[issueId] || null
  const isSiteScoped = wordPressFieldType ? SITE_SCOPED_FIELD_TYPES.has(wordPressFieldType) : false
  // FAQ schema has no "current value → new value" to compare and needs no live
  // SEO-plugin read: capability comes from the Bridge itself (faqSchemaSupported)
  // and the dialog previews the exact schema to be written instead.
  const isFaqSchema = wordPressFieldType === "faq_schema"
  const isRatingSchema = wordPressFieldType === "aggregate_rating"
  const schemaChannel = wordPressFieldType ? SCHEMA_CHANNELS[wordPressFieldType] || null : null
  const isSchemaChannel = !!schemaChannel
  const isContentChannel = wordPressFieldType ? CONTENT_FIELD_TYPES.has(wordPressFieldType) : false
  // Enabled regardless of scope — site-scoped fields don't use its
  // per-field write flags (see wpFieldSupported below), but its
  // connected/providerLabel data is shared display info both dialogs use.
  const { data: wpCapabilitiesResponse, isError: wpCapabilitiesError } = useWordPressCapabilities(activeProject?._id, { enabled: !!wordPressFieldType || issueId === ORGANIZATION_FIX_ISSUE_ID || issueId === IMAGE_ALT_ISSUE_ID })
  const wpCapabilities = wpCapabilitiesResponse?.data
  const wpCapabilityKey = wordPressFieldType ? WORDPRESS_CAPABILITY_KEY[wordPressFieldType] : null
  // Site-scoped fields (same_as, breadcrumb) have no per-post capability
  // entry at all — the per-post /capabilities endpoint only ever reports
  // title/meta_description/canonical/robots. Capability for these instead
  // comes from a dedicated site-schema read (Section 13: capability ->
  // scope -> issue type, never hardcoded).
  const { data: wpSiteSchemaResponse, isLoading: wpSiteSchemaLoading, isError: wpSiteSchemaError, refetch: refetchWpSiteSchema } = useWordPressSiteSchema(
    activeProject?._id, { enabled: isSiteScoped }
  )
  const wpSiteSchema = wpSiteSchemaResponse?.data
  const wpFieldSupportedBase = !!(
    wordPressFieldType &&
    !isContentChannel &&
    (isSchemaChannel
      // Independent of which SEO plugin(s) are active — the Bridge renders the JSON-LD itself.
      ? (wpCapabilities?.connected && wpCapabilities?.[schemaChannel.capabilityFlag])
      : isSiteScoped
        ? wpSiteSchema?.supported
        : (wpCapabilities?.connected && !wpCapabilities?.ambiguous && wpCapabilities?.capabilities?.[wpCapabilityKey]?.write))
  )
  // Specific, capability-driven reason shown instead of an Apply option when
  // the connected site's Bridge can't apply FAQ schema (never a generic message).
  // The minimum version is NEVER hardcoded here: it comes from the backend's
  // BRIDGE_CAPABILITY_MIN_VERSIONS (capabilities.bridgeRequirements), the same
  // table the Bridge changelog is tested against, so this text cannot drift.
  const requiredBridgeVersion = isSchemaChannel ? wpCapabilities?.bridgeRequirements?.[schemaChannel.requirementKey] || null : null
  const installedBridgeVersion = wpCapabilities?.bridgeVersion || null
  const wpSchemaChannelUnsupportedReason = (isSchemaChannel && wpCapabilities?.connected && !wpCapabilities?.[schemaChannel.capabilityFlag])
    ? (wpCapabilities?.bridgeInstalled
      ? `Applying ${WORDPRESS_FIELD_LABEL[wordPressFieldType]} through WordPress requires ${requiredBridgeVersion ? `Odito SEO Bridge ${requiredBridgeVersion} or newer` : "a newer version of Odito SEO Bridge"}${installedBridgeVersion ? ` (this site has ${installedBridgeVersion})` : ""}. Update the plugin on this WordPress site, then try again.`
      : `Applying ${WORDPRESS_FIELD_LABEL[wordPressFieldType]} through WordPress requires the Odito SEO Bridge plugin. Install and activate it on this WordPress site, then try again.`)
    : null
  // Shown next to the (hidden) Apply option when the Bridge is simply too
  // old — the exact naxonify.com situation found during live verification:
  // deployed Bridge reports installed+active but predates site_schema.
  const wpSiteSchemaUnsupportedReason = (isSiteScoped && wpSiteSchema && !wpSiteSchema.supported) ? wpSiteSchema.reason : null

  const [wpConfirmOpen, setWpConfirmOpen] = useState(false)
  // Schema fixes apply to ONE page, so that page must resolve to a WordPress page/post first — the
  // same shared resolver the write uses. Read only while the dialog is open; a failed resolution
  // keeps Apply disabled and explains why (different site, blog-index homepage, unsupported type...).
  const {
    data: wpPageResolutionResponse, isLoading: wpPageResolutionLoading, isError: wpPageResolutionError,
  } = useWordPressPageResolution(activeProject?._id, selUrl, { enabled: wpConfirmOpen && isSchemaChannel })
  const wpPageResolution = wpPageResolutionResponse?.data
  const selectedTask = selUrl ? taskMap[selUrl] : null
  // The finding covered only analytics trackers: there is no picture to fix, so neither the AI recommendation, the DIY checklist
  // ("Mark as Implemented") nor the WordPress panel is offered — a notice says why instead.
  const altNotApplicable = issueId === IMAGE_ALT_ISSUE_ID && !!selUrl && isAltFindingNotApplicable(issueContextData)
  // Until the page's context is known the alt content is held back, so nothing is fetched or offered for a tracker-only finding and
  // then taken away. A FAILED context load does not block: everything behaves as it did before this check existed.
  const altContextPending = issueId === IMAGE_ALT_ISSUE_ID && !!selUrl && !!issueContextLoading
  const altNotApplicableNotice = (
    <div role="status" data-testid="image-alt-not-applicable" className="rounded-xl border border-border bg-muted p-4 text-[12.5px] leading-relaxed text-muted-foreground">
      <div className="mb-1 font-bold text-foreground">{ALT_NOT_APPLICABLE_TITLE}</div>
      {ALT_NOT_APPLICABLE_MESSAGE}
    </div>
  )
  const altPanel = getAltPanelAvailability({ selUrl, taskId: selectedTask?._id, wpCapabilities, capabilitiesError: !!wpCapabilitiesError })

  // Bug fix: this used to gate on the local `recommendation` (this
  // component instance's own last "Generate Recommendation" result) —
  // which has no relationship whatsoever to whether the SELECTED TASK
  // actually has a recommendation linked server-side. A task created
  // before any recommendation existed (e.g. via the DIY flow) keeps
  // recommendationId: null forever unless explicitly linked (see
  // linkRecommendationMutation below); the old check would still show
  // "Apply via WordPress" as soon as a recommendation was generated for
  // this ISSUE, regardless of whether IT was ever attached to THIS task,
  // and the backend would then correctly reject with
  // RECOMMENDATION_REQUIRED — exactly the inconsistent state a production
  // screenshot surfaced. selectedTask.recommendationId (now included by
  // getActiveTaskUrls — see taskController.js) is the only field that
  // reflects the actual persisted link.
  const linkedRecommendationId = selectedTask?.recommendationId || null

  const linkRecommendationMutation = useLinkTaskRecommendation(activeProject?._id, issueId)

  // Auto-link: if the task already exists but has no recommendation linked
  // (or is linked to a stale/different one) and this component just
  // generated one for the same issue, complete the link server-side —
  // the "Persist Recommendation -> Receive recommendationId -> Task has
  // recommendationId" sequence, just completed retroactively for a task
  // that predates the recommendation rather than at task-creation time.
  // Never fires more than once per (task, recommendation) pair.
  //
  // Bug fix: this used `recommendation._id` (always undefined — see the
  // matching fix in createTaskMutation above for why: the recommendation
  // API names this field `id`), so this effect's very first guard bailed
  // out on every single run and the auto-link never fired at all. Caught
  // only by reading recommendationService._formatOutput()'s actual return
  // shape directly, not by assuming the field name.
  useEffect(() => {
    if (!selectedTask?._id || !recommendation?.id) return
    if (linkedRecommendationId === recommendation.id) return
    if (linkRecommendationMutation.isPending) return
    linkRecommendationMutation.mutate({ taskId: selectedTask._id, recommendationId: recommendation.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?._id, recommendation?.id, linkedRecommendationId])

  // The AUTHORITATIVE recommendation content — fetched by the id the task
  // actually persists, never assumed to be whatever this component's local
  // generation mutation happens to hold (that could belong to a different
  // task, or no longer exist after a page reload with no local state at
  // all). This is what canOfferWordPressApply and the dialog's preview
  // both key off from here on.
  const { data: linkedRecommendationResponse, isLoading: linkedRecommendationLoading } = useRecommendationById(
    activeProject?._id, linkedRecommendationId, { enabled: !!linkedRecommendationId }
  )
  const linkedRecommendation = linkedRecommendationResponse?.data || null

  // Page-content (H1) eligibility, decided per page by the backend's builder adapter. Fetched once the
  // task's linked recommendation (if any) is known so the backend can preview it in the same call —
  // `recommended` is display-only; what is written is derived server-side from the task's own
  // Recommendation.
  const wpH1RecommendedText = isContentChannel
    ? (linkedRecommendation?.sections?.contentRewrite?.optimized || linkedRecommendation?.sections?.recommendedVersion || null)
    : null
  const {
    data: wpH1ContextResponse, isLoading: wpH1ContextLoading, isError: wpH1ContextError, refetch: refetchWpH1Context,
  } = useWordPressH1Context(activeProject?._id, selUrl, wpH1RecommendedText, {
    enabled: isContentChannel && !!selUrl && !!selectedTask && (!linkedRecommendationId || (!!linkedRecommendation && !linkedRecommendationLoading)),
  })
  const wpH1Context = wpH1ContextResponse?.data
  const wpFieldSupported = isContentChannel
    ? !!(wpCapabilities?.connected && wpH1Context?.supported)
    : wpFieldSupportedBase
  // The specific reason this page's H1 cannot be applied automatically (builder not supported, an H1
  // already exists, ...) — shown instead of an Apply option, never a generic message.
  const wpContentUnsupportedReason = (isContentChannel && wpCapabilities?.connected && wpH1Context)
    ? (!wpH1Context.supported
      ? wpH1Context.reason
      : (wpH1Context.recommended && !wpH1Context.recommended.ok
        ? `The recommended H1 cannot be applied automatically: ${wpH1Context.recommended.message}`
        : null))
    : null

  // ALL of: field supported, a task exists, that task has a real persisted
  // recommendationId, AND the recommendation it points to has actually
  // loaded (never offer Apply while still confirming the link is real).
  // For an H1 the recommendation must also be applicable as plain text.
  const canOfferWordPressApply = !!(
    wpFieldSupported && selUrl && selectedTask && linkedRecommendationId &&
    linkedRecommendation && !linkedRecommendationLoading &&
    (!isContentChannel || wpH1Context?.recommended?.ok)
  )

  // Live current value, fetched only while the confirmation dialog is open
  // — never cached/displayed stale, and re-sent back to the server as
  // expectedCurrentValue so the backend's read-before-write conflict check
  // compares against exactly what this dialog showed.
  const { data: wpSeoDataResponse, isLoading: wpSeoDataLoading, isError: wpSeoDataError } = useWordPressSeoData(
    activeProject?._id, selUrl, { enabled: wpConfirmOpen && !!selUrl && !isSiteScoped && !isSchemaChannel && !isContentChannel }
  )
  const wpLiveValue = wordPressFieldType
    ? wpSeoDataResponse?.data?.seo?.[wpCapabilityKey] ?? null
    : null
  // Display-only reformat for robots (see formatRobotsWireValueForDisplay's
  // own comment) — wpLiveValue itself stays the raw wire string, since
  // that's what's sent back as expectedCurrentValue below. Also fixes a
  // real "(empty)" bug of its own: robots' confirmed "no restriction" wire
  // value is the empty string "", which is falsy and would otherwise render
  // as "(empty)" — indistinguishable from a genuinely unknown value — via
  // the dialog's `currentValue || "(empty)"` check.
  const wpLiveValueDisplay = (wordPressFieldType === "robots" && typeof wpLiveValue === "string")
    ? formatRobotsWireValueForDisplay(wpLiveValue)
    : wpLiveValue
  // Bug fix: a failed live-read (network error, WordPress unreachable) and
  // a page that genuinely has no meta description were both funneled into
  // the same `?? null` -> "(empty)" display — indistinguishable to the
  // user, and unsafe to Apply against since expectedCurrentValue would
  // silently be null instead of a real read. Tracked separately so the
  // dialog can tell them apart and refuse to offer Apply when the read
  // itself failed, rather than only when the value happens to be empty.
  const wpLiveValueUnavailable = wpConfirmOpen && !wpSeoDataLoading && wpSeoDataError

  // Same source TaskHistoryService.resolveExpectedValue() reads server-side
  // (sections.contentRewrite.optimized, falling back to recommendedVersion)
  // — shown here for the user's approval, but the backend re-derives it
  // independently, BY THE SAME task.recommendationId, rather than trusting
  // anything sent from this dialog. Sourced from linkedRecommendation (the
  // by-id fetch above), never the local generation-mutation state.
  const newValueForWordPress = wordPressFieldType
    ? (linkedRecommendation?.sections?.contentRewrite?.optimized || linkedRecommendation?.sections?.recommendedVersion || null)
    : null

  const applyWordPressFixMutation = useMutation({
    // `profiles` is only ever set by the sameAs dialog: the site owner's own
    // URLs ({ additionalProfiles, removeProfiles, expectedAdditionalProfiles }).
    // Every other fix passes nothing and the backend derives the value itself.
    mutationFn: async (profiles) => {
      if (!selectedTask?._id) throw new Error('No task exists for this URL yet.')
      // The H1 fix carries only the fingerprint of the page state the dialog showed.
      if (isContentChannel && !wpH1Context?.fingerprint) throw new Error('The page state could not be read. Refresh and try again.')
      return apiService.applyWordPressFix(selectedTask._id, {
        ...(isContentChannel ? { expectedContentFingerprint: wpH1Context.fingerprint } : {}),
        ...(wordPressFieldType === 'same_as' && profiles ? profiles : {}),
        // Site-scoped fixes (same_as add, breadcrumb enable) are additive/
        // idempotent by construction server-side (see
        // RankMathProvider::update_same_as's membership check and the
        // breadcrumbs toggle) — there's no single prior "current value" a
        // stale-value conflict check would compare against the way there is
        // for a per-post replace-value field, so expectedCurrentValue is
        // simply never sent for these.
        // Schema fixes (FAQ, AggregateRating) likewise send no expectedCurrentValue: the backend re-derives
        // the schema from the task's own recommendation and re-checks it against
        // the page's latest crawled FAQ, so there is no client-held "current
        // value" to conflict-check.
        ...((isSiteScoped || isSchemaChannel || isContentChannel) ? {} : { expectedCurrentValue: wpLiveValue }),
        approved: true,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.activeUrls(activeProject._id, issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(activeProject._id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.summary(activeProject._id) })
      // Site-scoped writes change state that isn't keyed by pageUrl at all —
      // invalidate the one site-schema query (not any per-page seo-data
      // query) so the dialog's "Current Social Profiles"/breadcrumb status
      // reflects the real post-write state next time it's opened, on ANY
      // page's issue detail view, not just this one (Section 14: invalidate
      // only the affected queries, avoid global cache resets).
      if (isSiteScoped && activeProject?._id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.siteSchema(activeProject._id) })
      }
      if (isContentChannel && activeProject?._id) {
        queryClient.invalidateQueries({ queryKey: ['wordpress', activeProject._id, 'h1-context'] })
      }
      setWpConfirmOpen(false)
      // Idempotent re-apply (backend detected the live value already
      // matched — no WordPress write occurred) is still a SUCCESS, worded
      // distinctly rather than repeating "Applied" as if a new write just
      // happened (Section 10 of the Phase 3 spec).
      const alreadyApplied = result?.data?.alreadyApplied
      // Bug fix (production): this toast used to always say "Applied via
      // WordPress" with a green success icon whenever the request returned
      // HTTP 200 — even when the backend's own immediate read-after-write
      // check (wordPressSeoFixService.applyFix's `immediateVerification`)
      // came back 'failed' or 'unknown'. That is exactly how a canonical
      // value could get written as a literal HTML string, "succeed" (the
      // write and the read-back agreed on the same garbage value), and
      // still show the user a plain, unqualified success toast. The
      // malformed-value case itself is now rejected upstream before any
      // write happens (see valueNormalization.extractCanonicalUrlValue /
      // TaskHistoryService._deriveExpectedAfterValue), but a GENUINE
      // mismatch — WordPress accepted the write, yet the immediate re-read
      // did not match what was sent — is still possible (a slow-propagating
      // cache, a conflicting plugin, etc.) and must never be reported as an
      // unqualified success either. `implemented` here always means "a
      // real WordPress write was attempted and recorded" — the ONLY
      // authoritative confirmation remains TaskVerificationService after
      // the next recrawl, in every branch below.
      const immediateVerification = result?.data?.immediateVerification
      if (isContentChannel) {
        // The page's content was edited: say what happened, and that only the next crawl can verify it.
        if (immediateVerification === 'success') {
          setToast({ message: 'H1 added to your page via WordPress — pending verification on next recrawl', type: 'success' })
        } else {
          setToast({
            message: 'The H1 was saved to WordPress, but Odito could not confirm it on the live page yet (a cache may still be serving the old page). It will be re-checked on the next recrawl.',
            type: 'warning',
          })
        }
      } else if (wordPressFieldType === 'same_as') {
        // Never "SEO issue fixed": WordPress accepted the profiles, and only the
        // next crawl of the rendered Organization JSON-LD can confirm them
        // (TaskVerificationService is the sole authority for verified_fixed).
        const sameAs = result?.data?.sameAs
        const count = sameAs?.added?.length || 0
        if (alreadyApplied) {
          setToast({ message: 'These profiles are already in your Organization schema — no change needed. Verification pending.', type: 'success' })
        } else if (immediateVerification === 'success') {
          setToast({ message: count === 1 ? 'Social profile added to WordPress. Verification pending.' : 'Social profiles added to WordPress. Verification pending.', type: 'success' })
        } else {
          setToast({
            message: 'Sent to WordPress, but Odito could not confirm the saved profiles match what you entered. The Organization schema output will be checked on the next recrawl.',
            type: 'warning',
          })
        }
      } else if (alreadyApplied) {
        setToast({
          message: 'This value was already correct on WordPress — no change needed. Pending verification on next recrawl.',
          type: 'success',
        })
      } else if (immediateVerification === 'success') {
        setToast({ message: 'Applied via WordPress — pending verification on next recrawl', type: 'success' })
      } else if (immediateVerification === 'failed') {
        setToast({
          message: 'Sent to WordPress, but the immediate re-check did not confirm the value was saved as expected. This will be re-checked on the next recrawl.',
          type: 'warning',
        })
      } else {
        // 'unknown' — the write was sent but the immediate re-read itself
        // failed (network error, etc.), so nothing here confirms or denies
        // the value actually persisted.
        setToast({
          message: 'Sent to WordPress, but Odito could not immediately confirm it was saved. This will be checked on the next recrawl.',
          type: 'warning',
        })
      }
    },
    onError: () => {
      // Error is rendered inline in the confirmation dialog (conflict,
      // permission, etc. all benefit from staying visible next to the
      // current/new value comparison) rather than as a toast that
      // auto-dismisses after 3.5s.
    },
  })

  const onApplyViaWordPress = useCallback(() => {
    if (canOfferWordPressApply) setWpConfirmOpen(true)
  }, [canOfferWordPressApply])

  // The backend refuses a schema whose content is no longer what the page shows
  // (FAQ_CONTENT_CHANGED / RATING_CONTENT_CHANGED). The only fix is a new
  // recommendation built from the current crawl; the auto-link effect above
  // re-links it to this task.
  const onRegenerateSchema = useCallback(() => {
    setWpConfirmOpen(false)
    applyWordPressFixMutation.reset()
    recommendationMutation.mutate()
    setToast({ message: schemaChannel?.regenerateToast || 'Regenerating from the current page — review it, then apply again.', type: 'success' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyWordPressFixMutation, recommendationMutation, schemaChannel])

  const applyErrorInfo = useMemo(
    () => (applyWordPressFixMutation.isError ? describeApplyError(applyWordPressFixMutation.error) : null),
    [applyWordPressFixMutation.isError, applyWordPressFixMutation.error]
  )

  // After a CONFLICT, the user must explicitly refresh the live value
  // before trying again — never silently re-fetched (Section 8: "do not
  // automatically retry... do not silently refresh and write again"). This
  // clears the stale error/value and re-fetches via the same
  // useWordPressSeoData query the dialog already reads.
  const onRefreshLiveValue = useCallback(() => {
    applyWordPressFixMutation.reset()
    if (!activeProject?._id) return
    if (isContentChannel) {
      refetchWpH1Context()
    } else if (isSiteScoped) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.siteSchema(activeProject._id) })
    } else if (selUrl) {
      queryClient.invalidateQueries({ queryKey: queryKeys.wordpress.seoData(activeProject._id, selUrl) })
    }
  }, [applyWordPressFixMutation, queryClient, activeProject?._id, selUrl, isSiteScoped, isContentChannel, refetchWpH1Context])

  // Site-schema freshness on dialog open — mirrors useWordPressSeoData's own
  // "never cached/displayed stale" guarantee for the per-post dialog. The
  // site-schema query itself stays always-enabled while isSiteScoped (it
  // also drives wpFieldSupported, the capability gate), so this refetches
  // rather than toggling `enabled`.
  useEffect(() => {
    if (wpConfirmOpen && isSiteScoped) refetchWpSiteSchema()
    // The H1 fingerprint the user approves must be as fresh as the dialog they are looking at.
    if (wpConfirmOpen && isContentChannel) refetchWpH1Context()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wpConfirmOpen, isSiteScoped, isContentChannel])

  // Recommendation mutation state is lifted to this parent (see comment
  // above) specifically so it survives tab switches — but that same lift
  // means nothing was clearing it when the user moves to a different URL,
  // so a stale recommendation for the previous URL kept rendering under the
  // newly-selected page's context. useMutation has no queryKey (unlike
  // useIssueContext below, which is correctly keyed by selUrl and so
  // self-invalidates), so it never resets on its own — reset() must be
  // called explicitly. This also covers the Clear button (selUrl -> null)
  // since that's just another value change on the same dependency.
  //
  // reset() detaches this observer from whatever mutation was in flight
  // (see MutationObserver#reset in @tanstack/query-core), so even a
  // slow-resolving generation for the previous URL can never flip this
  // panel back to a stale "success" state after the user has moved on.
  useEffect(() => {
    recommendationMutation.reset()
    setReplacedResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selUrl])

  // Calculate progress
  const totalUrls = fixedCount + openUrls.length
  const progress = totalUrls > 0 ? Math.round((fixedCount / totalUrls) * 100) : 0

  // Inject custom fonts
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
    `
    document.head.appendChild(style)

    return () => {
      if (style && style.parentNode) {
        document.head.removeChild(style)
      }
    }
  }, [])

  // ── Current State Section ──────────────────────────────────────────────

  /**
   * Isolated sub-component so the React Query hook runs at component level
   * and doesn't cause hook-order violations when selUrl changes.
   */
  function IssueCurrentStateSection({ projectId, issueId, pageUrl }) {
    const {
      data: issueContext,
      isLoading,
      error,
    } = useIssueContext(projectId, issueId, pageUrl)

    if (!pageUrl) return null

    return (
      <div style={{ marginBottom: 16 }}>
        {/* Divider label */}
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ flex: 1, height: 1, background: 'var(--b)' }} />
          Detected Issue
          <span style={{ flex: 1, height: 1, background: 'var(--b)' }} />
        </div>

        <CurrentStateRenderer
          issueContext={issueContext}
          isLoading={isLoading}
          error={error}
        />

        {/* Spacer before tabs */}
        <div style={{ height: 14, borderBottom: '1px solid var(--b)', marginTop: 14 }} />
      </div>
    )
  }

  // isPending only flips on the next render — the ref makes rapid repeated clicks
  // send exactly one request.
  const createTaskInFlight = useRef(false)
  const onCreateTask = useCallback(() => {
    if (selUrl && !createTaskInFlight.current) {
      createTaskInFlight.current = true
      createTaskMutation.mutate(selUrl, { onSettled: () => { createTaskInFlight.current = false } })
    }
  }, [selUrl, createTaskMutation])

  const onMarkImplemented = useCallback(() => {
    if (selUrl && !markImplementedMutation.isPending) {
      markImplementedMutation.mutate(selUrl)
    }
  }, [selUrl, markImplementedMutation])

  return (
    <div className="fi">
      {/* Breadcrumb */}
      <div className="detail-breadcrumb">
        <button
          className="task-btn secondary tap-target"
          style={{ fontSize: "11.5px" }}
          onClick={onBack}
        >
          ← {issueTypeName}
        </button>
        <span style={{ color: "var(--t3)", fontSize: "12px" }}>›</span>
        <span className="detail-breadcrumb__current" style={{ fontSize: "12px", color: "var(--t2)", fontWeight: "500" }}>
          {issue.title || issue.issue || issue.issue_message}
        </span>
      </div>

      {/* Header */}
      <div className="detail-title-row">
        <div style={{
          width: 50,
          height: 50,
          borderRadius: 13,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          background: issue.severity === "high" ? "var(--color-status-error-surface)" :
            issue.severity === "medium" ? "var(--color-status-warning-surface)" :
              "var(--color-status-info-surface)",
          color: issue.severity === "high" ? "var(--re)" :
            issue.severity === "medium" ? "var(--am)" :
              "var(--cy)",
          flexShrink: 0
        }}>
          {issue.severity === "high" ? "⚠" : issue.severity === "medium" ? "⚡" : "✓"}
        </div>
        <h2 className="detail-title-row__title" style={{
          fontFamily: "/dashboard",
          color: "var(--t)"
        }}>
          {issue.title || issue.issue || issue.issue_message}
        </h2>
        <span className="detail-title-row__pill" style={{
          background: "var(--color-brand-cyan-surface)",
          border: "1px solid var(--color-brand-cyan-border)",
          color: "var(--cy)",
          borderRadius: 20,
          padding: "4px 13px",
          fontSize: 11,
          fontWeight: 600
        }}>🗂 {issueTypeName}</span>
      </div>

      {/* 4 Stat Tiles */}
      <div className="detail-stat-grid">
        <div style={{
          background: "var(--s)",
          border: "1px solid var(--b)",
          borderRadius: 14,
          padding: "16px 18px"
        }}>
          <div style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "var(--t3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8
          }}>PAGES AFFECTED</div>
          <div style={{
            fontFamily: "/dashboard",
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            color: "var(--re)"
          }}>{issue.pages || issue.pages_affected || 0}</div>
        </div>
        <div style={{
          background: "var(--s)",
          border: "1px solid var(--b)",
          borderRadius: 14,
          padding: "16px 18px"
        }}>
          <div style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "var(--t3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8
          }}>PAGES AFFECTED %</div>
          <div style={{
            fontFamily: "/dashboard",
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            color: "var(--cy)"
          }}>{issue.impact || issue.impact_percentage || 0}%</div>
        </div>
        <div style={{
          background: "var(--s)",
          border: "1px solid var(--b)",
          borderRadius: 14,
          padding: "16px 18px"
        }}>
          <div style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "var(--t3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8
          }}>DIFFICULTY</div>
          <div style={{
            fontFamily: "/dashboard",
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            color: issue.difficulty === "Easy" ? "var(--gr)" :
              issue.difficulty === "Medium" ? "var(--am)" : "var(--re)"
          }}>{issue.difficulty || "Medium"}</div>
        </div>
        <div style={{
          background: "var(--s)",
          border: "1px solid var(--b)",
          borderRadius: 14,
          padding: "16px 18px"
        }}>
          <div style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: "var(--t3)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8
          }}>FIXED</div>
          <div style={{
            fontFamily: "/dashboard",
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1,
            color: "var(--vi)"
          }}>{fixedCount}/{totalUrls}</div>
        </div>
      </div>

      {/* ARIA Issue Breakdown */}
      <div style={{
        marginBottom: 22,
        background: "linear-gradient(135deg, var(--color-brand-violet-surface), var(--color-brand-cyan-surface))",
        border: "1px solid var(--color-brand-violet-border)",
        borderRadius: 14,
        padding: "18px 22px",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          right: 14,
          top: 12,
          fontSize: 20,
          opacity: 0.1,
          color: "var(--cy)",
          pointerEvents: "none"
        }}>✦</div>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--vi)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 8
        }}>✦ ARIA — ISSUE BREAKDOWN</div>
        <div style={{
          fontSize: 13,
          color: "var(--t2)",
          lineHeight: 1.65
        }}>
          This issue affects {issue.pages || issue.pages_affected || 0} pages
          ({issue.impact || issue.impact_percentage || 0}% of pages analyzed).
          Missing or empty attributes reduce both search engine understanding and AI citation probability.
          Fixing this is rated {issue.difficulty || "Medium"} difficulty.
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="detail-split">
        {/* Left Column - URLs */}
        <div className="detail-split__main">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="font-dashboard text-base font-bold text-foreground">
                Affected URLs
              </div>
              <div className="bg-[var(--color-brand-cyan-surface)] border border-[var(--color-brand-cyan-border)] text-[var(--cy)] rounded-full text-[9px] font-bold px-2.5 py-0.5 ml-2">
                {openUrls.length} OPEN
              </div>
            </div>
          </div>

          {openUrls.map(entry => {
            const { url, issue_message: pageIssueMessage } = entry
            const isSelected = selUrl === url
            const task = taskMap[url]
            let badge = null
            if (task) {
              if (task.status === 'implemented') {
                badge = (
                  <span className="bg-[rgba(157,78,221,0.08)] border border-[rgba(157,78,221,0.18)] text-[#b580ff] rounded-full text-[9px] font-bold px-2 py-0.5 ml-2 uppercase tracking-wide">
                    Implemented
                  </span>
                )
              } else if (task.status === 'reopened') {
                badge = (
                  <span className="bg-[rgba(255,56,96,0.08)] border border-[rgba(255,56,96,0.18)] text-[#ff6080] rounded-full text-[9px] font-bold px-2 py-0.5 ml-2 uppercase tracking-wide">
                    Reopened
                  </span>
                )
              } else if (task.status === 'task_created') {
                badge = (
                  <span className="bg-[rgba(0,223,255,0.08)] border border-[rgba(0,223,255,0.18)] text-[#00dfff] rounded-full text-[9px] font-bold px-2 py-0.5 ml-2 uppercase tracking-wide">
                    Active Task
                  </span>
                )
              }
            }

            return (
              <div
                key={url}
                className={`
                  flex items-center gap-2.5 p-3 mb-2 bg-card rounded-xl cursor-pointer
                  transition-all duration-200 border min-w-0
                  ${isSelected ? 'bg-[var(--color-brand-violet-surface)] border-[var(--color-brand-violet-border)]' : 'border-border hover:bg-[var(--color-surface-hover)]'}
                `}
                onClick={() => setSelUrl(isSelected ? null : url)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                    <div
                      className="font-dashboard text-[var(--cy)] font-medium min-w-0 [overflow-wrap:anywhere]"
                      style={{ fontSize: "13px" }}
                      title={url}
                    >
                      {url}
                    </div>
                    {badge}
                  </div>
                  <div className="text-[10.5px] mt-0.5 [overflow-wrap:anywhere]" style={{ color: 'var(--t2)' }}>
                    {pageIssueMessage || issue.issue || issue.issue_message || 'Issue detected on this page'}
                  </div>
                </div>
                <button
                  className="tap-target bg-[var(--color-status-error-surface)] text-[var(--re)] border border-[var(--color-status-error-border)]
                           text-[10px] font-medium px-2.5 py-1 rounded-md flex-shrink-0 mr-1.5
                           transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenUrl?.(url)
                  }}
                >
                  Open
                </button>
                <button
                  className="tap-target bg-gradient-to-r from-[#7730ed] to-[#00dfff] text-white border-none
                           text-[10px] font-bold px-3 py-1 rounded-md flex-shrink-0
                           shadow-[0_0_12px_rgba(0,223,255,0.2)] transition-all duration-200
                           hover:-translate-y-px hover:shadow-[0_3px_16px_rgba(0,223,255,0.3)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelUrl(url)
                    setMode("ai")
                  }}
                >
                  ✦ Fix
                </button>
              </div>
            )
          })}

          {/* Progress Card */}
          <div className="mt-3.5 bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between mb-2.5">
              <span className="text-xs text-muted-foreground">Remediation Progress</span>
              <span className="text-xs font-bold text-[var(--gr)]">{fixedCount}/{totalUrls} Fixed</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-[var(--gr)] transition-all duration-1100 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <div className="text-xs text-[var(--gr)] font-semibold text-center mt-2.5">
                🎉 All issues resolved! Re-audit to confirm.
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Fix Panel */}
        <div ref={fixPanelRef} className="detail-split__aside" data-selected={selUrl ? "true" : "false"}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden sticky top-0">
            {/* Panel Header */}
            <div className="px-4.5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-dashboard text-sm font-bold text-foreground">
                  {selUrl ? "✦ AI Recommendation" : "Fix Assistant"}
                </div>
              </div>
              {selUrl && (
                <button
                  className="tap-target bg-muted border border-border 
                           rounded-md px-2 py-0.5 text-xs text-muted-foreground cursor-pointer
                           hover:bg-accent transition-colors"
                  onClick={() => setSelUrl(null)}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Panel Body */}
            <div className="p-4.5 max-h-[calc(100vh-180px)] overflow-y-auto">

              {/* ── Current State Section ────────────────────────────── */}
              <IssueCurrentStateSection
                projectId={activeProject?._id}
                issueId={issueId}
                pageUrl={selUrl}
              />

              {/* 3-Tab Switcher */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                border: "1px solid var(--b)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 18
              }}>
                <button
                  className="tap-target"
                  style={{
                    padding: "9px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    background: mode === "ai" ? "linear-gradient(135deg,#7730ed,#00dfff)" : "transparent",
                    color: mode === "ai" ? "#fff" : "var(--t3)",
                    cursor: "pointer",
                    lineHeight: 1.3,
                    transition: "all 0.2s",
                    borderRight: "1px solid var(--b)"
                  }}
                  onClick={() => setMode("ai")}
                >
                  ✦ Fix with AI
                </button>
                <button
                  className="tap-target"
                  style={{
                    padding: "9px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    background: mode === "diy" ? "linear-gradient(135deg,#7730ed,#00dfff)" : "transparent",
                    color: mode === "diy" ? "#fff" : "var(--t3)",
                    cursor: "pointer",
                    lineHeight: 1.3,
                    transition: "all 0.2s",
                    borderLeft: "1px solid var(--b)",
                    borderRight: "1px solid var(--b)"
                  }}
                  onClick={() => setMode("diy")}
                >
                  🛠 DIY Guide
                </button>
                <button
                  className="tap-target"
                  style={{
                    padding: "9px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    background: mode === "help" ? "linear-gradient(135deg,#7730ed,#00dfff)" : "transparent",
                    color: mode === "help" ? "#fff" : "var(--t3)",
                    cursor: "pointer",
                    lineHeight: 1.3,
                    transition: "all 0.2s",
                    borderLeft: "1px solid var(--b)"
                  }}
                  onClick={() => setMode("help")}
                >
                  🤝 AuditIQ
                </button>
              </div>

              {/* Tab 1: AI Recommendation */}
              {mode === "ai" && altContextPending && <div role="status" data-testid="image-alt-context-loading" className="p-3 text-[12px] text-muted-foreground">Checking what this page flagged…</div>}
              {mode === "ai" && altNotApplicable && altNotApplicableNotice}
              {mode === "ai" && !altNotApplicable && !altContextPending && (
                <>
                <IssueRecommendationPanel
                  projectId={activeProject?._id}
                  issueId={issueId}
                  issueSource={issue.rule_id ? "ai_visibility" : "on_page"}
                  selUrl={selUrl}
                  issue={issue}
                  onCreateTask={onCreateTask}
                  isCreatingTask={createTaskMutation.isPending}
                  task={selUrl ? taskMap[selUrl] : null}
                  faqDetection={issueId === FAQ_ISSUE_ID ? getFaqDetection(issueContextData) : null}
                  ratingDetection={issueId === RATING_ISSUE_ID ? getRatingDetection(issueContextData) : null}
                  mutationState={{
                    isIdle,
                    isPending,
                    isSuccess,
                    isError,
                    error,
                    recommendation,
                    meta,
                  }}
                  onGenerate={() => { setReplacedResult(null); recommendationMutation.mutate() }}
                  onReset={() => { setReplacedResult(null); recommendationMutation.reset() }}
                  onRecommendationReplaced={setReplacedResult}
                />
                {/* Organization schema: the typed preview -> approve -> apply -> verify -> rollback workflow. Offered only once a
                    task exists with a linked recommendation and WordPress is connected; the panel itself explains anything unsupported. */}
                {issueId === ORGANIZATION_FIX_ISSUE_ID && selectedTask?._id && linkedRecommendationId && wpCapabilities?.connected && (
                  <OrganizationFixPanel projectId={activeProject?._id} task={selectedTask} />
                )}
                {/* Breadcrumbs: once the owner has confirmed a trail, the exact change WordPress can make for it (or the manual steps), approval,
                    apply, and verification of the live pages. The card renders nothing until there is a task and a confirmed trail. */}
                {issueId === BREADCRUMB_ISSUE_ID && selectedTask?._id && (
                  <BreadcrumbFixCard projectId={activeProject?._id} task={selectedTask} recommendationLinked={!!linkedRecommendationId} />
                )}
                {/* Organization sameAs: discover the profile links on the site, review/edit/add, preview the exact change, approve, apply,
                    verify. Discovery and preview need no task or recommendation; applying does (the panel says so and offers to create the task). */}
                {issueId === SAMEAS_ISSUE_ID && selUrl && (
                  <SameAsFixPanel
                    key={selUrl}
                    projectId={activeProject?._id}
                    pageUrl={selUrl}
                    task={selectedTask}
                    hasRecommendation={!!(recommendation || linkedRecommendation)}
                    recommendationLinked={!!(selectedTask?._id && linkedRecommendationId)}
                    onCreateTask={onCreateTask}
                    isCreatingTask={createTaskMutation.isPending}
                  />
                )}
                {/* Image alt text: one image at a time, written to the media library only after approval. The text is written by
                    a person, so no linked recommendation is required — only a task and a connected WordPress site. */}
                {issueId === IMAGE_ALT_ISSUE_ID && altPanel.available && (
                  <ImageAltFixPanel projectId={activeProject?._id} task={selectedTask} recommendationKey={`${recommendation?.id || linkedRecommendationId || ""}:${recommendation?.updatedAt || ""}`} />
                )}
                {/* When the panel cannot be offered, say why — never a silent absence. */}
                {issueId === IMAGE_ALT_ISSUE_ID && !altPanel.available && altPanel.message && (
                  <div role="status" data-testid="image-alt-unavailable" data-reason={altPanel.reason} className="mt-3 rounded-lg border border-border bg-muted px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    {altPanel.message}
                  </div>
                )}
                </>
              )}

              {/* Tab 2: DIY Guide — Uses shared recommendation intelligence.
                  Falls back to linkedRecommendation (the task's own
                  persisted recommendation, fetched by id) when this
                  component instance hasn't generated one itself this
                  session — e.g. after a page reload, where `recommendation`
                  (the local generation-mutation result) is empty but the
                  task already has a real one linked. Without this fallback,
                  a correctly-gated canOfferWordPressApply:true could never
                  actually be reached, since this tab wouldn't render at all. */}
              {mode === "diy" && altNotApplicable && altNotApplicableNotice}
              {mode === "diy" && !altNotApplicable && !altContextPending && (recommendation || linkedRecommendation) && (
                <DIYRenderer
                  recommendation={recommendation || linkedRecommendation}
                  issue={issue}
                  task={selUrl ? taskMap[selUrl] : null}
                  selUrl={selUrl}
                  onMarkImplemented={onMarkImplemented}
                  isMarkingImplemented={markImplementedMutation.isPending}
                  canApplyViaWordPress={canOfferWordPressApply && wordPressFieldType !== "same_as" && wordPressFieldType !== "breadcrumb"}
                  wordPressFieldLabel={wordPressFieldType ? WORDPRESS_FIELD_LABEL[wordPressFieldType] : null}
                  wordPressProviderLabel={wpCapabilities?.providerLabel}
                  wordPressBridgeRequired={!!(wordPressFieldType && !isContentChannel && wpCapabilities?.connected && !wpCapabilities?.ambiguous && wpCapabilities?.bridgeRequired && !wpFieldSupported)}
                  wordPressUnsupportedReason={wpSiteSchemaUnsupportedReason || wpSchemaChannelUnsupportedReason || wpContentUnsupportedReason || (issueId === IMAGE_ALT_ISSUE_ID ? ALT_DIY_POINTER : issueId === SAMEAS_ISSUE_ID ? SAMEAS_DIY_POINTER : issueId === BREADCRUMB_ISSUE_ID ? BREADCRUMB_DIY_POINTER : null)}
                  wordPressUserInputHint={wordPressFieldType === "same_as"
                    ? "Open the AI Recommendation tab: Odito finds the profile links on your own site, you review or add your own, and only then approve the exact change to your Organization schema in WordPress. Odito never guesses profile URLs."
                    : (isContentChannel && wpH1Context?.supported
                      ? `Odito can add the H1 to this page directly in WordPress (${wpH1Context.builder?.label || "page builder"}). You will review exactly what changes before anything is written.`
                      : null)}
                  wordPressRecommendationMissing={!!(wpFieldSupported && selUrl && selectedTask && !linkedRecommendationId)}
                  onGenerateRecommendation={() => recommendationMutation.mutate()}
                  onApplyViaWordPress={onApplyViaWordPress}
                />
              )}

              {/* Tab 2: DIY Guide — Fallback when no recommendation. Uses the
                  SAME "no recommendation linked" wording the backend/dialog
                  use (Section 7, State A) when this field would otherwise
                  be eligible for Apply via WordPress, so the message is
                  identical regardless of whether the DIY guide has other
                  content to show yet. */}
              {mode === "diy" && !altNotApplicable && !altContextPending && !recommendation && !linkedRecommendation && (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--t2)",
                  fontSize: "11.5px",
                  lineHeight: 1.65
                }}>
                  {wpFieldSupported && selUrl && selectedTask
                    ? "No AI recommendation is linked to this task yet — generate one before applying a WordPress fix."
                    : "Generate an AI recommendation first to access the DIY guide."}
                  {wpFieldSupported && selUrl && selectedTask && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => recommendationMutation.mutate()}
                        disabled={recommendationMutation.isPending}
                        style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                          border: "1px solid var(--b)", background: "var(--s2)", color: "var(--t)",
                          cursor: recommendationMutation.isPending ? "not-allowed" : "pointer",
                        }}
                      >
                        {recommendationMutation.isPending ? "Generating…" : "Generate Recommendation"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: AuditIQ Help — real actions live in AuditIqHelpPanel. Mounted on first visit and then kept
                  (hidden) so a half-written request note survives switching tabs. */}
              {auditIqVisited && (
                <AuditIqHelpPanel
                  hidden={mode !== "help"}
                  projectId={activeProject?._id}
                  projectName={activeProject?.project_name || activeProject?.main_url}
                  issue={issue}
                  issueId={issueId}
                  issueCategory={issue.category || issueTypeName}
                  affectedPageCount={Number(issue.pages || issue.pages_affected || 0)}
                  selUrl={selUrl}
                  onBackToAi={() => setMode("ai")}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {wpConfirmOpen && isFaqSchema && createPortal(
        <FaqSchemaApplyDialog
          open={wpConfirmOpen}
          resolution={wpPageResolution}
          resolutionLoading={wpPageResolutionLoading}
          resolutionError={wpPageResolutionError}
          onOpenChange={(open) => { setWpConfirmOpen(open); if (!open) applyWordPressFixMutation.reset() }}
          siteLabel={activeProject?.main_url || activeProject?.project_name}
          pageUrl={selUrl}
          jsonLd={newValueForWordPress}
          onConfirm={() => applyWordPressFixMutation.mutate()}
          onRegenerate={onRegenerateSchema}
          isApplying={applyWordPressFixMutation.isPending}
          isRegenerating={recommendationMutation.isPending}
          errorInfo={applyErrorInfo}
        />,
        document.body
      )}

      {wpConfirmOpen && isRatingSchema && createPortal(
        <RatingSchemaApplyDialog
          open={wpConfirmOpen}
          resolution={wpPageResolution}
          resolutionLoading={wpPageResolutionLoading}
          resolutionError={wpPageResolutionError}
          onOpenChange={(open) => { setWpConfirmOpen(open); if (!open) applyWordPressFixMutation.reset() }}
          siteLabel={activeProject?.main_url || activeProject?.project_name}
          pageUrl={selUrl}
          jsonLd={newValueForWordPress}
          onConfirm={() => applyWordPressFixMutation.mutate()}
          onRegenerate={onRegenerateSchema}
          isApplying={applyWordPressFixMutation.isPending}
          isRegenerating={recommendationMutation.isPending}
          errorInfo={applyErrorInfo}
        />,
        document.body
      )}

      {wpConfirmOpen && isContentChannel && createPortal(
        <H1ApplyDialog
          open={wpConfirmOpen}
          onOpenChange={(open) => { setWpConfirmOpen(open); if (!open) applyWordPressFixMutation.reset() }}
          siteLabel={activeProject?.main_url || activeProject?.project_name}
          pageUrl={selUrl}
          context={wpH1Context}
          contextLoading={wpH1ContextLoading}
          contextUnavailable={wpConfirmOpen && !wpH1ContextLoading && wpH1ContextError}
          onConfirm={() => applyWordPressFixMutation.mutate()}
          onRefreshContext={onRefreshLiveValue}
          isApplying={applyWordPressFixMutation.isPending}
          errorInfo={applyErrorInfo}
        />,
        document.body
      )}

      {wpConfirmOpen && !isSiteScoped && !isSchemaChannel && !isContentChannel && createPortal(
        <WordPressApplyConfirmDialog
          open={wpConfirmOpen}
          onOpenChange={(open) => { setWpConfirmOpen(open); if (!open) applyWordPressFixMutation.reset() }}
          fieldLabel={wordPressFieldType ? WORDPRESS_FIELD_LABEL[wordPressFieldType] : ""}
          siteLabel={activeProject?.main_url || activeProject?.project_name}
          providerLabel={wpCapabilities?.providerLabel}
          currentValue={wpLiveValueDisplay}
          currentValueLoading={wpSeoDataLoading}
          currentValueUnavailable={wpLiveValueUnavailable}
          newValue={newValueForWordPress}
          onConfirm={() => applyWordPressFixMutation.mutate()}
          onRefreshLiveValue={onRefreshLiveValue}
          isApplying={applyWordPressFixMutation.isPending}
          errorInfo={applyErrorInfo}
        />,
        document.body
      )}

      {toast && createPortal(
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />,
        document.body
      )}
    </div>
  )
}

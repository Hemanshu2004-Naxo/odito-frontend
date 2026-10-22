"use client"

import { memo, useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Copy, Check, AlertCircle, Zap, Eye, Layers } from "lucide-react"
import RecommendationLoadingState from "./RecommendationLoadingState"
import RecommendationCodeBlock from "./RecommendationCodeBlock"
import RecommendationDiffViewer from "./RecommendationDiffViewer"
import { describeFaqGenerationBlock } from "../issue-context/faqDetection"
import { describeRatingGenerationBlock, formatRating } from "../issue-context/ratingDetection"
import BreadcrumbHierarchyPanel from "./BreadcrumbHierarchyPanel"
import { getBreadcrumbModel } from "./breadcrumbHierarchy"
import SchemaIntentPanel from "./SchemaIntentPanel"
import { getOrganizationIntentModel } from "./organizationIntent"

// ── Design tokens — theme-aware CSS variables ────────────────────────────────
const T = {
  border:       "border-border",
  borderSm:     "border-border",
  surface:      "bg-card/60",
  surfaceHover: "hover:bg-accent",
  muted:        "text-muted-foreground",
  sub:          "text-muted-foreground",
  label:        "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground",
  body:         "text-[12.5px] leading-[1.65] text-foreground/80",
}

const SEVERITY_CONFIG = {
  critical: { color: "#ff3860", bg: "rgba(255,56,96,0.08)",   border: "rgba(255,56,96,0.2)",   label: "Critical" },
  high:     { color: "#ff8800", bg: "rgba(255,136,0,0.08)",   border: "rgba(255,136,0,0.2)",   label: "High" },
  medium:   { color: "#ffb703", bg: "rgba(255,183,3,0.08)",   border: "rgba(255,183,3,0.18)",  label: "Medium" },
  low:      { color: "#00f5a0", bg: "rgba(0,245,160,0.08)",   border: "rgba(0,245,160,0.18)",  label: "Low" },
}


const CHANGE_TYPE_CONFIG = {
  add:    { color: "#00f5a0", label: "Add" },
  modify: { color: "#00dfff", label: "Modify" },
  remove: { color: "#ff3860", label: "Remove" },
  fix:    { color: "#ffb703", label: "Fix" },
}


// ── Utility helpers ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={12} className="text-muted-foreground" />}
      <span className={T.label}>{label}</span>
    </div>
  )
}

function Pill({ color, bg, border, children }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
    >
      {children}
    </span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
    >
      {copied ? <Check size={11} className="text-[#00f5a0]" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border ${T.border} ${T.surface} p-4 ${className}`}>
      {children}
    </div>
  )
}


// ── SECTION 1: Issue Analysis ─────────────────────────────────────────────────
// Lean: what was detected + why it matters. No metadata, no confidence tier.

const IssueAnalysisSection = memo(function IssueAnalysisSection({ recommendation, issue }) {
  const severity = recommendation?.severity || issue?.severity || "medium"
  const sev = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium
  const issueAnalysis = recommendation?.sections?.issueAnalysis
  const whyThisMatters = recommendation?.sections?.whyThisMatters

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={AlertCircle} label="Issue Analysis" />
        <Pill color={sev.color} bg={sev.bg} border={sev.border}>
          {sev.label}
        </Pill>
      </div>

      {issueAnalysis && (
        <p className={`${T.body} mb-2.5`}>{issueAnalysis}</p>
      )}

      {whyThisMatters && whyThisMatters !== issueAnalysis && (
        <p className={T.body}>{whyThisMatters}</p>
      )}
    </Card>
  )
})


// ── SECTION 3: Recommended Version ───────────────────────────────────────────

const RecommendedVersionSection = memo(function RecommendedVersionSection({ recommendation }) {
  const rv = recommendation?.sections?.recommendedVersion
  const afterState = recommendation?.afterState

  const displayText = rv || afterState?.rawText
  const isFaqSchema = recommendation?.ruleId === 'faq_schema'
  const isRatingSchema = recommendation?.ruleId === 'aggregate_rating_schema'
  // A schema preview isn't a length-constrained text: the char count and the
  // "valid range" pill are meaningless for it.
  const charCount   = (isFaqSchema || isRatingSchema) ? null : (afterState?.measurement?.value ?? (typeof displayText === 'string' ? displayText.length : null))
  const constraint  = (isFaqSchema || isRatingSchema) ? null : afterState?.satisfiesConstraint

  if (!displayText) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Zap} label={isFaqSchema ? "FAQPage Schema Preview" : isRatingSchema ? "Generated Schema Preview" : "Recommended Version"} />
        <div className="flex items-center gap-2">
          {charCount != null && (
            <span className="text-[10px] text-muted-foreground">{charCount} chars</span>
          )}
          {constraint != null && (
            <Pill
              color={constraint ? "#00f5a0" : "#ff3860"}
              bg={constraint ? "rgba(0,245,160,0.08)" : "rgba(255,56,96,0.08)"}
              border={constraint ? "rgba(0,245,160,0.18)" : "rgba(255,56,96,0.2)"}
            >
              {constraint ? "✓ Valid" : "⚠ Check range"}
            </Pill>
          )}
        </div>
      </div>

      <RecommendationCodeBlock type="text" content={displayText} />
    </Card>
  )
})

// ── SECTION 4: Before / After ─────────────────────────────────────────────────


const BeforeAfterSection = memo(function BeforeAfterSection({ beforeState, afterState, changeSummary }) {
  if (!beforeState && !afterState) return null

  return (
    <Card>
      <SectionHeader icon={Eye} label="Before / After" />
      <RecommendationDiffViewer beforeState={beforeState} afterState={afterState} />
    </Card>
  )
})

// ── SECTION 5: Change Summary ─────────────────────────────────────────────────

const ChangeSummarySection = memo(function ChangeSummarySection({ changeSummary }) {
  const items = changeSummary?.items
  if (!items?.length) return null

  return (
    <Card>
      <SectionHeader icon={Layers} label="Change Summary" />
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const ct = CHANGE_TYPE_CONFIG[item.changeType] || CHANGE_TYPE_CONFIG.fix
          const pColor = item.priority === "critical" ? "#ff3860"
            : item.priority === "high" ? "#ff8800"
            : item.priority === "medium" ? "#ffb703"
            : "#6b7ea0"

          return (
            <div key={i} className={`rounded-xl border ${T.borderSm} ${T.surface} p-3.5`}>
              {/* Row 1: field name + badges */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[13px] font-semibold text-foreground leading-tight">{item.field}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ color: ct.color, backgroundColor: `${ct.color}18`, border: `1px solid ${ct.color}30` }}
                  >
                    {ct.label}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ color: pColor, backgroundColor: `${pColor}12`, border: `1px solid ${pColor}28` }}
                  >
                    {item.priority}
                  </span>
                </div>
              </div>

              {/* Row 2: Before stacked above After */}
              <div className="space-y-2">
                {item.before && (
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(255,56,96,0.06)", border: "1px solid rgba(255,56,96,0.14)" }}>
                    <div className="text-[9.5px] font-bold uppercase tracking-widest text-[#ff6080] mb-1.5">Before</div>
                    <div className="text-[12px] text-foreground leading-relaxed wrap-break-word">{item.before}</div>
                  </div>
                )}
                {item.after && (
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(0,245,160,0.05)", border: "1px solid rgba(0,245,160,0.14)" }}>
                    <div className="text-[9.5px] font-bold uppercase tracking-widest text-[#00f5a0] mb-1.5">After</div>
                    <div className="text-[12px] text-foreground leading-relaxed wrap-break-word">{item.after}</div>
                  </div>
                )}
              </div>

              {/* Row 3: reason */}
              {item.reason && (
                <div className="mt-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
                  {item.reason}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
})



/** Task status / Create Task: shown after the AI result in both the legacy and the unified panel. */
function TaskActions({ task, onCreateTask, isCreatingTask, hideCreate = false }) {
  return (
    <>
      {task?.status === 'verified_fixed' ? (
            <div className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold text-center bg-[rgba(0,245,160,0.08)] text-[#00f5a0] border border-[rgba(0,245,160,0.18)] flex items-center justify-center gap-2">
              <span>✓</span> Verified Fixed
            </div>
          ) : task?.status === 'implemented' ? (
            <div className="space-y-2">
              <div className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold text-center bg-[rgba(157,78,221,0.08)] text-[#b580ff] border border-[rgba(157,78,221,0.18)] flex items-center justify-center gap-2">
                <span>⏳</span> Implemented — Pending Verification
              </div>
              <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed px-2">
                The next recrawl will automatically verify and mark this as fixed.
              </p>
            </div>
          ) : task?.status === 'task_created' ? (
            <div className="space-y-2">
              <div className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold text-center bg-[rgba(0,223,255,0.08)] text-[#00dfff] border border-[rgba(0,223,255,0.18)] flex items-center justify-center gap-2">
                <span>📋</span> Task Created
              </div>
              <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed px-2">
                Use the <strong className="text-foreground">DIY Guide</strong> below to review implementation steps, then mark as implemented.
              </p>
            </div>
          ) : task?.status === 'reopened' ? (
            <div className="space-y-2">
              <div className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold text-center bg-[rgba(255,56,96,0.08)] text-[#ff6080] border border-[rgba(255,56,96,0.18)] flex items-center justify-center gap-2">
                <span>⚠️</span> Reopened — Re-implementation Required
              </div>
              <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed px-2">
                The fix was not confirmed. Use the <strong className="text-foreground">DIY Guide</strong> or <strong className="text-foreground">History Logs</strong> to re-implement.
              </p>
            </div>
          ) : hideCreate ? null : typeof onCreateTask === 'function' ? (
            // Only rendered when a screen actually provides a handler — a button
            // whose click silently does nothing is worse than no button.
            <button
              onClick={onCreateTask}
              disabled={isCreatingTask}
              className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold cursor-pointer bg-[rgba(0,223,255,0.08)] text-[#00dfff] border border-[rgba(0,223,255,0.18)] transition-all duration-200 hover:bg-[rgba(0,223,255,0.12)] hover:border-[rgba(0,223,255,0.28)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingTask ? '⏳ Creating…' : '📋 Create Task'}
            </button>
          ) : null}
    </>
  )
}

// ── MAIN PANEL ────────────────────────────────────────────────────────────────

export default function IssueRecommendationPanel({
  projectId,
  issueId,
  issueSource = null,
  selUrl = null,
  issue = {},
  onCreateTask,
  isCreatingTask = false,
  task = null,
  mutationState = {},
  onGenerate,
  onReset,
  faqDetection = null,
  ratingDetection = null,
  // Optional: lets a parent that shows the recommendation elsewhere (the DIY guide) follow a breadcrumb regeneration.
  onRecommendationReplaced = null,
  // Unified mode (opt-in): the parent supplies ONE primary AI action (`primaryAction`). This panel then renders no "generate" button, no
  // legacy loading/error/result states of its own and no Create Task button; it keeps the selected-URL card, the FAQ/rating safety block and
  // only the owner-input panels (breadcrumb hierarchy / organization) that need the legacy recommendation's evidence. Default (false) is unchanged.
  unified = false,
  primaryAction = null,
  // Unified mode: show the task status / Create Task once the investigation has produced a result (never before).
  showTaskActions = false,
}) {
  const {
    isIdle = true,
    isPending = false,
    isSuccess = false,
    isError = false,
    error = null,
    recommendation: generatedRecommendation = null,
    meta: generatedMeta = null,
  } = mutationState

  // A breadcrumb regeneration (owner-confirmed hierarchy) replaces the recommendation shown here WITHOUT re-running the
  // generation mutation. It belongs to one page: it is dropped when the page changes or the panel returns to idle.
  const [replacement, setReplacement] = useState(null)
  useEffect(() => { setReplacement(null) }, [selUrl])
  useEffect(() => { if (isIdle) setReplacement(null) }, [isIdle])
  const recommendation = replacement?.data ?? generatedRecommendation
  const meta = replacement?.meta ?? generatedMeta
  const breadcrumbModel = getBreadcrumbModel(issueId, meta)
  const showBreadcrumbPanel = breadcrumbModel.applies && ["unavailable", "user_provided", "conflict"].includes(breadcrumbModel.state)
  // organization_schema: the server decided WHICH entity (Organization / LocalBusiness / Hospital / reuse / ask for a missing fact)
  const orgModel = getOrganizationIntentModel(issueId, meta)
  const showOrgIntent = orgModel.applies
  const handleBreadcrumbRegenerated = (response) => {
    setReplacement(response)
    onRecommendationReplaced?.(response)
  }

  // ── UNIFIED MODE: one primary action ─────────────────────────────────────────
  if (unified) {
    if (!selUrl) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(119,48,237,0.08)] border border-[rgba(119,48,237,0.2)] flex items-center justify-center text-xl mb-4">✦</div>
          <div className="text-[13px] font-semibold text-foreground mb-1.5">AI Recommendation Engine</div>
          <div className="text-[11.5px] text-muted-foreground leading-relaxed max-w-60">Select a URL from the affected pages list to investigate it and get a recommended fix</div>
        </motion.div>
      )
    }
    const block = describeFaqGenerationBlock(faqDetection) || describeRatingGenerationBlock(ratingDetection)
    const ownerInputPanel = isSuccess && recommendation && (showBreadcrumbPanel || showOrgIntent)
    const ruleMetadata = { title: issue?.title || issue?.issue || issue?.issue_message, category: issue?.category, severity: issue?.severity }
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
        <div className="rounded-xl border border-[rgba(0,223,255,0.18)] bg-[rgba(0,223,255,0.04)] p-3.5">
          <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Selected URL</div>
          <div className="text-[12px] text-(--cy) font-medium font-mono truncate">{selUrl}</div>
        </div>
        {block ? (
          <div
            data-testid={ratingDetection ? "rating-generation-blocked" : "faq-generation-blocked"}
            className={`rounded-xl border p-3.5 text-[12px] leading-relaxed ${block.tone === "warning" ? "border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.06)] text-[#ffb703]" : "border-border bg-card/60 text-muted-foreground"}`}
          >
            {block.message}
            {block.hint && <div className="mt-1.5 text-muted-foreground">{block.hint}</div>}
          </div>
        ) : primaryAction}
        {showTaskActions && !block && (
          <div className="space-y-2" data-testid="unified-task-actions">
            <TaskActions task={task} onCreateTask={onCreateTask} isCreatingTask={isCreatingTask} hideCreate={(showBreadcrumbPanel && ["unavailable", "conflict"].includes(breadcrumbModel.state)) || (showOrgIntent && orgModel.needsNoTask)} />
          </div>
        )}
        {ownerInputPanel && (showBreadcrumbPanel ? (
          <BreadcrumbHierarchyPanel projectId={projectId} selUrl={selUrl} model={breadcrumbModel} recommendation={recommendation} ruleMetadata={ruleMetadata} onRegenerated={handleBreadcrumbRegenerated} />
        ) : (
          <SchemaIntentPanel model={orgModel} recommendation={recommendation} projectId={projectId} selUrl={selUrl} ruleMetadata={ruleMetadata} onRegenerated={handleBreadcrumbRegenerated} />
        ))}
      </motion.div>
    )
  }

  // ── STATE 1: No URL selected ───────────────────────────────────────────────
  if (!selUrl) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 px-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-[rgba(119,48,237,0.08)] border border-[rgba(119,48,237,0.2)] flex items-center justify-center text-xl mb-4">
          ✦
        </div>
        <div className="text-[13px] font-semibold text-foreground mb-1.5">
          AI Recommendation Engine
        </div>
        <div className="text-[11.5px] text-muted-foreground leading-relaxed max-w-60">
          Select a URL from the affected pages list to generate a contextual AI recommendation
        </div>
      </motion.div>
    )
  }

  // ── STATE 2a: FAQ issue, nothing safe to generate from ────────────────────
  // Only for the faq_schema issue (faqDetection is only ever provided for it).
  // When FAQ content was found but its Q/A pairs could not be reliably
  // extracted — or a schema already exists — no generate action is offered at
  // all, so a schema can never be produced from content that wasn't read.
  const faqBlock = isIdle && selUrl
    ? (describeFaqGenerationBlock(faqDetection) || describeRatingGenerationBlock(ratingDetection))
    : null
  if (faqBlock) {
    const warn = faqBlock.tone === "warning"
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="rounded-xl border border-[rgba(0,223,255,0.18)] bg-[rgba(0,223,255,0.04)] p-3.5">
          <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Selected URL</div>
          <div className="text-[12px] text-(--cy) font-medium font-mono truncate">{selUrl}</div>
        </div>
        <div
          data-testid={ratingDetection ? "rating-generation-blocked" : "faq-generation-blocked"}
          className={`rounded-xl border p-3.5 text-[12px] leading-relaxed ${warn
            ? "border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.06)] text-[#ffb703]"
            : "border-border bg-card/60 text-muted-foreground"}`}
        >
          {faqBlock.message}
          {faqBlock.hint && <div className="mt-1.5 text-muted-foreground">{faqBlock.hint}</div>}
        </div>
      </motion.div>
    )
  }

  // ── STATE 2: Ready to generate ────────────────────────────────────────────
  if (isIdle && selUrl) {
    const faqPairCount = faqDetection?.content?.pairCount
    const ratingFigure = ratingDetection ? formatRating(ratingDetection.detectedRatingData?.selected) : null
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="rounded-xl border border-[rgba(0,223,255,0.18)] bg-[rgba(0,223,255,0.04)] p-3.5">
          <div className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Selected URL</div>
          <div className="text-[12px] text-(--cy) font-medium font-mono truncate">{selUrl}</div>
        </div>
        <button
          onClick={onGenerate}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white cursor-pointer bg-gradient-to-r from-[#7730ed] to-[#00dfff] border-none shadow-[0_0_20px_rgba(119,48,237,0.2)] transition-all duration-200 hover:shadow-[0_0_28px_rgba(119,48,237,0.35)] hover:-translate-y-px active:translate-y-0"
        >
          {faqDetection ? "✦ Generate Schema from Detected FAQs" : ratingDetection ? "✦ Generate Schema from Detected Rating" : "✦ Generate AI Recommendation"}
        </button>
        <div className="text-[10.5px] text-muted-foreground text-center leading-relaxed">
          {faqDetection
            ? `Builds FAQPage schema only from the ${faqPairCount} question${faqPairCount === 1 ? "" : "s"} detected on this page — nothing is added or reworded`
            : ratingDetection
              ? `Builds AggregateRating only from the rating shown on this page (${ratingFigure}) and the existing ${ratingDetection.targetSchemaType} schema — nothing is estimated`
              : "Generates a context-aware remediation strategy grounded in real page data"}
        </div>
      </motion.div>
    )
  }

  // ── STATE 3: Generating ───────────────────────────────────────────────────
  if (isPending) {
    return (
      <AnimatePresence mode="wait">
        <RecommendationLoadingState isLoading={true} />
      </AnimatePresence>
    )
  }

  // ── STATE: Error ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="text-[12px] font-semibold text-destructive mb-1">Generation failed</div>
          <div className="text-[11px] text-muted-foreground">
            {error?.message || "Unable to generate recommendation. Please try again."}
          </div>
        </div>
        <button
          onClick={onGenerate}
          className="w-full py-2.5 rounded-lg text-[12px] font-semibold text-muted-foreground cursor-pointer bg-muted border border-border hover:bg-accent transition-all duration-200"
        >
          ↻ Retry
        </button>
      </motion.div>
    )
  }

  // ── STATE 4: Recommendation ready ────────────────────────────────────────
  if (isSuccess && recommendation) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="space-y-3"
      >
        {/* Issue Analysis — what was detected + why it matters */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <IssueAnalysisSection recommendation={recommendation} issue={issue} />
        </motion.div>

        {showBreadcrumbPanel ? (
          /* Breadcrumb hierarchy the crawl could not determine: ask the owner (no fake code), or show what was generated from it */
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <BreadcrumbHierarchyPanel
              projectId={projectId}
              selUrl={selUrl}
              model={breadcrumbModel}
              recommendation={recommendation}
              ruleMetadata={{ title: issue?.title || issue?.issue || issue?.issue_message, category: issue?.category, severity: issue?.severity }}
              onRegenerated={handleBreadcrumbRegenerated}
            />
          </motion.div>
        ) : showOrgIntent ? (
          /* Organization / LocalBusiness / Hospital: the chosen type, why, the facts used, and validated JSON-LD or a question */
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <SchemaIntentPanel
              model={orgModel}
              recommendation={recommendation}
              projectId={projectId}
              selUrl={selUrl}
              ruleMetadata={{ title: issue?.title || issue?.issue || issue?.issue_message, category: issue?.category, severity: issue?.severity }}
              onRegenerated={handleBreadcrumbRegenerated}
            />
          </motion.div>
        ) : (
          /* Recommended Version — what the corrected version looks like */
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <RecommendedVersionSection recommendation={recommendation} />
          </motion.div>
        )}

        {/* Before / After — visual diff */}
        {!showBreadcrumbPanel && !showOrgIntent && (recommendation.beforeState || recommendation.afterState) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <BeforeAfterSection
              beforeState={recommendation.beforeState}
              afterState={recommendation.afterState}
            />
          </motion.div>
        )}

        {/* Change Summary — concise bullet list of what needs to change */}
        {recommendation.changeSummary?.items?.length > 0 && !(showBreadcrumbPanel && breadcrumbModel.state !== "user_provided") && !(showOrgIntent && orgModel.needsNoTask) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <ChangeSummarySection changeSummary={recommendation.changeSummary} />
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2 pt-1"
        >
          <TaskActions task={task} onCreateTask={onCreateTask} isCreatingTask={isCreatingTask} hideCreate={(showBreadcrumbPanel && ["unavailable", "conflict"].includes(breadcrumbModel.state)) || (showOrgIntent && orgModel.needsNoTask)} />
          <button
            onClick={onReset}
            className="w-full py-2.5 rounded-lg text-[12.5px] font-semibold cursor-pointer bg-muted text-muted-foreground border border-border transition-all duration-200 hover:bg-accent hover:text-foreground"
          >
            ↻ Regenerate
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return null
}

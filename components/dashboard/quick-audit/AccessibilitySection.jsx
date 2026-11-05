import React from "react";
import s from "../QuickAuditResult.module.css";
import {
  getGrade as getSharedGrade,
  GRADE_TEXT_COLOR,
  GRADE_RING_COLOR,
  getSeverityDashboardBadge,
} from "../../../lib/homepageAudit/constants";

function Field({ name, check, desc, children }) {
  const checkCls = check === "pass" ? s.checkGreen : check === "fail" ? s.checkRed : check === "warning" ? s.checkWarning : s.checkInfo;
  const checkChar = check === "pass" ? "✓" : check === "fail" ? "✗" : check === "warning" ? "⚠" : "ℹ";
  return (
    <div className={s.fieldRow}>
      <div className={s.fieldHeader}>
        <div className={s.fieldName}>{name}</div>
        <span className={checkCls}>{checkChar}</span>
      </div>
      {desc && <div className={s.fieldDesc}>{desc}</div>}
      {children}
    </div>
  );
}

/* Helper: derive grade from score — sourced from the shared scoreBands. */
function getGrade(score) {
  return getSharedGrade(score);
}

/* Helper: derive grade info from accessibility score */
function getAccessibilityGrade(score) {
  const grade = getGrade(score);
  const titles = {
    A: "Your accessibility is excellent!",
    B: "Your accessibility is above average.",
    C: "Your accessibility could be better.",
    F: "Your accessibility needs significant improvement.",
  };
  return { grade, color: GRADE_RING_COLOR[grade], titleColor: GRADE_TEXT_COLOR[grade], title: titles[grade] };
}

function scoreToDash(score, size) {
  const circumference = 2 * Math.PI * (size / 2 - 7);
  const filled = (score / 100) * circumference;
  return `${filled} ${circumference}`;
}

export default function AccessibilitySection({ data }) {
  if (!data) return null;

  // ========== CANONICAL DATA SOURCE ==========
  // Read from sections.accessibility.checks (canonical section architecture)
  // Falls back to accessibility_metrics for backward compat during transition
  const accessibilitySection = data.sections?.accessibility || {};
  const canonicalChecks = accessibilitySection.checks || [];
  const accessibilitySectionStatus = accessibilitySection.status;
  
  // Get accessibility metrics for score/grade (still the source of truth for score)
  const accessibilityMetrics = data.accessibility_metrics || {};
  const accessibilityScore = accessibilitySection.score || accessibilityMetrics.score || 0;
  const accessibilityGrade = accessibilitySection.grade || accessibilityMetrics.grade || getGrade(accessibilityScore);
  const gradeInfo = getAccessibilityGrade(accessibilityScore);
  gradeInfo.grade = accessibilityGrade;

  // Check if accessibility analysis is still processing
  const isProcessing = accessibilitySectionStatus === "processing" || accessibilityMetrics.status === "processing";
  const hasError = accessibilitySectionStatus === "failed" || accessibilityMetrics.status === "failed";

  if (isProcessing) {
    return (
      <div className={s.section}>
        <div className={s.sectionTitle}>Accessibility</div>
        <div className={s.gradeHero}>
          <div className={s.scoreCircleLg} style={{ width: 90, height: 90 }}>
            <div className={s.scoreLabel} style={{ fontSize: "16px", color: "#6b7280" }}>...</div>
          </div>
          <div className={s.gradeText}>
            <h3 style={{ color: "#6b7280" }}>Analyzing accessibility...</h3>
            <p>Running comprehensive accessibility checks including axe-core violations, landmarks analysis, and focus management review.</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={s.section}>
        <div className={s.sectionTitle}>Accessibility</div>
        <div className={s.gradeHero}>
          <div className={s.scoreCircleLg} style={{ width: 90, height: 90 }}>
            <div className={s.scoreLabel} style={{ fontSize: "16px", color: "#dc2626" }}>!</div>
          </div>
          <div className={s.gradeText}>
            <h3 style={{ color: "#dc2626" }}>Accessibility analysis failed</h3>
            <p>Unable to complete accessibility analysis. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  // If no canonical checks yet, show nothing (shouldn't happen after async completes)
  if (canonicalChecks.length === 0) {
    return null;
  }

  // Helper to get status badge color and text. NOTE: unlike the shared
  // severityMap (where severity 'low' maps to green/Optimized for a passing
  // check), a FAILING accessibility check with severity 'low' must not show
  // green here — green is reserved for status === 'pass'. So only the
  // critical/high and medium/warning bands are sourced from the shared map;
  // anything else on a non-passing check keeps the original orange/Issue badge.
  const getStatusInfo = (status, severity) => {
    if (status === 'pass') return { color: 'green', text: 'Optimized' };
    const sev = (severity || '').toLowerCase();
    if (['critical', 'high'].includes(sev)) return getSeverityDashboardBadge('critical');
    if (['medium', 'warning'].includes(sev)) return getSeverityDashboardBadge('medium');
    return { color: 'orange', text: 'Issue' };
  };

  // Map canonical checks to display format
  // Each canonical check already has: name, rule_id, status, severity, message, category
  const accessibilityChecksData = canonicalChecks.map((check, idx) => {
    // Derive display fields from canonical check data
    const statusInfo = getStatusInfo(check.status, check.severity);
    
    // Build recommendation based on check
    const recommendations = {
      'axe_violations': 'Fix all axe-core violations to ensure WCAG compliance and improve accessibility for all users.',
      'missing_form_labels': 'Add proper labels to all form elements using label tags or aria-label attributes.',
      'focus_issues': 'Fix focus management issues to improve keyboard accessibility and user experience.',
      'clickable_divs': 'Replace clickable divs with proper button or link elements for better accessibility.',
      'autoplay_media': 'Remove autoplay functionality or provide user controls for media playback.',
      'landmark_main': 'Add <main> element to wrap your primary content area.',
      'landmark_nav': 'Add <nav> element to wrap your navigation menus.',
      'landmark_header': 'Add <header> element to wrap your page header content.',
      'landmark_footer': 'Add <footer> element to wrap your page footer content.'
    };
    
    const whyItMattersMap = {
      'axe_violations': 'axe-core violations indicate serious accessibility issues that prevent users with disabilities from properly using your website.',
      'missing_form_labels': 'Form labels are essential for screen reader users to understand and interact with form controls.',
      'focus_issues': 'Proper focus management ensures keyboard users can navigate and interact with your content effectively.',
      'clickable_divs': 'Using proper semantic elements for clickable content improves screen reader announcements and accessibility.',
      'autoplay_media': 'Autoplaying media can interfere with screen reader navigation and may violate accessibility guidelines.',
      'landmark_main': 'The main landmark helps screen reader users quickly navigate to the primary content of the page.',
      'landmark_nav': 'Navigation landmarks provide quick access to site navigation for screen reader users.',
      'landmark_header': 'Header landmarks provide consistent page structure and help users understand the page layout.',
      'landmark_footer': 'Footer landmarks provide consistent page structure and help users navigate to supplementary content.'
    };

    return {
      id: idx + 1,
      name: check.name,
      rule_id: check.rule_id,
      status: check.status,
      severity: check.severity,
      issues: check.message,
      currentData: check.status === 'pass' ? `${check.name} detected` : `${check.name} missing or issues found`,
      whyItMatters: whyItMattersMap[check.rule_id] || 'This check ensures your website is accessible to all users.',
      recommendation: check.status === 'pass' 
        ? 'Current implementation is optimal.' 
        : (recommendations[check.rule_id] || 'Fix this accessibility issue to improve compliance.')
    };
  });

  // Filter to show only checks with issues (hide optimized ones)
  const filteredChecks = accessibilityChecksData.filter(check => check.status !== 'pass');

  return (
    <section className="space-y-12 pt-8">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#263244] pb-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center">
            <span className="text-purple-700 dark:text-purple-400 text-xl">♿</span>
          </div>
          Accessibility
        </h2>
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-xl">
          <span className="text-xs tracking-[0.15em] uppercase text-slate-600 dark:text-slate-400">
            Section Score
          </span>
          <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">
            {accessibilityScore}%
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mt-8">
        {filteredChecks.map((check) => {
          const statusInfo = getStatusInfo(check.status, check.severity);
          const statusColors = {
            red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
            yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400',
            orange: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400',
            green: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
          };

          return (
            <div key={check.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-[#263244] flex justify-between items-start">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {check.name}
                </h3>
                <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${statusColors[statusInfo.color]}`}>
                  {statusInfo.text}
                </span>
              </div>

              {/* CONTENT */}
              <div className="p-8 space-y-8">
                {/* Issue */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Issues Found
                  </p>
                  <p className="text-slate-800 dark:text-slate-200 leading-7">
                    {check.issues}
                  </p>
                </div>

                {/* Current */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Current Data
                  </p>
                  <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-[#263244] rounded-xl p-6">
                    <p className="italic text-slate-600 dark:text-slate-400 leading-7">
                      "{check.currentData}"
                    </p>
                  </div>
                </div>

                {/* Why */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Why It Matters
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-7">
                    {check.whyItMatters}
                  </p>
                </div>

                {/* Recommendation */}
                <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-2xl p-6">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400 mb-4">
                    AI Recommendation
                  </p>
                  <p className="text-cyan-800 dark:text-cyan-200 font-semibold leading-7">
                    {check.recommendation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredChecks.length === 0 && (
        <div className="text-center py-16 mt-8">
          <div className="text-green-700 dark:text-green-400 text-6xl mb-6">✓</div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">All Accessibility Checks Passed!</h3>
          <p className="text-slate-600 dark:text-slate-400">Excellent! Your site is fully accessible and follows WCAG guidelines.</p>
        </div>
      )}
    </section>
  );
}

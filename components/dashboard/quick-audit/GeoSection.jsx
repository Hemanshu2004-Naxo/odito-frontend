import React from "react";
import s from "../QuickAuditResult.module.css";
import {
  getGrade as getSharedGrade,
  GRADE_TEXT_COLOR,
  GRADE_RING_COLOR,
  getSeverityDashboardBadge,
} from "../../../lib/homepageAudit/constants";

function GradeHero({ bgStroke, fgStroke, dash, grade, gradeColor, titleColor, title, desc }) {
  return (
    <div className={s.gradeHero}>
      <div className={s.scoreCircleLg} style={{ width: 90, height: 90 }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="38" fill="none" stroke={bgStroke} strokeWidth="8" />
          <circle cx="45" cy="45" r="38" fill="none" stroke={fgStroke} strokeWidth="8"
            strokeDasharray={dash} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 45 45)" />
        </svg>
        <div className={s.scoreLabel} style={{ fontSize: "20px", color: gradeColor }}>{grade}</div>
      </div>
      <div className={s.gradeText}>
        <h3 style={{ color: titleColor }}>{title}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function Field({ name, check, desc, children, badge }) {
  const checkCls = check === "pass" ? s.checkGreen : check === "fail" ? s.checkRed : check === "warning" ? s.checkWarning : s.checkInfo;
  const checkChar = check === "pass" ? "✓" : check === "fail" ? "✗" : check === "warning" ? "⚠" : "ℹ";
  return (
    <div className={s.fieldRow}>
      <div className={s.fieldHeader}>
        <div className={s.fieldName}>{name}{badge && <span className={s.badgeNew}>{badge}</span>}</div>
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

/* Helper: derive grade info from AI score */
function getGeoGrade(score) {
  const grade = getGrade(score);
  const titles = {
    A: "Your Generative Engine Optimization is good!",
    B: "Your Generative Engine Optimization is above average.",
    C: "Your Generative Engine Optimization needs improvement.",
    F: "Your Generative Engine Optimization is very poor.",
  };
  return { grade, color: GRADE_RING_COLOR[grade], titleColor: GRADE_TEXT_COLOR[grade], title: titles[grade] };
}

function scoreToDash(score, size) {
  const circumference = 2 * Math.PI * (size / 2 - 7);
  const filled = (score / 100) * circumference;
  return `${filled} ${circumference}`;
}

export default function GeoSection({ data }) {
  if (!data) return null;

  const pi = data.page_info || {};
  const aiScore = data.sections?.ai?.score ?? 0;
  const aiGrade = data.sections?.ai?.grade ?? getGrade(aiScore);
  const gradeInfo = getGeoGrade(aiScore);
  // Override grade from backend
  gradeInfo.grade = aiGrade;

  // GEO heading message from score_explanation
  const aiExplanation = data.score_explanation?.ai || `AI score ${aiScore}/100`;

  // Identity Schema
  const identitySchema = pi.identity_schema || {};
  const identityPresent = identitySchema.present === true;
  const identityName = identitySchema.name || "";
  const identityHasLogo = identitySchema.has_logo ?? false;
  const identitySource = identitySchema.source || "";
  const identityStatus = identityPresent ? "pass" : "fail";
  const identityDesc = identityPresent
    ? `${identityName ? identityName : "Entity"} identified via ${identitySource === "fallback_meta" ? "meta tags (fallback)" : "structured data"}.`
    : "No Organization or Person Schema detected on the page.";
  const identityTypes = identitySchema.types || [];
  const hasOrg = identityName || identityTypes.includes("Organization");
  const hasPerson = identityTypes.includes("Person");

  // LLM Readability
  const llmReadability = pi.llm_readability || {};
  const llmScore = llmReadability.score ?? 0;
  const isJsHeavy = llmReadability.is_js_heavy ?? false;
  const textHtmlRatio = llmReadability.text_html_ratio ?? 0;
  const llmRating = llmReadability.rating || "Not detected";
  const llmStatus = llmScore >= 80 ? "pass" : llmScore >= 50 ? "warning" : "fail";
  const llmDesc = llmScore >= 80
    ? "Your page content is well-structured for LLM readability."
    : llmScore >= 50
      ? `LLM readability score is average (${llmScore}/100). Consider improving content structure.`
      : `LLM readability score is low (${llmScore}/100). Content may not be fully readable by LLMs.`;

  // llms.txt
  const llmsTxt = pi.llms_txt || {};
  const llmsTxtExists = llmsTxt.exists === true;
  const llmsTxtUrl = llmsTxt.url || "";
  const llmsTxtStatus = llmsTxtExists ? "pass" : "fail";
  const llmsTxtDesc = llmsTxtExists
    ? "llms.txt file detected. This helps AI systems discover and understand your content."
    : "llms.txt not found. This file is recommended for AI discoverability.";

  // Structured Data Depth
  const schemaInfo = pi.schema_info || {};
  const schemaTypes = schemaInfo.types_detected || [];
  const schemaFormats = schemaInfo.formats || [];
  const structuredDepthPass = schemaTypes.length >= 2;
  const structuredDepthStatus = structuredDepthPass ? "pass" : "fail";
  const structuredDepthDesc = structuredDepthPass
    ? `Multiple schema types detected (${schemaTypes.length}): ${schemaTypes.join(', ')}. This provides rich context for AI systems.`
    : schemaTypes.length === 1
      ? `Only basic schema detected (${schemaTypes[0]}). Multiple structured data types are recommended for better AI understanding.`
      : "No structured data types detected. Schema markup helps AI systems understand your content.";

  // FAQ Optimization
  const hasFaqSchema = schemaTypes.includes('FAQPage');
  const faqOptimized = hasFaqSchema && schemaTypes.length >= 2 && llmScore >= 60;
  const faqStatus = faqOptimized ? "pass" : "fail";
  const faqDesc = faqOptimized
    ? "FAQ schema is present and well-optimized with supporting structured data."
    : hasFaqSchema
      ? "FAQ schema exists but lacks optimization. Add supporting schema types and improve content readability."
      : "No FAQ schema detected. FAQ structured data helps AI systems provide direct answers.";

  // Content Chunking
  const h1Count = pi.h1_count ?? 0;
  const h2Count = pi.h2_count ?? 0;
  const chunkingPass = h1Count >= 1 && h2Count >= 2;
  const chunkingStatus = chunkingPass ? "pass" : "fail";
  const chunkingDesc = chunkingPass
    ? `Good content structure with H1 + ${h2Count} H2 tags. Content is well-chunked for LLM processing.`
    : h2Count === 0
      ? "No H2 headings found. Content chunking with clear heading structure helps LLMs parse your content."
      : `Content structure is weak (H1: ${h1Count}, H2: ${h2Count}). Add more H2 sections for better LLM readability.`;

  // AI checks from backend (for status sync)
  const aiChecks = data.sections?.ai?.checks || [];
  const getCheckStatus = (name) => aiChecks.find(c => c.name === name)?.status ?? null;

  // Helper to get status badge color and text based on backend severity —
  // sourced from the shared severityMap.
  const getStatusInfo = (severity) => getSeverityDashboardBadge(severity);

  // AI Visibility checks data using actual data from old code
  const aiChecksData = [
    {
      id: 1,
      name: "Identity Schema",
      status: identityStatus,
      issues: identityDesc,
      currentData: identityPresent 
        ? `${identityName || "Entity"} identified via ${identitySource === "fallback_meta" ? "meta tags (fallback)" : "structured data"}`
        : "No Organization or Person Schema detected on the page.",
      whyItMatters: "Identity schema helps AI systems understand your brand entity and improves brand recognition in AI-generated responses.",
      recommendation: identityStatus === 'pass' 
        ? "Current identity schema is optimal." 
        : "Add Organization or Person schema to establish brand identity.",
      tags: ["Entity Mapping", "Authoritativeness"]
    },
    {
      id: 2,
      name: "LLM Readability",
      status: llmStatus,
      issues: llmDesc,
      currentData: `LLM Readability Score: ${llmScore}/100, JS Heavy: ${isJsHeavy ? "Yes" : "No"}, Text/HTML Ratio: ${textHtmlRatio}`,
      whyItMatters: "AI systems need to be able to read and understand your content after JavaScript rendering.",
      recommendation: llmStatus === 'pass' 
        ? "Current content is well-optimized for LLM readability." 
        : "Improve content structure and reduce JavaScript dependency for better LLM parsing.",
      tags: ["LLM Readability", "Content Analysis"]
    },
    {
      id: 3,
      name: "llms.txt",
      status: llmsTxtStatus,
      issues: llmsTxtDesc,
      currentData: llmsTxtExists ? `llms.txt file detected at: ${llmsTxtUrl}` : "llms.txt not found",
      whyItMatters: "llms.txt file helps AI systems discover and understand your content structure and preferences.",
      recommendation: llmsTxtStatus === 'pass' 
        ? "Current llms.txt setup is optimal." 
        : "Create llms.txt file to improve AI discoverability.",
      tags: ["AI Discovery", "Structured Data"]
    },
    {
      id: 4,
      name: "Structured Data Depth",
      status: structuredDepthStatus,
      issues: structuredDepthDesc,
      currentData: schemaTypes.length > 0 
        ? `Detected types: ${schemaTypes.join(', ')}, Format: ${schemaFormats.join(', ')}`
        : "No structured data types detected.",
      whyItMatters: "Rich structured data provides deep context for AI systems to understand your content and entities.",
      recommendation: structuredDepthStatus === 'pass' 
        ? "Current structured data depth is optimal." 
        : "Add multiple schema types for better AI understanding.",
      tags: ["Semantic Analysis", "Entity Mapping"]
    },
    {
      id: 5,
      name: "FAQ Optimization",
      status: faqStatus,
      issues: faqDesc,
      currentData: hasFaqSchema ? "FAQ Schema: Present" : "FAQ Schema: Not detected",
      whyItMatters: "FAQ schema helps AI systems provide direct answers and improves visibility in AI search results.",
      recommendation: faqStatus === 'pass' 
        ? "Current FAQ optimization is optimal." 
        : "Add FAQ schema and supporting structured data for better AI visibility.",
      tags: ["Direct Answers", "AI Visibility"]
    },
    {
      id: 6,
      name: "Content Chunking",
      status: chunkingStatus,
      issues: chunkingDesc,
      currentData: `H1: ${h1Count}, H2: ${h2Count}`,
      whyItMatters: "Proper content chunking with clear heading structure helps LLMs parse and understand your content effectively.",
      recommendation: chunkingStatus === 'pass' 
        ? "Current content structure is well-optimized." 
        : "Improve heading structure with more H2 sections for better LLM readability.",
      tags: ["Content Structure", "Vector Search"]
    }
  ];

  // Filter to show only checks with issues (hide optimized ones)
  const filteredChecks = aiChecksData.filter(check => check.status !== 'pass');

  // Determine grid class based on issue count
  const getGridClass = (count) => {
    if (count === 0) return '';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  return (
    <section className="space-y-12 pt-8">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#263244] pb-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <span className="text-cyan-700 dark:text-cyan-400 text-xl">🧠</span>
          </div>
          AI Visibility & GEO
        </h2>
        
        {/* LLM REACH SCORE */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            LLM Reach
          </span>
          <div className="w-40 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-indigo-400 rounded-full"
              style={{ width: `${aiScore}%` }}
            ></div>
          </div>
          <span className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
            {aiScore}%
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className={`grid ${getGridClass(filteredChecks.length)} gap-8`}>
        {filteredChecks.map((check) => {
          // Get severity from backend checks
          const backendCheck = data.sections?.ai?.checks?.find(c => c.name === check.name);
          const severity = backendCheck?.severity || 'medium';
          const statusInfo = getStatusInfo(severity);
          const statusColors = {
            red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
            yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400',
            green: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
          };

          const tagColors = {
            'Semantic Analysis': 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400',
            'Entity Mapping': 'bg-purple-400/10 border-purple-400/20 text-purple-700 dark:text-purple-300',
            'Vector Search': 'bg-indigo-400/10 border-indigo-400/20 text-indigo-700 dark:text-indigo-300',
            'Authoritativeness': 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400',
            'Trustworthiness': 'bg-purple-400/10 border-purple-400/20 text-purple-700 dark:text-purple-300',
            'LLM Readability': 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400',
            'Content Analysis': 'bg-purple-400/10 border-purple-400/20 text-purple-700 dark:text-purple-300',
            'AI Discovery': 'bg-indigo-400/10 border-indigo-400/20 text-indigo-700 dark:text-indigo-300',
            'Structured Data': 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400',
            'Direct Answers': 'bg-purple-400/10 border-purple-400/20 text-purple-700 dark:text-purple-300',
            'AI Visibility': 'bg-indigo-400/10 border-indigo-400/20 text-indigo-700 dark:text-indigo-300',
            'Content Structure': 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400'
          };

          return (
            <div key={check.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-3xl overflow-hidden">
              {/* TOP */}
              <div className="p-6 border-b border-slate-200 dark:border-[#263244] flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {check.name}
                  </h3>
                  
                  {/* TAGS */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {check.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${tagColors[tag] || 'bg-cyan-400/10 border-cyan-400/20 text-cyan-700 dark:text-cyan-400'}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* STATUS */}
                <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${statusColors[statusInfo.color]}`}>
                  {statusInfo.text}
                </span>
              </div>

              {/* CONTENT */}
              <div className="p-8 space-y-8">
                {/* ISSUE */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Issues Found
                  </p>
                  <p className="text-slate-800 dark:text-slate-200 leading-7">
                    {check.issues}
                  </p>
                </div>

                {/* CURRENT */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Current Data
                  </p>
                  <div className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-[#263244] rounded-xl p-6">
                    <p className="text-slate-600 dark:text-slate-400 leading-7">
                      "{check.currentData}"
                    </p>
                  </div>
                </div>

                {/* WHY */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
                    Why It Matters
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-7">
                    {check.whyItMatters}
                  </p>
                </div>

                {/* RECOMMENDATION */}
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
        <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20 rounded-xl p-6 text-center mt-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            {/* Success Icon */}
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <div className="text-green-700 dark:text-green-400 text-2xl">✓</div>
            </div>
            
            {/* Success Message */}
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                All AI Visibility Checks Passed
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                All {aiChecksData.length} GEO optimizations are perfectly configured
              </p>
            </div>
            
            {/* Success Indicators */}
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>AI Optimized</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

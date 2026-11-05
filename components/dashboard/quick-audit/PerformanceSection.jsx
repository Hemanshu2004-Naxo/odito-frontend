import React from "react";
import s from "../QuickAuditResult.module.css";
import {
  getGrade as getSharedGrade,
  GRADE_TEXT_COLOR,
  rateCwvMetric,
  cwvRatingToDashboardStatus,
  cwvRatingToTailwindClass,
  parseCwvValueToMs,
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

function PsiBlock({ score, color, ringStroke, ringBg, dash, labData, opportunities }) {
  return (
    <>
      <div className={s.psiScoreRing}>
        <div className={s.psiRingWrap}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke={ringBg} strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={ringStroke} strokeWidth="8"
              strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div className={`${s.psiRingLabel} ${color === "red" ? s.psiBad : s.psiMid}`}>{score}</div>
        </div>
      </div>
      <div className={s.psiDataGrid}>
        <div className={s.psiColHeader}>Lab Data</div>
        <div className={s.psiColHeader}>Value</div>
        <div className={`${s.psiColHeader} ${s.psiOppHeader}`}>Opportunities</div>
        <div className={`${s.psiColHeader} ${s.psiSavHeader}`}>Estimated Savings</div>
        {labData.map((row, i) => {
          const alt = i % 2 === 1 ? s.psiRowAlt : "";
          const opp = opportunities[i] || {};
          return (
            <React.Fragment key={i}>
              <div className={`${s.psiCell} ${s.psiCellLabel} ${alt}`}>{row.label}</div>
              <div className={`${s.psiCell} ${s.psiCellValue} ${row.good ? s.psiGreen : s.psiRed} ${alt}`}>{row.value}</div>
              <div className={`${s.psiCell} ${s.psiCellLabel} ${s.psiOppCell} ${alt}`}>{opp.name || ""}</div>
              <div className={`${s.psiCell} ${s.psiCellValue} ${s.psiSavCell} ${opp.value ? s.psiRed : ""} ${alt}`}>{opp.value || ""}</div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}

/* Helper: derive grade from score — sourced from the shared scoreBands
 * (canonical: A>=85, B>=70, C>=50, else F), matching the backend's formula. */
function getGrade(score) {
  return getSharedGrade(score);
}

/* Helper: derive grade info from performance score */
function getPerformanceGrade(score) {
  const grade = getGrade(score);
  const color = GRADE_TEXT_COLOR[grade];
  const titles = {
    A: "Excellent performance",
    B: "Good performance",
    C: "Performance needs improvement",
    F: "Poor performance",
  };
  return { grade, color, titleColor: color, title: titles[grade] };
}

function scoreToDash(score, size) {
  const circumference = 2 * Math.PI * (size / 2 - 7);
  const filled = (score / 100) * circumference;
  return `${filled} ${circumference}`;
}

function psiScoreToDash(score) {
  const circumference = 2 * Math.PI * 42;
  const filled = (score / 100) * circumference;
  return `${filled} ${circumference}`;
}

function getPsiStyle(score) {
  if (score >= 90) return { ringStroke: "#16a34a", ringBg: "#dcfce7", color: "mid" };
  if (score >= 50) return { ringStroke: "#d97706", ringBg: "#fff3e0", color: "mid" };
  return { ringStroke: "#dc2626", ringBg: "#fce4ec", color: "red" };
}

function isNA(val) {
  return val === "N/A" || val === null || val === undefined || val === "";
}

function parseSec(val) {
  if (isNA(val)) return null;
  const n = parseFloat(String(val).replace("s", "").trim());
  return isNaN(n) ? null : n;
}

function getCwvStatus(metric, val) {
  const ms = parseCwvValueToMs(metric, val);
  if (ms === null) return "info";
  const rating = rateCwvMetric(metric, ms);
  if (rating === null) return "info";
  return cwvRatingToDashboardStatus(rating);
}

function buildLabData(m) {
  if (!m) return [];
  const isGood = (metric, val) => rateCwvMetric(metric, parseCwvValueToMs(metric, val)) === "good";
  return [
    { label: "First Contentful Paint", value: isNA(m.fcp) ? "N/A" : m.fcp, good: isGood("fcp", m.fcp) },
    { label: "Largest Contentful Paint", value: isNA(m.lcp) ? "N/A" : m.lcp, good: isGood("lcp", m.lcp) },
    { label: "Total Blocking Time", value: isNA(m.tbt) ? "N/A" : m.tbt, good: isGood("tbt", m.tbt) },
    { label: "Cumulative Layout Shift", value: isNA(m.cls) ? "N/A" : m.cls, good: isGood("cls", m.cls) },
  ];
}

function hasAnyMetric(m) {
  if (!m) return false;
  return !isNA(m.fcp) || !isNA(m.lcp) || !isNA(m.tbt) || !isNA(m.cls);
}

export default function PerformanceSection({ data }) {
  if (!data) return null;

  const pi = data.page_info || {};
  // Canonical performance object — single source of truth from backend
  const perf = data.performance || {};
  const perfInsights = perf.insights || {};
  // Legacy path for mobile/desktop raw metrics (still needed for CWV display)
  const perfMetrics = perf.mobile !== null || perf.desktop !== null
    ? { status: perf.status, mobile: perf.mobile, desktop: perf.desktop, score: perf.score }
    : data.performance_metrics || pi.performance_metrics || {};

  // 1. Page Speed
  const loadTimeMs = perf.load_time_ms ?? 0;
  const loadTimeSec = (loadTimeMs / 1000).toFixed(1);
  const loadTimeStatus = loadTimeMs === 0 ? "info" : loadTimeMs < 2000 ? "pass" : loadTimeMs <= 4000 ? "warning" : "fail";

  // 2. Performance Rating
  const perfLabel = perf.label || "Not available";
  const perfStatus = perfLabel.toLowerCase() === "fast" ? "pass" : perfLabel.toLowerCase() === "average" ? "warning" : perfLabel.toLowerCase() === "slow" ? "fail" : "info";

  // 3. Mobile Optimization
  const hasViewport = pi.has_viewport ?? false;
  const viewportStatus = hasViewport ? "pass" : "fail";

  // 4. HTTPS
  const isHttps = pi.is_https ?? false;
  const httpsStatus = isHttps ? "pass" : "fail";

  // 5. HTTPS Redirect
  const httpsRedirect = pi.https_redirect || {};
  const redirectsToHttps = httpsRedirect.redirects_to_https ?? false;
  const httpsRedirectStatus = redirectsToHttps ? "pass" : "fail";

  // 6. Core Web Vitals (Mobile + Desktop)
  const metricsStatus = perfMetrics.status || "";
  const isProcessing = metricsStatus === "processing";
  const mobileMetrics = perfMetrics.mobile || {};
  const mobileHasData = mobileMetrics !== null && (mobileMetrics.score !== undefined || hasAnyMetric(mobileMetrics));
  const mobilePsiScore = mobileHasData && mobileMetrics.score !== undefined ? mobileMetrics.score : null;
  const mobileLabData = mobileHasData ? buildLabData(mobileMetrics) : buildLabData({});

  const mobilePsiStatus = mobilePsiScore !== null
    ? mobilePsiScore >= 90 ? "pass" : mobilePsiScore >= 50 ? "warning" : "fail"
    : "info";

  const desktopMetrics = perfMetrics.desktop || {};
  const desktopHasData = desktopMetrics !== null && (desktopMetrics.score !== undefined || hasAnyMetric(desktopMetrics));
  const desktopPsiScore = desktopHasData && desktopMetrics.score !== undefined ? desktopMetrics.score : null;
  const desktopLabData = desktopHasData ? buildLabData(desktopMetrics) : buildLabData({});

  const desktopPsiStatus = desktopPsiScore !== null
    ? desktopPsiScore >= 90 ? "pass" : desktopPsiScore >= 50 ? "warning" : "fail"
    : "info";

  // 7. Response Time
  const responseTimeMs = pi.response_time_ms ?? 0;
  const responseTimeSec = (responseTimeMs / 1000).toFixed(1);
  const responseTimeStatus = responseTimeMs === 0 ? "info" : responseTimeMs < 2000 ? "pass" : responseTimeMs <= 4000 ? "warning" : "fail";

  // ========== CANONICAL PERFORMANCE SCORE (from backend) ==========
  // Read ONLY from data.performance.score — no frontend recalculation.
  // The backend calculates this as the average of available Lighthouse scores.
  const performanceScore = perf.score ?? null;
  const performanceGrade = perf.grade ?? (performanceScore !== null ? getGrade(performanceScore) : null);
  const gradeInfo = performanceScore !== null ? getPerformanceGrade(performanceScore) : getPerformanceGrade(0);
  if (performanceGrade) gradeInfo.grade = performanceGrade;
  const isPerformanceProcessing = performanceScore === null && isProcessing;

  // Generate performance insights
  const getPerformanceInsights = () => {
    const insights = [];
    
    if (mobilePsiScore !== null && desktopPsiScore !== null) {
      if (mobilePsiScore < desktopPsiScore - 15) {
        insights.push("⚠ Mobile performance is significantly lower than desktop");
      }
    }
    
    const criticalMetrics = [];
    if (mobileMetrics.tbt && parseSec(mobileMetrics.tbt) > 0.3) {
      criticalMetrics.push(`High Total Blocking Time (${mobileMetrics.tbt})`);
    }
    if (mobileMetrics.lcp && parseSec(mobileMetrics.lcp) > 2.5) {
      criticalMetrics.push(`Slow Largest Contentful Paint (${mobileMetrics.lcp})`);
    }
    
    if (criticalMetrics.length > 0) {
      insights.push(`Main issues affecting performance:\n${criticalMetrics.join('\n')}`);
    }
    
    return insights;
  };

  const performanceInsights = getPerformanceInsights();

  // Helper to get status badge color and text for new design
  const getStatusInfo = (status) => {
    switch (status) {
      case 'fail':
        return { color: 'red', text: 'Poor' };
      case 'warning':
        return { color: 'orange', text: 'Medium' };
      case 'pass':
        return { color: 'green', text: 'Good' };
      case 'info':
        return { color: 'orange', text: 'Medium' };
      default:
        return { color: 'orange', text: 'Medium' };
    }
  };

  // Helper to get color for Core Web Vitals metrics — sourced from the
  // shared cwvThresholds (canonical, matches the video adapter's bands).
  const getCwvColor = (metric, value) => {
    if (!value || value === "--") return 'text-slate-600 dark:text-slate-400';
    const ms = parseCwvValueToMs(metric, value);
    const rating = rateCwvMetric(metric, ms);
    return cwvRatingToTailwindClass(rating);
  };

  // Performance checks data using real data from old code
  const performanceChecksData = [
    {
      id: 1,
      name: "Response Time",
      status: responseTimeStatus,
      desc: "Server response latency",
      value: responseTimeMs === 0 ? "Not available" : `${responseTimeSec}s`,
      issues: responseTimeMs === 0 ? "Response time data not available." : responseTimeMs < 2000 ? `Server responds quickly (${responseTimeSec}s).` : responseTimeMs <= 4000 ? `Server response is average (${responseTimeSec}s).` : `Server responds slowly (${responseTimeSec}s).`
    },
    {
      id: 2,
      name: "Performance Rating",
      status: perfStatus,
      desc: "Overall performance level",
      value: perfLabel,
      issues: `Performance rating: ${perfLabel}`
    },
    {
      id: 3,
      name: "Use of Mobile Viewports",
      status: viewportStatus,
      desc: "Mobile responsiveness",
      value: hasViewport ? "Viewport Meta Tag Detected" : "Viewport Meta Tag Missing",
      issues: hasViewport ? "Your page specifies a Viewport matching the device's size, allowing it to render appropriately across devices." : "Your page is missing a Viewport Meta Tag. This may cause mobile rendering issues."
    }
  ];

  return (
    <section className="space-y-12 pt-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-slate-200 dark:border-[#263244] pb-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-400/10 border border-orange-400/20 flex items-center justify-center">
            <span className="text-orange-700 dark:text-orange-400 text-xl">⚡</span>
          </div>
          Performance & Core Web Vitals
        </h2>
        <span className="text-2xl font-bold text-orange-700 dark:text-orange-400">
          {isPerformanceProcessing ? (
            <span className="animate-pulse">Analyzing...</span>
          ) : (
            `${performanceScore ?? 0}%`
          )}
        </span>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT CARD - Device Performance Comparison */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-3xl p-8">
          {/* TOP */}
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              Device Performance Comparison
            </h4>
            <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-orange-400/10 text-orange-700 dark:text-orange-400 border border-orange-400/20 uppercase tracking-widest">
              High Priority
            </span>
          </div>

          {/* DEVICE SCORES */}
          <div className="grid grid-cols-2 gap-8">
            {/* MOBILE */}
            <div className="text-center space-y-4 border-r border-slate-200 dark:border-[#263244] pr-8">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    className="text-slate-800/20"
                    cx="64"
                    cy="64"
                    fill="transparent"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                  ></circle>
                  <circle
                    cx="64"
                    cy="64"
                    fill="transparent"
                    r="56"
                    stroke={mobilePsiScore !== null ? (mobilePsiScore >= 90 ? "#22C55E" : mobilePsiScore >= 50 ? "#F59E0B" : "#EF4444") : "#6B7280"}
                    strokeDasharray="351.85"
                    strokeDashoffset={mobilePsiScore !== null ? (351.85 - (351.85 * mobilePsiScore / 100)) : "176"}
                    strokeLinecap="round"
                    strokeWidth="8"
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-bold" style={{ color: mobilePsiScore !== null ? (mobilePsiScore >= 90 ? "#22C55E" : mobilePsiScore >= 50 ? "#F59E0B" : "#EF4444") : "#6B7280" }}>
                    {mobilePsiScore !== null ? mobilePsiScore : "--"}
                  </span>
                  <span className="text-sm">📱</span>
                </div>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                MOBILE SCORE
              </p>
            </div>

            {/* DESKTOP */}
            <div className="text-center space-y-4 pl-8">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    className="text-slate-800/20"
                    cx="64"
                    cy="64"
                    fill="transparent"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                  ></circle>
                  <circle
                    cx="64"
                    cy="64"
                    fill="transparent"
                    r="56"
                    stroke={desktopPsiScore !== null ? (desktopPsiScore >= 90 ? "#22C55E" : desktopPsiScore >= 50 ? "#F59E0B" : "#EF4444") : "#6B7280"}
                    strokeDasharray="351.85"
                    strokeDashoffset={desktopPsiScore !== null ? (351.85 - (351.85 * desktopPsiScore / 100)) : "176"}
                    strokeLinecap="round"
                    strokeWidth="8"
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-bold" style={{ color: desktopPsiScore !== null ? (desktopPsiScore >= 90 ? "#22C55E" : desktopPsiScore >= 50 ? "#F59E0B" : "#EF4444") : "#6B7280" }}>
                    {desktopPsiScore !== null ? desktopPsiScore : "--"}
                  </span>
                  <span className="text-sm">🖥️</span>
                </div>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                DESKTOP SCORE
              </p>
            </div>
          </div>

          {/* CORE WEB VITALS */}
          <div className="flex justify-center mt-8 mb-6">
            <h3 className="text-xl text-slate-900 dark:text-white">
              Core Web Vitals Details
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* MOBILE METRICS */}
            <div className="space-y-3 border-r border-slate-200 dark:border-[#263244] pr-8">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-4">
                MOBILE METRICS
              </p>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">LCP</span>
                <span className={`font-bold ${getCwvColor('lcp', mobileMetrics.lcp)}`}>{mobileMetrics.lcp || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">TBT</span>
                <span className={`font-bold ${getCwvColor('tbt', mobileMetrics.tbt)}`}>{mobileMetrics.tbt || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">FCP</span>
                <span className={`font-bold ${getCwvColor('fcp', mobileMetrics.fcp)}`}>{mobileMetrics.fcp || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">CLS</span>
                <span className={`font-bold ${getCwvColor('cls', mobileMetrics.cls)}`}>{mobileMetrics.cls || "--"}</span>
              </div>
            </div>

            {/* DESKTOP METRICS */}
            <div className="space-y-3 pl-8">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-4">
                DESKTOP METRICS
              </p>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">LCP</span>
                <span className={`font-bold ${getCwvColor('lcp', desktopMetrics.lcp)}`}>{desktopMetrics.lcp || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">TBT</span>
                <span className={`font-bold ${getCwvColor('tbt', desktopMetrics.tbt)}`}>{desktopMetrics.tbt || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">FCP</span>
                <span className={`font-bold ${getCwvColor('fcp', desktopMetrics.fcp)}`}>{desktopMetrics.fcp || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-xs">CLS</span>
                <span className={`font-bold ${getCwvColor('cls', desktopMetrics.cls)}`}>{desktopMetrics.cls || "--"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD - Performance Checks */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-3xl p-8">
          {/* TOP */}
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              Performance Checks
            </h4>
            <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-red-400/10 text-red-600 dark:text-red-400 border border-red-400/20 uppercase tracking-widest">
              {getStatusInfo(perfStatus).text}
            </span>
          </div>

          {/* CHECKS */}
          <div className="space-y-6">
            {performanceChecksData.map((check) => {
              const statusInfo = getStatusInfo(check.status);
              return (
                <div key={check.id} className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-[#263244] last:border-b-0">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {check.name}
                    </p>
                    <p className="text-[11px] text-slate-500 uppercase">
                      {check.desc}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {check.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RECOMMENDATION */}
          <div className="mt-8 p-6 bg-cyan-400/5 rounded-xl border border-cyan-400/20">
            <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-700 dark:text-cyan-400 mb-2">
              AI Recommendation
            </p>
            <p className="font-semibold text-cyan-800 dark:text-cyan-200">
              Optimize server response time and implement caching strategies to improve overall performance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

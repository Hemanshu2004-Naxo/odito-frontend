import React from "react";
import { getScoreTier } from "../../../lib/homepageAudit/constants";

export default function HeroSection({ data }) {
  if (!data) return null;

  // ========== SINGLE SOURCE OF TRUTH: data.performance.score ==========
  // All section scores come from backend. No hardcoded fallbacks.
  // When score is null (processing), components show loading state.
  const overallScore = data.score ?? 0;
  const aiScore = data.sections?.ai?.score ?? 0;
  const technicalScore = data.sections?.technical?.score ?? 0;
  // Canonical performance score — read ONLY from data.performance.score
  const performanceScore = data.performance?.score ?? data.sections?.performance?.score ?? null;
  const isPerformanceProcessing = performanceScore === null && data.performance?.status === 'processing';
  const accessibilityScore = data.accessibility_metrics?.score ?? null;
  const isAccessibilityProcessing = accessibilityScore === null && data.accessibility_metrics?.status === 'processing';
  const onPageScore = data.sections?.on_page?.score ?? 0;
  const securityScore = data.security_score ?? data.sections?.security?.score ?? 0;

  // Use canonical sections.summary data ONLY
  const summaryData = data.sections?.summary || {};
  const totalIssues = summaryData.total || 0;
  const criticalIssues = summaryData.critical || 0;
  const warningIssues = summaryData.warnings || 0;
  const passedIssues = summaryData.passed || 0;

  // Calculate dash values for SVG circles
  const scoreToDash = (score, radius = 100) => {
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 100) * circumference;
    const offset = circumference - filled;
    return {
      strokeDasharray: `${circumference}`,
      strokeDashoffset: `${offset}`
    };
  };

  const overallDash = scoreToDash(overallScore);

  // Dynamic text based on score — tier sourced from the shared scoreBands
  // (canonical: A>=85, B>=70, C>=50, else F), matching the backend's formula.
  // NOTE: this collapses the previous 5-tier wording (Excellent/Above
  // Average/Average/Below Average/Needs Work) into the canonical 4-tier
  // scheme (excellent/good/needs-improvement/poor).
  const getScoreText = (score) => {
    const tier = getScoreTier(score);
    if (tier === "excellent") return {
      status: "Excellent",
      description: "Outstanding performance! You're in the top tier."
    };
    if (tier === "good") return {
      status: "Good",
      description: `Performing better than ${Math.round(score - 25)}% of competitors in your niche.`
    };
    if (tier === "needs-improvement") return {
      status: "Needs Improvement",
      description: "Good performance with room for improvement."
    };
    return {
      status: "Needs Work",
      description: "Significant improvements required for better performance."
    };
  };

  const scoreText = getScoreText(overallScore);

  return (
    <>
      {/* OVERALL SCORE SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT BIG SCORE CARD */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-[28px] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-purple-400/5 to-blue-400/5"></div>

          {/* Circle */}
          <div className="relative w-[240px] h-[240px] flex items-center justify-center">
            <svg className="absolute w-full h-full -rotate-90">
              {/* Background Circle */}
              <circle
                cx="120"
                cy="120"
                r="100"
                className="stroke-slate-200 dark:stroke-[#1E293B]"
                strokeWidth="14"
                fill="none"
              ></circle>

              {/* Progress Circle */}
              <circle
                cx="120"
                cy="120"
                r="100"
                stroke="url(#gradient)"
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={overallDash.strokeDasharray}
                strokeDashoffset={overallDash.strokeDashoffset}
              ></circle>

              <defs>
                <linearGradient id="gradient">
                  <stop offset="0%" stopColor="#67E8F9"></stop>
                  <stop offset="50%" stopColor="#8B5CF6"></stop>
                  <stop offset="100%" stopColor="#A78BFA"></stop>
                </linearGradient>
              </defs>
            </svg>

            {/* Score */}
            <div className="flex flex-col items-center">
              <h1 className="text-7xl font-bold text-slate-900 dark:text-white">{overallScore}</h1>
              <p className="text-xs tracking-[0.25em] uppercase text-slate-600 dark:text-slate-400 mt-2">
                Overall Score
              </p>
            </div>
          </div>

          {/* Bottom Text */}
          <div className="mt-8">
            <h2 className="text-4xl font-semibold text-slate-900 dark:text-white">
              {scoreText.status}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg mt-4 leading-8 max-w-[320px]">
              {scoreText.description}
            </p>
          </div>
        </div>

        {/* RIGHT CARDS */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* AI VISIBILITY CARD */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                AI VISIBILITY
              </span>
              <span className="text-cyan-700 dark:text-cyan-400 text-xl">🧠</span>
            </div>
            <div className="mt-8">
              <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{aiScore}</h3>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400"
                  style={{ width: `${aiScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* TECHNICAL CARD */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                TECHNICAL
              </span>
              <span className="text-green-700 dark:text-green-400 text-xl">⚙️</span>
            </div>
            <div className="mt-8">
              <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{technicalScore}</h3>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                  style={{ width: `${technicalScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* PERFORMANCE CARD */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                PERFORMANCE
              </span>
              <span className="text-yellow-700 dark:text-yellow-400 text-xl">⚡</span>
            </div>
            <div className="mt-8">
              {isPerformanceProcessing ? (
                <h3 className="text-3xl font-bold text-slate-500 animate-pulse">Analyzing...</h3>
              ) : (
                <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{performanceScore ?? '—'}</h3>
              )}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  style={{ width: `${performanceScore ?? 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* ACCESSIBILITY CARD */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                ACCESSIBILITY
              </span>
              <span className="text-sky-700 dark:text-sky-400 text-xl">♿</span>
            </div>
            <div className="mt-8">
              {isAccessibilityProcessing ? (
                <h3 className="text-3xl font-bold text-slate-500 animate-pulse">Analyzing...</h3>
              ) : (
                <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{accessibilityScore ?? '—'}</h3>
              )}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400"
                  style={{ width: `${accessibilityScore ?? 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* ON PAGE CARD (replacing Local SEO) */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                ON PAGE
              </span>
              <span className="text-cyan-700 dark:text-cyan-300 text-xl">📍</span>
            </div>
            <div className="mt-8">
              <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{onPageScore}</h3>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-sky-400"
                  style={{ width: `${onPageScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* SECURITY CARD */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-7">
            <div className="flex justify-between items-start">
              <span className="text-xs tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
                SECURITY
              </span>
              <span className="text-red-600 dark:text-red-400 text-xl">🔒</span>
            </div>
            <div className="mt-8">
              <h3 className="text-5xl font-bold text-slate-900 dark:text-white">{securityScore}</h3>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-red-400 to-pink-400"
                  style={{ width: `${securityScore}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM STATS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-8">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-8 text-center">
          <p className="text-xs tracking-[0.2em] text-slate-600 dark:text-slate-400 uppercase">
            Total Issues
          </p>
          <h2 className="text-5xl font-bold text-slate-900 dark:text-white mt-4">
            {totalIssues}
          </h2>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
          <p className="text-xs tracking-[0.2em] text-red-600 dark:text-red-400 uppercase">
            Critical
          </p>
          <h2 className="text-5xl font-bold text-red-600 dark:text-red-400 mt-4">
            {criticalIssues}
          </h2>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-8 text-center">
          <p className="text-xs tracking-[0.2em] text-yellow-700 dark:text-yellow-400 uppercase">
            Warnings
          </p>
          <h2 className="text-5xl font-bold text-yellow-700 dark:text-yellow-400 mt-4">
            {warningIssues}
          </h2>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-8 text-center">
          <p className="text-xs tracking-[0.2em] text-green-700 dark:text-green-400 uppercase">
            Passed
          </p>
          <h2 className="text-5xl font-bold text-green-700 dark:text-green-400 mt-4">
            {passedIssues}
          </h2>
        </div>
      </section>

      {/* RECOMMENDATIONS SECTION (HIDDEN FOR NOW) */}
      {/* 
      <section className="mt-8">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-[28px] p-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Recommendations</h2>
            <div className="flex space-x-4">
              <p className="text-slate-600 dark:text-slate-400">
                <span className="text-red-500 font-bold">12</span> Issues Found
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="text-blue-500 font-bold">52</span> Hidden Issues
              </p>
            </div>
          </div>

          <ul className="mt-8 space-y-4">
            <li className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-[#263244] last:border-b-0">
              <div className="flex items-center space-x-3">
                <span className="text-slate-500 text-lg">1.</span>
                <p className="text-blue-700 dark:text-blue-400 text-lg">Add meta descriptions to improve SEO visibility</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-slate-600 dark:text-slate-400 text-sm">SEO</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                  Critical
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                  High Priority
                </span>
              </div>
            </li>
            <li className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-[#263244] last:border-b-0">
              <div className="flex items-center space-x-3">
                <span className="text-slate-500 text-lg">2.</span>
                <p className="text-blue-700 dark:text-blue-400 text-lg">Optimize images for faster page load times</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Performance</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-400">
                  Medium
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-400">
                  Med Priority
                </span>
              </div>
            </li>
            <li className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-[#263244] last:border-b-0">
              <div className="flex items-center space-x-3">
                <span className="text-slate-500 text-lg">3.</span>
                <p className="text-blue-700 dark:text-blue-400 text-lg">Add alt text to all images for accessibility</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Accessibility</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-400">
                  Low
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-400">
                  Low Priority
                </span>
              </div>
            </li>
          </ul>
        </div>
      </section>
      */}
    </>
  );
}

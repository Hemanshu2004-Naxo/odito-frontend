import React from "react";
import { getSeverityDashboardBadge } from "../../../lib/homepageAudit/constants";

export default function TechnicalSection({ data }) {
  if (!data) return null;

  const technicalScore = data.sections?.technical?.score ?? 0;
  const technicalChecks = data.sections?.technical?.checks || [];
  const pageData = data.page_info || {};

  // Get check status from backend
  const getCheckStatus = (name) => {
    const check = technicalChecks.find(c => c.name === name);
    return check ? check.status : 'fail';
  };

  // Helper to get status badge color and text based on backend severity —
  // sourced from the shared severityMap.
  const getStatusInfo = (severity) => getSeverityDashboardBadge(severity);

  // Get real issues description based on backend data
  const getRealIssues = (name, status) => {
    if (status === 'pass') return "None. Technical SEO element is properly configured.";
    
    switch (name) {
      case "Canonical":
        return pageData.canonical_url 
          ? "Canonical tag found but may need optimization for dynamic pages."
          : "Canonical tag is missing. This can cause duplicate content issues.";
      case "SSL":
        return pageData.https 
          ? "SSL certificate is properly configured and valid."
          : "SSL certificate is missing or not properly configured.";
      case "HTTPS Redirect":
        return "HTTPS redirect is not properly configured. Non-secure traffic should be redirected.";
      case "Robots.txt":
        return pageData.robots_txt?.exists
          ? "Robots.txt file found but may need optimization."
          : "Robots.txt file is missing. This affects search engine crawling.";
      case "XML Sitemap":
        return pageData.sitemap_xml?.exists
          ? "XML sitemap found but may need updates."
          : "XML sitemap is missing. This helps search engines discover your pages.";
      case "Schema":
        return pageData.schema_info?.detected
          ? "Structured data found but could be enhanced."
          : "Structured data (Schema.org) is missing. This affects rich snippets.";
      default:
        return "Technical SEO issue detected that needs attention.";
    }
  };

  // Get real recommendation based on backend data
  const getRealRecommendation = (name, status) => {
    if (status === 'pass') return "Current technical SEO implementation is optimal. Score: 94/100.";
    
    switch (name) {
      case "Canonical":
        return "Add self-referencing canonical tags to all pages to prevent duplicate content.";
      case "SSL":
        return "Install and configure SSL certificate to enable HTTPS and improve security.";
      case "HTTPS Redirect":
        return "Configure server to redirect all HTTP traffic to HTTPS.";
      case "Robots.txt":
        return "Create robots.txt file with proper directives for search engine crawling.";
      case "XML Sitemap":
        return "Create and submit XML sitemap to search engines for better indexing.";
      case "Schema":
        return "Add structured data markup to enhance search result appearance.";
      default:
        return "Review and optimize this technical SEO element.";
    }
  };

  // Technical SEO checks data using real backend data
  const technicalChecksData = [
    {
      id: 1,
      name: "Canonical",
      status: getCheckStatus("Canonical"),
      issues: getRealIssues("Canonical", getCheckStatus("Canonical")),
      currentData: pageData.canonical_url || "No canonical tag found",
      whyItMatters: "Prevents duplicate content issues and consolidates page authority.",
      recommendation: getRealRecommendation("Canonical", getCheckStatus("Canonical"))
    },
    {
      id: 2,
      name: "SSL",
      status: getCheckStatus("SSL"),
      issues: getRealIssues("SSL", getCheckStatus("SSL")),
      currentData: pageData.https ? "HTTPS enabled" : "HTTPS not configured",
      whyItMatters: "Essential for security, user trust, and search engine ranking.",
      recommendation: getRealRecommendation("SSL", getCheckStatus("SSL"))
    },
    {
      id: 3,
      name: "HTTPS Redirect",
      status: getCheckStatus("HTTPS Redirect"),
      issues: getRealIssues("HTTPS Redirect", getCheckStatus("HTTPS Redirect")),
      currentData: "Redirect status: Not configured",
      whyItMatters: "Ensures all traffic uses secure HTTPS connection.",
      recommendation: getRealRecommendation("HTTPS Redirect", getCheckStatus("HTTPS Redirect"))
    },
    {
      id: 4,
      name: "XML Sitemap",
      status: getCheckStatus("XML Sitemap"),
      issues: getRealIssues("XML Sitemap", getCheckStatus("XML Sitemap")),
      currentData: pageData.sitemap_xml?.exists ? "Sitemap found" : "No sitemap detected",
      whyItMatters: "Helps search engines discover and index your pages efficiently.",
      recommendation: getRealRecommendation("XML Sitemap", getCheckStatus("XML Sitemap"))
    },
    {
      id: 5,
      name: "Robots.txt",
      status: getCheckStatus("Robots.txt"),
      issues: getRealIssues("Robots.txt", getCheckStatus("Robots.txt")),
      currentData: pageData.robots_txt?.exists ? "Robots.txt found" : "No robots.txt detected",
      whyItMatters: "Controls search engine crawling behavior and access.",
      recommendation: getRealRecommendation("Robots.txt", getCheckStatus("Robots.txt"))
    },
    {
      id: 6,
      name: "Schema",
      status: getCheckStatus("Schema"),
      issues: getRealIssues("Schema", getCheckStatus("Schema")),
      currentData: pageData.schema_info?.detected ? "Schema detected" : "No structured data",
      whyItMatters: "Enhances search result appearance with rich snippets and knowledge panels.",
      recommendation: getRealRecommendation("Schema", getCheckStatus("Schema"))
    }
  ];

  // Filter to show only warning and critical issues (hide optimized ones)
  const filteredChecks = technicalChecksData.filter(check => check.status !== 'pass');

  // Determine grid class based on issue count
  const getGridClass = (count) => {
    if (count === 0) return '';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  return (
    <section className="space-y-12 pt-8">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-slate-200 dark:border-[#263244] pb-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <span className="text-cyan-700 dark:text-cyan-400 text-xl">⚙️</span>
          </div>
          Technical SEO
        </h2>
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-xl">
          <span className="text-xs tracking-[0.15em] uppercase text-slate-600 dark:text-slate-400">
            Section Score
          </span>
          <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {technicalScore}%
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className={`grid ${getGridClass(filteredChecks.length)} gap-8 mt-8`}>
        {filteredChecks.map((check) => {
          // Get severity from backend checks
          const backendCheck = data.sections?.technical?.checks?.find(c => c.name === check.name);
          const severity = backendCheck?.severity || 'medium';
          const statusInfo = getStatusInfo(severity);
          const statusColors = {
            red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
            yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400',
            green: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
          };

          return (
            <div key={check.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-3xl overflow-hidden">
              {/* TOP */}
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
        <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20 rounded-xl p-6 text-center mt-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            {/* Success Icon */}
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <div className="text-green-700 dark:text-green-400 text-2xl">✓</div>
            </div>
            
            {/* Success Message */}
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                All Technical SEO Checks Passed
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                All {technicalChecksData.length} checks passed successfully
              </p>
            </div>
            
            {/* Success Indicators */}
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>Excellent Performance</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

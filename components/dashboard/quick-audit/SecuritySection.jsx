import React from "react";
import { getSeverityDashboardBadge } from "../../../lib/homepageAudit/constants";

export default function SecuritySection({ data }) {
  if (!data) return null;

  const securityScore = data.security_score ?? data.sections?.security?.score ?? 0;
  const securityChecks = data.sections?.security?.checks || [];
  const pageData = data.page_info || {};

  // Get check status from backend
  const getCheckStatus = (name) => {
    const check = securityChecks.find(c => c.name === name);
    return check ? check.status : 'fail';
  };

  // Helper to get status badge color and text based on backend severity —
  // sourced from the shared severityMap.
  const getStatusInfo = (severity) => getSeverityDashboardBadge(severity);

  // Get real security issues based on backend data
  const getRealSecurityIssues = (name, status) => {
    if (status === 'pass') return "None. Security header is properly configured.";
    
    switch (name) {
      case "Content Security Policy":
        return "Content Security Policy header is missing, leaving your site vulnerable to XSS attacks.";
      case "HSTS":
        return "Strict-Transport-Security header is missing, allowing potential man-in-the-middle attacks.";
      case "X-Frame-Options":
        return "X-Frame-Options header is missing, making your site vulnerable to clickjacking attacks.";
      case "X-Content-Type-Options":
        return "X-Content-Type-Options header is missing, allowing MIME sniffing in older browsers.";
      case "Referrer Policy":
        return "Referrer-Policy header is missing, potentially exposing sensitive referrer information.";
      case "Permissions Policy":
        return "Permissions-Policy header is missing, allowing unrestricted browser feature access.";
      default:
        return "Security header is missing or misconfigured.";
    }
  };

  // Get real security recommendations based on backend data
  const getRealSecurityRecommendation = (name, status) => {
    if (status === 'pass') return "Current security implementation is optimal. Score: 94/100.";
    
    switch (name) {
      case "Content Security Policy":
        return "Add Content-Security-Policy header with appropriate directives for your site's resources.";
      case "HSTS":
        return "Add Strict-Transport-Security header with max-age and includeSubDomains directives.";
      case "X-Frame-Options":
        return "Add X-Frame-Options header set to 'DENY' or 'SAMEORIGIN' based on your needs.";
      case "X-Content-Type-Options":
        return "Add X-Content-Type-Options header set to 'nosniff'.";
      case "Referrer Policy":
        return "Add Referrer-Policy header set to 'strict-origin-when-cross-origin'.";
      case "Permissions Policy":
        return "Add Permissions-Policy header to restrict unnecessary browser features.";
      default:
        return "Review and configure missing security headers.";
    }
  };

  // Get severity from backend rules_details
  const getCheckSeverity = (name) => {
    // Map security check names to rule IDs
    const ruleMapping = {
      "Content Security Policy": "csp_missing",
      "HSTS": "hsts_missing", 
      "X-Frame-Options": "x_frame_missing",
      "X-Content-Type-Options": "x_content_type_missing",
      "Referrer Policy": "referrer_policy_missing",
      "Permissions Policy": "permissions_policy_missing"
    };
    
    const ruleId = ruleMapping[name];
    if (!ruleId) return 'critical';
    
    // Find the rule in rules_details
    const allRules = data.rules_details || [];
    const rule = allRules.find(r => r.rule_id === ruleId);
    return rule ? rule.severity : 'critical';
  };

  // Security checks data using real backend data
  const securityChecksData = [
    {
      id: 1,
      name: "Content Security Policy",
      status: getCheckStatus("Content Security Policy"),
      issues: getRealSecurityIssues("Content Security Policy", getCheckStatus("Content Security Policy")),
      currentData: "Header: Not detected",
      whyItMatters: "Prevents Cross-Site Scripting (XSS) attacks by controlling which resources can be loaded.",
      recommendation: getRealSecurityRecommendation("Content Security Policy", getCheckStatus("Content Security Policy"))
    },
    {
      id: 2,
      name: "HSTS",
      status: getCheckStatus("HSTS"),
      issues: getRealSecurityIssues("HSTS", getCheckStatus("HSTS")),
      currentData: "Header: Not detected",
      whyItMatters: "Enforces HTTPS connections, preventing man-in-the-middle attacks and protocol downgrade attacks.",
      recommendation: getRealSecurityRecommendation("HSTS", getCheckStatus("HSTS"))
    },
    {
      id: 3,
      name: "X-Frame-Options",
      status: getCheckStatus("X-Frame-Options"),
      issues: getRealSecurityIssues("X-Frame-Options", getCheckStatus("X-Frame-Options")),
      currentData: "Header: Not detected",
      whyItMatters: "Protects against clickjacking attacks by controlling whether your site can be embedded in frames.",
      recommendation: getRealSecurityRecommendation("X-Frame-Options", getCheckStatus("X-Frame-Options"))
    },
    {
      id: 4,
      name: "X-Content-Type-Options",
      status: getCheckStatus("X-Content-Type-Options"),
      issues: getRealSecurityIssues("X-Content-Type-Options", getCheckStatus("X-Content-Type-Options")),
      currentData: "Header: Not detected",
      whyItMatters: "Prevents MIME-type sniffing attacks by ensuring browsers use the declared content type.",
      recommendation: getRealSecurityRecommendation("X-Content-Type-Options", getCheckStatus("X-Content-Type-Options"))
    },
    {
      id: 5,
      name: "Referrer Policy",
      status: getCheckStatus("Referrer Policy"),
      issues: getRealSecurityIssues("Referrer Policy", getCheckStatus("Referrer Policy")),
      currentData: "Header: Not detected",
      whyItMatters: "Controls how much referrer information is sent with requests, protecting user privacy.",
      recommendation: getRealSecurityRecommendation("Referrer Policy", getCheckStatus("Referrer Policy"))
    },
    {
      id: 6,
      name: "Permissions Policy",
      status: getCheckStatus("Permissions Policy"),
      issues: getRealSecurityIssues("Permissions Policy", getCheckStatus("Permissions Policy")),
      currentData: "Header: Not detected",
      whyItMatters: "Restricts browser features access, improving security and privacy by limiting unnecessary capabilities.",
      recommendation: getRealSecurityRecommendation("Permissions Policy", getCheckStatus("Permissions Policy"))
    }
  ];

  // Filter to show only warning and critical issues (hide optimized ones)
  const filteredChecks = securityChecksData.filter(check => check.status !== 'pass');

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
            <span className="text-cyan-700 dark:text-cyan-400 text-xl">🛡️</span>
          </div>
          Security Audit
        </h2>
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-xl">
          <span className="text-xs tracking-[0.15em] uppercase text-slate-600 dark:text-slate-400">
            Section Score
          </span>
          <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {securityScore}%
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className={`grid ${getGridClass(filteredChecks.length)} gap-8 mt-8`}>
        {filteredChecks.map((check) => {
          // Get severity from backend checks dynamically
          const backendCheck = data.sections?.security?.checks?.find(c => c.name === check.name);
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
              <div className="text-green-700 dark:text-green-400 text-2xl">🛡️</div>
            </div>
            
            {/* Success Message */}
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                All Security Checks Passed
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                All {securityChecksData.length} security headers properly configured
              </p>
            </div>
            
            {/* Success Indicators */}
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>Strong Protection</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

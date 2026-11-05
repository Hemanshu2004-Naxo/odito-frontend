import React from "react";
import { getSeverityDashboardBadge } from "../../../lib/homepageAudit/constants";

export default function OnPageSeoSection({ data }) {
  if (!data) return null;

  const pi = data.page_info || {};
  const seoScore = data.sections?.on_page?.score ?? 68;

  // Helper to get status badge color and text based on backend severity —
  // sourced from the shared severityMap.
  const getStatusInfo = (severity) => getSeverityDashboardBadge(severity);

  // 1. Title Tag
  const titleTag = pi.title || "Example Business - Your Trusted Partner for All Enterprise Software Solutions and Custom Digital Transformation Services";
  const titleLen = pi.title_length ?? titleTag.length;
  const titleStatus = titleLen > 60 ? 'warning' : titleLen < 30 ? 'warning' : 'optimized';

  // 2. Meta Description
  const metaDesc = pi.meta_description || "Scale your business with advanced SEO auditing and AI visibility tools.";
  const metaLen = pi.meta_length ?? metaDesc.length;
  const metaStatus = metaLen >= 120 && metaLen <= 160 ? 'optimized' : 'warning';

  // 3. Hreflang Usage
  const hreflangTags = pi.hreflang_tags || [];
  const hreflangStatus = hreflangTags.length > 0 ? 'optimized' : 'critical';

  // 4. Language
  const htmlLang = pi.html_lang || "";
  const langStatus = htmlLang ? 'optimized' : 'critical';

  // 5. H1 Header Tag Usage
  const h1Count = pi.h1_count ?? 3;
  const h1Status = h1Count === 1 ? 'optimized' : h1Count === 0 ? 'critical' : 'critical';

  // 6. H2-H6 Header Tag Usage
  const h2Count = pi.h2_count ?? 0;
  const h2h6Status = h2Count > 0 ? 'optimized' : 'critical';

  // 7. Amount of Content
  const wordCount = pi.word_count ?? 250;
  const contentStatus = wordCount > 300 ? 'optimized' : 'warning';

  // 8. Image Alt Attributes
  const altPercentage = pi.image_alt_percentage?.percentage ?? 45;
  const altStatus = altPercentage >= 80 ? 'optimized' : altPercentage >= 50 ? 'warning' : 'critical';

  // 9. Noindex Tag Test
  const hasNoindex = pi.has_noindex ?? false;
  const noindexTagStatus = !hasNoindex ? 'optimized' : 'critical';

  // 10. Noindex Header Test
  const xRobotsTag = pi.x_robots_tag || "";
  const noindexHeaderStatus = !xRobotsTag.toLowerCase().includes("noindex") ? 'optimized' : 'critical';

  // 11. Analytics
  const analyticsDetected = pi.analytics?.detected ?? false;
  const analyticsStatus = analyticsDetected ? 'optimized' : 'warning';

  // All SEO checks data
  const seoChecks = [
    {
      id: 1,
      name: "Title Tag",
      status: titleStatus,
      issues: titleStatus === 'optimized' ? "None. Meta title is well-formed and engaging." : "Title exceeds 60 characters and lacks brand consistency.",
      currentData: titleTag,
      whyItMatters: titleStatus === 'optimized' ? "Helps search engines understand page content and improves CTR." : "Long titles are truncated in SERPs, reducing CTR by up to 15%.",
      recommendation: titleStatus === 'optimized' ? "Current title is optimal. Score: 94/100." : '"Enterprise Software & Digital Transformation | Example Business"'
    },
    {
      id: 2,
      name: "Meta Description",
      status: metaStatus,
      issues: metaStatus === 'optimized' ? "None. Meta description is well-formed and engaging." : "Description length needs optimization for better SERP display.",
      currentData: metaDesc,
      whyItMatters: "Drives organic CTR and provides context to search crawlers.",
      recommendation: metaStatus === 'optimized' ? "Current description is optimal. Score: 94/100." : "Adjust length to 120-160 characters for optimal display."
    },
    {
      id: 3,
      name: "Hreflang",
      status: hreflangStatus,
      issues: hreflangStatus === 'optimized' ? "None. Hreflang attributes are properly implemented." : "No hreflang attributes detected for international targeting.",
      currentData: hreflangStatus === 'optimized' ? `${hreflangTags.length} hreflang tags found` : "No hreflang tags found",
      whyItMatters: "Essential for international SEO and targeting specific language audiences.",
      recommendation: hreflangStatus === 'optimized' ? "Current implementation is optimal." : "Add hreflang tags for international audiences."
    },
    {
      id: 4,
      name: "Language",
      status: langStatus,
      issues: langStatus === 'optimized' ? "None. Language attribute is properly set." : "HTML lang attribute is missing.",
      currentData: langStatus === 'optimized' ? `Declared: ${htmlLang}` : "No language declaration",
      whyItMatters: "Helps search engines understand the language of your content.",
      recommendation: langStatus === 'optimized' ? "Current implementation is optimal." : 'Add lang="en" to HTML tag.'
    },
    {
      id: 5,
      name: "H1 Tag",
      status: h1Status,
      issues: h1Status === 'optimized' ? "None. H1 tag is properly implemented." : "Multiple H1 tags detected, which dilutes SEO focus.",
      currentData: h1Status === 'optimized' ? "1 H1 tag found" : `${h1Count} H1 tags found`,
      whyItMatters: h1Status === 'optimized' ? "Single H1 tag provides clear topic focus for search engines." : "Multiple H1 tags confuse search engines about page topic.",
      recommendation: h1Status === 'optimized' ? "Current H1 implementation is optimal." : "Consolidate to a single, descriptive H1 tag."
    },
    {
      id: 6,
      name: "H2–H6 Tags",
      status: h2h6Status,
      issues: h2h6Status === 'optimized' ? "None. Proper header structure found." : "Missing H2 tags for content hierarchy.",
      currentData: h2h6Status === 'optimized' ? `H2: ${h2Count}, H3: ${pi.h3_count || 0}, H4: ${pi.h4_count || 0}` : "No H2 tags found",
      whyItMatters: "Creates logical content structure and improves readability.",
      recommendation: h2h6Status === 'optimized' ? "Current structure is optimal." : "Add H2 tags to break down content sections."
    },
    {
      id: 7,
      name: "Content Length",
      status: contentStatus,
      issues: contentStatus === 'optimized' ? "None. Content length is optimal for SEO." : "Content length needs improvement for better engagement.",
      currentData: contentStatus === 'optimized' ? `${wordCount} words` : `${wordCount} words (needs 300+)`,
      whyItMatters: contentStatus === 'optimized' ? "Sufficient content provides comprehensive topic coverage." : "Short content may lack depth for search engines.",
      recommendation: contentStatus === 'optimized' ? "Current content length is optimal." : "Expand content to 300+ words for better SEO."
    },
    {
      id: 8,
      name: "Image Alt",
      status: altStatus,
      issues: altStatus === 'optimized' ? "None. All images have alt attributes." : `Only ${altPercentage}% of images have alt attributes.`,
      currentData: `Total images: ${pi.image_alt_percentage?.total || 10}, With alt: ${pi.image_alt_percentage?.with_alt || 4}`,
      whyItMatters: "Essential for accessibility and image search optimization.",
      recommendation: altStatus === 'optimized' ? "Current implementation is optimal." : "Add alt attributes to all images for better accessibility."
    },
    {
      id: 9,
      name: "Noindex Tag",
      status: noindexTagStatus,
      issues: noindexTagStatus === 'optimized' ? "None. No noindex tags found." : "Noindex tag detected - page will not be indexed.",
      currentData: noindexTagStatus === 'optimized' ? "No noindex meta tag found" : "Noindex meta tag detected in HTML",
      whyItMatters: noindexTagStatus === 'optimized' ? "Allows search engines to index your page." : "Prevents search engines from indexing your page.",
      recommendation: noindexTagStatus === 'optimized' ? "Current setup is optimal." : "Remove noindex tag to allow indexing."
    },
    {
      id: 10,
      name: "Robots Meta",
      status: noindexTagStatus === 'optimized' ? 'optimized' : 'critical',
      issues: noindexTagStatus === 'optimized' ? "None. Robots meta tag is properly configured." : "Robots meta tag may be misconfigured.",
      currentData: noindexTagStatus === 'optimized' ? "Robots meta tag allows indexing" : "Robots meta tag issues detected",
      whyItMatters: "Controls how search engines crawl and index your page.",
      recommendation: noindexTagStatus === 'optimized' ? "Current setup is optimal." : "Review robots meta tag configuration."
    },
    {
      id: 11,
      name: "Analytics",
      status: analyticsStatus,
      issues: analyticsStatus === 'optimized' ? "None. Analytics properly configured." : "Analytics tracking not detected or misconfigured.",
      currentData: analyticsStatus === 'optimized' ? `${pi.analytics?.type || 'Google Analytics'} configured` : "No analytics detected",
      whyItMatters: "Essential for tracking performance and user behavior.",
      recommendation: analyticsStatus === 'optimized' ? "Current setup is optimal." : "Install Google Analytics or similar tracking tool."
    }
  ];

  // Filter to show only warning and critical issues (hide optimized ones)
  const filteredChecks = seoChecks.filter(check => check.status !== 'optimized');

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
            <span className="text-cyan-700 dark:text-cyan-400 text-xl">🔍</span>
          </div>
          On Page SEO
        </h2>
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-xl">
          <span className="text-xs tracking-[0.15em] uppercase text-slate-600 dark:text-slate-400">
            Section Score
          </span>
          <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
            {seoScore}%
          </span>
        </div>
      </div>

      {/* CARDS */}
      <div className={`grid ${getGridClass(filteredChecks.length)} gap-8 mt-8`}>
        {filteredChecks.map((check) => {
          // Get severity from backend checks
          const backendCheck = data.sections?.on_page?.checks?.find(c => c.name === check.name);
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
                All On Page SEO Checks Passed
              </h4>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                All {seoChecks.length} checks passed successfully
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

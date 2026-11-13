"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, Sparkles } from 'lucide-react'
import { useProject } from '@/contexts/ProjectContext'
import { SEV, Chip, StatCard } from '@/components/dashboard/issues/OnPageIssuesView'

// Static lookup table for enriching checks with additional data
const CHECKS_LOOKUP = {
  "SSL Certificate": {
    impact: 0,
    difficulty: "N/A",
    icon: "🔒",
    aiPrompt: "Generate SSL certificate configuration for [domain]. Include certificate setup, renewal, and security best practices.",
    // No static "what"/"whatToDo" here on purpose: unlike the other checks,
    // SSL status varies (valid / expired / hostname mismatch / unverifiable)
    // and the backend message already says exactly which one it is -- a
    // fixed "your certificate is valid" string here would contradict a
    // Critical/Warning status and show a false all-clear. Let both fields
    // fall through to check.message (see the mapping below).
    diySteps: [],
    before: "",
    after: ""
  },
  "Security Headers": {
    impact: 8,
    difficulty: "Medium",
    icon: "🛡",
    aiPrompt: "Generate complete security headers for Nginx server at [domain]. Include X-Frame-Options, CSP, HSTS, X-Content-Type-Options, and Referrer-Policy.",
    what: "Security headers like Content-Security-Policy (CSP), X-Frame-Options, and HSTS are missing from your server responses.",
    whatToDo: "Add the missing security headers at the server level (Apache/Nginx config or CDN headers).",
    diySteps: [
      { title: "Add headers via Nginx config", desc: "Open your Nginx server block config and add the security headers." },
      { title: "Add headers via Apache .htaccess", desc: "Add the Header set directives in your .htaccess file." },
      { title: "Verify via securityheaders.com", desc: "Test your domain to confirm all headers are returning correctly." }
    ],
    before: "# No security headers set\nserver {\n  listen 443 ssl;\n  server_name yourdomain.com;\n}",
    after: "server {\n  listen 443 ssl;\n  server_name yourdomain.com;\n  add_header X-Frame-Options \"SAMEORIGIN\";\n  add_header X-Content-Type-Options \"nosniff\";\n  add_header Strict-Transport-Security \"max-age=31536000\" always;\n  add_header Content-Security-Policy \"default-src 'self'\" always;\n}"
  },
  "Canonical Tags": {
    impact: 11,
    difficulty: "Medium",
    icon: "🔗",
    aiPrompt: "Generate correct canonical tags for these URLs: [URL list]. Use HTTPS and consistent www format.",
    what: "Canonical tags are pointing to incorrect URLs or using inconsistent domain variants.",
    whatToDo: "Ensure every page has a self-referencing canonical tag pointing to the preferred URL.",
    diySteps: [
      { title: "Audit all canonical tags", desc: "Use Screaming Frog to export all canonical URLs and check for inconsistencies." },
      { title: "Decide preferred domain format", desc: "Choose either https://www.domain.com OR https://domain.com and be consistent." },
      { title: "Update canonical tags in CMS", desc: "Add correct self-referencing canonical tags in the <head> section." }
    ],
    before: "<link rel=\"canonical\" href=\"http://www.domain.com/page/\">",
    after: "<link rel=\"canonical\" href=\"https://www.domain.com/page/\">"
  },
  "Robots.txt": {
    impact: 0,
    difficulty: "N/A",
    icon: "🤖",
    aiPrompt: "Generate robots.txt file for [domain] that allows all crawlers and points to sitemap.",
    what: "Robots.txt is correctly configured. No critical paths are accidentally blocked.",
    whatToDo: "No action needed. Keep robots.txt updated when adding new sections.",
    diySteps: [],
    before: "",
    after: ""
  },
  "Noindex on Key Pages": {
    impact: 19,
    difficulty: "Easy",
    icon: "🚫",
    aiPrompt: "I have noindex tags on these important pages: [URL list]. Generate the correct meta robots tags to remove noindex.",
    what: "Important pages have a noindex directive, meaning Google cannot index or rank them.",
    whatToDo: "Remove the noindex directive from these pages unless they are intentionally excluded.",
    diySteps: [
      { title: "Locate the noindex directive", desc: "Check page source for <meta name=\"robots\" content=\"noindex\"> in the <head>." },
      { title: "Remove from WordPress", desc: "Edit the page → SEO tab → Advanced → set 'Allow search engines to show this page' to Yes." },
      { title: "Request re-indexing in GSC", desc: "Use Google Search Console → URL Inspection → Request Indexing." }
    ],
    before: "<meta name=\"robots\" content=\"noindex, follow\">",
    after: "<meta name=\"robots\" content=\"index, follow\">"
  },
  "H1 Tags": {
    impact: 12,
    difficulty: "Easy",
    icon: "H¹",
    aiPrompt: "Write SEO-optimised H1 tags for these pages: [list page URLs and topics]. Each H1 should be 20–70 characters.",
    what: "Pages are missing their H1 tag entirely or have an empty H1. The H1 is the primary content signal.",
    whatToDo: "Add one descriptive, keyword-rich H1 tag per page.",
    diySteps: [
      { title: "Identify missing H1s", desc: "Use Screaming Frog → H1 tab → filter 'Missing' or 'Empty'." },
      { title: "Write keyword-focused H1s", desc: "Each H1 should be 20–70 chars and contain the primary keyword." },
      { title: "Add H1 in page template or CMS", desc: "Ensure the first heading block is set to H1 type." }
    ],
    before: "<h2>Welcome to our platform</h2>",
    after: "<h1>AI-Powered SEO Audit Tool for Agencies</h1>\n<h2>Welcome to our platform</h2>"
  },
  "Structured Data / Schema": {
    impact: 22,
    difficulty: "Medium",
    icon: "🧩",
    aiPrompt: "Generate complete JSON-LD schema markup for a [page type] for this page: [URL]. Include 3 FAQ pairs.",
    what: "Structured data (schema markup) is missing, which reduces rich results eligibility and AI citation probability.",
    whatToDo: "Implement JSON-LD schema on every key page type: Organization, WebSite, Article, FAQPage.",
    diySteps: [
      { title: "Map schema types to page types", desc: "Homepage → Organization + WebSite. Blog posts → Article. Service pages → Service + FAQPage." },
      { title: "Generate JSON-LD blocks", desc: "Use schema.org or Google's Structured Data Markup Helper." },
      { title: "Add to <head> via CMS or template", desc: "Paste the <script type=\"application/ld+json\"> block inside <head>." }
    ],
    before: "<head>\n  <title>AI SEO Audit | AuditIQ</title>\n</head>",
    after: "<head>\n  <title>AI SEO Audit | AuditIQ</title>\n</head>\n<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"FAQPage\",\n  \"mainEntity\": [{\n    \"@type\": \"Question\",\n    \"name\": \"What is an AI SEO audit?\",\n    \"acceptedAnswer\": {\n      \"@type\": \"Answer\",\n      \"text\": \"An AI SEO audit analyses...\"\n    }\n  }]\n}\n<\/script>"
  },
  "Mobile Friendliness": {
    impact: 0,
    difficulty: "N/A",
    icon: "📱",
    aiPrompt: "Generate mobile optimization recommendations for [domain] to improve mobile-friendliness.",
    what: "All tested pages pass Google's mobile-friendly test. Viewport meta tag is set correctly.",
    whatToDo: "No action needed. Continue monitoring mobile usability in Google Search Console.",
    diySteps: [],
    before: "",
    after: ""
  },
  "XML Sitemap": {
    impact: 0,
    difficulty: "N/A",
    icon: "🗺",
    aiPrompt: "Generate XML sitemap for [domain] with all important pages and proper priority settings.",
    what: "XML sitemap is present and correctly submitted to Google Search Console.",
    whatToDo: "No action needed. Keep sitemap updated when adding/removing pages.",
    diySteps: [],
    before: "",
    after: ""
  },
  "OG / Social Tags": {
    impact: 3,
    difficulty: "Easy",
    icon: "📣",
    aiPrompt: "Generate complete Open Graph and Twitter Card meta tags for this page: [URL]. Include all required tags.",
    what: "Open Graph (OG) tags are missing or incomplete, hurting social media share previews.",
    whatToDo: "Add complete OG meta tags to every page: og:title, og:description, og:image, og:url, og:type.",
    diySteps: [
      { title: "Audit missing OG tags", desc: "Screaming Frog → Custom Extraction → extract og:title, og:image, og:description." },
      { title: "Create OG images", desc: "Design 1200×630px social preview images for each page category." },
      { title: "Add OG tags to templates", desc: "Add full OG meta tag set to your <head> template with dynamic values." }
    ],
    before: "<head>\n  <title>AI SEO Features | AuditIQ</title>\n</head>",
    after: "<head>\n  <title>AI SEO Features | AuditIQ</title>\n  <meta property=\"og:title\" content=\"AI SEO Audit Features\">\n  <meta property=\"og:description\" content=\"Run a 60-second AI SEO audit\">\n  <meta property=\"og:image\" content=\"https://auditiq.com/og/features.jpg\">\n  <meta property=\"og:type\" content=\"website\">\n</head>"
  }
}

export default function CheckList({ onSelectCheck, technicalData, error }) {
  const { activeProject } = useProject()
  const [checks, setChecks] = useState([])
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")

  // Process technical data when received from parent
  useEffect(() => {
    if (!technicalData) return

    // Store summary from backend response
    setSummary(technicalData.summary || null)
    
    const enrichedChecks = (technicalData.checks || []).map(check => {
      const lookup = CHECKS_LOOKUP[check.name] || {}
      const statusMap = {
        "pass": "passed",
        "fail": "critical", 
        "warning": "warning",
        "OK": "passed",
        "Critical": "critical",
        "Warning": "warning"
      }
      return {
        ...check,
        status: statusMap[check.status] || check.status,
        impact: check.impact_percentage || 0,
        difficulty: check.difficulty || "Medium",
        icon: lookup.icon || "⚙",
        aiPrompt: lookup.aiPrompt || "",
        what: lookup.what || check.message || check.description || "",
        whatToDo: lookup.whatToDo || "",
        diySteps: lookup.diySteps || [],
        before: lookup.before || "",
        after: lookup.after || ""
      }
    })
    setChecks(enrichedChecks)
  }, [technicalData])

  const filteredChecks = checks.filter(check => {
    if (filter === "all") return true
    return check.status === filter
  })

  // Use backend summary values instead of calculating in frontend
  const critical = summary?.critical ?? 0
  const warnings = summary?.warnings ?? 0 
  const passed = summary?.passed ?? 0
  const total = summary?.total ?? checks.length
  const healthScore = summary?.healthScore ?? 0
  
  // `impact` mixes two different bases depending on the check (see
  // technicalChecks.service.js's `impact_basis`): a real "% of pages
  // affected" ratio for page-level checks, or a fixed 100/50/0 severity
  // weight for site-wide checks (SSL/robots/sitemap). Summing them across
  // checks and presenting the total as "% SEO potential recovery" was
  // fabricating a ranking/traffic estimate that doesn't exist in the data —
  // two site-wide critical checks alone would already sum to 200%. Replaced
  // with the actual highest-impact critical check, named and quantified
  // honestly instead.
  const criticalChecks = checks.filter(c => c.status === "critical" || c.status === "Critical")
  const topCriticalCheck = criticalChecks.length > 0
    ? [...criticalChecks].sort((a, b) => (b.impact || 0) - (a.impact || 0))[0]
    : null

  if (error) {
    return (
      <div className="glass-card">
        <div className="p-6 text-center">
          <div className="text-red-500 mb-2">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="text-blue-500 hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const STATUS = {
    critical: { label: "Critical", pill: SEV.high.pill, bar: SEV.high.bar },
    warning: { label: "Warning", pill: SEV.medium.pill, bar: SEV.medium.bar },
    passed: { label: "Passed", pill: "bg-[#1FB37A]/15 text-[#0B6E4D] dark:text-[#5FD9A6]", bar: "bg-[#1FB37A]" },
  }
  const ORDER = ["critical", "warning", "passed"]
  const query = search.trim().toLowerCase()
  const shown = filteredChecks
    .filter((c) => !query || `${c.name} ${c.message || ""} ${c.description || ""}`.toLowerCase().includes(query))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
  const hasFilters = filter !== "all" || query !== ""
  const clearAll = () => { setFilter("all"); setSearch("") }
  const listTitle = filter === "all" ? `All checks · ${shown.length}` : `${STATUS[filter].label} · ${shown.length}`
  const GRID = "minmax(0,1fr) 170px 100px 120px"

  return (
    <div className="flex flex-col gap-[18px] text-foreground">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            <Link href="/app/domain-overview" className="hover:underline">Dashboard</Link> / SEO / <span className="font-bold text-foreground">Technical</span>
          </span>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">Technical checks</h1>
        </div>
        <span className="text-[13px] text-muted-foreground">Technical health {healthScore}%{activeProject?.project_name ? ` · ${activeProject.project_name}` : ""}</span>
      </header>

      <div role="group" aria-label="Filter by status" className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))" }}>
        <StatCard label="Total checks" value={total} sub="across 8 categories" accent="bg-foreground" valueColor="text-foreground" active={filter === "all"} showBadge={filter === "all"} onClick={() => setFilter("all")} />
        <StatCard label="Critical" value={critical} sub="need immediate fix" accent={SEV.high.accent} valueColor={SEV.high.value} active={filter === "critical"} showBadge={filter === "critical"} onClick={() => setFilter(filter === "critical" ? "all" : "critical")} />
        <StatCard label="Warnings" value={warnings} sub="should be addressed" accent={SEV.medium.accent} valueColor={SEV.medium.value} active={filter === "warning"} showBadge={filter === "warning"} onClick={() => setFilter(filter === "warning" ? "all" : "warning")} />
        <StatCard label="Passed" value={passed} sub="no action needed" accent="bg-[#1FB37A]" valueColor="text-[#0B6E4D] dark:text-[#5FD9A6]" active={filter === "passed"} showBadge={filter === "passed"} onClick={() => setFilter(filter === "passed" ? "all" : "passed")} />
      </div>

      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#0A86A0]/30 bg-[#0A86A0]/10 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0A86A0] text-white"><Sparkles className="h-[18px] w-[18px]" aria-hidden="true" /></span>
        <span className="min-w-[240px] flex-1 text-[14px] leading-normal">
          {critical > 0 ? (
            <>
              <strong>Start here:</strong> {critical} critical {critical === 1 ? "check needs" : "checks need"} action.
              {topCriticalCheck && (
                <> Begin with <strong>{topCriticalCheck.name}</strong>{topCriticalCheck.difficulty ? ` (${topCriticalCheck.difficulty})` : ""}
                  {topCriticalCheck.impact_basis === "pages_affected_ratio" && <>, which affects <strong>{topCriticalCheck.impact || 0}%</strong> of crawled pages</>}.</>
              )}
            </>
          ) : (
            <>No critical checks right now — nice work.</>
          )}
        </span>
        {critical > 0 && (
          <button type="button" onClick={() => setFilter("critical")} className="h-10 rounded-xl bg-foreground px-3.5 text-[13px] font-bold text-background">Show critical</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[18px] border border-border bg-card p-3.5">
        <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12px] font-bold text-muted-foreground">Status</span>
          {[["all", "All"], ["critical", "Critical"], ["warning", "Warnings"], ["passed", "Passed"]].map(([id, label]) => (
            <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>{label}</Chip>
          ))}
        </div>
        <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Search checks</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search checks, e.g. "canonical"' className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-foreground outline-none" />
        </label>
        {hasFilters && <button type="button" onClick={clearAll} className="h-11 rounded-xl px-3 text-[13px] font-bold text-[#4256D6] dark:text-[#8FA0FF]">Clear filters</button>}
      </div>

      <section aria-label="Checks" className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-[18px] py-3.5">
          <span className="text-[14px] font-extrabold">{listTitle}</span>
          <span className="text-[12px] text-muted-foreground">Critical first · click a check to see pages and fixes</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid gap-3 border-b border-border px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground" style={{ gridTemplateColumns: GRID }}>
              <span>Check</span><span>Pages affected</span><span>Difficulty</span><span />
            </div>
            {shown.map((check) => {
              const st = STATUS[check.status] || STATUS.passed
              const ok = check.status === "passed" || check.status === "OK"
              const ratio = check.impact_basis === "pages_affected_ratio"
              return (
                <div key={check.name} className="grid cursor-pointer items-center gap-3 border-t border-border px-[18px] py-3 transition-colors hover:bg-muted/40" style={{ gridTemplateColumns: GRID }} onClick={() => onSelectCheck(check)}>
                  <span className="flex min-w-0 items-center gap-3">
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className={`w-16 shrink-0 rounded-full py-1 text-center text-[11px] font-extrabold ${st.pill}`}>{st.label}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14px] font-bold">{check.name}</span>
                      <span className="truncate text-[12px] text-muted-foreground">{check.message || check.description || "No description available"}</span>
                    </span>
                  </span>
                  <span>
                    {check.affected_pages > 0 ? (
                      <span className="flex flex-col gap-1">
                        <span className="text-[13px]"><strong>{check.affected_pages}</strong> <span className="text-muted-foreground">page{check.affected_pages > 1 ? "s" : ""}{ratio ? ` · ${check.impact || 0}%` : ""}</span></span>
                        {ratio && <span className="block h-[5px] rounded-[3px] bg-muted"><span className={`block h-[5px] rounded-[3px] ${st.bar}`} style={{ width: `${Math.min(100, check.impact || 0)}%` }} /></span>}
                      </span>
                    ) : <span className="text-[13px] text-muted-foreground">{ok ? "—" : "Site-wide"}</span>}
                  </span>
                  <span className="text-[12px] font-semibold text-muted-foreground">{ok ? "—" : check.difficulty}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelectCheck(check) }}
                    className={`h-9 rounded-[10px] text-[12px] font-bold ${ok ? "border border-border bg-card text-foreground hover:bg-muted" : "bg-[#4256D6] text-white hover:bg-[#3547BD]"}`}
                  >
                    {ok ? "View" : "Fix with AI"}
                  </button>
                </div>
              )
            })}
            {shown.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-[18px] py-10 text-center">
                <span className="text-[15px] font-extrabold">No checks match these filters</span>
                <button type="button" onClick={clearAll} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-bold">Clear filters</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

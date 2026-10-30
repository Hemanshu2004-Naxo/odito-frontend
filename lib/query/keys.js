/* ═══════════════════════════════════════════════════════════════
   Query Key Factory
   
   Centralized, type-safe query key generation.
   Every TanStack Query hook MUST use these factories.
   
   RULES:
   - Keys are arrays, ordered from general → specific
   - Adding a projectId scopes the query to that project
   - queryClient.invalidateQueries(['projects']) invalidates ALL project queries
   - queryClient.invalidateQueries(['issues', projectId]) invalidates all issues for one project
   ═══════════════════════════════════════════════════════════════ */

export const queryKeys = {
  // ── Projects ────────────────────────────────────────────────
  projects: {
    all: () => ['projects'],
    list: (params) => ['projects', 'list', params],
    detail: (id) => ['projects', id],
    overview: (id) => ['projects', id, 'overview'],
    trash: (params) => ['projects', 'trash', params],
  },

  // ── Issues ──────────────────────────────────────────────────
  issues: {
    counts: (projectId) => ['issues', projectId, 'counts'],
    onpage: (projectId) => ['issues', projectId, 'onpage'],
    accessibility: (projectId) => ['issues', projectId, 'accessibility'],
    page: (projectId, url) => ['issues', projectId, 'page', url],
  },

  // ── Issue context (the "Current State" of one issue on one page) ──
  // Derived from the latest crawl, so it MUST be refreshed whenever a crawl or a page verification completes (see invalidateProject).
  issueContext: {
    all: (projectId) => ['issue-context', projectId],
    detail: (projectId, issueId, pageUrl) => ['issue-context', projectId, issueId, pageUrl],
  },

  // ── URL Verification (F4-002 result panel) ──────────────────
  verification: {
    latest: (projectId, url) => ['verification', projectId, 'latest', url],
    // F4-003: keyed by projectId only — the underlying request is the
    // project-wide history endpoint (no page-scoped list route exists on
    // the frozen backend); per-page filtering happens client-side via
    // useVerificationHistory's `select`, so every page on the same project
    // shares one cached fetch instead of one each.
    projectHistory: (projectId) => ['verification', projectId, 'project-history'],
    // F4-004: single run by id, for the Run Detail Drawer.
    run: (runId) => ['verification', 'run', runId],
  },

  // ── Technical Checks ────────────────────────────────────────
  technical: {
    all: (projectId) => ['technical', projectId],
    detail: (projectId, checkId) => ['technical', projectId, checkId],
  },

  // ── PageSpeed ───────────────────────────────────────────────
  pagespeed: {
    data:   (projectId) => ['pagespeed', projectId],
    status: (projectId) => ['pagespeed', projectId, 'status'],
  },

  // ── ChatGPT Visibility (sampled ChatGPT answers; NOT on-page AI readiness) ──
  // ── Domain Overview (five independent DataForSEO-backed sections, cached on the server) ──
  domainOverview: {
    all:     (projectId) => ['domain-overview', projectId],
    section: (projectId, section) => ['domain-overview', projectId, section],
    // The history is keyed by window. 12 is the Domain Overview's own query AND Traffic History's default, so both share one cache entry;
    // "v2" drops payloads persisted before the history carried every monthly metric.
    history: (projectId, months = 12) => ['domain-overview', projectId, 'history', 'v2', months],
    // The dashboard's top-5 query. It is also where the Organic Keywords page gets its whole-domain totals (an unfiltered response is the
    // only one whose metrics are whole-domain), so both share one entry. "v2": the payload now carries `metrics`; a copy persisted
    // before that has none, and would show "—" until it went stale.
    rankedKeywords: (projectId) => ['domain-overview', projectId, 'ranked-keywords', 'v2'],
    // The Domain Overview's "Top keywords" card in its Brand / Non-brand variants (top 5 by traffic + the brand filter). Not the Organic Keywords
    // page's key on purpose: the Anchors settings' "import keywords" reads every `keywords` entry. Never persisted.
    topKeywordsVariant: (projectId, request) => ['domain-overview', projectId, 'top-keywords', request],
    // One page of the Organic Keywords table (or the 1,000-row export). `query` is { limit, offset, order_by, filters } and is part of
    // the key, so every page / sort / filter has its own entry. Never persisted (see lib/queryPersistence.js).
    keywords: (projectId, query) => ['domain-overview', projectId, 'keywords', query],
    // The backlinks summary (API 6). `request` = { status, dofollow } (lib/backlinksRequest.js). The dashboard's three cards and the Backlink
    // Overview page's default view use the SAME key: one entry in the browser, one on the server.
    backlinks: (projectId, request) => ['domain-overview', projectId, 'backlinks', 'v2', request],
    // One page of individual backlinks (the Backlinks page). `request` = { status, mode, limit, offset, token?, order_by, filters }: every tab /
    // group / sort / filter / page (and "Load more" token) is its own entry. Never persisted (see lib/queryPersistence.js).
    backlinksList: (projectId, request) => ['domain-overview', projectId, 'backlinks-list', request],
    // One page of referring domains (the Referring Domains page). `request` = { status, dofollow, limit, offset, order_by, filters }: every tab /
    // sort / filter / page is its own entry. The Disavowed tab fills in only the saved domains it has no row for yet (`domains` = those). Never persisted.
    referringDomains: (projectId, request) => ['domain-overview', projectId, 'referring-domains', request],
    referringDomainsFill: (projectId, domains) => ['domain-overview', projectId, 'referring-domains', 'fill', domains],
    // One page of the Top Pages table. `request` = { limit, offset, order_by, filters } (live links only): every tab / sort / filter / page is its
    // own entry. The traffic per page is joined by the SERVER. Never persisted. The three profile pieces (headline counts, "Fix first") are fixed
    // requests, one entry each, kept 7 days on the server.
    topPages: (projectId, request) => ['domain-overview', projectId, 'domain-pages', request],
    topPagesCounts: (projectId) => ['domain-overview', projectId, 'tp-counts'],
    topPagesFixFirst: (projectId) => ['domain-overview', projectId, 'tp-fix-first'],
    // The two PROFILE-LEVEL cards (live links, no filters): the rank distribution (five count-only calls) and the toxic-domain count. 7 days on the server.
    rdRankBuckets: (projectId) => ['domain-overview', projectId, 'rd-rank-buckets'],
    // The Domain Overview's "Referring domains - last 30 days" tiles (two count-only calls, 7 days on the server).
    rdLast30: (projectId) => ['domain-overview', projectId, 'rd-last-30'],
    rdToxicCount: (projectId) => ['domain-overview', projectId, 'rd-toxic-count'],
    // One page of anchors (the Anchors page). `request` = { status, limit, offset, order_by, filters }: every status / sort / filter / page is
    // its own entry. Never persisted (see lib/queryPersistence.js).
    anchors: (projectId, request) => ['domain-overview', projectId, 'anchors', request],
    // The anchor profile (the distribution, the summary cards, "Export all anchors"): ONE fixed request per project (the top 1,000 live
    // anchors), kept for 7 days on the server. Never persisted: ~200 KB.
    anchorProfile: (projectId) => ['domain-overview', projectId, 'anchor-profile'],
    // The same profile PEEKED from the Domain Overview: answered from the server's cache only (never a provider call), so "not cached" is a
    // normal answer. Its own key: it must never be mistaken for the Anchors page's real profile. Never persisted.
    anchorProfilePeek: (projectId) => ['domain-overview', projectId, 'anchor-profile', 'peek'],
    // One page of competitors. `request` is the section's request shape (lib/competitorsRequest.js); `signature` fingerprints the project's
    // exclude list, which changes the answer. The Domain Overview card and the Competitors page's default view use the SAME key (one entry).
    // Pinning / unpinning a competitor changes neither, so it never refetches this.
    competitors: (projectId, request, signature) => ['domain-overview', projectId, 'competitors', 'v2', signature, request],
    // The Compare section: the project plus the tracked competitors (`targetsKey` = the sorted tracked domains joined).
    trafficComparison: (projectId, targetsKey) => ['domain-overview', projectId, 'bulk-traffic', targetsKey],
    // The same comparison PEEKED (cache only) by the Domain Overview's competitors card, for tracked competitors the competitors list does not contain.
    trafficComparisonPeek: (projectId, targetsKey) => ['domain-overview', projectId, 'bulk-traffic-peek', targetsKey],
  },

  // ── Domain lists: the project's disavowed + reviewed referring domains (never persisted; changing them never refetches the data provider) ──
  domainLists: {
    detail: (projectId) => ['domain-lists', projectId],
  },

  // ── Anchor settings: the project's saved brand terms + target keywords (never persisted: they decide every anchor's type) ──
  anchorSettings: {
    detail: (projectId) => ['anchor-settings', projectId],
  },

  // ── Competitor settings: the project's tracked + excluded domain lists (never persisted: they decide the competitors query key) ──
  competitorSettings: {
    detail: (projectId) => ['competitor-settings', projectId],
  },

  // ── Google AI Overview Visibility (own namespace: never shares a cache entry with ChatGPT Visibility) ──
  googleAioVisibility: {
    all:          (projectId) => ['google-aio-visibility', projectId],
    summary:      (projectId) => ['google-aio-visibility', projectId, 'summary'],
    selection:    (projectId, device) => ['google-aio-visibility', projectId, 'selection', device],
    runs:         (projectId, params) => ['google-aio-visibility', projectId, 'runs', params],
    run:          (projectId, runId) => ['google-aio-visibility', projectId, 'run', runId],
    evidenceRun:  (projectId, runId) => ['google-aio-visibility', projectId, 'evidence', runId],
    evidenceItem: (projectId, runId, questionId) => ['google-aio-visibility', projectId, 'evidence-item', runId, questionId],
    questionHistory: (projectId, questionId) => ['google-aio-visibility', projectId, 'question-history', questionId],
    trend:        (projectId, range) => ['google-aio-visibility', projectId, 'trend', range],
  },

  // ── AI Visibility question sets (provider-independent; draft -> approved is decided by the server) ──
  aiVisibilityQuestions: {
    all:      (projectId) => ['ai-visibility-questions', projectId],
    list:     (projectId, params) => ['ai-visibility-questions', projectId, 'list', params],
    set:      (projectId, setId) => ['ai-visibility-questions', projectId, 'set', setId],
    approved: (projectId) => ['ai-visibility-questions', projectId, 'approved'],
    profile:  (projectId) => ['ai-visibility-questions', projectId, 'profile'],
  },

  // ── Keywords ────────────────────────────────────────────────
  // list(projectId, opts) — Manual Keyword Management (add/delete/rescan)
  // calls this with opts omitted; usage (used/limit/remaining) is embedded
  // in the same GET /rankings response the list already uses, so there's
  // no separate "usage" query key to keep in sync with the list.
  keywords: {
    list: (projectId, opts) => ['keywords', projectId, 'list', opts],
    intelligence: (projectId) => ['keywords', projectId, 'intelligence'],
  },

  // ── AI Search Audit ─────────────────────────────────────────
  aiAudit: {
    project: (projectId) => ['ai-audit', projectId, 'project'],
    summary: (projectId) => ['ai-audit', projectId],
    issues: (projectId) => ['ai-audit', projectId, 'issues'],
    issue: (projectId, issueId) => ['ai-audit', projectId, 'issues', issueId],
    issuePages: (projectId, issueId, opts) => ['ai-audit', projectId, 'issues', issueId, 'pages', opts],
    accessibility: (projectId) => ['ai-audit', projectId, 'accessibility'],
  },

  // ── AEO Hub ─────────────────────────────────────────────────
  aeoHub: {
    data:   (projectId)         => ['aeo-hub', projectId],
    issues: (projectId)         => ['aeo-hub', projectId, 'issues'],
    detail: (projectId, ruleId) => ['aeo-hub', projectId, 'issues', ruleId],
  },

  // ── AI Pages (URL-level AI issue detail) ────────────────────
  aiPages: {
    issues: (projectId, url) => ['ai-pages', projectId, 'issues', url],
  },

  // ── GEO Hub ─────────────────────────────────────────────────
  geoHub: {
    data:   (projectId)         => ['geo-hub', projectId],
    issues: (projectId)         => ['geo-hub', projectId, 'issues'],
    detail: (projectId, ruleId) => ['geo-hub', projectId, 'issues', ruleId],
  },

  // ── AISO Hub ────────────────────────────────────────────────
  aisoHub: {
    data:   (projectId)          => ['aiso-hub', projectId],
    issues: (projectId)          => ['aiso-hub', projectId, 'issues'],
    detail: (projectId, ruleId)  => ['aiso-hub', projectId, 'issues', ruleId],
  },

  // ── Pre Audit ───────────────────────────────────────────────
  preAudit: {
    detail: (projectId) => ['pre-audit', projectId],
  },

  // ── Subscription ────────────────────────────────────────────
  subscription: {
    mine: () => ['subscription'],
    plans: () => ['plans'],
    history: (page) => ['subscription', 'history', page],
  },

  // ── Connected Accounts (Google) ─────────────────────────────
  googleAccount: {
    status: () => ['google-account', 'status'],
  },

  // ── Google Services (independent per-service accounts) ─────────
  // Settings → Google Services. Project-scoped, unlike googleAccount above
  // (an account-wide rollup used only by the legacy bundled connection).
  googleServices: {
    connections: (projectId) => ['google-services', projectId, 'connections'],
  },

  // ── Brand Asset Resolver ──────────────────────────────────────
  brandAsset: {
    detail: (projectId) => ['brand-asset', projectId],
  },

  // ── WordPress Connection (Phase 2 — connect/verify/status/disconnect) ──
  wordpress: {
    status: (projectId) => ['wordpress', projectId, 'status'],
    pluginStatus: (projectId) => ['wordpress', projectId, 'plugin-status'],
    forms: (projectId) => ['wordpress', projectId, 'forms'],
    // ── SEO provider detection + live field read (Phase 4) ──────────────
    capabilities: (projectId) => ['wordpress', projectId, 'seo-capabilities'],
    seoData: (projectId, pageUrl) => ['wordpress', projectId, 'seo-data', pageUrl],
    // Site-level schema (Organization sameAs, breadcrumbs) — deliberately
    // NOT keyed by pageUrl, unlike seoData above: this is one site-wide
    // state, not per-page.
    siteSchema: (projectId) => ['wordpress', projectId, 'site-schema'],
    // Page-content (H1) fix eligibility for one page. `recommended` is part of the key because it
    // changes the preview the backend returns (never what is written).
    // Whether a page URL resolves to a WordPress post/page (and why not) — per page.
    pageResolution: (projectId, pageUrl) => ['wordpress', projectId, 'page-resolution', pageUrl],
    h1Context: (projectId, pageUrl, recommended = null) => ['wordpress', projectId, 'h1-context', pageUrl, recommended],
    fixPreview: (projectId, taskId) => ['wordpress', projectId, 'fix-preview', taskId],
    imageAlt: (projectId, taskId) => ['wordpress', projectId, 'image-alt', taskId],
  },

  // ── Organization sameAs (profile links): discovery + the plan for one selection ─────────────
  // ── Breadcrumb trail discovery (what trail does this page really have?) ───────────────────
  investigation: {
    detail: (projectId, investigationId) => ['investigation', projectId, investigationId],
  },

  breadcrumb: {
    all: (projectId) => ['breadcrumb', projectId],
    discovery: (projectId, pageUrl) => ['breadcrumb', projectId, 'discovery', pageUrl],
    pages: (projectId) => ['breadcrumb', projectId, 'pages'],
  },

  sameAs: {
    all: (projectId) => ['same-as', projectId],
    discovery: (projectId, pageUrl) => ['same-as', projectId, 'discovery', pageUrl],
    preview: (projectId, pageUrl, taskId, selectionKey) => ['same-as', projectId, 'preview', pageUrl, taskId || null, selectionKey],
  },

  // ── Business Profile ─────────────────────────────────────────
  businessProfile: {
    status:  (projectId)         => ['business-profile', projectId, 'status'],
    accounts: (projectId)        => ['business-profile', projectId, 'accounts'],
    locations: (projectId, accountId) => ['business-profile', projectId, 'locations', accountId],
    data:    (projectId)         => ['business-profile', projectId, 'data'],
    details: (projectId)         => ['business-profile', projectId, 'details'],
    trends:  (projectId, range)  => ['business-profile', projectId, 'trends', range],
    media:   (projectId, params) => ['business-profile', projectId, 'media', params],
    rating:  (projectId)         => ['business-profile', projectId, 'rating'],
    reviews: (projectId, params) => ['business-profile', projectId, 'reviews', params],
    reviewAnalytics: (projectId, locationId, range, tz) => ['business-profile', projectId, 'review-analytics', locationId, range, tz],
    posts:   (projectId, params) => ['business-profile', projectId, 'posts', params],
  },

  // ── Search Console ────────────────────────────────────────────
  searchConsole: {
    status:    (projectId)           => ['search-console', projectId, 'status'],
    sites:     (projectId)           => ['search-console', projectId, 'sites'],
    data:      (projectId, params)   => ['search-console', projectId, 'data', params],
    trends:    (projectId, range)    => ['search-console', projectId, 'trends', range],
    breakdown: (projectId, dimension) => ['search-console', projectId, 'breakdown', dimension],
    sitemaps:  (projectId)           => ['search-console', projectId, 'sitemaps'],
  },

  // ── Analytics (GA4) ──────────────────────────────────────────
  analytics: {
    status:      (projectId)        => ['analytics', projectId, 'status'],
    properties:  (projectId)        => ['analytics', projectId, 'properties'],
    property:    (projectId)        => ['analytics', projectId, 'property'],
    trends:      (projectId, range) => ['analytics', projectId, 'trends', range],
    breakdowns:  (projectId, range) => ['analytics', projectId, 'breakdowns', range],
    events:      (projectId, range) => ['analytics', projectId, 'events', range],
    conversions: (projectId, range) => ['analytics', projectId, 'conversions', range],
    realtime:    (projectId)        => ['analytics', projectId, 'realtime'],
    health:      (projectId, range) => ['analytics', projectId, 'health', range],
    activity:    (projectId)        => ['analytics', projectId, 'activity'],
    pages:       (projectId, params) => ['analytics', projectId, 'pages', params],
  },

  // ── Google Ads ──────────────────────────────────────────────
  googleAds: {
    syncStatus: (projectId) => ['google-ads', projectId, 'sync-status'],
    accounts:   (projectId) => ['google-ads', projectId, 'accounts'],

    // Phase 7.2 dashboard reads - all keyed off projectId first so
    // queryClient.invalidateQueries({ queryKey: ['google-ads', projectId] })
    // (see useInvalidateGoogleAdsQueries in useDashboardQueries.js) catches
    // every one of these in a single call after a sync completes.
    overview:          (projectId, range) => ['google-ads', projectId, 'overview', range],
    trends:             (projectId, range, granularity, campaignId) => ['google-ads', projectId, 'trends', range, granularity, campaignId || null],
    campaigns:          (projectId, params) => ['google-ads', projectId, 'campaigns', params],
    campaignDetail:     (projectId, campaignId, range) => ['google-ads', projectId, 'campaign-detail', campaignId, range],
    campaignHealth:     (projectId) => ['google-ads', projectId, 'campaign-health'],
    campaignHealthSummary: (projectId) => ['google-ads', projectId, 'campaign-health-summary'],
    keywords:           (projectId, params) => ['google-ads', projectId, 'keywords', params],
    keywordDetail:      (projectId, adGroupId, criterionId) => ['google-ads', projectId, 'keyword-detail', adGroupId, criterionId],
    searchTerms:        (projectId, params) => ['google-ads', projectId, 'search-terms', params],
    optimizationScore:  (projectId, range) => ['google-ads', projectId, 'optimization-score', range],
    recommendations:    (projectId, params) => ['google-ads', projectId, 'recommendations', params],
    devicePerformance:  (projectId, range) => ['google-ads', projectId, 'device-performance', range],
    geoPerformance:     (projectId, params) => ['google-ads', projectId, 'geo-performance', params],
    audiencePerformance:(projectId) => ['google-ads', projectId, 'audience-performance'],
    adPerformance:      (projectId, params) => ['google-ads', projectId, 'ad-performance', params],
    budgetOverview:     (projectId) => ['google-ads', projectId, 'budget-overview'],
    budgetForecast:     (projectId) => ['google-ads', projectId, 'budget-forecast'],
    attribution:        (projectId) => ['google-ads', projectId, 'attribution'],
    capabilities:       (projectId) => ['google-ads', projectId, 'capabilities'],
    activity:           (projectId, params) => ['google-ads', projectId, 'activity', params],
  },

  // ── AI Campaign Builder (Phase 3) ──────────────────────────────────
  // Kept OFF the ['google-ads', projectId] key namespace on purpose: a
  // Google Ads dashboard sync must never invalidate a draft the user is
  // editing, and saving a draft must never refetch the whole dashboard.
  aiCampaign: {
    all:   (projectId)         => ['ai-campaign', projectId],
    list:  (projectId, params) => ['ai-campaign', projectId, 'list', params],
    draft: (draftId)           => ['ai-campaign', 'draft', draftId],
    // Phase 4 — conversational editing. Keyed off draftId (not projectId)
    // since every proposal read/write is already scoped to one draft.
    proposals: (draftId)             => ['ai-campaign', 'draft', draftId, 'proposals'],
    proposal:  (draftId, proposalId) => ['ai-campaign', 'draft', draftId, 'proposals', proposalId],
    // Phase 5 — pre-publish readiness. Keyed off draftId, same isolation
    // rationale as proposals above: a readiness check is scoped to one
    // draft and must never be touched by a Google Ads dashboard sync.
    validation: (draftId) => ['ai-campaign', 'draft', draftId, 'validation'],
    // Phase 6 — Google Ads publish pipeline. Same isolation rationale.
    publish: (draftId) => ['ai-campaign', 'draft', draftId, 'publish'],
    // Phase 7 — performance + AI optimization. Same isolation rationale.
    optimization: (draftId) => ['ai-campaign', 'draft', draftId, 'optimization'],
    optimizationHistory: (draftId) => ['ai-campaign', 'draft', draftId, 'optimization', 'history'],
    // Phase 8 — automation & autonomous optimization controls. Same
    // isolation rationale as publish/optimization above.
    automationPolicies: (draftId) => ['ai-campaign', 'draft', draftId, 'automation', 'policies'],
    automationPolicy: (draftId, policyId) => ['ai-campaign', 'draft', draftId, 'automation', 'policies', policyId],
    automationPolicyHistory: (draftId, policyId) => ['ai-campaign', 'draft', draftId, 'automation', 'policies', policyId, 'history'],
    automationHistory: (draftId) => ['ai-campaign', 'draft', draftId, 'automation', 'history'],
  },

  // ── Custom Plan Request ─────────────────────────────────────
  customPlanRequest: {
    mine: () => ['custom-plan-request', 'mine'],
  },

  // ── AI Video / Visibility ───────────────────────────────────
  aiVideo: {
    pages: (projectId, params) => ['ai-video', projectId, 'pages', params],
    page: (projectId, url) => ['ai-video', projectId, 'page', url],
    worst: (projectId, limit) => ['ai-video', projectId, 'worst', limit],
    graph: (projectId) => ['ai-video', projectId, 'graph'],
  },

  // ── Raw HTML ────────────────────────────────────────────────
  rawHtml: {
    detail: (projectId, url) => ['raw-html', projectId, url],
  },

  // ── Fix Logs (deprecated — use tasks instead) ──────────────────────
  fixLogs: {
    // Base key — used for broad invalidations (invalidates all pages/filters)
    all:       (projectId)             => ['fix-logs', projectId],
    // Paginated + filtered list — separate cache entry per filter combo
    list:      (params)                => ['fix-logs', params?.projectId, 'list', params],
    fixedUrls: (projectId, issueKey)   => ['fix-logs', projectId, 'fixed-urls', issueKey],
  },

  // ── Tasks (new lifecycle system) ──────────────────────────────────
  tasks: {
    all:        (projectId)             => ['tasks', projectId],
    list:       (params)                => ['tasks', params?.projectId, 'list', params],
    detail:     (taskId)                => ['tasks', 'detail', taskId],
    // Older fixHistory attempts (Optimization Center View Details) — kept
    // off the main detail key so expanding history never invalidates/refetches
    // the (already-loaded) latest-attempt detail query.
    history:    (taskId)                => ['tasks', 'detail', taskId, 'history'],
    summary:    (projectId)             => ['tasks', projectId, 'summary'],
    activeUrls: (projectId, issueKey)   => ['tasks', projectId, 'active-urls', issueKey],
  },

  // ── Recommendations (read-by-id, for the WordPress apply-fix dialog —
  // shows the EXACT recommendation a Task.recommendationId points to,
  // never the ephemeral local state from the generation mutation) ────
  recommendations: {
    byId: (projectId, recommendationId) => ['recommendations', projectId, 'detail', recommendationId],
    // Every recommendation query of a project (prefix key) — invalidated when a recommendation is regenerated.
    forProject: (projectId) => ['recommendations', projectId],
  },

  // ── Leads (Phase 3B — real backend, replaces the /app/leads mock) ──
  leads: {
    all:    (projectId)     => ['leads', projectId],
    list:   (params)        => ['leads', params?.projectId, 'list', params],
    detail: (leadId)        => ['leads', 'detail', leadId],
    stats:  (projectId)     => ['leads', projectId, 'stats'],
  },

  // ── System Admin ────────────────────────────────────────────────
  systemAdmin: {
    dashboard: () => ['system-admin', 'dashboard'],
    users: {
      list: (params) => ['system-admin', 'users', 'list', params],
      detail: (id) => ['system-admin', 'users', 'detail', id],
    },
    subscriptions: {
      list: (params) => ['system-admin', 'subscriptions', 'list', params],
      detail: (userId) => ['system-admin', 'subscriptions', 'detail', userId],
    },
    customPlanRequests: {
      list: (params) => ['system-admin', 'custom-plan-requests', 'list', params],
      detail: (id) => ['system-admin', 'custom-plan-requests', 'detail', id],
    },
    payments: {
      list: (params) => ['system-admin', 'payments', 'list', params],
      summary: () => ['system-admin', 'payments', 'summary'],
      detail: (paymentId) => ['system-admin', 'payments', 'detail', paymentId],
    },
    jobs: {
      list: (params) => ['system-admin', 'jobs', 'list', params],
      summary: () => ['system-admin', 'jobs', 'summary'],
      detail: (jobId) => ['system-admin', 'jobs', 'detail', jobId],
    },
    webhooks: {
      list: (params) => ['system-admin', 'webhooks', 'list', params],
      summary: () => ['system-admin', 'webhooks', 'summary'],
      detail: (id) => ['system-admin', 'webhooks', 'detail', id],
    },
    auditLogs: {
      list: (params) => ['system-admin', 'audit-logs', 'list', params],
      summary: () => ['system-admin', 'audit-logs', 'summary'],
      detail: (id) => ['system-admin', 'audit-logs', 'detail', id],
    },
    projects: {
      list: (params) => ['system-admin', 'projects', 'list', params],
      summary: () => ['system-admin', 'projects', 'summary'],
      detail: (id) => ['system-admin', 'projects', 'detail', id],
    },
    // ODITO-OPS-001: Verification Operations Dashboard
    verificationBatches: {
      list: (params) => ['system-admin', 'verification-batches', 'list', params],
      summary: () => ['system-admin', 'verification-batches', 'summary'],
      detail: (batchId) => ['system-admin', 'verification-batches', 'detail', batchId],
    },
    verificationQueue: {
      summary: () => ['system-admin', 'verification-queue', 'summary'],
    },
    verificationRecovery: {
      list: (params) => ['system-admin', 'verification-recovery', 'list', params],
      summary: () => ['system-admin', 'verification-recovery', 'summary'],
    },
    verificationWorkers: {
      health: () => ['system-admin', 'verification-workers', 'health'],
    },
  },

  // ── Audit History ────────────────────────────────────────────────
  auditHistory: {
    comparison:      (projectId)           => ['audit-history', projectId, 'comparison'],
    auditComparison: (projectId, from, to) => ['audit-history', projectId, 'comparison', from, to],
    history:         (projectId, page)     => ['audit-history', projectId, 'history', page],
    historyAll:      (projectId)           => ['audit-history', projectId, 'history-all'],
    trends:          (projectId)           => ['audit-history', projectId, 'trends'],
  },
}

/* ── Invalidation Helpers ──────────────────────────────────────── */

/**
 * Filter matching ONE page's issue-context entries (every issue, that page only). The page URL is the last key element, so this is a
 * predicate rather than a key prefix — which keeps a single-URL verification from touching any other page's cache.
 */
export function issueContextPageFilter(projectId, pageUrl) {
  return {
    predicate: (query) => {
      const k = query.queryKey
      return k[0] === 'issue-context' && k[1] === projectId && k[3] === pageUrl
    },
  }
}

/**
 * Invalidate all queries for a specific project.
 * Use when switching projects or after recrawl completes.
 */
export function invalidateProject(queryClient, projectId) {
  // Project data — overview + the projects list (used by ProjectContext/sidebar)
  queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
  queryClient.invalidateQueries({ queryKey: ['projects', 'list'] })
  // Audit results
  queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
  // Per-page issue state is read from the crawl; without this it stays cached (5 min, and persisted) after a recrawl.
  queryClient.invalidateQueries({ queryKey: ['issue-context', projectId] })
  queryClient.invalidateQueries({ queryKey: ['technical', projectId] })
  queryClient.invalidateQueries({ queryKey: ['pagespeed', projectId] })
  queryClient.invalidateQueries({ queryKey: ['keywords', projectId] })
  queryClient.invalidateQueries({ queryKey: ['ai-audit', projectId] })
  queryClient.invalidateQueries({ queryKey: ['ai-video', projectId] })
  queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
  queryClient.invalidateQueries({ queryKey: ['audit-history', projectId] })
}

/**
 * Force-refetch all audit result queries for a project immediately.
 * Call after recrawl completion to push fresh data to all panels
 * without waiting for user interaction.
 */
export function refetchProject(queryClient, projectId) {
  queryClient.refetchQueries({ queryKey: ['projects', projectId] })
  queryClient.refetchQueries({ queryKey: ['projects', 'list'] })
  queryClient.refetchQueries({ queryKey: ['issues', projectId] })
  queryClient.refetchQueries({ queryKey: ['issue-context', projectId] })
  queryClient.refetchQueries({ queryKey: ['technical', projectId] })
  queryClient.refetchQueries({ queryKey: ['pagespeed', projectId] })
  queryClient.refetchQueries({ queryKey: ['ai-video', projectId] })
  queryClient.refetchQueries({ queryKey: ['tasks', projectId] })
  queryClient.refetchQueries({ queryKey: ['audit-history', projectId] })
}

/**
 * Invalidate all project data globally.
 * Use on logout.
 */
export function invalidateAll(queryClient) {
  queryClient.clear()
}

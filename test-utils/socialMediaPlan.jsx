import { strategyBody } from '@/test-utils/socialMediaAI'

/**
 * Fixtures for the AI Strategy v2 and the Content Calendar plan tests. Shaped exactly like the backend's responses
 * (strategyOutputSchema v2 + the server-owned fields; GET /social/content-calendar) — never like the UI's own models.
 */

/** A schema-version-2 strategy as the backend stores it (compact; brand analysis, topics, hooks, competitors). */
export function strategyBodyV2(overrides = {}) {
  return strategyBody({
    schemaVersion: 2,
    trendDataSource: 'none',
    overview: { primaryObjective: 'Trust and new patient bookings', strongestOpportunity: 'Educational content that calms dental anxiety', growthOpportunity: 'Consistent proof and team-led content', platformFocus: 'Facebook for community, Instagram for visual stories' },
    brandAnalysis: {
      strengths: ['Clear family-dentistry focus'], weaknesses: ['Little proof content so far'], differentiators: ['Gentle, explain-everything approach'], personality: ['Warm', 'Reassuring'],
      communicationStyle: 'Plain, friendly language that explains rather than sells.', opportunities: ['More educational authority content'], risks: ['Generic dental messaging'],
    },
    positioning: { brandPositioning: 'A friendly neighbourhood dental practice.', valueProposition: 'Clear, gentle dental care for local families.', keyDifferentiators: ['Open late on weekdays'], whyCustomersChoose: 'Gentle care and convenient hours.', messagingAngle: 'Nothing to be nervous about.' },
    audience: { primaryAudience: 'Young families nearby', secondaryAudiences: ['Retirees'], painPoints: ['Nervous about dental visits'], needs: ['Convenient appointment times'], motivations: ['Keeping the family healthy'], buyingTriggers: ['A child needs a check-up'], objections: ['Worried about cost'], interests: ['Family health'] },
    contentPillars: [
      { name: 'Dental tips', description: 'Simple everyday care advice.', purpose: 'Build trust', suggestedPercentage: 60, exampleTopics: ['Brushing basics'], formats: ['Carousel', 'Reel'] },
      { name: 'Meet the team', description: 'The people behind the practice.', purpose: 'Reduce anxiety', suggestedPercentage: 40, exampleTopics: ['Team introductions'], formats: ['Static post'] },
    ],
    trendingTopics: [{ topic: 'Back-to-school check-ups', whyItMatters: 'Parents book before term starts.', relevance: 'high', angle: 'A calm checklist for a first visit', freshness: 'seasonal' }],
    workingHooks: [
      { hook: 'Most people brush too hard. Here is the fix.', category: 'educational' }, { hook: 'Nervous about the dentist? Start here.', category: 'problem_solution' },
      { hook: 'What really happens at a first check-up?', category: 'curiosity' }, { hook: 'Floss every day? You may still miss this.', category: 'contrarian' },
      { hook: 'Meet the person who makes visits easier.', category: 'story' }, { hook: 'Three questions to ask before your next appointment.', category: 'engagement' },
    ],
    competitorAnalysis: { hasCompetitorData: false, analysisBasis: 'none', competitorsConsidered: [], differentiationOpportunities: [], contentGaps: [], recommendations: [] },
    platformStrategy: [
      { platform: 'facebook', role: 'Community and offers', contentTypes: ['Photo posts'], postsPerWeek: 3, connected: true, audienceBehavior: 'Local families look for trusted practices.', guidance: ['Lead with a local benefit'] },
      { platform: 'instagram', role: 'Visual storytelling', contentTypes: ['Reels'], postsPerWeek: 3, connected: false, audienceBehavior: 'Visual and quick to scan.', guidance: ['Strong first frame'] },
    ],
    postingStrategy: { postsPerWeek: 4, postsPerWeekRange: { min: 3, max: 5 }, recommendedDays: ['tuesday', 'thursday'], recommendedTimeWindows: ['Early evening'] },
    ctaStrategy: { preferredCTAs: ['Book a check-up'], objectives: ['Bookings'], byObjective: [{ objective: 'awareness', ctas: ['Follow for more'] }, { objective: 'lead_generation', ctas: ['Book a check-up'] }] },
    brandRules: { visualGuidelines: ['Bright, clean photography'], messagingRules: ['Explain, never scare'], prohibitedPhrases: ['cheapest'] },
    ...overrides,
  })
}

/** One planned calendar item as GET /social/content-calendar returns it (the public shape). */
export function calendarItem(over = {}) {
  return {
    id: 'item-1', order: 0, date: '2026-10-07', dayOfWeek: 'wednesday', platforms: ['instagram'], format: 'carousel', deliverable: 'Educational carousel',
    contentPillar: 'Dental tips', contentType: 'educational', objective: 'engagement', primaryKpi: 'saves', targetAudience: 'Young families',
    serviceId: null, serviceName: null, productId: null, productName: null, occasion: '', topic: '5 brushing mistakes', angle: 'A calm, practical checklist',
    hook: 'Most people brush too hard. Here is the fix.', hookRef: 0, onCreativeText: '5 mistakes', creativeDirection: 'Clean, bright slides', contentBrief: 'Five common habits and the simple fix for each.',
    captionDirection: 'Warm and plain, end with a question.', primaryCta: 'Save this', engagementPrompt: 'Which one surprised you?', requiredAssets: ['team_photo'],
    requiresReview: false, approvalNotes: '', footerDisclaimer: '', status: 'planned', publicationIds: [], strategyVersion: 3,
    // the workspace fields (GET /social/content-calendar, toApiItem)
    contentId: 'OCT-P01', revision: 0, isManual: false, editedFields: [], planApprovedAt: null, effectiveStatus: over.status || 'planned', locked: false,
    caption: '', hashtags: [], platformContent: [], selectedMediaIds: [], publications: [], ...over,
  }
}

/** GET /social/content-calendar/options (`data`): the real strategy pillars / hooks, the live catalog with product images, formats and connection state. */
export function calendarOptions(over = {}) {
  return {
    calendar: { id: 'cal-1', version: 1, startDate: '2026-10-06', endDate: '2026-11-04' },
    pillars: [{ name: 'Dental tips', purpose: 'Build trust' }, { name: 'Meet the team', purpose: 'Reduce anxiety' }, { name: 'Offers', purpose: 'Drive bookings' }],
    hooks: [{ index: 0, hook: 'Most people brush too hard. Here is the fix.', category: 'educational' }, { index: 1, hook: 'Nervous about the dentist? Start here.', category: 'problem_solution' }],
    objectives: [
      { value: 'awareness', kpis: ['reach', 'views'] }, { value: 'engagement', kpis: ['comments', 'shares', 'saves'] }, { value: 'traffic', kpis: ['link_clicks'] },
      { value: 'lead_generation', kpis: ['dms', 'calls', 'form_submissions'] }, { value: 'conversion', kpis: ['purchases', 'bookings'] },
    ],
    ctas: { preferred: ['Book a check-up'], byObjective: [{ objective: 'engagement', ctas: ['Save this', 'Comment below'] }] },
    formats: { facebook: ['static_post', 'carousel', 'reel', 'video', 'text_post'], instagram: ['static_post', 'carousel', 'reel', 'video'] },
    platforms: [{ platform: 'facebook', connected: true, inStrategy: true }, { platform: 'instagram', connected: true, inStrategy: true }],
    businessModel: 'service',
    services: [{ id: 'svc-1', name: 'Family check-up' }, { id: 'svc-2', name: 'Teeth whitening' }],
    products: [],
    assetTypes: ['product_image', 'logo', 'team_photo', 'customer_photo', 'testimonial', 'screenshot', 'stock_photo', 'video_clip', 'infographic'],
    limits: { fields: { topic: 150, angle: 200, hook: 200, caption: 3000, primaryCta: 80 }, caption: { facebook: 3000, instagram: 2200 }, hashtags: { facebook: 10, instagram: 30 } },
    ...over,
  }
}

export const calendarOptionsResponse = (over) => ({ success: true, data: calendarOptions(over) })

/** A publication summary as embedded in an item (loadPublicationSummaries). */
export const itemPublication = (over = {}) => ({ id: 'pub-1', platform: 'facebook', status: 'draft', approvalState: 'content_review', content: 'The generated Facebook draft text.', scheduledAt: null, ...over })

/** The whole GET /social/content-calendar response body (`data`). Pass `status: 'ready'` with `items` for a finished calendar. */
export function calendarState(over = {}) {
  const items = over.items || []
  const config = { startDate: '2026-10-06', endDate: '2026-10-12', months: null, postsPerWeek: 3, platforms: ['facebook', 'instagram'], distributionMode: 'balanced' }
  const ready = over.status === 'ready'
  return {
    status: 'none',
    calendar: ready ? {
      id: 'cal-1', version: 1, status: 'ready', generatedAt: '2026-10-05T10:00:00.000Z', config, strategy: { id: 'strat-3', version: 3 },
      plan: {
        totalItems: items.length, platformCounts: { facebook: 1, instagram: 2 }, warnings: [],
        pillarDistribution: [{ pillar: 'Dental tips', targetPercent: 60, plannedCount: 2, plannedPercent: 66.7 }, { pillar: 'Meet the team', targetPercent: 40, plannedCount: 1, plannedPercent: 33.3 }],
      },
    } : null,
    items: [],
    generation: null,
    stale: ready ? { strategyChanged: false, currentStrategyVersion: 3, profileChanged: false } : null,
    strategy: { available: true, id: 'strat-3', version: 3, platforms: ['facebook', 'instagram'], hasHooks: true, recommended: { postsPerWeek: 4, range: { min: 3, max: 5 }, days: ['tuesday', 'thursday'] } },
    connectedPlatforms: { facebook: true, instagram: true },
    limits: { minDays: 7, maxDays: 184, minMonths: 1, maxMonths: 6, maxPostsPerWeek: 7, maxPosts: 200 },
    ...over,
  }
}

export const calendarResponse = (over) => ({ success: true, data: calendarState(over) })
export const calendarGeneration = (o = {}) => ({
  id: 'cgen-1', version: 1, status: 'generating', startedAt: '2026-10-05T10:00:00.000Z', finishedAt: null, config: null, failure: null,
  progress: { plannedPosts: 0, totalPosts: 0, completedBatches: 0, totalBatches: 0 }, retry: null, runAttempts: 1, canResume: false, ...o,
})

/**
 * Design jobs: the live stages of a design (Concept Studio) and the "done" notification.
 *
 * The SERVER runs every design job in the background and records its stage and every slide's stage; these helpers only name the stages
 * and remember, in this browser, which posts it started a job for - so that a job is announced when it finishes even after the person
 * left the page (DesignJobsWatcher polls the project's jobs only while such a post is pending).
 */

export const DESIGN_JOBS_STORAGE_KEY = 'odito.designJobs.v1'
export const DESIGN_JOBS_EVENT = 'odito-design-jobs'
const MAX_AGE_MS = 30 * 60 * 1000 // a job older than this is not announced any more (the server marks it interrupted long before)

/** The steps shown for a job, by what it is making. */
export const DESIGN_STEPS = Object.freeze({
  compare: [
    { key: 'concept', label: 'Writing concepts' },
    { key: 'previews', label: 'Preview images' },
  ],
  single: [
    { key: 'concept', label: 'Writing concept' },
    { key: 'image', label: 'Image' },
    { key: 'quality', label: 'Quality check' },
  ],
  carousel: [
    { key: 'concept', label: 'Writing concept' },
    { key: 'hook', label: 'Hook image' },
    { key: 'slides', label: 'Slides' },
    { key: 'quality', label: 'Quality check' },
  ],
  slide: [
    { key: 'image', label: 'New slide image' },
    { key: 'quality', label: 'Quality check' },
  ],
})

/** Which step list a generation shows. */
export function stepsFor(generation) {
  if (!generation) return []
  if (generation.phase === 'compare') return DESIGN_STEPS.compare
  if (generation.phase === 'slide') return DESIGN_STEPS.slide
  return generation.format === 'carousel' ? DESIGN_STEPS.carousel : DESIGN_STEPS.single
}

/** Index of the current step (the server's stage), -1 before the first. A finished job has every step done. */
export function currentStepIndex(generation) {
  const steps = stepsFor(generation)
  if (!generation?.active) return generation?.status === 'ready' ? steps.length : -1
  const i = steps.findIndex((s) => s.key === generation.stage)
  return i < 0 ? 0 : i
}

export const SLIDE_LABEL = (slide) => (slide.kind === 'hook' ? 'Hook' : slide.kind === 'cta' ? 'CTA' : String(slide.number ?? slide.key.replace(/^p/, '')))

// ── this browser's pending jobs ─────────────────────────────────────────────

function read() {
  if (typeof window === 'undefined') return []
  try {
    const list = JSON.parse(window.localStorage.getItem(DESIGN_JOBS_STORAGE_KEY) || '[]')
    const now = Date.now()
    return Array.isArray(list) ? list.filter((j) => j && j.projectId && j.publicationId && now - (j.startedAt || 0) < MAX_AGE_MS) : []
  } catch { return [] }
}

function write(list) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(DESIGN_JOBS_STORAGE_KEY, JSON.stringify(list)) } catch { /* storage full or blocked: the in-page progress still shows */ }
  window.dispatchEvent(new Event(DESIGN_JOBS_EVENT))
}

/** Remember that this browser started a job for the post (label = what to say when it is done). */
export function trackDesignJob({ projectId, publicationId, label }) {
  const list = read().filter((j) => !(j.projectId === projectId && j.publicationId === publicationId))
  write([...list, { projectId, publicationId, label: label || 'Your design', startedAt: Date.now() }])
}

export const pendingDesignJobs = (projectId) => read().filter((j) => j.projectId === projectId)

export function settleDesignJob(projectId, publicationId) {
  write(read().filter((j) => !(j.projectId === projectId && j.publicationId === publicationId)))
}

/** What to tell the person about a finished job (from the server's job summary). */
export function doneMessage(job, label) {
  if (job.status === 'failed') return { tone: 'danger', text: `${label} could not be finished.` }
  if (job.phase === 'compare') return { tone: 'success', text: `${label}: 3 concepts are ready to compare.` }
  if (job.needsAttention > 0) return { tone: 'default', text: `${label} is ready - ${job.needsAttention} slide${job.needsAttention === 1 ? ' needs' : 's need'} attention.` }
  if (job.format === 'carousel' && job.slides) return { tone: 'success', text: `${label}: your ${job.slides}-slide carousel is ready for review.` }
  return { tone: 'success', text: `${label} is ready for review.` }
}

export const formatUsd = (usd) => (usd == null ? '—' : usd < 0.01 && usd > 0 ? '< $0.01' : `$${usd.toFixed(2)}`)

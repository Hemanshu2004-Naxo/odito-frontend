import { describe, it, expect } from 'vitest'
import { shouldPersistQuery } from './queryPersistence'

const q = (queryKey, data = { x: 1 }, status = 'success') => ({ queryKey, state: { status, data } })

describe('persisted query cache filter', () => {
  it('never persists the volatile social lists (publishing, AI post / design generation state)', () => {
    expect(shouldPersistQuery(q(['social', 'publishing', 'p1', 'all', { status: 'scheduled' }]))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'publishing', 'p1', 'approval-summary']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'ai-content', 'p1']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'ai-design', 'p1', 'pub-1']))).toBe(false)
  })

  it('never persists Creative Studio state: a reload must show the server\'s selected design, not a copy from before it was chosen', () => {
    expect(shouldPersistQuery(q(['social', 'studio', 'p1', 'pub-1']))).toBe(false)
  })

  it('never persists the content calendar (its generation progress changes on the server): not the calendar, its status poll, options or preview', () => {
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1', 'status']))).toBe(false)
    expect(shouldPersistQuery(q(['social', 'content-calendar', 'p1', 'preview', '2026-10-13', 3, 3]))).toBe(false)
  })

  it('never persists AI Visibility state: question sets (approval is server-decided), runs, progress, and stored answers / evidence', () => {
    expect(shouldPersistQuery(q(['ai-visibility-questions', 'p1', 'list']))).toBe(false)
    expect(shouldPersistQuery(q(['ai-visibility-questions', 'p1', 'set', 's1']))).toBe(false)
    expect(shouldPersistQuery(q(['chatgpt-visibility', 'p1', 'summary']))).toBe(false)
    expect(shouldPersistQuery(q(['chatgpt-visibility', 'p1', 'evidence-item', 'r1', 'q1']))).toBe(false)
  })

  it('still persists ordinary successful queries (existing behaviour) and nothing without data', () => {
    expect(shouldPersistQuery(q(['projects']))).toBe(true)
    expect(shouldPersistQuery(q(['social', 'business-profile', 'p1']))).toBe(true)
    expect(shouldPersistQuery(q(['projects'], null))).toBe(false)
    expect(shouldPersistQuery(q(['projects'], { x: 1 }, 'error'))).toBe(false)
  })
})

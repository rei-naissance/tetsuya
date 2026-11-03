import { beforeEach, describe, expect, it } from 'vitest'
import {
  addNewToday, addReviewsToday, buildQueue, deckId, markIntroduced, markReviewed, saveCard, schedule, studyDay, today,
  type CardState,
} from './srs'

// The test runner has no browser: a small in-memory localStorage.
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const DAY = 86_400_000
const HOUR = 3_600_000
// Noon local time, so the 4 a.m. boundary is predictable.
const noon = new Date(2026, 0, 10, 12).getTime()
const limits = { newPerDay: 10, maxReviews: 3 }
const reading = deckId('N4', 'kanji', 'reading')
const writing = deckId('N4', 'kanji', 'writing')
const mixed = deckId('N4', 'kanji', 'all')

const review = (due: number): CardState => ({ ease: 2.5, interval: 5, reps: 2, lapses: 0, due, last: due - 5 * DAY })

beforeEach(() => store.clear())

describe('daily limits', () => {
  it('share one new-card allowance across a section’s decks and Mixed', () => {
    for (let i = 0; i < 6; i++) markIntroduced(reading, noon)
    for (let i = 0; i < 3; i++) markIntroduced(writing, noon)
    expect(today(mixed, limits, noon).newLeft).toBe(1)
    expect(today(reading, limits, noon).newLeft).toBe(1)
    // Another section has its own allowance.
    expect(today(deckId('N4', 'vocabulary', 'context'), limits, noon).newLeft).toBe(10)
  })

  it('never resets when the limit is changed, only when the study day changes', () => {
    for (let i = 0; i < 10; i++) markIntroduced(reading, noon)
    expect(today(reading, limits, noon).newLeft).toBe(0)
    expect(today(reading, { ...limits, newPerDay: 15 }, noon).newLeft).toBe(5)
    expect(today(reading, { ...limits, newPerDay: 5 }, noon).newLeft).toBe(0)
    expect(today(reading, limits, noon).introduced).toBe(10)
  })

  it('starts the study day at 4 a.m., not midnight', () => {
    const lateNight = new Date(2026, 0, 11, 1).getTime() // 1 a.m. the next calendar day
    const morning = new Date(2026, 0, 11, 5).getTime()
    expect(studyDay(lateNight)).toBe(studyDay(noon))
    expect(studyDay(morning)).not.toBe(studyDay(noon))
    markIntroduced(reading, noon)
    expect(today(reading, limits, lateNight).introduced).toBe(1)
    expect(today(reading, limits, morning).introduced).toBe(0)
  })

  it('adds extra new cards and reviews for today only', () => {
    for (let i = 0; i < 10; i++) markIntroduced(reading, noon)
    addNewToday(reading, 25, noon)
    expect(today(mixed, limits, noon).newLeft).toBe(25)
    for (let i = 0; i < 3; i++) markReviewed(reading, noon)
    expect(today(reading, limits, noon).reviewsLeft).toBe(0)
    addReviewsToday(reading, 50, noon)
    expect(today(reading, limits, noon).reviewsLeft).toBe(50)
    expect(today(reading, limits, noon + DAY).newLeft).toBe(10)
  })

  it('folds counts saved per deck (before limits were shared) into their section', () => {
    store.set('tetsuya:srs:daily:v1', JSON.stringify({ date: studyDay(noon), introduced: { 'N4-kanji-words': 5, 'N4-kanji-reading': 2 } }))
    expect(today(mixed, limits, noon).introduced).toBe(7)
  })

  it('caps due reviews at the limit; 0 means no limit', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    ids.forEach((id, i) => saveCard(id, review(noon - (i + 1) * HOUR)))
    expect(buildQueue(ids, reading, limits, {}, noon)).toHaveLength(3)
    expect(buildQueue(ids, reading, { ...limits, maxReviews: 0 }, {}, noon)).toHaveLength(5)
  })

  it('review ahead takes graduated cards due soon, ignoring the limits', () => {
    saveCard('soon', review(noon + 2 * DAY))
    saveCard('later', review(noon + 10 * DAY))
    for (let i = 0; i < 3; i++) markReviewed(reading, noon)
    expect(buildQueue(['soon', 'later', 'new'], reading, limits, { aheadDays: 3 }, noon)).toEqual(['soon'])
  })
})

describe('reviewing early', () => {
  it('grows from the time actually passed and never shortens the interval', () => {
    const card = { ...review(noon + 4 * DAY), interval: 5, last: noon - DAY } // reviewed 1 day in, 4 early
    const next = schedule(card, 'good', noon)
    expect(next.interval).toBe(5)
    const onTime = schedule({ ...card, due: noon }, 'good', noon)
    expect(onTime.interval).toBeGreaterThan(next.interval)
  })
})

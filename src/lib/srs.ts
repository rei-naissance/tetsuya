/**
 * Lightweight Anki-style spaced repetition (a simplified SM-2).
 *
 * Each card has an ease factor (how fast its interval grows) and an interval
 * in days. Grading a card schedules its next due date:
 *
 *   again → lapse: reset to a short relearning step, ease −0.20
 *   hard  → interval × 1.2,                          ease −0.15
 *   good  → interval × ease
 *   easy  → interval × ease × 1.3,                   ease +0.15
 *
 * New cards graduate through fixed first steps (1 day, then 3 / 4 days) before
 * the multiplicative growth kicks in. All state lives in localStorage.
 */
import { readJSON, writeJSON, removeKey } from './storage'
import { shuffle } from './random'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface CardState {
  /** Ease factor, never below MIN_EASE. */
  ease: number
  /** Current interval in days (0 while relearning). */
  interval: number
  /** Consecutive successful reviews. */
  reps: number
  /** Times the card was forgotten after being learned. */
  lapses: number
  /** Next due time, epoch ms. */
  due: number
  /** Last review time, epoch ms. */
  last: number
}

export const START_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_EASE = 3.5
const DAY = 24 * 60 * 60 * 1000
const RELEARN_DELAY = 10 * 60 * 1000 // "again" cards come back in 10 minutes

const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100))

export function newCard(now = Date.now()): CardState {
  return { ease: START_EASE, interval: 0, reps: 0, lapses: 0, due: now, last: 0 }
}

/** Pure scheduling function: returns the card's next state. */
export function schedule(card: CardState, grade: Grade, now = Date.now()): CardState {
  let { ease, interval, reps, lapses } = card

  if (grade === 'again') {
    return {
      ease: clampEase(ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: card.reps > 0 ? lapses + 1 : lapses,
      due: now + RELEARN_DELAY,
      last: now,
    }
  }

  if (reps === 0) {
    interval = grade === 'easy' ? 4 : 1
  } else if (reps === 1) {
    interval = grade === 'hard' ? 2 : grade === 'good' ? 3 : 6
  } else {
    const factor = grade === 'hard' ? 1.2 : grade === 'good' ? ease : ease * 1.3
    // Always move forward at least one day so "hard" never stalls a card.
    interval = Math.max(interval + 1, Math.round(interval * factor))
  }

  if (grade === 'hard') ease -= 0.15
  if (grade === 'easy') ease += 0.15

  return {
    ease: clampEase(ease),
    interval,
    reps: reps + 1,
    lapses,
    due: now + interval * DAY,
    last: now,
  }
}

/** Human-readable preview of the interval a grade would give, e.g. "10m", "3d". */
export function previewInterval(card: CardState, grade: Grade, now = Date.now()): string {
  const ms = schedule(card, grade, now).due - now
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)}m`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const CARDS_KEY = 'tetsuya:srs:cards:v1'
const DAILY_KEY = 'tetsuya:srs:daily:v1'

/** Max brand-new cards introduced per deck per day. */
export const NEW_PER_DAY = 10

type CardMap = Record<string, CardState>
interface Daily { date: string; introduced: Record<string, number> }

export function loadCards(): CardMap {
  return readJSON<CardMap>(CARDS_KEY, {})
}

export function getCard(id: string): CardState | undefined {
  return loadCards()[id]
}

export function saveReview(id: string, grade: Grade, now = Date.now()): CardState {
  const cards = loadCards()
  const next = schedule(cards[id] ?? newCard(now), grade, now)
  cards[id] = next
  writeJSON(CARDS_KEY, cards)
  return next
}

const today = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA') // YYYY-MM-DD, local

function loadDaily(now = Date.now()): Daily {
  const d = readJSON<Daily>(DAILY_KEY, { date: '', introduced: {} })
  return d.date === today(now) ? d : { date: today(now), introduced: {} }
}

export function newCardsLeftToday(deck: string, now = Date.now()): number {
  return Math.max(0, NEW_PER_DAY - (loadDaily(now).introduced[deck] ?? 0))
}

export function markIntroduced(deck: string, now = Date.now()): void {
  const d = loadDaily(now)
  d.introduced[deck] = (d.introduced[deck] ?? 0) + 1
  writeJSON(DAILY_KEY, d)
}

export interface DeckStats { due: number; fresh: number; learned: number; total: number }

export function deckStats(ids: string[], deck: string, now = Date.now()): DeckStats {
  const cards = loadCards()
  let due = 0, unseen = 0, learned = 0
  for (const id of ids) {
    const c = cards[id]
    if (!c) unseen++
    else {
      if (c.due <= now) due++
      if (c.interval >= 21) learned++ // Anki calls these "mature"
    }
  }
  return { due, fresh: Math.min(unseen, newCardsLeftToday(deck, now)), learned, total: ids.length }
}

/**
 * Builds a review queue: due cards first (most overdue first), then up to
 * the day's remaining allowance of new cards in random order.
 */
export function buildQueue(ids: string[], deck: string, now = Date.now()): string[] {
  const cards = loadCards()
  const due = ids
    .filter((id) => cards[id] && cards[id].due <= now)
    .sort((a, b) => cards[a].due - cards[b].due)
  const unseen = shuffle(ids.filter((id) => !cards[id]))
  return [...due, ...unseen.slice(0, newCardsLeftToday(deck, now))]
}

export function resetSrs(): void {
  removeKey(CARDS_KEY)
  removeKey(DAILY_KEY)
}

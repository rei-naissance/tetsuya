/**
 * Anki-style spaced repetition (a simplified SM-2 with learning steps).
 *
 * A new card first goes through short learning steps (1 min, then 10 min)
 * inside the session. "Good" on the last step graduates it to a 1-day
 * interval ("Easy" skips straight to 4 days). From then on each review grows
 * the interval:
 *
 *   again → lapse: back to a 10-minute relearning step, ease −0.20
 *   hard  → interval × 1.2,                              ease −0.15
 *   good  → interval × ease
 *   easy  → interval × ease × 1.3,                       ease +0.15
 *
 * All state lives in localStorage.
 */
import { readJSON, writeJSON, removeKey } from './storage'
import { shuffle } from './random'

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface CardState {
  /** Ease factor, never below MIN_EASE. */
  ease: number
  /** Interval in days once graduated (kept while relearning, for afterwards). */
  interval: number
  /** Successful reviews since the card graduated or was last forgotten. */
  reps: number
  /** Times the card was forgotten after being learned. */
  lapses: number
  /** Next due time, epoch ms. */
  due: number
  /** Last review time, epoch ms (0 = never seen). */
  last: number
  /** Index into the learning (or relearning) steps; absent once graduated. */
  step?: number
  /** True while relearning a forgotten card. */
  relearn?: boolean
}

export const START_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_EASE = 3.5
/** Ease won back by each Good on a graduated card (four Goods undo one lapse). */
export const EASE_RECOVERY = 0.05
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
/** Learning steps for new cards, in minutes. */
export const LEARN_STEPS = [1, 10]
/** Relearning steps for forgotten cards, in minutes. */
export const RELEARN_STEPS = [10]
/** A learning card due within this long may be shown early when nothing else is left. */
export const LEARN_AHEAD = 20 * MIN
/** Interval for "I already know this" on a new card. */
export const KNOWN_INTERVAL = 30
/** Cards with an interval this long count as learned (Anki's "mature"). */
export const MATURE = 21

const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100))

export function newCard(now = Date.now()): CardState {
  return { ease: START_EASE, interval: 0, reps: 0, lapses: 0, due: now, last: 0, step: 0 }
}

export const isLearning = (c: CardState) => c.step !== undefined

/** Pure scheduling function: returns the card's next state. */
export function schedule(card: CardState, grade: Grade, now = Date.now()): CardState {
  const { interval, lapses } = card
  let ease = card.ease

  if (isLearning(card)) {
    const steps = card.relearn ? RELEARN_STEPS : LEARN_STEPS
    const step = Math.min(card.step!, steps.length - 1)
    const stay = (s: number, minutes: number) =>
      ({ ...card, step: s, due: now + minutes * MIN, last: now })
    if (grade === 'again') return stay(0, steps[0])
    // Anki: "hard" on the first step waits halfway to the second.
    if (grade === 'hard') return stay(step, step === 0 && steps[1] ? (steps[0] + steps[1]) / 2 : steps[step] * 1.5)
    if (grade === 'good' && step + 1 < steps.length) return stay(step + 1, steps[step + 1])
    const days = grade === 'easy'
      ? (card.relearn ? Math.max(1, interval) + 1 : 4)
      : (card.relearn ? Math.max(1, interval) : 1)
    if (grade === 'easy') ease += 0.15
    return { ease: clampEase(ease), interval: days, reps: 1, lapses, due: now + days * DAY, last: now }
  }

  if (grade === 'again') {
    return {
      ease: clampEase(ease - 0.2),
      // After relearning the card restarts from a much shorter interval.
      interval: Math.max(1, Math.round(interval * 0.2)),
      reps: 0,
      lapses: lapses + 1,
      due: now + RELEARN_STEPS[0] * MIN,
      last: now,
      step: 0,
      relearn: true,
    }
  }

  const factor = grade === 'hard' ? 1.2 : grade === 'good' ? ease : ease * 1.3
  // Reviewed early (review ahead): grow from the time that actually passed,
  // and never shorten the interval. On time: grow the whole interval, always
  // moving forward at least one day so "hard" never stalls a card.
  const early = now < card.due
  const next = early
    ? Math.max(interval, Math.round(Math.max(1, (now - card.last) / DAY) * factor))
    : Math.max(interval + 1, Math.round(interval * factor))
  if (grade === 'hard') ease -= 0.15
  if (grade === 'easy') ease += 0.15
  // With only Again / Good shown, ease would only ever fall ("ease hell"):
  // each Good wins a little back, up to the starting ease.
  if (grade === 'good' && ease < START_EASE) ease = Math.min(START_EASE, ease + EASE_RECOVERY)
  return { ease: clampEase(ease), interval: next, reps: card.reps + 1, lapses, due: now + next * DAY, last: now }
}

/** A new card the learner already knows: straight to a long interval. */
export function markKnown(now = Date.now()): CardState {
  return { ease: START_EASE, interval: KNOWN_INTERVAL, reps: 1, lapses: 0, due: now + KNOWN_INTERVAL * DAY, last: now }
}

/** Human-readable preview of the interval a grade would give, e.g. "10m", "3d". */
export function previewInterval(card: CardState, grade: Grade, now = Date.now()): string {
  return formatDelay(schedule(card, grade, now).due - now)
}

export function formatDelay(ms: number): string {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

/* ------------------------------------------------------------------ */
/* Persistence and daily limits                                        */
/* ------------------------------------------------------------------ */

export const CARDS_KEY = 'tetsuya:srs:cards:v1'
const DAILY_KEY = 'tetsuya:srs:daily:v1'

/** Defaults for the daily limit settings. */
export const NEW_PER_DAY = 10
export const MAX_REVIEWS = 200
/** Like Anki, the study day starts at 4 a.m., so a late-night session counts as the same day. */
export const DAY_STARTS_AT = 4

export interface Limits {
  newPerDay: number
  /** 0 = no limit. */
  maxReviews: number
}
export const DEFAULT_LIMITS: Limits = { newPerDay: NEW_PER_DAY, maxReviews: MAX_REVIEWS }

/** One deck per question type ("N4-kanji-reading"); the mixed deck is "N4-kanji". */
export const deckId = (level: string, section: string, kind: string) =>
  kind === 'all' ? `${level}-${section}` : `${level}-${section}-${kind}`

/**
 * Daily limits are counted per section ("N4-kanji"), shared by every
 * question-type deck in it and by Mixed, so studying the same section from
 * several decks can't multiply the allowance.
 */
export const limitKey = (deck: string) => deck.split('-').slice(0, 2).join('-')

type CardMap = Record<string, CardState>
type Counts = Record<string, number>
/** Per limit key, for one study day. */
interface Daily {
  date: string
  /** New cards seen for the first time. */
  introduced: Counts
  /** Graduated cards reviewed. */
  reviewed?: Counts
  /** Extra new cards / reviews allowed on top of the settings. */
  extra?: Counts
  extraReviews?: Counts
}

export function loadCards(): CardMap {
  return readJSON<CardMap>(CARDS_KEY, {})
}

export function getCard(id: string): CardState | undefined {
  return loadCards()[id]
}

export function saveCard(id: string, card: CardState): CardState {
  const cards = loadCards()
  cards[id] = card
  writeJSON(CARDS_KEY, cards)
  return card
}

export function saveReview(id: string, grade: Grade, now = Date.now()): CardState {
  return saveCard(id, schedule(getCard(id) ?? newCard(now), grade, now))
}

/** YYYY-MM-DD of the study day (local time, starting at DAY_STARTS_AT). */
export const studyDay = (now = Date.now()) =>
  new Date(now - DAY_STARTS_AT * 60 * MIN).toLocaleDateString('en-CA')

/** The counts only start over when the study day changes; changing a setting never clears them. */
function loadDaily(now = Date.now()): Daily {
  const d = readJSON<Daily>(DAILY_KEY, { date: '', introduced: {} })
  if (d.date !== studyDay(now)) return { date: studyDay(now), introduced: {} }
  // Counts saved before limits were shared were keyed per deck
  // ("N4-kanji-words"): fold them into their section.
  for (const field of ['introduced', 'reviewed', 'extra', 'extraReviews'] as const) {
    const counts = d[field]
    if (!counts) continue
    d[field] = {}
    for (const [k, n] of Object.entries(counts)) d[field]![limitKey(k)] = (d[field]![limitKey(k)] ?? 0) + n
  }
  return d
}

function bump(field: 'introduced' | 'reviewed' | 'extra' | 'extraReviews', deck: string, n: number, now: number) {
  const d = loadDaily(now)
  const key = limitKey(deck)
  d[field] = { ...d[field], [key]: (d[field]?.[key] ?? 0) + n }
  writeJSON(DAILY_KEY, d)
}

export interface Today { introduced: number; reviewed: number; newLeft: number; reviewsLeft: number }

/** What's been done today in this deck's section, and what the limits still allow. */
export function today(deck: string, limits: Limits = DEFAULT_LIMITS, now = Date.now()): Today {
  const d = loadDaily(now)
  const key = limitKey(deck)
  const introduced = d.introduced[key] ?? 0
  const reviewed = d.reviewed?.[key] ?? 0
  return {
    introduced,
    reviewed,
    newLeft: Math.max(0, limits.newPerDay + (d.extra?.[key] ?? 0) - introduced),
    reviewsLeft: limits.maxReviews <= 0
      ? Infinity
      : Math.max(0, limits.maxReviews + (d.extraReviews?.[key] ?? 0) - reviewed),
  }
}

export const markIntroduced = (deck: string, now = Date.now()) => bump('introduced', deck, 1, now)
export const markReviewed = (deck: string, now = Date.now()) => bump('reviewed', deck, 1, now)
/** Anki's "custom study": allow `n` more new cards / reviews in this section today. */
export const addNewToday = (deck: string, n: number, now = Date.now()) => bump('extra', deck, n, now)
export const addReviewsToday = (deck: string, n: number, now = Date.now()) => bump('extraReviews', deck, n, now)

export interface DeckStats {
  /** Graduated cards due now that today's review limit still allows. */
  due: number
  /** All graduated cards due now, limit or not. */
  dueTotal: number
  /** Cards in (re)learning steps (not limited: they're already started). */
  learning: number
  /** New cards still allowed today. */
  fresh: number
  /** Cards never seen. */
  unseen: number
  /** Graduated cards due within the next `aheadDays`, not yet due. */
  ahead: number
  learned: number
  total: number
}

export function deckStats(ids: string[], deck: string, limits: Limits = DEFAULT_LIMITS, now = Date.now(), aheadDays = 7): DeckStats {
  const cards = loadCards()
  const t = today(deck, limits, now)
  let dueTotal = 0, learning = 0, unseen = 0, learned = 0, ahead = 0
  for (const id of ids) {
    const c = cards[id]
    if (!c) unseen++
    else if (isLearning(c)) learning++
    else {
      if (c.due <= now) dueTotal++
      else if (c.due <= now + aheadDays * DAY) ahead++
      if (c.interval >= MATURE) learned++
    }
  }
  return {
    due: Math.min(dueTotal, t.reviewsLeft), dueTotal, learning,
    fresh: Math.min(unseen, t.newLeft), unseen, ahead, learned, total: ids.length,
  }
}

export interface QueueOptions {
  /** Keep new cards in the given order (a word list) instead of shuffling them. */
  newOrder?: boolean
  /** Review ahead: only graduated cards due within this many days, early, with no limits. */
  aheadDays?: number
}

/**
 * Builds a session queue: due reviews first (most overdue first), up to the
 * day's review limit, then the day's remaining new cards. Cards in learning
 * steps are handled by the session as they come due.
 */
export function buildQueue(ids: string[], deck: string, limits: Limits = DEFAULT_LIMITS, opts: QueueOptions = {}, now = Date.now()): string[] {
  const cards = loadCards()
  const graduated = ids.filter((id) => cards[id] && !isLearning(cards[id]))
  if (opts.aheadDays) {
    return graduated
      .filter((id) => cards[id].due <= now + opts.aheadDays! * DAY)
      .sort((a, b) => cards[a].due - cards[b].due)
  }
  const t = today(deck, limits, now)
  const due = graduated
    .filter((id) => cards[id].due <= now)
    .sort((a, b) => cards[a].due - cards[b].due)
    .slice(0, t.reviewsLeft)
  const unseen = ids.filter((id) => !cards[id])
  const fresh = (opts.newOrder ? unseen : shuffle(unseen)).slice(0, t.newLeft)
  return [...due, ...fresh]
}

/** Cards of this deck in learning steps, soonest first. */
export function learningCards(ids: string[]): string[] {
  const cards = loadCards()
  return ids.filter((id) => cards[id] && isLearning(cards[id])).sort((a, b) => cards[a].due - cards[b].due)
}

export function resetSrs(): void {
  removeKey(CARDS_KEY)
  removeKey(DAILY_KEY)
}

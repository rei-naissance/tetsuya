import { useEffect, useState } from 'react'
import { toHiragana } from 'wanakana'
import { CARDS_KEY, isLearning, loadCards, markKnown, MATURE, type CardState } from './srs'
import { readJSON, removeKey, writeJSON } from './storage'
import type { Level, Word } from './types'

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

const cache = new Map<Level, Promise<Word[]>>()

/** Loads /data/<level>-words.json (built from the scraped vocabulary list). */
export function loadWords(level: Level): Promise<Word[]> {
  let p = cache.get(level)
  if (!p) {
    const url = `${import.meta.env.BASE_URL}data/${level.toLowerCase()}-words.json`
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`No word list for ${level} yet (${url}: ${res.status})`)
        return res.json() as Promise<{ words: Word[] }>
      })
      .then((data) => data.words ?? [])
    p.catch(() => cache.delete(level))
    cache.set(level, p)
  }
  return p
}

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; words: Word[] }

export function useWords(level: Level): State {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    loadWords(level).then(
      (words) => alive && setState({ status: 'ready', words }),
      (err: Error) => alive && setState({ status: 'error', error: err.message }),
    )
    return () => { alive = false }
  }, [level])
  return state
}

/* ------------------------------------------------------------------ */
/* Status: from the word's flashcard (spaced repetition)               */
/* ------------------------------------------------------------------ */

export type WordStatus = 'new' | 'learning' | 'known'
export type StatusMap = Record<string, WordStatus>

/** The flashcard deck for a level's vocabulary list. Cards are keyed by word id. */
export const wordDeck = (level: Level) => `${level}-words`

/** new = never studied; known = learned (interval of 3 weeks or more); learning = anything between. */
export function wordStatus(card: CardState | undefined): WordStatus {
  if (!card) return 'new'
  return !isLearning(card) && card.interval >= MATURE ? 'known' : 'learning'
}

export function loadStatus(words: Word[]): StatusMap {
  migrateMarks()
  const cards = loadCards()
  return Object.fromEntries(words.map((w) => [w.id, wordStatus(cards[w.id])]))
}

export function wordStats(words: Word[], status = loadStatus(words)) {
  let learning = 0, known = 0
  for (const w of words) {
    if (status[w.id] === 'learning') learning++
    else if (status[w.id] === 'known') known++
  }
  return { total: words.length, learning, known, fresh: words.length - learning - known }
}

/** Forget a word: it goes back to new. */
export function resetWord(id: string): void {
  const cards = loadCards()
  delete cards[id]
  writeJSON(CARDS_KEY, cards)
}

// Before flashcards used spaced repetition, words were marked by hand.
// "Know it" becomes a learned card, "still learning" a card due now.
const OLD_MARKS_KEY = 'tetsuya:words:v1'

function migrateMarks(now = Date.now()): void {
  const marks = readJSON<Record<string, 'learning' | 'known'>>(OLD_MARKS_KEY, {})
  if (!Object.keys(marks).length) return
  const cards = loadCards()
  for (const [id, mark] of Object.entries(marks)) {
    if (cards[id]) continue
    cards[id] = mark === 'known' ? markKnown(now) : { ...markKnown(now), interval: 1, due: now }
  }
  writeJSON(CARDS_KEY, cards)
  removeKey(OLD_MARKS_KEY)
}

export function resetWordStatus(): void {
  removeKey(OLD_MARKS_KEY)
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const squash = (s: string) => s.toLowerCase().replace(/[\s'’-]/g, '')

/**
 * Finds words by Japanese, kana, romaji ("agaru" also matches あがる) or English
 * meaning. Exact matches come first, then prefixes, then anything containing it.
 */
export function searchWords(words: Word[], query: string): Word[] {
  const q = query.trim().toLowerCase()
  if (!q) return words
  const latin = /^[a-z'’\s-]+$/.test(q)
  const kana = latin ? toHiragana(squash(q)) : q
  const score = (w: Word): number => {
    const ja = [w.word, w.kana ?? '', ...(w.spellings ?? [])]
    const romaji = squash(w.romaji ?? '')
    if (ja.includes(q) || ja.includes(kana) || (latin && romaji === squash(q))) return 0
    if (ja.some((s) => s.startsWith(q) || s.startsWith(kana)) || (latin && romaji.startsWith(squash(q)))) return 1
    if (latin && new RegExp(`\\b${q.replace(/[^a-z\s]/g, '')}\\b`).test(w.meaning.toLowerCase())) return 2
    if (ja.some((s) => s.includes(q) || s.includes(kana)) || (latin && romaji.includes(squash(q)))) return 3
    if (latin && `${w.meaning} ${w.fullMeaning ?? ''}`.toLowerCase().includes(q)) return 4
    return -1
  }
  return words
    .map((w, i) => ({ w, i, s: score(w) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.w)
}

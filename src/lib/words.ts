import { useEffect, useState } from 'react'
import { toHiragana } from 'wanakana'
import { shuffle } from './random'
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
/* Status: which words you're learning / already know                  */
/* ------------------------------------------------------------------ */

export type WordStatus = 'learning' | 'known'
export type StatusMap = Record<string, WordStatus>

const KEY = 'tetsuya:words:v1'

export function loadStatus(): StatusMap {
  return readJSON<StatusMap>(KEY, {})
}

/** null clears the mark. */
export function setStatus(id: string, status: WordStatus | null): StatusMap {
  const all = loadStatus()
  if (status) all[id] = status
  else delete all[id]
  writeJSON(KEY, all)
  return all
}

export function resetWordStatus(): void {
  removeKey(KEY)
}

export function wordStats(words: Word[], status = loadStatus()) {
  let learning = 0, known = 0
  for (const w of words) {
    if (status[w.id] === 'learning') learning++
    else if (status[w.id] === 'known') known++
  }
  return { total: words.length, learning, known }
}

export type CardSet = 'new' | 'learning'

/** Flashcards: the next unmarked words in list order, or the "learning" words shuffled. */
export function pickCards(words: Word[], set: CardSet, n: number, status = loadStatus()): Word[] {
  return set === 'new'
    ? words.filter((w) => !status[w.id]).slice(0, n)
    : shuffle(words.filter((w) => status[w.id] === 'learning')).slice(0, n)
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

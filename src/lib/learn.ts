import { useEffect, useState } from 'react'
import type { GrammarPattern, Kanji, KanjiStrokes, Level, ParticleContrast } from './types'

/* Loading for the learn-mode files in public/data (grammar patterns, particles). */

const cache = new Map<string, Promise<unknown>>()

function loadData<T>(name: string): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined
  if (!p) {
    const url = `${import.meta.env.BASE_URL}data/${name}`
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
      return res.json() as Promise<T>
    })
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return p
}

type State<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }

function useData<T>(name: string): State<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    loadData<T>(name).then(
      (data) => alive && setState({ status: 'ready', data }),
      (err: Error) => alive && setState({ status: 'error', error: err.message }),
    )
    return () => { alive = false }
  }, [name])
  return state
}

export interface ParticleData {
  note: string
  contrasts: ParticleContrast[]
  /** Ids of the bank's particle-only grammar questions, per level. */
  bank: Record<Level, string[]>
}

export const useParticles = () => useData<ParticleData>('particles.json')

export const useGrammar = (level: Level) =>
  useData<{ patterns: GrammarPattern[] }>(`${level.toLowerCase()}-grammar.json`)

export const useKanji = (level: Level) =>
  useData<{ kanji: Kanji[] }>(`${level.toLowerCase()}-kanji.json`)

/** Stroke paths for every kanji page (both levels), kept apart so the kanji list doesn't wait for them. */
export const useKanjiStrokes = () => useData<Record<string, KanjiStrokes>>('kanji-strokes.json')

const LEARN_FILES = {
  grammar: (level: Level) => `${level.toLowerCase()}-grammar.json`,
  particles: () => 'particles.json',
  kanji: (level: Level) => `${level.toLowerCase()}-kanji.json`,
}

/** Start downloading a learn page's data ahead of a likely click (hover, focus, touch). */
export function prefetchLearn(page: keyof typeof LEARN_FILES, level: Level): void {
  loadData(LEARN_FILES[page](level)).catch(() => {})
  if (page === 'kanji') loadData('kanji-strokes.json').catch(() => {})
}

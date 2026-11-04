import { isRomaji, toHiragana, toKatakana } from 'wanakana'
import type { Kanji } from './types'

/** 会う: a kun reading as it's written after the kanji, okurigana included. */
export const kunText = (k: Kanji['kun'][number]) => k.stem.replace(/^-|-$/g, '') + (k.okuri ?? '')

/** Words like 会議 need a way back to 会: any kanji with a page, in reading order. */
export const kanjiChars = (word: string, known: (ch: string) => boolean) =>
  [...new Set([...word].filter(known))]

export function kanjiPath(base: string, char: string) {
  return `${base}/${encodeURIComponent(char)}`
}

/** School grade, the way KANJIDIC2 numbers it. */
export function gradeLabel(grade?: number) {
  if (!grade) return undefined
  if (grade <= 6) return `Grade ${grade}`
  if (grade === 8) return 'Secondary school'
  return 'Name kanji'
}

/**
 * Search by the kanji itself, a reading (kana or romaji: "kai", "あう") or an
 * English meaning. Best matches first: exact kanji, then exact reading, then
 * meaning word, then partial matches.
 */
export function searchKanji(list: Kanji[], query: string): Kanji[] {
  const q = query.trim().toLowerCase()
  if (!q) return list
  const latin = isRomaji(q.replace(/\s+/g, ''))
  const hira = latin ? toHiragana(q.replace(/\s+/g, '')) : toHiragana(q)
  const kata = toKatakana(hira)
  const score = (k: Kanji): number => {
    if (q.includes(k.char)) return 0
    const kun = k.kun.map(kunText)
    const stems = k.kun.map((r) => r.stem.replace(/-/g, ''))
    if (k.on.includes(kata) || kun.includes(hira) || stems.includes(hira)) return 1
    if (latin && k.meanings.some((m) => new RegExp(`\\b${escape(q)}\\b`).test(m.toLowerCase()))) return 2
    if (k.on.some((r) => r.startsWith(kata)) || kun.some((r) => r.startsWith(hira))) return 3
    if (latin && k.meanings.some((m) => m.toLowerCase().includes(q))) return 4
    return -1
  }
  return list
    .map((k, i) => ({ k, i, s: score(k) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.k)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

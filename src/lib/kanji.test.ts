import { describe, expect, it } from 'vitest'
import { gradeLabel, kanjiChars, kunText, searchKanji } from './kanji'
import type { Kanji } from './types'

const k = (char: string, on: string[], kun: Kanji['kun'], meanings: string[]): Kanji =>
  ({ char, on, kun, meanings, strokes: 1, words: [] })

const LIST = [
  k('会', ['カイ', 'エ'], [{ stem: 'あ', okuri: 'う' }], ['meeting', 'meet', 'party']),
  k('海', ['カイ'], [{ stem: 'うみ' }], ['sea', 'ocean']),
  k('合', ['ゴウ', 'ガッ'], [{ stem: 'あ', okuri: 'う' }], ['fit', 'suit', 'join']),
  k('肉', ['ニク'], [], ['meat']),
]
const chars = (q: string) => searchKanji(LIST, q).map((x) => x.char).join('')

describe('searchKanji', () => {
  it('finds the kanji itself', () => expect(chars('海')).toBe('海'))
  it('matches readings in kana or romaji', () => {
    expect(chars('かい')).toBe('会海')
    expect(chars('kai')).toBe('会海')
    expect(chars('うみ')).toBe('海')
    expect(chars('あう')).toBe('会合')
  })
  it('ranks whole-word meanings above partial ones', () => {
    expect(chars('meet')).toBe('会')
    expect(chars('mee')).toBe('会')
    expect(chars('meat')).toBe('肉')
  })
  it('returns everything for an empty query', () => expect(chars('  ')).toBe('会海合肉'))
})

describe('helpers', () => {
  it('writes kun readings with their okurigana', () => {
    expect(kunText({ stem: 'あ', okuri: 'う' })).toBe('あう')
    expect(kunText({ stem: '-がた' })).toBe('がた')
  })
  it('lists a word’s known kanji once, in order', () => {
    expect(kanjiChars('会社会', (c) => c === '会' || c === '社')).toEqual(['会', '社'])
  })
  it('names school grades', () => {
    expect(gradeLabel(2)).toBe('Grade 2')
    expect(gradeLabel(8)).toBe('Secondary school')
    expect(gradeLabel(undefined)).toBeUndefined()
  })
})

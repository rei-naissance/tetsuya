import { describe, expect, it } from 'vitest'
import type { Word } from './types'
import { markKnown, newCard, schedule } from './srs'
import { searchWords, wordStatus } from './words'

const w = (id: string, word: string, kana: string, romaji: string, meaning: string): Word =>
  ({ id, word, kana, romaji, meaning, examples: [], inBank: [] })

const words = [
  w('a', '上がる', 'あがる', 'agaru', 'to rise, to ascend'),
  w('b', '挨拶', 'あいさつ', 'aisatsu', 'greeting, salutation'),
  w('c', '原因', 'げんいん', "gen'in", 'cause, origin'),
  w('d', '大きい', 'おおきい', 'ookii', 'big'),
  w('e', '上着', 'うわぎ', 'uwagi', 'jacket, coat that rises above'),
]

describe('searchWords', () => {
  it('finds a word by kanji, kana and romaji', () => {
    expect(searchWords(words, '上がる')[0].id).toBe('a')
    expect(searchWords(words, 'あがる')[0].id).toBe('a')
    expect(searchWords(words, 'agaru')[0].id).toBe('a')
    expect(searchWords(words, 'genin')[0].id).toBe('c')
  })

  it('matches romaji typed as a prefix', () => {
    expect(searchWords(words, 'ais').map((x) => x.id)).toEqual(['b'])
  })

  it('ranks a whole-word meaning match above a partial one', () => {
    expect(searchWords(words, 'big').map((x) => x.id)).toEqual(['d'])
    expect(searchWords(words, 'rise').map((x) => x.id)).toEqual(['a', 'e']) // "rise" before "rises"
    expect(searchWords(words, 'coat').map((x) => x.id)).toEqual(['e'])
  })

  it('returns everything for an empty query', () => {
    expect(searchWords(words, '  ')).toHaveLength(words.length)
  })
})

describe('wordStatus', () => {
  it('is new without a card, learning in steps or short intervals, known once mature', () => {
    expect(wordStatus(undefined)).toBe('new')
    expect(wordStatus(newCard())).toBe('learning')
    expect(wordStatus(schedule(newCard(), 'easy'))).toBe('learning')
    expect(wordStatus(markKnown())).toBe('known')
  })
})

import { describe, expect, it } from 'vitest'
import { definitionTerm, findWord, senses, wordRuby } from './definition'
import type { Question, Word } from './types'

const word = (w: Partial<Word> & { word: string }): Word => ({ id: w.word, meaning: '', examples: [], inBank: [], ...w })

describe('wordRuby', () => {
  it('keeps kana written in the word outside the ruby', () => {
    expect(wordRuby('一人で', 'ひとりで')).toBe('{一人|ひとり}で')
    expect(wordRuby('目覚まし時計', 'めざましとけい')).toBe('{目覚|めざ}まし{時計|とけい}')
    expect(wordRuby('ケーキ屋', 'ケーキや')).toBe('ケーキ{屋|や}')
    expect(wordRuby('きせつ', 'きせつ')).toBe('きせつ')
  })
})

describe('definitionTerm', () => {
  const base = { section: 'kanji' as const, prompt: '', choices: ['a', 'b', 'c', 'd'], answer: 0 }

  it('uses a word card’s own word', () => {
    const q: Question = { ...base, id: 'n4-kanji-春', kind: 'words', headword: { word: '春', reading: 'はる', meaning: 'spring' } }
    expect(definitionTerm(q)).toEqual({ word: '春', reading: 'はる', meaning: 'spring' })
  })

  it('pairs a kanji question’s underlined word with the right reading or spelling', () => {
    const reading: Question = { ...base, id: 'n4-kanji-t-q1', kind: 'reading', target: '{質問|しつもん}の**答え**が', choices: ['ごたえ', 'こたえ', 'x', 'y'], answer: 1 }
    expect(definitionTerm(reading)).toMatchObject({ word: '答え', reading: 'こたえ' })
    const writing: Question = { ...base, id: 'n4-kanji-t-q2', kind: 'writing', target: '{私|わたし}の**おねえさん**は', choices: ['お父さん', 'お姉さん', 'x', 'y'], answer: 1 }
    expect(definitionTerm(writing)).toMatchObject({ word: 'お姉さん', reading: 'おねえさん' })
  })

  it('defines a fill-the-blank answer, but not a paraphrase sentence', () => {
    const context: Question = { ...base, id: 'n4-vocabulary-ex1-q1', section: 'vocabulary', kind: 'context', choices: ['てんき', 'きせつ', 'x', 'y'], answer: 1 }
    expect(definitionTerm(context)).toMatchObject({ word: 'きせつ' })
    const paraphrase: Question = { ...context, kind: 'paraphrase', choices: ['電車の中で騒がないでください。', 'b', 'c', 'd'], answer: 0 }
    expect(definitionTerm(paraphrase)).toBeNull()
  })
})

describe('findWord', () => {
  const words = [word({ word: '季節', kana: 'きせつ' }), word({ word: '橋', kana: 'はし' }), word({ word: '箸', kana: 'はし' })]

  it('finds a kana answer by its reading only when one word reads that way', () => {
    expect(findWord(words, { word: 'きせつ' })?.word).toBe('季節')
    expect(findWord(words, { word: 'はし' })).toBeUndefined()
    expect(findWord(words, { word: '箸' })?.word).toBe('箸')
  })
})

describe('senses', () => {
  it('splits on semicolons', () => {
    expect(senses('older sister, elder sister; young lady')).toEqual(['older sister, elder sister', 'young lady'])
  })
})

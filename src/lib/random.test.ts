import { describe, expect, it } from 'vitest'
import { sampleGrouped, shuffleChoices } from './random'

describe('shuffleChoices', () => {
  it('keeps the answer pointing at the same text', () => {
    for (let i = 0; i < 50; i++) {
      const q = shuffleChoices({ choices: ['a', 'b', 'c', 'd'], answer: 2 })
      expect(q.choices[q.answer]).toBe('c')
    }
  })

  it('moves choice translations with their choices', () => {
    for (let i = 0; i < 50; i++) {
      const q = shuffleChoices({ choices: ['a', 'b', 'c', 'd'], answer: 0, en: { choices: ['A', null, 'C', 'D'] } })
      q.choices.forEach((c, j) => expect(q.en!.choices![j]).toBe(c === 'b' ? null : c.toUpperCase()))
    }
  })

  it('leaves keepOrder questions untouched', () => {
    const q = { choices: ['1', '2', '3', '4'], answer: 1, keepOrder: true }
    expect(shuffleChoices(q)).toBe(q)
  })
})

describe('sampleGrouped', () => {
  const items = [
    ...['a1', 'a2', 'a3'].map((id) => ({ id, group: 'A' })),
    ...['b1', 'b2'].map((id) => ({ id, group: 'B' })),
    { id: 'c1' },
    { id: 'd1' },
  ]

  it('keeps each group together and in order', () => {
    for (let i = 0; i < 30; i++) {
      const ids = sampleGrouped(items, 10).map((q) => q.id)
      const a = ids.indexOf('a1')
      if (a >= 0) expect(ids.slice(a, a + 3)).toEqual(['a1', 'a2', 'a3'])
      const b = ids.indexOf('b1')
      if (b >= 0) expect(ids.slice(b, b + 2)).toEqual(['b1', 'b2'])
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('stops once it has enough questions', () => {
    for (let i = 0; i < 30; i++) expect(sampleGrouped(items, 2).length).toBeLessThanOrEqual(4)
  })
})

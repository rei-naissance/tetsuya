import { describe, expect, it } from 'vitest'
import { drawDistractors, sampleGrouped, shuffleChoices } from './random'

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

describe('drawDistractors', () => {
  const card = {
    choices: ['こたえ', 'ごたえ', 'こだえ', 'こたい'],
    answer: 0,
    distractors: {
      near: ['ごたえ', 'こだえ', 'こたい', 'こうたえ', 'こたえる'],
      far: [['ごだえ'], ['こだい'], [], ['ごうたえ'], []],
    },
  }

  it('keeps the answer and draws three different wrong choices from the pool', () => {
    const pool = new Set([...card.distractors.near, ...card.distractors.far.flat()])
    for (let i = 0; i < 100; i++) {
      const q = shuffleChoices(card)
      expect(q.choices[q.answer]).toBe('こたえ')
      expect(new Set(q.choices).size).toBe(4)
      q.choices.filter((c) => c !== 'こたえ').forEach((c) => expect(pool.has(c)).toBe(true))
    }
  })

  it('varies the choices between showings, sometimes with a near miss of a near miss', () => {
    const sets = new Set<string>()
    let decoys = 0
    for (let i = 0; i < 200; i++) {
      const q = drawDistractors(card)
      sets.add([...q.choices].sort().join())
      if (q.choices.some((c) => card.distractors.far.flat().includes(c))) decoys++
    }
    expect(sets.size).toBeGreaterThan(3)
    expect(decoys).toBeGreaterThan(50)
    expect(decoys).toBeLessThan(200)
  })

  it('leaves questions without a pool alone', () => {
    const q = { choices: ['a', 'b', 'c', 'd'], answer: 1 }
    expect(drawDistractors(q)).toBe(q)
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

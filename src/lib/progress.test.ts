import { describe, expect, it } from 'vitest'
import { pickSet, progressStats, type AttemptMap } from './progress'

const qs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
const tried = (lastCorrect: boolean, at = 1) => ({ seen: 1, correct: lastCorrect ? 1 : 0, lastCorrect, at })

describe('pickSet', () => {
  const attempts: AttemptMap = { a: tried(true, 5), b: tried(false), c: tried(true, 1) }

  it('picks unseen questions first, then mistakes, then the oldest right answers', () => {
    for (let i = 0; i < 20; i++) {
      expect(new Set(pickSet(qs, 3, 'next', attempts).map((q) => q.id))).toEqual(new Set(['d', 'e', 'f']))
      expect(new Set(pickSet(qs, 5, 'next', attempts).map((q) => q.id))).toEqual(new Set(['d', 'e', 'f', 'b', 'c']))
    }
  })

  it('shuffles the set it picked, so a restudy comes in a new order', () => {
    const seenAll: AttemptMap = Object.fromEntries(qs.map((q, i) => [q.id, tried(true, i)]))
    const orders = new Set(Array.from({ length: 30 }, () => pickSet(qs, 6, 'next', seenAll).map((q) => q.id).join('')))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('limits the set size', () => {
    expect(pickSet(qs, 4, 'next', attempts)).toHaveLength(4)
  })

  it('"mistakes" only returns questions last answered wrong', () => {
    expect(pickSet(qs, 10, 'mistakes', attempts).map((q) => q.id)).toEqual(['b'])
  })

  it('keeps a passage group together and in order', () => {
    const items = [{ id: 'p1', group: 'P' }, { id: 'p2', group: 'P' }, { id: 'p3', group: 'P' }, { id: 'x' }]
    for (let i = 0; i < 20; i++) {
      const ids = pickSet(items, 3, 'next', {}).map((q) => q.id)
      const at = ids.indexOf('p1')
      if (at >= 0) expect(ids.slice(at, at + 3)).toEqual(['p1', 'p2', 'p3'])
    }
  })
})

describe('progressStats', () => {
  it('counts by the most recent answer', () => {
    expect(progressStats(['a', 'b', 'z'], { a: tried(true), b: tried(false) })).toEqual({ total: 3, seen: 2, right: 1, wrong: 1 })
  })
})

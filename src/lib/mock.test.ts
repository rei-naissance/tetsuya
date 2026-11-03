import { describe, expect, it } from 'vitest'
import { pageList } from '../components/Layout'
import { buildMock, JLPT_FORMAT } from './mock'
import type { Question, Section } from './types'

const make = (section: Section, kind: string, n: number, group?: number): Question[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${section}-${kind}-${i}`, section, kind, prompt: '', choices: ['a', 'b', 'c', 'd'], answer: 0,
    group: group ? `${kind}-g${Math.floor(i / group)}` : undefined,
  }))

// Plenty of everything except kanji writing (表記), like the N3 bank.
const bank = [
  ...make('kanji', 'reading', 50), ...make('vocabulary', 'context', 50), ...make('vocabulary', 'paraphrase', 50),
  ...make('vocabulary', 'usage', 50), ...make('grammar', 'form', 50), ...make('grammar', 'order', 50),
  ...make('grammar', 'passage', 50, 5), ...make('reading', 'comprehension', 60, 3),
  ...make('listening', 'picture', 50), ...make('listening', 'audio', 50), ...make('listening', 'response', 50),
]

describe('buildMock', () => {
  it('follows the official counts, paper by paper, with no repeats', () => {
    const { test, short } = buildMock('N4', bank)
    expect(short.map((s) => s.mondai.jp)).toEqual(['表記'])
    const ids = test.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Papers come in order.
    expect(test.map((q) => q.paper)).toEqual([...test.map((q) => q.paper)].sort())
    for (const [p, paper] of JLPT_FORMAT.N4.entries()) {
      for (const m of paper.mondai) {
        const n = test.filter((q) => q.paper === p && q.mondai === m.jp).length
        if (m.jp === '表記') expect(n).toBe(0)
        else if (m.section === 'reading' || m.kinds[0] === 'passage') expect(n).toBeGreaterThanOrEqual(m.count) // passages stay whole
        else expect(n).toBe(m.count)
      }
    }
  })

  it('reports a shortfall instead of padding with another question type', () => {
    const { short } = buildMock('N3', bank.filter((q) => q.kind !== 'usage'))
    expect(short.find((s) => s.mondai.jp === '用法')).toMatchObject({ got: 0 })
  })
})

describe('pageList', () => {
  it('shows the ends and one page either side, with gaps', () => {
    expect(pageList(1, 3)).toEqual([1, 2, 3])
    expect(pageList(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12])
    expect(pageList(2, 12)).toEqual([1, 2, 3, '…', 12])
  })
})

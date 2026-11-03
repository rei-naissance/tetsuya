import { sampleGrouped, shuffleChoices } from './random'
import type { Level, Question, Section } from './types'

/**
 * The JLPT paper layout per level: three timed papers, each a list of
 * 問題 (question types) with the official item count. Counts are the
 * post-December-2020 figures; the Japan Foundation says they can vary
 * slightly between sessions.
 *
 * `kinds` are the bank's question kinds to draw from, best match first.
 * Where the bank has no fair substitute, a 問題 comes up short and the
 * intro says so instead of padding it with another type.
 */
export interface Mondai { label: string; jp: string; section: Section; kinds: string[]; count: number }
export interface Paper { label: string; jp: string; minutes: number; mondai: Mondai[] }

const listening = (counts: [string, string, string[], number][]): Mondai[] =>
  // The bank's listening kinds (picture / audio / response) don't line up
  // exactly with the official types, so each falls back to the others.
  counts.map(([label, jp, kinds, count]) => ({
    label, jp, section: 'listening', count,
    kinds: [...kinds, ...['picture', 'audio', 'response'].filter((k) => !kinds.includes(k))],
  }))

export const JLPT_FORMAT: Record<Level, Paper[]> = {
  N4: [
    {
      label: 'Language Knowledge (Vocabulary)', jp: '言語知識（文字・語彙）', minutes: 25,
      mondai: [
        { label: 'Kanji reading', jp: '漢字読み', section: 'kanji', kinds: ['reading'], count: 7 },
        { label: 'Orthography', jp: '表記', section: 'kanji', kinds: ['writing'], count: 5 },
        { label: 'Contextual meaning', jp: '文脈規定', section: 'vocabulary', kinds: ['context'], count: 8 },
        { label: 'Paraphrases', jp: '言い換え類義', section: 'vocabulary', kinds: ['paraphrase'], count: 4 },
        { label: 'Usage', jp: '用法', section: 'vocabulary', kinds: ['usage'], count: 4 },
      ],
    },
    {
      label: 'Language Knowledge (Grammar)・Reading', jp: '言語知識（文法）・読解', minutes: 55,
      mondai: [
        { label: 'Grammar form', jp: '文法形式の判断', section: 'grammar', kinds: ['form'], count: 13 },
        { label: 'Sentence order', jp: '文の組み立て', section: 'grammar', kinds: ['order'], count: 4 },
        { label: 'Text grammar', jp: '文章の文法', section: 'grammar', kinds: ['passage'], count: 4 },
        // Short (3) + mid-size (3) passages + information retrieval (2); the bank doesn't tell them apart.
        { label: 'Reading comprehension', jp: '読解', section: 'reading', kinds: ['comprehension'], count: 8 },
      ],
    },
    {
      label: 'Listening', jp: '聴解', minutes: 35,
      mondai: listening([
        ['Task-based comprehension', '課題理解', ['picture'], 8],
        ['Point comprehension', 'ポイント理解', ['audio'], 7],
        ['Verbal expressions', '発話表現', ['picture'], 5],
        ['Quick response', '即時応答', ['response', 'audio'], 8],
      ]),
    },
  ],
  N3: [
    {
      label: 'Language Knowledge (Vocabulary)', jp: '言語知識（文字・語彙）', minutes: 30,
      mondai: [
        // The N3 bank has no kanji-reading questions; word-reading cards are the closest.
        { label: 'Kanji reading', jp: '漢字読み', section: 'kanji', kinds: ['reading', 'words'], count: 8 },
        { label: 'Orthography', jp: '表記', section: 'kanji', kinds: ['writing'], count: 6 },
        { label: 'Contextual meaning', jp: '文脈規定', section: 'vocabulary', kinds: ['context'], count: 11 },
        { label: 'Paraphrases', jp: '言い換え類義', section: 'vocabulary', kinds: ['paraphrase'], count: 5 },
        { label: 'Usage', jp: '用法', section: 'vocabulary', kinds: ['usage'], count: 5 },
      ],
    },
    {
      label: 'Language Knowledge (Grammar)・Reading', jp: '言語知識（文法）・読解', minutes: 70,
      mondai: [
        { label: 'Grammar form', jp: '文法形式の判断', section: 'grammar', kinds: ['form'], count: 13 },
        { label: 'Sentence order', jp: '文の組み立て', section: 'grammar', kinds: ['order'], count: 5 },
        { label: 'Text grammar', jp: '文章の文法', section: 'grammar', kinds: ['passage'], count: 5 },
        // Short (4) + mid-size (6) + long (4) passages + information retrieval (2).
        { label: 'Reading comprehension', jp: '読解', section: 'reading', kinds: ['comprehension'], count: 16 },
      ],
    },
    {
      label: 'Listening', jp: '聴解', minutes: 40,
      mondai: listening([
        ['Task-based comprehension', '課題理解', ['picture'], 6],
        ['Point comprehension', 'ポイント理解', ['audio'], 6],
        ['Summary comprehension', '概要理解', ['audio'], 3],
        ['Verbal expressions', '発話表現', ['picture'], 4],
        ['Quick response', '即時応答', ['response'], 9],
      ]),
    },
  ],
}

export interface MockQuestion extends Question { paper: number; mondai: string }
export interface Shortfall { paper: number; mondai: Mondai; got: number }

/**
 * Draws a mock test in paper and 問題 order. Passages stay whole, so a
 * reading 問題 may run a question or two over its count.
 */
export function buildMock(level: Level, questions: Question[]): { test: MockQuestion[]; short: Shortfall[] } {
  const used = new Set<string>()
  const test: MockQuestion[] = []
  const short: Shortfall[] = []
  JLPT_FORMAT[level].forEach((paper, p) => {
    for (const m of paper.mondai) {
      let got = 0
      for (const kind of m.kinds) {
        if (got >= m.count) break
        const pool = questions.filter((q) => q.section === m.section && q.kind === kind && !used.has(q.id))
        for (const q of sampleGrouped(pool, m.count - got)) {
          used.add(q.id)
          test.push({ ...shuffleChoices(q), paper: p, mondai: m.jp })
          got++
        }
      }
      if (got < m.count) short.push({ paper: p, mondai: m, got })
    }
  })
  return { test, short }
}

import type { GlossaryEntry, Level, Question, Word } from './types'

/** The word a definition card is about: from a question, or a list word. */
export interface Term {
  word: string
  reading?: string
  meaning?: string
}

const plain = (s: string) => s.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '').trim()
const bold = (s?: string) => s?.match(/\*\*(.+?)\*\*/)?.[1]
const isKana = (s: string) => /^[ぁ-ゖァ-ヺー]+$/.test(s)

/** Question ids start with the level: "n4-kanji-…". */
export const questionLevel = (q: Question): Level => (q.id.startsWith('n3') ? 'N3' : 'N4')

/**
 * The word a kanji or vocabulary question is about, once answered: the word
 * card's word, the underlined word of a kanji question (with its right
 * reading or spelling), the right answer of a fill-the-blank, or the word a
 * usage question is about. null when the question isn't about one word.
 */
export function definitionTerm(q: Question): Term | null {
  if (q.headword) return q.headword
  const answer = plain(q.choices[q.answer] ?? '')
  const underlined = plain(bold(q.target) ?? '')
  const gloss = (w: string) => glossFor(q.glossary, w)
  if (q.section === 'kanji') {
    // Reading: 答え, read こたえ. Writing: おねえさん, spelled お姉さん.
    const [word, reading] = q.kind === 'writing' ? [answer, underlined] : [underlined, answer]
    if (!word || word.length > 10) return null
    const g = gloss(word)
    return { word, reading, meaning: g?.meaning }
  }
  if (q.section !== 'vocabulary') return null
  const word = q.kind === 'context' ? answer : q.kind === 'usage' ? underlined : ''
  if (!word || word.length > 10 || /[。、\s]/.test(word)) return null
  const g = gloss(word)
  return { word, reading: g?.reading, meaning: g?.meaning }
}

/** The glossary entry for a word, also when the question has it inflected (通って → 通う). */
function glossFor(glossary: GlossaryEntry[] | undefined, word: string): GlossaryEntry | undefined {
  if (!glossary) return undefined
  return glossary.find((g) => g.word === word || g.reading === word)
    ?? glossary.find((g) => g.word.length > 1 && word.startsWith(g.word.slice(0, -1)) && !isKana(g.word))
}

/**
 * The list word for a term: by spelling (preferring the one read the same
 * way), or for a kana-only term, the one word that reads that way.
 */
export function findWord(words: Word[], term: Term): Word | undefined {
  const w = term.word
  const spelled = words.filter((x) => x.word === w || x.spellings?.includes(w))
  if (spelled.length) return (term.reading && spelled.find((x) => x.kana === term.reading)) || spelled[0]
  if (term.reading) {
    const read = words.filter((x) => x.kana === term.reading && (x.word === w || x.word.startsWith(w.slice(0, -1))))
    if (read.length === 1) return read[0]
  }
  if (isKana(w)) {
    const read = words.filter((x) => x.kana === w)
    if (read.length === 1) return read[0]
  }
  return undefined
}

/** "older sister, elder sister; young lady" → one sense per ";". */
export const senses = (meaning: string) => meaning.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean)

/**
 * Furigana markup for a word whose reading is known: kana written in the
 * word stays outside the ruby (取り扱い + とりあつかい → {取|と}り{扱|あつか}い).
 */
export function wordRuby(word: string, reading?: string): string {
  if (!reading || !/[一-龯㐀-䶿々〆ヶ]/.test(word)) return word
  const runs = word.match(/[^ぁ-ゖァ-ヺー]+|[ぁ-ゖァ-ヺー]+/g) ?? [word]
  const hira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${runs.map((x) => (isKana(x) ? esc(hira(x)) : '(.+?)')).join('')}$`)
  const m = hira(reading).match(re)
  if (!m) return `{${word}|${reading}}`
  let i = 1
  return runs.map((x) => (isKana(x) ? x : `{${x}|${m[i++]}}`)).join('')
}

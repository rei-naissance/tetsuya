export type Level = 'N4' | 'N3'
export type Section = 'kanji' | 'vocabulary' | 'grammar' | 'reading' | 'listening'

export const LEVELS: Level[] = ['N4', 'N3']
export const SECTIONS: Section[] = ['kanji', 'vocabulary', 'grammar', 'reading', 'listening']

/** Sections that use spaced repetition instead of one-off practice. */
export const SRS_SECTIONS: Section[] = ['kanji', 'vocabulary']

export interface Question {
  /** Globally unique and STABLE — SRS progress is keyed by this id. */
  id: string
  section: Section
  /** Instruction / question text. Supports furigana markup: {漢字|かんじ}. */
  prompt: string
  /** Optional highlighted word or sentence the question is about. */
  target?: string
  /** Optional reading passage (reading section). */
  passage?: string
  /** Optional audio path relative to /public, e.g. "audio/n4/l-001.mp3". */
  audio?: string
  /** Optional transcript, shown after answering (or if audio is missing). */
  transcript?: string
  /** Optional image path relative to /public. */
  image?: string
  choices: string[]
  /** Zero-based index into `choices`. */
  answer: number
  explanation?: string
}

export interface LevelData {
  level: Level
  version?: number
  questions: Question[]
}

export const SECTION_META: Record<Section, { label: string; jp: string; blurb: string }> = {
  kanji: { label: 'Kanji', jp: '漢字', blurb: 'Readings and writing' },
  vocabulary: { label: 'Vocabulary', jp: '語彙', blurb: 'Words in context' },
  grammar: { label: 'Grammar', jp: '文法', blurb: 'Sentence patterns' },
  reading: { label: 'Reading', jp: '読解', blurb: 'Short passages' },
  listening: { label: 'Listening', jp: '聴解', blurb: 'Audio comprehension' },
}

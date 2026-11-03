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
  /** JLPT question type within the section (see KINDS), e.g. "order" for ★ grammar. */
  kind?: string
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
  /** Questions sharing a group (e.g. one reading passage) are kept together, in id order. */
  group?: string
  /** Don't shuffle choices (e.g. "1–4" referring to a picture or the audio). */
  keepOrder?: boolean
  /** Words from the question, shown after answering. */
  glossary?: GlossaryEntry[]
  /** English, shown after answering. `choices` lines up with `choices` (null = none). */
  en?: { sentence?: string; passage?: string; prompt?: string; choices?: (string | null)[] }
}

export interface GlossaryEntry {
  word: string
  reading?: string
  meaning: string
}

/** A sentence using a word; `ja` marks the word with **…**. */
export interface WordExample {
  ja: string
  romaji?: string
  en?: string
}

/** One entry of the JLPT vocabulary list (learn mode). */
export interface Word {
  /** Stable — word status is keyed by this id. */
  id: string
  word: string
  kana?: string
  romaji?: string
  /** Short meaning from the list. */
  meaning: string
  /** Longer meaning from the word's page, when it has one. */
  fullMeaning?: string
  /** "verb", "noun", "i-adjective"… */
  type?: string
  /** Other spellings, e.g. 上る for 上がる. */
  spellings?: string[]
  examples: WordExample[]
  /** "昇る (noboru)" */
  similar?: string[]
  /** Conjugation chart image (on the source site). */
  conjugation?: string
  /** The word's page on the source site. */
  url?: string
  /** Sentences from this app's questions that use the word. */
  inBank: (WordExample & { qid: string })[]
}

/** One grammar pattern (learn mode), merged from the source sites. */
export interface GrammarPattern {
  /** Stable — drill progress is keyed by question ids derived from it. */
  id: string
  /** "～さ", "あまり～ない" */
  pattern: string
  romaji?: string
  meaning: string
  /** One-line title and learning goal (japanesejlpt lessons). */
  title?: string
  goal?: string
  /** japanesejlpt lesson chapter, for grouping. */
  chapter?: number
  formation: string[]
  notes: string[]
  /** "Why it means that" / "How it is built" explanations. */
  sections: { label: string; heading: string; text: string[] }[]
  /** `ja` may contain furigana {漢字|かな} and the pattern as **…**. */
  examples: (WordExample & { audio?: string })[]
  sources: { name: string; url: string }[]
  /** Fill-the-blank drills made from the examples. */
  drills: Question[]
  /** Sentences from this app's grammar questions whose answer is this pattern. */
  inBank: (WordExample & { qid: string })[]
}

/** A hand-written particle contrast (learn mode). */
export interface ParticleContrast {
  id: string
  level: Level
  title: string
  particles: string[]
  summary: string
  points: { rule: string; examples: WordExample[] }[]
  drills: Question[]
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

export interface KindMeta { id: string; label: string; jp: string; blurb: string }

/** The question types (問題) in each section, in JLPT paper order. */
export const KINDS: Record<Section, KindMeta[]> = {
  kanji: [
    { id: 'reading', label: 'Kanji reading', jp: '漢字読み', blurb: 'How is the underlined word read?' },
    { id: 'writing', label: 'Orthography', jp: '表記', blurb: 'Which kanji spells the underlined word?' },
    { id: 'words', label: 'Word cards', jp: '単語', blurb: 'Readings of words from the exercise word lists' },
  ],
  vocabulary: [
    { id: 'context', label: 'Contextual meaning', jp: '文脈規定', blurb: 'Fill the blank with the right word' },
    { id: 'paraphrase', label: 'Paraphrases', jp: '言い換え類義', blurb: 'Pick the sentence that means the same' },
    { id: 'usage', label: 'Usage', jp: '用法', blurb: 'Pick the sentence that uses the word correctly' },
  ],
  grammar: [
    { id: 'form', label: 'Grammar form', jp: '文法形式の判断', blurb: 'Fill the blank with the right grammar' },
    { id: 'order', label: 'Sentence order', jp: '文の組み立て', blurb: 'Put the words in order: which goes in ★?' },
    { id: 'passage', label: 'Text grammar', jp: '文章の文法', blurb: 'Fill the numbered gaps in a passage' },
  ],
  reading: [
    { id: 'comprehension', label: 'Comprehension', jp: '内容理解', blurb: 'Passages with questions' },
  ],
  listening: [
    { id: 'picture', label: 'With pictures', jp: '絵を見て', blurb: 'Listen and pick the right picture or number' },
    { id: 'audio', label: 'Listen and choose', jp: '聞いて答える', blurb: 'Listen and pick the right answer' },
    { id: 'response', label: 'Quick response', jp: '即時応答', blurb: 'Pick the best reply to what you hear' },
  ],
}

/** "all" = every type in the section, mixed. */
export const ALL_KINDS = 'all'

import { Link } from 'react-router-dom'
import { JP } from './JP'
import { cn } from '../lib/cn'
import { findWord, senses, wordRuby, type Term } from '../lib/definition'
import { kanjiChars, kanjiPath } from '../lib/kanji'
import { useKanji } from '../lib/learn'
import type { Kanji, Level, Word } from '../lib/types'
import { useWords } from '../lib/words'

const kanjiBase = (level: Level) => `/${level.toLowerCase()}/learn/kanji`
const otherLevel = (level: Level): Level => (level === 'N4' ? 'N3' : 'N4')

/**
 * A dictionary-style card for one word: the word with furigana, its reading,
 * part of speech, meanings (numbered when there are several), its kanji and
 * a link to the word's page. Give it a list `word`, or a `term` from a
 * question, which is looked up in the level's word list for the full entry
 * (or the other level's, for an N4 question using an N3 word).
 * Renders nothing when there's nothing to say about the term.
 *
 * In a quiz, `newTab` opens links in a new tab so the session isn't lost.
 */
export function WordDefinition({ level, word, term, size = 'md', newTab, className }: {
  level: Level
  word?: Word
  term?: Term
  size?: 'md' | 'lg'
  newTab?: boolean
  className?: string
}) {
  const lists = [useWords(level), useWords(otherLevel(level))]
  let found = word
  let foundLevel = level
  if (!found && term) {
    for (const [i, list] of lists.entries()) {
      found = list.status === 'ready' ? findWord(list.words, term) : undefined
      if (found) { foundLevel = i ? otherLevel(level) : level; break }
    }
  }
  // While the list loads, the question's own entry is enough to start with.
  const headword = found?.word ?? term?.word
  const reading = found?.kana ?? term?.reading
  const meaning = found?.meaning ?? term?.meaning
  if (!headword || !meaning) return null

  const parts = senses(meaning)
  const extra = found?.fullMeaning && found.fullMeaning !== meaning ? found.fullMeaning : undefined
  const target = newTab ? { target: '_blank', rel: 'noreferrer' } : {}
  const lg = size === 'lg'

  return (
    <section
      aria-label={`Definition of ${headword}`}
      className={cn('rounded-2xl border border-stone-200 bg-white text-left dark:border-stone-800 dark:bg-stone-900', lg ? 'p-6 sm:p-8' : 'p-5', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <JP as="p" text={wordRuby(headword, reading)} className={cn('tracking-wide', lg ? 'text-5xl leading-[1.8]' : 'text-3xl leading-[1.8]')} />
          {(reading || found?.romaji) && (
            <p className="mt-1 text-sm text-stone-500">
              {reading && <span lang="ja" className="font-jp text-base">{reading}</span>}
              {found?.romaji && <span className={cn('text-stone-400', reading && 'ml-2')}>{found.romaji}</span>}
            </p>
          )}
        </div>
        {found?.type && (
          <span className="mt-2 shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            {found.type}
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
        {parts.length > 1 ? (
          <ol className="space-y-2">
            {parts.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold tabular-nums text-accent dark:bg-accent/10">{i + 1}</span>
                <span className={lg ? 'text-lg' : undefined}>{s}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={lg ? 'text-xl' : 'text-lg'}>{meaning}</p>
        )}
        {extra && <p className="mt-2 text-sm text-stone-500">{extra}</p>}
        {found?.spellings && (
          <p className="mt-2 text-sm text-stone-500">
            Also written <span lang="ja" className="font-jp">{found.spellings.join('、')}</span>
          </p>
        )}
      </div>

      <WordKanji level={level} word={headword} newTab={newTab} className="mt-4" />

      {found && (
        <Link
          to={`/${foundLevel.toLowerCase()}/learn/vocab/${found.id}`}
          {...target}
          className="mt-4 inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
        >
          {foundLevel !== level ? `${foundLevel} word page` : 'Word page'}, examples and more <span aria-hidden>{newTab ? '↗' : '→'}</span>
        </Link>
      )}
    </section>
  )
}

/** The word's kanji, each linking to its kanji page. Nothing while the kanji list loads or for kana-only words. */
export function WordKanji({ level, word, newTab, className }: { level: Level; word: string; newTab?: boolean; className?: string }) {
  // This level's kanji pages first, then the other level's.
  const data = [useKanji(level), useKanji(otherLevel(level))]
  if (data[0].status !== 'ready') return null
  const byChar = new Map<string, { k: Kanji; level: Level }>()
  data.forEach((d, i) => {
    if (d.status !== 'ready') return
    for (const k of d.data.kanji) if (!byChar.has(k.char)) byChar.set(k.char, { k, level: i ? otherLevel(level) : level })
  })
  const chars = kanjiChars(word, (ch) => byChar.has(ch))
  if (!chars.length) return null
  const target = newTab ? { target: '_blank', rel: 'noreferrer' } : {}
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chars.map((ch) => {
        const { k, level: at } = byChar.get(ch)!
        const reads = [...k.on.slice(0, 2), ...k.kun.slice(0, 2).map((r) => r.stem.replace(/-/g, '') + (r.okuri ?? ''))]
        return (
          <Link
            key={ch}
            to={kanjiPath(kanjiBase(at), ch)}
            {...target}
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white py-1.5 pl-2 pr-3 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
          >
            <span className="font-jp-serif text-2xl" lang="ja">{ch}</span>
            <span className="min-w-0 leading-tight">
              <span className="block max-w-40 truncate text-sm text-stone-600 dark:text-stone-300">{k.meanings.slice(0, 2).join(', ')}</span>
              {reads.length > 0 && <span lang="ja" className="block max-w-40 truncate font-jp text-xs text-stone-400">{reads.join('・')}</span>}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

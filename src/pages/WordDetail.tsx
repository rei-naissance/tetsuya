import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Layout, TextButton } from '../components/Layout'
import { JP } from '../components/JP'
import type { Level, Word, WordExample } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { formatDelay, getCard, markKnown, saveCard } from '../lib/srs'
import { resetWord, wordStatus } from '../lib/words'
import { cn } from '../lib/cn'

/** Everything known about one word, with prev/next through the list (← →). */
export function WordDetail({ level, words, word }: { level: Level; words: Word[]; word: Word }) {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? ''
  const base = `/${level.toLowerCase()}/learn/vocab`
  const index = words.indexOf(word)
  const prev = words[index - 1]
  const next = words[index + 1]
  const go = (w?: Word) => w && navigate(`${base}/${w.id}`, { replace: true, state: { from } })

  useKeys((e) => {
    if (e.key === 'ArrowLeft') go(prev)
    else if (e.key === 'ArrowRight') go(next)
  })

  // Similar words link to their own page when they're on this list.
  const findWord = (s: string) => {
    const w = s.replace(/\s*\(.*$/, '').trim()
    return words.find((x) => x.word === w || x.spellings?.includes(w))
  }

  return (
    <Layout
      back={{ to: `${base}${from}`, label: 'Word list' }}
      title={`${index + 1} / ${words.length}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {word.type && <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{word.type}</p>}
          <h1 className="mt-2 font-jp text-5xl tracking-wide">{word.word}</h1>
          <p className="mt-3 font-jp text-xl text-stone-500">
            {word.kana}
            {word.romaji && <span className="ml-3 font-sans text-base text-stone-400">{word.romaji}</span>}
          </p>
          {word.spellings && (
            <p className="mt-2 text-sm text-stone-500">
              Also written <span className="font-jp">{word.spellings.join('、')}</span>
            </p>
          )}
        </div>
        <StatusToggle key={word.id} id={word.id} />
      </div>

      <p className="mt-6 text-lg">{word.meaning}</p>
      {word.fullMeaning && <p className="mt-1 text-stone-500">{word.fullMeaning}</p>}

      {word.examples.length > 0 && (
        <Block title="Example sentences">
          {word.examples.map((ex, i) => <Example key={i} ex={ex} />)}
        </Block>
      )}

      {word.inBank.length > 0 && (
        <Block title="In this app's questions">
          {word.inBank.map((ex) => <Example key={ex.qid + ex.ja} ex={ex} />)}
        </Block>
      )}

      {word.examples.length + word.inBank.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500 dark:border-stone-700">
          No example sentences for this word yet.
          {!word.url && ' The source list has no word page for it, so the reading was converted from romaji.'}
        </p>
      )}

      {word.similar && (
        <Block title="Similar words">
          <div className="flex flex-wrap gap-2">
            {word.similar.map((s) => {
              const w = findWord(s)
              const cls = 'rounded-full border border-stone-200 px-3 py-1 font-jp text-sm dark:border-stone-800'
              return w ? (
                <Link key={s} to={`${base}/${w.id}`} state={{ from }} className={cn(cls, 'hover:border-stone-900 dark:hover:border-stone-400')}>{s}</Link>
              ) : (
                <span key={s} className={cn(cls, 'text-stone-500')}>{s}</span>
              )
            })}
          </div>
        </Block>
      )}

      {(word.conjugation || word.url) && (
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {word.conjugation && <a href={word.conjugation} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">Conjugation chart ↗</a>}
          {word.url && <a href={word.url} target="_blank" rel="noreferrer" className="text-stone-500 underline-offset-4 hover:underline">Word page on japanesetest4you ↗</a>}
        </div>
      )}

      <nav className="mt-12 flex justify-between gap-4 border-t border-stone-200 pt-6 text-sm dark:border-stone-800">
        <NavLink word={prev} dir="prev" onClick={() => go(prev)} />
        <NavLink word={next} dir="next" onClick={() => go(next)} />
      </nav>
    </Layout>
  )
}

/** The word's flashcard: where it stands, and a way to skip or restart it. */
function StatusToggle({ id }: { id: string }) {
  const [card, setCard] = useState(() => getCard(id))
  const status = wordStatus(card)
  const wait = card ? card.due - Date.now() : 0
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-xs font-medium',
          status === 'known' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : status === 'learning' ? 'bg-accent-soft text-accent dark:bg-accent/15'
          : 'bg-stone-100 text-stone-500 dark:bg-stone-800',
        )}
      >
        {status === 'known' ? 'Learned' : status === 'learning' ? 'Learning' : 'New'}
      </span>
      {card && <span className="text-xs text-stone-400">{wait > 0 ? `Next review in ${formatDelay(wait)}` : 'Due now'}</span>}
      {card ? (
        <TextButton onClick={() => { resetWord(id); setCard(undefined) }}>Start over</TextButton>
      ) : (
        <TextButton onClick={() => setCard(saveCard(id, markKnown()))}>I already know this</TextButton>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-stone-400">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export function Example({ ex }: { ex: WordExample }) {
  return (
    <div>
      <JP as="p" text={ex.ja} className="text-lg leading-loose" />
      {ex.romaji && <p className="text-sm italic text-stone-400">{ex.romaji}</p>}
      {ex.en && <p className="text-sm text-stone-500">{ex.en}</p>}
    </div>
  )
}

function NavLink({ word, dir, onClick }: { word?: Word; dir: 'prev' | 'next'; onClick: () => void }) {
  if (!word) return <span />
  return (
    <button onClick={onClick} className={cn('group text-stone-500 hover:text-stone-900 dark:hover:text-stone-100', dir === 'next' && 'text-right')}>
      <span className="block text-xs text-stone-400">{dir === 'prev' ? '← Previous' : 'Next →'}</span>
      <span className="font-jp text-base">{word.word}</span>
    </button>
  )
}

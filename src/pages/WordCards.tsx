import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Centered, Layout, ProgressBar } from '../components/Layout'
import { JP } from '../components/JP'
import { usePrefs } from '../lib/prefs'
import type { Level, Word } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { pickCards, setStatus, wordStats, type CardSet, type WordStatus } from '../lib/words'
import { Example } from './WordDetail'

/**
 * Flashcards from the vocabulary list: see the word, recall it, flip, then
 * mark it "still learning" or "know it". Marks show up in the word list.
 */
export function WordCards({ level, words, set: initialSet }: { level: Level; words: Word[]; set: CardSet }) {
  const navigate = useNavigate()
  const { prefs } = usePrefs()
  const [set, setSet] = useState(initialSet)
  const [cards, setCards] = useState(() => pickCards(words, initialSet, prefs.setSize))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [tally, setTally] = useState({ learning: 0, known: 0 })

  const done = index >= cards.length
  const w = cards[index]
  const list = `/${level.toLowerCase()}/learn/vocab`

  const mark = (s: WordStatus) => {
    if (!flipped) return
    setStatus(w.id, s)
    setTally((t) => ({ ...t, [s]: t[s] + 1 }))
    setFlipped(false)
    setIndex((i) => i + 1)
  }
  const restart = (s: CardSet) => {
    setSet(s)
    setCards(pickCards(words, s, prefs.setSize))
    setIndex(0)
    setFlipped(false)
    setTally({ learning: 0, known: 0 })
  }

  useKeys((e) => {
    if (done) return
    if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setFlipped(true) }
    else if (flipped && e.key === '1') mark('learning')
    else if (flipped && e.key === '2') mark('known')
  })

  const back = { to: list, label: 'Word list' }
  const title = set === 'new' ? 'New words' : 'Learning'

  if (cards.length === 0) {
    return (
      <Layout back={back} title={title}>
        <Centered>{set === 'new' ? 'Every word is marked. Nice work.' : 'No words marked “learning” yet.'}</Centered>
      </Layout>
    )
  }

  if (done) {
    const stats = wordStats(words)
    return (
      <Layout back={back} title={title}>
        <div className="py-12 text-center">
          <p className="text-sm uppercase tracking-widest text-stone-400">Set complete</p>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            <span className="text-emerald-600 dark:text-emerald-400">{tally.known} known</span>
            <span className="text-stone-300"> · </span>
            <span className="text-accent">{tally.learning} still learning</span>
          </p>
          <div className="mx-auto mt-8 max-w-xs">
            <ProgressBar value={stats.known} max={stats.total} />
            <p className="mt-2 text-xs tabular-nums text-stone-400">{stats.known} of {stats.total} words known · {stats.learning} learning</p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button onClick={() => restart('new')}>Next new words</Button>
            {stats.learning > 0 && <Button variant="outline" onClick={() => restart('learning')}>Review learning ({stats.learning})</Button>}
            <Button variant="ghost" onClick={() => navigate(list)}>Word list</Button>
          </div>
        </div>
      </Layout>
    )
  }

  const example = w.examples[0] ?? w.inBank[0]
  return (
    <Layout back={back} title={title} right={<span className="text-xs tabular-nums text-stone-400">{index + 1}/{cards.length}</span>}>
      <ProgressBar value={index + (flipped ? 1 : 0)} max={cards.length} />

      <button
        onClick={() => setFlipped(true)}
        disabled={flipped}
        className="mt-8 block w-full rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center transition enabled:hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900"
      >
        <p className="font-jp text-5xl tracking-wide">{w.word}</p>
        {!flipped && <p className="mt-6 text-sm text-stone-400">Reading and meaning? Tap or press Space</p>}
        {flipped && (
          <div className="mt-6 space-y-2">
            {w.kana && <p className="font-jp text-xl text-stone-500">{w.kana}</p>}
            <p className="text-lg">{w.meaning}</p>
            {w.type && <p className="text-xs uppercase tracking-widest text-stone-400">{w.type}</p>}
          </div>
        )}
      </button>

      {flipped && example && (
        <div className="mt-6 rounded-xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
          <Example ex={example} />
        </div>
      )}
      {flipped && !example && w.spellings && (
        <JP as="p" text={`Also written ${w.spellings.join('、')}`} className="mt-6 text-center text-sm text-stone-500" />
      )}

      <div className="mt-8 flex h-12 items-center justify-between gap-3">
        <p className="text-sm text-stone-400">{flipped ? '1 still learning · 2 know it' : ''}</p>
        {flipped && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => mark('learning')}>Still learning</Button>
            <Button onClick={() => mark('known')}>Know it</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}

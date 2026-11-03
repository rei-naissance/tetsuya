import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Actions, Button, Layout, ProgressBar, TextButton } from '../components/Layout'
import { JP } from '../components/JP'
import { StudyOptions } from '../components/StudyOptions'
import { usePrefs } from '../lib/prefs'
import type { Limits } from '../lib/srs'
import type { Level, Word } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { useSrsSession } from '../lib/useSrsSession'
import { wordDeck, wordStats } from '../lib/words'
import { GradeButtons, SessionCounts, SessionDone } from './Review'
import { Example } from './WordDetail'

/**
 * Vocabulary flashcards with spaced repetition: see the word, recall its
 * reading and meaning, flip, then grade yourself. New words come in list
 * order, up to the daily limit; due words come back on their own schedule.
 * With `aheadDays` it reviews words due soon, early.
 */
export function WordCards({ level, words, aheadDays }: { level: Level; words: Word[]; aheadDays?: number }) {
  const navigate = useNavigate()
  const { limits } = usePrefs()
  const deck = wordDeck(level)
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])
  const [round, setRound] = useState(0) // bumped by custom study to start a fresh session
  const list = `/${level.toLowerCase()}/learn/vocab`

  return (
    <Session
      key={round}
      words={words}
      byId={byId}
      deck={deck}
      limits={limits}
      aheadDays={aheadDays}
      back={{ to: list, label: 'Word list' }}
      onRestart={() => setRound((r) => r + 1)}
      onAhead={(d) => navigate(`${list}/cards?ahead=${d}`)}
    />
  )
}

function Session({ words, byId, deck, limits, aheadDays, back, onRestart, onAhead }: {
  words: Word[]
  byId: Map<string, Word>
  deck: string
  limits: Limits
  aheadDays?: number
  back: { to: string; label: string }
  onRestart: () => void
  onAhead: (days: number) => void
}) {
  const navigate = useNavigate()
  const ids = useMemo(() => words.map((w) => w.id), [words])
  const s = useSrsSession(ids, deck, limits, { newOrder: true, aheadDays })
  const [flipped, setFlipped] = useState(false)
  const [initial] = useState(s.counts.fresh + s.counts.learning + s.counts.review)
  const w = s.current ? byId.get(s.current) : undefined

  const grade = (g: Parameters<typeof s.grade>[0]) => {
    if (!flipped) return
    s.grade(g)
    setFlipped(false)
  }

  useKeys((e) => {
    if (!w) return
    if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setFlipped(true); return }
    if (!flipped) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); grade('good') }
    else if (e.key === '1') grade('again')
    else if (e.key === '2') grade('good')
  })

  if (!w || !s.card) {
    const stats = wordStats(words)
    return (
      <Layout back={back} title={aheadDays ? 'Flashcards · ahead' : 'Flashcards'}>
        <SessionDone tally={s.tally} ids={ids}>
          <div className="mx-auto mt-8 max-w-xs">
            <ProgressBar value={stats.known} max={stats.total} />
            <p className="mt-2 text-xs tabular-nums text-stone-400">
              {stats.known} of {stats.total} words learned · {stats.learning} in progress · {stats.fresh} new
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <StudyOptions compact ids={ids} deck={deck} onChange={onRestart} onAhead={onAhead} />
          </div>
          <Actions align="center" className="mt-8">
            <Button variant="secondary" onClick={() => navigate(back.to)}>Word list</Button>
          </Actions>
        </SessionDone>
      </Layout>
    )
  }

  const left = s.counts.fresh + s.counts.learning + s.counts.review
  const example = w.examples[0] ?? w.inBank[0]
  return (
    <Layout back={back} title={aheadDays ? 'Flashcards · ahead' : 'Flashcards'} right={<SessionCounts counts={s.counts} />}>
      <ProgressBar value={Math.max(0, initial - left)} max={Math.max(initial, left)} />

      <button
        onClick={() => setFlipped(true)}
        disabled={flipped}
        className="mt-8 block w-full rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center transition enabled:hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900"
      >
        {s.isNew && <p className="mb-4 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent dark:bg-accent/15">New</p>}
        <p lang="ja" className="font-jp text-5xl tracking-wide">{w.word}</p>
        {!flipped && <p className="mt-6 text-sm text-stone-400">Reading and meaning? Tap or press Space</p>}
        {flipped && (
          <div className="mt-6 space-y-2">
            {w.kana && <p lang="ja" className="font-jp text-xl text-stone-500">{w.kana}</p>}
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

      <div className="mt-8 min-h-20">
        {flipped ? (
          <GradeButtons card={s.card} onGrade={grade} />
        ) : (
          <Actions align="between">
            <p className="text-sm text-stone-400">Space to flip</p>
            {s.isNew && <TextButton onClick={() => s.knowIt()}>I already know this</TextButton>}
          </Actions>
        )}
      </div>
    </Layout>
  )
}

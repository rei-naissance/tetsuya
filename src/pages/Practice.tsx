import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Centered, Layout, ProgressBar } from '../components/Layout'
import { QuestionView } from '../components/QuestionView'
import { usePrefs } from '../lib/prefs'
import { pickSet, progressStats, recordAttempt, type SetMode } from '../lib/progress'
import { shuffleChoices } from '../lib/random'
import type { Level, Question, Section } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { kindTitle } from './Review'

/**
 * A short practice set with instant feedback (grammar, reading, listening).
 * Every answer is recorded, so the next set starts with unseen questions and
 * "mistakes" mode replays the ones last answered wrong. Passages stay together.
 */
export function Practice({ level, section, kind, pool, mode, back: backTo, title: titleText }: {
  level: Level
  section: Section
  kind: string
  pool: Question[]
  mode: SetMode
  /** Overrides for drills outside the section pages (learn mode). */
  back?: { to: string; label: string }
  title?: ReactNode
}) {
  const navigate = useNavigate()
  const { prefs } = usePrefs()
  const makeSet = (m: SetMode) => pickSet(pool, prefs.setSize, m).map(shuffleChoices)
  const [setMode, setSetMode] = useState(mode)
  const [set, setSet] = useState(() => makeSet(mode))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)

  const done = index >= set.length
  const q = set[index]
  const reveal = selected !== null

  const choose = (i: number) => {
    if (reveal) return
    setSelected(i)
    recordAttempt(q.id, i === q.answer)
    if (i === q.answer) setCorrect((c) => c + 1)
  }
  const next = () => {
    setSelected(null)
    setIndex((i) => i + 1)
    window.scrollTo(0, 0)
  }
  const restart = (m: SetMode) => {
    setSetMode(m)
    setSet(makeSet(m))
    setIndex(0)
    setSelected(null)
    setCorrect(0)
  }

  useKeys((e) => {
    if (done) return
    const n = Number(e.key)
    if (!reveal && n >= 1 && n <= q.choices.length) choose(n - 1)
    else if (reveal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next() }
  })

  const back = backTo ?? { to: `/${level.toLowerCase()}/study/${section}`, label: 'Types' }
  const title = titleText ?? kindTitle(section, kind, setMode === 'mistakes')

  if (set.length === 0) {
    return (
      <Layout back={back} title={title}>
        <Centered>No mistakes to retry. Nice work.</Centered>
      </Layout>
    )
  }

  if (done) {
    const pct = Math.round((correct / set.length) * 100)
    const stats = progressStats(pool.map((p) => p.id))
    return (
      <Layout back={back} title={title}>
        <div className="py-12 text-center">
          <p className="text-sm uppercase tracking-widest text-stone-400">Set complete</p>
          <p className="mt-4 text-7xl font-semibold tracking-tighter">{pct}<span className="text-3xl text-stone-400">%</span></p>
          <p className="mt-2 text-stone-500">{correct} of {set.length} correct</p>
          <div className="mx-auto mt-8 max-w-xs">
            <ProgressBar value={stats.right} max={stats.total} />
            <p className="mt-2 text-xs tabular-nums text-stone-400">
              {stats.seen} of {stats.total} tried · {stats.right} right{stats.wrong > 0 && ` · ${stats.wrong} to retry`}
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button onClick={() => restart('next')}>Next set</Button>
            {stats.wrong > 0 && <Button variant="outline" onClick={() => restart('mistakes')}>Retry mistakes ({stats.wrong})</Button>}
            <Button variant="ghost" onClick={() => navigate(back.to)}>{backTo ? back.label : 'All types'}</Button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout back={back} title={title} right={<span className="text-xs tabular-nums text-stone-400">{index + 1}/{set.length}</span>}>
      <ProgressBar value={index + (reveal ? 1 : 0)} max={set.length} />
      <div className="mt-8">
        <QuestionView key={q.id} q={q} selected={selected} reveal={reveal} onSelect={choose} showSection={kind === 'all'} />
      </div>
      <div className="mt-8 flex h-12 items-center justify-between">
        <p className="text-sm text-stone-400">
          {reveal ? (selected === q.answer ? <span className="text-emerald-600">Correct</span> : <span className="text-rose-500">Not quite</span>) : 'Press 1–4 to answer'}
        </p>
        {reveal && <Button onClick={next}>{index + 1 === set.length ? 'See results' : 'Next'} <span aria-hidden>→</span></Button>}
      </div>
    </Layout>
  )
}

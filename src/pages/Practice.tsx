import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, ProgressBar } from '../components/Layout'
import { QuestionView } from '../components/QuestionView'
import { sample, shuffleChoices } from '../lib/random'
import type { Level, Question, Section } from '../lib/types'
import { SECTION_META } from '../lib/types'
import { useKeys } from '../lib/useKeys'

export const PRACTICE_SET_SIZE = 10

/** One-off practice set with instant feedback (grammar, reading, listening). */
export function Practice({ level, section, pool }: { level: Level; section: Section; pool: Question[] }) {
  const navigate = useNavigate()
  const makeSet = () => sample(pool, PRACTICE_SET_SIZE).map(shuffleChoices)
  const [set, setSet] = useState(makeSet)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)

  const done = index >= set.length
  const q = set[index]
  const reveal = selected !== null

  const choose = (i: number) => {
    if (reveal) return
    setSelected(i)
    if (i === q.answer) setCorrect((c) => c + 1)
  }
  const next = () => {
    setSelected(null)
    setIndex((i) => i + 1)
  }
  const restart = () => {
    setSet(makeSet())
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

  const back = { to: `/${level.toLowerCase()}`, label: level }
  const title = <span>{SECTION_META[section].label} <span className="font-jp text-stone-400">{SECTION_META[section].jp}</span></span>

  if (done) {
    const pct = Math.round((correct / set.length) * 100)
    return (
      <Layout back={back} title={title}>
        <div className="py-12 text-center">
          <p className="text-sm uppercase tracking-widest text-stone-400">Set complete</p>
          <p className="mt-4 text-7xl font-semibold tracking-tighter">{pct}<span className="text-3xl text-stone-400">%</span></p>
          <p className="mt-2 text-stone-500">{correct} of {set.length} correct</p>
          <div className="mt-10 flex justify-center gap-3">
            <Button onClick={restart}>New set</Button>
            <Button variant="outline" onClick={() => navigate(back.to)}>Back to {level}</Button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout back={back} title={title} right={<span className="text-xs tabular-nums text-stone-400">{index + 1}/{set.length}</span>}>
      <ProgressBar value={index + (reveal ? 1 : 0)} max={set.length} />
      <div className="mt-8">
        <QuestionView key={q.id} q={q} selected={selected} reveal={reveal} onSelect={choose} />
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

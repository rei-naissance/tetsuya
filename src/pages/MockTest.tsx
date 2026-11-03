import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, ProgressBar } from '../components/Layout'
import { QuestionView } from '../components/QuestionView'
import { bySection } from '../lib/data'
import { saveResult, type MockResult } from '../lib/history'
import { sampleGrouped, shuffleChoices } from '../lib/random'
import type { Level, Question, Section } from '../lib/types'
import { SECTION_META, SECTIONS } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { cn } from '../lib/cn'

/** Questions drawn per section (reading may run slightly over to keep a passage whole). */
export const MOCK_PLAN: Record<Section, number> = { kanji: 6, vocabulary: 6, grammar: 6, reading: 6, listening: 6 }

/** Rough overall pass marks (official: N4 90/180, N3 95/180, plus sectional minimums). */
const PASS_MARK: Record<Level, number> = { N4: 0.5, N3: 0.53 }

function buildTest(questions: Question[]): Question[] {
  // Grouped sampling keeps a reading passage's questions together.
  return SECTIONS.flatMap((s) => sampleGrouped(bySection(questions, s), MOCK_PLAN[s]).map(shuffleChoices))
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function MockTest({ level, questions }: { level: Level; questions: Question[] }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'intro' | 'test' | 'results'>('intro')
  const [test, setTest] = useState<Question[]>([])
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [index, setIndex] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<MockResult | null>(null)

  useEffect(() => {
    if (phase !== 'test') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, startedAt])

  const start = () => {
    const t = buildTest(questions)
    setTest(t)
    setAnswers(t.map(() => null))
    setIndex(0)
    setStartedAt(Date.now())
    setElapsed(0)
    setPhase('test')
  }

  const submit = () => {
    const unanswered = answers.filter((a) => a === null).length
    if (unanswered && !confirm(`${unanswered} question${unanswered > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) return
    const bySec: MockResult['bySection'] = {}
    let correct = 0
    test.forEach((q, i) => {
      const s = (bySec[q.section] ??= { correct: 0, total: 0 })
      s.total++
      if (answers[i] === q.answer) { s.correct++; correct++ }
    })
    const r: MockResult = {
      level, date: Date.now(), correct, total: test.length,
      seconds: Math.floor((Date.now() - startedAt) / 1000), bySection: bySec,
    }
    saveResult(r)
    setResult(r)
    setPhase('results')
    window.scrollTo(0, 0)
  }

  const answer = (i: number) => setAnswers((a) => a.map((v, j) => (j === index ? i : v)))
  const go = (i: number) => { setIndex(Math.max(0, Math.min(test.length - 1, i))); window.scrollTo(0, 0) }

  useKeys((e) => {
    if (phase !== 'test') return
    const n = Number(e.key)
    if (n >= 1 && n <= test[index].choices.length) answer(n - 1)
    else if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
  })

  const back = { to: `/${level.toLowerCase()}`, label: level }
  const plan = useMemo(
    () => SECTIONS.map((s) => [s, Math.min(MOCK_PLAN[s], bySection(questions, s).length)] as const).filter(([, n]) => n > 0),
    [questions],
  )
  const planTotal = plan.reduce((sum, [, n]) => sum + n, 0)

  if (phase === 'intro') {
    return (
      <Layout back={back} title={`${level} mock test`}>
        <p className="font-jp text-sm tracking-[0.3em] text-accent">模擬試験</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{level} Mock test</h1>
        <p className="mt-3 text-stone-500">
          About {planTotal} questions drawn at random from your question bank. No feedback until you submit — just like the real thing.
        </p>
        <ul className="mt-8 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {plan.map(([s, n]) => (
            <li key={s} className="flex items-center justify-between px-5 py-3.5">
              <span>{SECTION_META[s].label} <span className="ml-1 font-jp text-sm text-stone-400">{SECTION_META[s].jp}</span></span>
              <span className="tabular-nums text-stone-500">{n}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-4">
          <Button onClick={start} disabled={planTotal === 0}>Begin test</Button>
          <span className="text-sm text-stone-400">Keys: 1–4 answer · ← → move</span>
        </div>
      </Layout>
    )
  }

  if (phase === 'results' && result) {
    const pct = Math.round((result.correct / result.total) * 100)
    const passed = result.correct / result.total >= PASS_MARK[level]
    const missed = test.map((q, i) => ({ q, picked: answers[i] })).filter(({ q, picked }) => picked !== q.answer)
    return (
      <Layout back={back} title={`${level} mock test`}>
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-stone-400">Your score</p>
          <p className="mt-3 text-8xl font-semibold tracking-tighter">{pct}<span className="text-4xl text-stone-400">%</span></p>
          <p className="mt-2 text-stone-500">{result.correct} / {result.total} correct · {fmtTime(result.seconds)}</p>
          <p className={cn('mt-4 inline-block rounded-full px-3 py-1 text-xs font-medium', passed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300')}>
            {passed ? 'Above' : 'Below'} the approximate {level} pass mark ({Math.round(PASS_MARK[level] * 100)}%)
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {SECTIONS.filter((s) => result.bySection[s]).map((s) => {
            const { correct, total } = result.bySection[s]!
            return (
              <div key={s}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{SECTION_META[s].label} <span className="ml-1 font-jp text-stone-400">{SECTION_META[s].jp}</span></span>
                  <span className="tabular-nums text-stone-500">{correct}/{total}</span>
                </div>
                <ProgressBar value={correct} max={total} />
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button onClick={start}>New mock test</Button>
          <Button variant="outline" onClick={() => navigate(back.to)}>Back to {level}</Button>
        </div>

        {missed.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-stone-400">Review mistakes ({missed.length})</h2>
            <div className="space-y-3">
              {missed.map(({ q, picked }) => (
                <details key={q.id} className="group rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <span className="truncate font-jp text-sm">
                      <span className="mr-2 text-xs uppercase tracking-wider text-stone-400">{SECTION_META[q.section].label}</span>
                      {picked === null ? <span className="text-stone-400">Unanswered</span> : <>Correct: <b className="font-medium">{q.choices[q.answer]}</b></>}
                    </span>
                    <span className="text-stone-400 transition group-open:rotate-90" aria-hidden>›</span>
                  </summary>
                  <div className="border-t border-stone-200 px-5 py-6 dark:border-stone-800">
                    <QuestionView q={q} selected={picked} reveal onSelect={() => {}} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </Layout>
    )
  }

  const q = test[index]
  const answeredCount = answers.filter((a) => a !== null).length
  const isLast = index === test.length - 1
  return (
    <Layout
      back={back}
      title={<span className="tabular-nums">{index + 1} / {test.length}</span>}
      right={<span className="font-mono text-xs tabular-nums text-stone-400">{fmtTime(elapsed)}</span>}
    >
      <ProgressBar value={answeredCount} max={test.length} />
      <div className="mt-8">
        <QuestionView key={q.id} q={q} selected={answers[index]} reveal={false} onSelect={answer} showSection />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>← Previous</Button>
        {isLast
          ? <Button onClick={submit}>Submit test</Button>
          : <Button variant={answers[index] === null ? 'outline' : 'primary'} onClick={() => go(index + 1)}>Next →</Button>}
      </div>

      <nav className="mt-12 border-t border-stone-200 pt-6 dark:border-stone-800" aria-label="Question navigator">
        <div className="flex flex-wrap gap-1.5">
          {test.map((tq, i) => (
            <button
              key={tq.id}
              onClick={() => go(i)}
              title={SECTION_META[tq.section].label}
              className={cn(
                'size-8 rounded-lg text-xs tabular-nums transition',
                i === index ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : answers[i] !== null ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200'
                : 'border border-stone-200 text-stone-400 hover:border-stone-400 dark:border-stone-800',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {!isLast && (
          <button onClick={submit} className="mt-4 text-xs text-stone-400 underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-stone-100">
            Submit early
          </button>
        )}
      </nav>
    </Layout>
  )
}

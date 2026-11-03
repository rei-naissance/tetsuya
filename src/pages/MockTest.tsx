import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Actions, Button, Layout, ProgressBar, TextButton } from '../components/Layout'
import { QuestionView } from '../components/QuestionView'
import { saveResult, type MockResult } from '../lib/history'
import { buildMock, JLPT_FORMAT, type MockQuestion, type Shortfall } from '../lib/mock'
import type { Level, Question } from '../lib/types'
import { SECTION_META, SECTIONS } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { cn } from '../lib/cn'

/** Rough overall pass marks (official: N4 90/180, N3 95/180, plus sectional minimums). */
const PASS_MARK: Record<Level, number> = { N4: 0.5, N3: 0.53 }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * A mock JLPT in the official layout: three papers in order, each with its
 * own countdown. When a paper's time runs out (or you finish it early) it
 * locks and the next one starts. No feedback until the end.
 */
export function MockTest({ level, questions }: { level: Level; questions: Question[] }) {
  const navigate = useNavigate()
  const papers = JLPT_FORMAT[level]
  const preview = useMemo(() => buildMock(level, questions), [level, questions])
  const [phase, setPhase] = useState<'intro' | 'test' | 'results'>('intro')
  const [test, setTest] = useState<MockQuestion[]>([])
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [index, setIndex] = useState(0)
  const [paper, setPaper] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<MockResult | null>(null)
  const finishing = useRef(false)

  const paperIdx = useMemo(() => test.map((q, i) => (q.paper === paper ? i : -1)).filter((i) => i >= 0), [test, paper])
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))

  const start = () => {
    const { test: t } = buildMock(level, questions)
    setTest(t)
    setAnswers(t.map(() => null))
    setResult(null)
    setStartedAt(Date.now())
    openPaper(t, 0)
    setPhase('test')
  }

  const openPaper = (t: MockQuestion[], p: number) => {
    // Skip a paper with no questions (a bank missing a whole section).
    const first = t.findIndex((q) => q.paper === p)
    if (first < 0) {
      if (p + 1 < papers.length) openPaper(t, p + 1)
      else finish()
      return
    }
    setPaper(p)
    setIndex(first)
    setDeadline(Date.now() + papers[p].minutes * 60_000)
    setNow(Date.now())
    finishing.current = false
    window.scrollTo(0, 0)
  }

  const finish = () => {
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

  /** Locks the current paper and moves on (or ends the test after the last). */
  const endPaper = () => {
    if (finishing.current) return
    finishing.current = true
    if (paper + 1 < papers.length) openPaper(test, paper + 1)
    else finish()
  }

  const finishEarly = () => {
    const open = paperIdx.filter((i) => answers[i] === null).length
    const next = paper + 1 < papers.length ? `move on to ${papers[paper + 1].jp}` : 'submit the test'
    const warn = open ? `${open} question${open > 1 ? 's are' : ' is'} unanswered. ` : ''
    if (confirm(`${warn}Finish ${papers[paper].jp} and ${next}? You can't come back to this paper.`)) endPaper()
  }

  useEffect(() => {
    if (phase !== 'test') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'test' && deadline && now >= deadline) endPaper()
  })

  const answer = (i: number) => setAnswers((a) => a.map((v, j) => (j === index ? i : v)))
  const go = (pos: number) => {
    const clamped = Math.max(0, Math.min(paperIdx.length - 1, pos))
    setIndex(paperIdx[clamped])
    window.scrollTo(0, 0)
  }
  const pos = paperIdx.indexOf(index)

  useKeys((e) => {
    if (phase !== 'test') return
    const n = Number(e.key)
    if (n >= 1 && n <= test[index].choices.length) answer(n - 1)
    else if (e.key === 'ArrowRight') go(pos + 1)
    else if (e.key === 'ArrowLeft') go(pos - 1)
  })

  const back = { to: `/${level.toLowerCase()}`, label: level }

  if (phase === 'intro') {
    const total = papers.reduce((n, p) => n + p.mondai.reduce((m, x) => m + x.count, 0), 0)
    const minutes = papers.reduce((n, p) => n + p.minutes, 0)
    return (
      <Layout back={back} title={`${level} mock test`}>
        <p className="font-jp text-sm tracking-[0.3em] text-accent">模擬試験</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{level} Mock test</h1>
        <p className="mt-3 text-stone-500">
          The official {level} layout: {total} questions in three timed papers, {minutes} minutes in all.
          Each paper has its own countdown; when it reaches zero the paper closes and the next one starts.
          No feedback until the end, just like the real thing.
        </p>

        <div className="mt-8 space-y-4">
          {papers.map((p, i) => (
            <section key={p.jp} className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
              <header className="flex items-baseline justify-between gap-4 border-b border-stone-200 px-5 py-3.5 dark:border-stone-800">
                <span className="font-medium"><span className="font-jp">{p.jp}</span> <span className="ml-1 text-sm font-normal text-stone-400">{p.label}</span></span>
                <span className="shrink-0 text-sm tabular-nums text-stone-500">{p.minutes} min</span>
              </header>
              <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800/60">
                {p.mondai.map((m) => {
                  const s = preview.short.find((x) => x.paper === i && x.mondai === m)
                  return (
                    <li key={m.jp} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
                      <span><span className="font-jp">{m.jp}</span> <span className="ml-1 text-stone-400">{m.label}</span></span>
                      <span className={cn('shrink-0 tabular-nums', s ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500')}>
                        {s ? `${s.got} of ${m.count}` : m.count}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
        <ShortNote short={preview.short} />

        <Actions className="mt-8">
          <Button onClick={start} disabled={preview.test.length === 0}>Begin test</Button>
          <span className="text-sm text-stone-400">Keys: 1–4 answer · ← → move</span>
        </Actions>
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

        <Actions align="center" className="mt-10">
          <Button onClick={start}>New test</Button>
          <Button variant="secondary" onClick={() => navigate(back.to)}>Back to {level}</Button>
        </Actions>

        {missed.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-stone-400">Review mistakes ({missed.length})</h2>
            <div className="space-y-3">
              {missed.map(({ q, picked }) => (
                <details key={q.id} className="group rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <span className="truncate font-jp text-sm">
                      <span className="mr-2 text-xs tracking-wider text-stone-400">{q.mondai}</span>
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
  const answeredCount = paperIdx.filter((i) => answers[i] !== null).length
  const isLast = pos === paperIdx.length - 1
  const lastPaper = paper === papers.length - 1
  return (
    <Layout
      back={back}
      title={<span><span className="tabular-nums text-stone-400">{pos + 1}/{paperIdx.length}</span> <span className="font-jp">{papers[paper].jp}</span></span>}
      right={
        <span className={cn('font-mono text-xs tabular-nums', remaining <= 300 ? 'font-semibold text-rose-500' : 'text-stone-500')} title="Time left in this paper">
          {fmtTime(remaining)}
        </span>
      }
    >
      <ProgressBar value={answeredCount} max={paperIdx.length} />
      <p className="mt-6 font-jp text-xs tracking-wider text-stone-400">{q.mondai}</p>
      <div className="mt-3">
        <QuestionView key={q.id} q={q} selected={answers[index]} reveal={false} onSelect={answer} autoPlay />
      </div>

      <Actions align="between" className="mt-8 min-h-11">
        <Button variant="ghost" onClick={() => go(pos - 1)} disabled={pos === 0}>← Previous</Button>
        {isLast
          ? <Button onClick={finishEarly}>{lastPaper ? 'Submit' : 'Finish paper'}</Button>
          : <Button variant={answers[index] === null ? 'secondary' : 'primary'} onClick={() => go(pos + 1)}>Next →</Button>}
      </Actions>

      <nav className="mt-12 border-t border-stone-200 pt-6 dark:border-stone-800" aria-label="Question navigator">
        <p className="mb-3 text-xs text-stone-400">
          Paper {paper + 1} of {papers.length} · {answeredCount}/{paperIdx.length} answered
        </p>
        <div className="flex flex-wrap gap-1.5">
          {paperIdx.map((qi, i) => (
            <button
              key={test[qi].id}
              onClick={() => go(i)}
              title={test[qi].mondai}
              className={cn(
                'size-8 rounded-lg text-xs tabular-nums transition',
                qi === index ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : answers[qi] !== null ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200'
                : 'border border-stone-200 text-stone-400 hover:border-stone-400 dark:border-stone-800',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        {!isLast && (
          <TextButton onClick={finishEarly} className="mt-4">
            {lastPaper ? 'Submit early' : 'Finish this paper early'}
          </TextButton>
        )}
      </nav>
    </Layout>
  )
}

function ShortNote({ short }: { short: Shortfall[] }) {
  if (!short.length) return null
  return (
    <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
      This test doesn't have enough{' '}
      {short.map((s, i) => (
        <span key={s.mondai.jp}>{i > 0 && (i === short.length - 1 ? ' or ' : ', ')}<span className="font-jp">{s.mondai.jp}</span></span>
      ))}{' '}
      questions, so it's shorter than the real one there. The time limits are the official ones.
    </p>
  )
}

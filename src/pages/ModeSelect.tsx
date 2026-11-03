import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Centered, Layout } from '../components/Layout'
import { byKind, bySection } from '../lib/data'
import { clearHistory, loadHistory } from '../lib/history'
import { progressStats, resetAttempts, type ProgressStats } from '../lib/progress'
import { deckId, deckStats, resetSrs } from '../lib/srs'
import type { Level, Section } from '../lib/types'
import { KINDS, SECTION_META, SECTIONS, SRS_SECTIONS } from '../lib/types'
import { useQuestions } from '../lib/useQuestions'
import { resetWordStatus, useWords, wordStats } from '../lib/words'
import { cn } from '../lib/cn'

export function ModeSelect({ level }: { level: Level }) {
  const data = useQuestions(level)
  const words = useWords(level)
  const [version, setVersion] = useState(0) // bumped to recompute stats after a reset
  const lastMock = loadHistory(level)[0]
  const base = `/${level.toLowerCase()}`

  const stats = useMemo(() => {
    if (data.status !== 'ready') return null
    return Object.fromEntries(
      SECTIONS.map((s) => {
        const ids = bySection(data.questions, s).map((q) => q.id)
        if (!SRS_SECTIONS.includes(s)) return [s, { count: ids.length, srs: null, practice: progressStats(ids) }]
        // SRS decks are per question type; add them up for the section card.
        const srs = KINDS[s]
          .map((k) => deckStats(byKind(data.questions, s, k.id).map((q) => q.id), deckId(level, s, k.id)))
          .reduce((a, b) => ({ due: a.due + b.due, fresh: a.fresh + b.fresh, learned: a.learned + b.learned, total: a.total + b.total }))
        return [s, { count: ids.length, srs, practice: null }]
      }),
    ) as Record<Section, { count: number; srs: ReturnType<typeof deckStats> | null; practice: ProgressStats | null }>
  }, [data, level, version])

  const vocab = useMemo(() => (words.status === 'ready' ? wordStats(words.words) : null), [words, version])

  const reset = () => {
    if (!confirm('Reset ALL spaced-repetition progress, practice history, word marks and mock-test history (both levels)? This cannot be undone.')) return
    resetSrs()
    resetAttempts()
    resetWordStatus()
    clearHistory()
    setVersion((n) => n + 1)
  }

  return (
    <Layout back={{ to: '/levels', label: 'Levels' }} title={`JLPT ${level}`}>
      {data.status === 'loading' && <Centered>Loading questions…</Centered>}
      {data.status === 'error' && (
        <Centered>
          <div>
            <p className="font-medium text-stone-900 dark:text-stone-100">Couldn't load the {level} question set.</p>
            <p className="mt-1 text-sm">{data.error}</p>
          </div>
        </Centered>
      )}
      {stats && (
        <>
          <Link
            to={`${base}/mock`}
            className="group flex items-center justify-between gap-6 rounded-3xl bg-stone-900 p-7 text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            <div>
              <p className="font-jp text-xs tracking-[0.25em] text-stone-400 dark:text-stone-500">模擬試験</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Mock test</h2>
              <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                A randomized set from all five sections, scored at the end.
              </p>
              {lastMock && (
                <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
                  Last score: <span className="font-medium text-white dark:text-stone-900">{Math.round((lastMock.correct / lastMock.total) * 100)}%</span>
                  {' · '}
                  {new Date(lastMock.date).toLocaleDateString()}
                </p>
              )}
            </div>
            <span className="text-2xl transition group-hover:translate-x-1" aria-hidden>→</span>
          </Link>

          <h2 className="mb-4 mt-12 text-sm font-medium uppercase tracking-widest text-stone-400">Practice by section</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const { count, srs, practice } = stats[s]
              const empty = count === 0
              const nothingToDo = srs && srs.due + srs.fresh === 0
              return (
                <Link
                  key={s}
                  to={`${base}/study/${s}`}
                  aria-disabled={empty}
                  onClick={(e) => empty && e.preventDefault()}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition dark:border-stone-800 dark:bg-stone-900',
                    empty ? 'cursor-not-allowed opacity-50' : 'hover:border-stone-900 dark:hover:border-stone-400',
                  )}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-stone-100 font-jp-serif text-lg dark:bg-stone-800">
                    {SECTION_META[s].jp}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{SECTION_META[s].label}</p>
                    <p className="truncate text-sm text-stone-500">
                      {empty ? 'No questions yet' : srs ? (
                        nothingToDo ? 'All caught up' : (
                          <>
                            {srs.due > 0 && <span className="font-medium text-accent">{srs.due} due</span>}
                            {srs.due > 0 && srs.fresh > 0 && ' · '}
                            {srs.fresh > 0 && `${srs.fresh} new`}
                          </>
                        )
                      ) : practice && practice.seen > 0 ? `${practice.seen} of ${count} tried · ${practice.right} right` : `${count} questions`}
                    </p>
                  </div>
                  {srs && !empty && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent dark:bg-accent/15">
                      SRS
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          <h2 className="mb-4 mt-12 text-sm font-medium uppercase tracking-widest text-stone-400">Learn</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {vocab && (
              <LearnCard to={`${base}/learn/vocab`} jp="単語" label="Vocabulary list">
                {vocab.known + vocab.learning > 0
                  ? `${vocab.known} of ${vocab.total} known · ${vocab.learning} learning`
                  : `${vocab.total} words · examples, flashcards`}
              </LearnCard>
            )}
            <LearnCard to={`${base}/learn/grammar`} jp="文型" label="Grammar patterns">
              Meaning, form, examples, drills
            </LearnCard>
            <LearnCard to={`${base}/learn/particles`} jp="助詞" label="Particles">
              に vs で, まで vs までに, には…
            </LearnCard>
          </div>

          <div className="mt-16 flex justify-center">
            <button onClick={reset} className="text-xs text-stone-400 underline-offset-4 hover:text-rose-500 hover:underline">
              Reset progress
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}

function LearnCard({ to, jp, label, children }: { to: string; jp: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft font-jp-serif text-lg text-accent dark:bg-accent/15">{jp}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="truncate font-jp text-sm text-stone-500">{children}</p>
      </div>
    </Link>
  )
}

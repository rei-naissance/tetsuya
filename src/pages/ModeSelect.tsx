import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Centered, Layout } from '../components/Layout'
import { bySection } from '../lib/data'
import { clearHistory, loadHistory } from '../lib/history'
import { deckStats, resetSrs } from '../lib/srs'
import type { Level, Section } from '../lib/types'
import { SECTION_META, SECTIONS, SRS_SECTIONS } from '../lib/types'
import { useQuestions } from '../lib/useQuestions'
import { cn } from '../lib/cn'

export const deckId = (level: Level, section: Section) => `${level}-${section}`

export function ModeSelect({ level }: { level: Level }) {
  const data = useQuestions(level)
  const [version, setVersion] = useState(0) // bumped to recompute stats after a reset
  const lastMock = loadHistory(level)[0]
  const base = `/${level.toLowerCase()}`

  const stats = useMemo(() => {
    if (data.status !== 'ready') return null
    return Object.fromEntries(
      SECTIONS.map((s) => {
        const ids = bySection(data.questions, s).map((q) => q.id)
        return [s, { count: ids.length, srs: SRS_SECTIONS.includes(s) ? deckStats(ids, deckId(level, s)) : null }]
      }),
    ) as Record<Section, { count: number; srs: ReturnType<typeof deckStats> | null }>
  }, [data, level, version])

  const reset = () => {
    if (!confirm('Reset ALL spaced-repetition progress and mock-test history (both levels)? This cannot be undone.')) return
    resetSrs()
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
              const { count, srs } = stats[s]
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
                      ) : `${count} questions`}
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

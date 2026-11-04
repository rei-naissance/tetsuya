import { useMemo, useState } from 'react'
import { Furi } from '../components/JP'
import { Link } from 'react-router-dom'
import { ConfirmTextButton, Layout } from '../components/Layout'
import { bySection } from '../lib/data'
import { clearHistory, loadHistory } from '../lib/history'
import { progressStats, resetAttempts, type ProgressStats } from '../lib/progress'
import { deckId, deckStats, resetSrs } from '../lib/srs'
import type { Level, Section } from '../lib/types'
import { ALL_KINDS, SECTION_META, SECTIONS, SRS_SECTIONS } from '../lib/types'
import { useQuestions } from '../lib/useQuestions'
import { resetWordStatus, useWords, wordDeck, wordStats } from '../lib/words'
import { usePrefs } from '../lib/prefs'
import { prefetchLearn } from '../lib/learn'
import { cn } from '../lib/cn'

export function ModeSelect({ level }: { level: Level }) {
  const data = useQuestions(level)
  const words = useWords(level)
  const { limits } = usePrefs()
  const [version, setVersion] = useState(0) // bumped to recompute stats after a reset
  const lastMock = loadHistory(level)[0]
  const base = `/${level.toLowerCase()}`

  const stats = useMemo(() => {
    if (data.status !== 'ready') return null
    return Object.fromEntries(
      SECTIONS.map((s) => {
        const ids = bySection(data.questions, s).map((q) => q.id)
        if (!SRS_SECTIONS.includes(s)) return [s, { count: ids.length, srs: null, practice: progressStats(ids) }]
        // The daily limits are shared by the section's decks, so count the section once.
        const srs = deckStats(ids, deckId(level, s, ALL_KINDS), limits)
        return [s, { count: ids.length, srs, practice: null }]
      }),
    ) as Record<Section, { count: number; srs: ReturnType<typeof deckStats> | null; practice: ProgressStats | null }>
  }, [data, level, version, limits.newPerDay, limits.maxReviews]) // eslint-disable-line react-hooks/exhaustive-deps

  const vocab = useMemo(() => {
    if (words.status !== 'ready') return null
    const deck = deckStats(words.words.map((w) => w.id), wordDeck(level), limits)
    return { ...wordStats(words.words), due: deck.due + deck.learning }
  }, [words, level, version, limits.newPerDay, limits.maxReviews]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    resetSrs()
    resetAttempts()
    resetWordStatus()
    clearHistory()
    setVersion((n) => n + 1)
  }

  // Everything renders straight away: the cards keep their size and only
  // their one-line status fills in when the question set and word list load,
  // so nothing pops in late or pushes the page around.
  return (
    <Layout back={{ to: '/levels', label: 'Levels' }} title={`JLPT ${level}`}>
      {data.status === 'error' && (
        <p className="mb-8 rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200">
          Couldn't load the {level} question set. {data.error}
        </p>
      )}
      <Link
        to={`${base}/mock`}
        className="group flex items-center justify-between gap-6 rounded-3xl bg-stone-900 p-7 text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
      >
        <div>
          <Furi as="p" text="模擬試験" className="text-xs tracking-[0.25em] text-stone-300 dark:text-stone-600" />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Mock test</h2>
          <p className="mt-1 text-sm text-stone-300 dark:text-stone-600">
            The official {level} layout in three timed papers, scored at the end.
          </p>
          {lastMock && (
            <p className="mt-4 text-xs text-stone-300 dark:text-stone-600">
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
          const st = stats?.[s]
          const empty = st?.count === 0
          const srs = st?.srs
          const nothingToDo = srs && srs.due + srs.learning + srs.fresh === 0
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
                <Furi text={SECTION_META[s].jp} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{SECTION_META[s].label}</p>
                <p className="truncate text-sm text-stone-500">
                  {!st ? <Placeholder /> : empty ? 'No questions yet' : srs ? (
                    nothingToDo ? 'All caught up' : (
                      <>
                        {srs.due + srs.learning > 0 && <span className="font-medium text-accent">{srs.due + srs.learning} due</span>}
                        {srs.due + srs.learning > 0 && srs.fresh > 0 && ' · '}
                        {srs.fresh > 0 && `${srs.fresh} new`}
                      </>
                    )
                  ) : st.practice && st.practice.seen > 0 ? `${st.practice.seen} of ${st.count} tried · ${st.practice.right} right` : `${st.count} questions`}
                </p>
              </div>
              {SRS_SECTIONS.includes(s) && !empty && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent dark:bg-accent/10">
                  SRS
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <h2 className="mb-4 mt-12 text-sm font-medium uppercase tracking-widest text-stone-400">Learn</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <LearnCard to={`${base}/learn/vocab`} jp="単語" label="Vocabulary list">
          {!vocab ? 'Words, examples, flashcards' : vocab.known + vocab.learning > 0 ? (
            <>
              {vocab.due > 0 && <span className="font-medium text-accent">{vocab.due} due · </span>}
              {vocab.known} of {vocab.total} learned · {vocab.learning} learning
            </>
          ) : `${vocab.total} words · examples, flashcards`}
        </LearnCard>
        <LearnCard to={`${base}/learn/kanji`} jp="漢字" label="Kanji" onIntent={() => prefetchLearn('kanji', level)}>
          Readings, stroke order, words
        </LearnCard>
        <LearnCard to={`${base}/learn/grammar`} jp="文型" label="Grammar patterns" onIntent={() => prefetchLearn('grammar', level)}>
          Meaning, form, examples, drills
        </LearnCard>
        <LearnCard to={`${base}/learn/particles`} jp="助詞" label="Particles" onIntent={() => prefetchLearn('particles', level)}>
          に vs で, まで vs までに, には…
        </LearnCard>
      </div>

      <div className="mt-16 flex justify-center">
        <ConfirmTextButton
          tone="danger"
          question="Reset all progress for both levels? This can't be undone."
          confirmLabel="Reset"
          onConfirm={reset}
        >
          Reset progress
        </ConfirmTextButton>
      </div>
    </Layout>
  )
}

/** Holds a status line's height while its numbers load. */
function Placeholder() {
  return <span className="inline-block h-3 w-28 animate-pulse rounded bg-stone-200 align-middle dark:bg-stone-800" aria-label="Loading" />
}

function LearnCard({ to, jp, label, onIntent, children }: { to: string; jp: string; label: string; onIntent?: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onTouchStart={onIntent}
      className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft font-jp-serif text-lg text-accent dark:bg-accent/10"><Furi text={jp} className="font-jp-serif" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="truncate font-jp text-sm text-stone-500">{children}</p>
      </div>
    </Link>
  )
}

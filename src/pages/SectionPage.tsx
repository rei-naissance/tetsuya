import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, ProgressBar } from '../components/Layout'
import { byKind } from '../lib/data'
import { SET_SIZES, usePrefs } from '../lib/prefs'
import { loadAttempts, progressStats, type ProgressStats } from '../lib/progress'
import { deckId, deckStats, type DeckStats } from '../lib/srs'
import type { KindMeta, Level, Question, Section } from '../lib/types'
import { ALL_KINDS, KINDS, SECTION_META, SRS_SECTIONS } from '../lib/types'
import { cn } from '../lib/cn'

const MIXED = (section: Section): KindMeta => ({
  id: ALL_KINDS,
  label: 'Mixed',
  jp: 'まとめ',
  blurb: `All ${SECTION_META[section].label.toLowerCase()} question types together`,
})

/** A section's question types, each with its own progress and practice buttons. */
export function SectionPage({ level, section, questions }: { level: Level; section: Section; questions: Question[] }) {
  const navigate = useNavigate()
  const { prefs, setSetSize } = usePrefs()
  const srs = SRS_SECTIONS.includes(section)
  const base = `/${level.toLowerCase()}/study/${section}`

  const kinds = useMemo(() => {
    const attempts = loadAttempts()
    const present = KINDS[section]
      .map((meta) => ({ meta, pool: byKind(questions, section, meta.id) }))
      .filter((k) => k.pool.length > 0)
    const list = present.length > 1 ? [...present, { meta: MIXED(section), pool: byKind(questions, section, ALL_KINDS) }] : present
    return list.map(({ meta, pool }) => {
      const ids = pool.map((q) => q.id)
      return {
        meta,
        count: ids.length,
        practice: srs ? null : progressStats(ids, attempts),
        deck: srs ? deckStats(ids, deckId(level, section, meta.id)) : null,
      }
    })
  }, [questions, section, level, srs])

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} ${SECTION_META[section].label}`}>
      <p className="font-jp text-sm tracking-[0.3em] text-accent">{SECTION_META[section].jp}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{SECTION_META[section].label}</h1>
      <p className="mt-2 text-stone-500">
        {srs
          ? 'Spaced repetition: due cards come back when you are about to forget them, plus up to 10 new cards a day per deck.'
          : 'Short sets that start with questions you haven’t seen, then the ones you missed.'}
      </p>

      {!srs && (
        <div className="mt-6 flex items-center gap-3 text-sm text-stone-500">
          Questions per set
          <div className="flex rounded-lg border border-stone-200 p-0.5 dark:border-stone-800" role="radiogroup" aria-label="Questions per set">
            {SET_SIZES.map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={prefs.setSize === n}
                onClick={() => setSetSize(n)}
                className={cn(
                  'min-w-9 rounded-md px-2 py-1 tabular-nums transition',
                  prefs.setSize === n ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'hover:text-stone-900 dark:hover:text-stone-100',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {kinds.map(({ meta, count, practice, deck }) => (
          <div
            key={meta.id}
            className={cn(
              'rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900',
              meta.id === ALL_KINDS && 'border-dashed',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-medium">
                {meta.label} <span className="ml-1 font-jp text-sm text-stone-400">{meta.jp}</span>
              </p>
              <p className="text-sm tabular-nums text-stone-400">{count} questions</p>
            </div>
            <p className="mt-1 text-sm text-stone-500">{meta.blurb}</p>

            {practice && <PracticeProgress stats={practice} />}
            {deck && <DeckProgress stats={deck} />}

            <div className="mt-4 flex flex-wrap gap-2">
              {practice && (
                <>
                  <Button onClick={() => navigate(`${base}/${meta.id}`)}>
                    {practice.seen === 0 ? 'Start' : practice.seen < practice.total ? 'Continue' : 'Practice again'}
                  </Button>
                  {practice.wrong > 0 && (
                    <Button variant="outline" onClick={() => navigate(`${base}/${meta.id}?mode=mistakes`)}>
                      Retry mistakes ({practice.wrong})
                    </Button>
                  )}
                </>
              )}
              {deck && (
                <Button onClick={() => navigate(`${base}/${meta.id}`)} disabled={deck.due + deck.fresh === 0}>
                  {deck.due + deck.fresh === 0 ? 'All caught up' : 'Study'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}

function PracticeProgress({ stats }: { stats: ProgressStats }) {
  return (
    <div className="mt-4">
      <ProgressBar value={stats.right} max={stats.total} />
      <p className="mt-2 text-xs tabular-nums text-stone-400">
        {stats.seen === 0 ? 'Not started' : (
          <>
            {stats.seen} of {stats.total} tried · <span className="text-emerald-600 dark:text-emerald-400">{stats.right} right</span>
            {stats.wrong > 0 && <> · <span className="text-rose-500">{stats.wrong} to retry</span></>}
          </>
        )}
      </p>
    </div>
  )
}

function DeckProgress({ stats }: { stats: DeckStats }) {
  return (
    <div className="mt-4">
      <ProgressBar value={stats.learned} max={stats.total} />
      <p className="mt-2 text-xs tabular-nums text-stone-400">
        {stats.due > 0 && <span className="font-medium text-accent">{stats.due} due · </span>}
        {stats.fresh} new today · {stats.learned} of {stats.total} learned
      </p>
    </div>
  )
}

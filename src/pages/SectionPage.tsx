import { useMemo, useState } from 'react'
import { Furi } from '../components/JP'
import { useNavigate } from 'react-router-dom'
import { Actions, Button, Chips, Layout, ProgressBar } from '../components/Layout'
import { StudyOptions } from '../components/StudyOptions'
import { byKind } from '../lib/data'
import { SET_SIZES, setCount, usePrefs } from '../lib/prefs'
import { loadAttempts, progressStats, type ProgressStats } from '../lib/progress'
import { deckId, deckStats, type DeckStats } from '../lib/srs'
import type { KindMeta, Level, Question, Section } from '../lib/types'
import { ALL_KINDS, KINDS, SECTION_META, SRS_SECTIONS } from '../lib/types'
import { cn } from '../lib/cn'

const MIXED: KindMeta = {
  id: ALL_KINDS,
  label: 'Mixed',
  jp: 'まとめ',
  blurb: 'The types above, shuffled together. Same questions, so progress is shared with them.',
}

export const setSizeLabel = (n: number) => (n === 0 ? 'All' : String(n))

/** A section's question types, each with its own progress and practice buttons. */
export function SectionPage({ level, section, questions }: { level: Level; section: Section; questions: Question[] }) {
  const navigate = useNavigate()
  const { prefs, limits } = usePrefs()
  const [version, setVersion] = useState(0) // bumped by custom study to recount the decks
  const srs = SRS_SECTIONS.includes(section)
  const base = `/${level.toLowerCase()}/study/${section}`
  const sectionIds = useMemo(() => byKind(questions, section, ALL_KINDS).map((q) => q.id), [questions, section])

  const kinds = useMemo(() => {
    const attempts = loadAttempts()
    const present = KINDS[section]
      .map((meta) => ({ meta, pool: byKind(questions, section, meta.id) }))
      .filter((k) => k.pool.length > 0)
    const list = present.length > 1 ? [...present, { meta: MIXED, pool: byKind(questions, section, ALL_KINDS) }] : present
    return list.map(({ meta, pool }) => {
      const ids = pool.map((q) => q.id)
      return {
        meta,
        count: ids.length,
        practice: srs ? null : progressStats(ids, attempts),
        deck: srs ? deckStats(ids, deckId(level, section, meta.id), limits) : null,
      }
    })
  }, [questions, section, level, srs, limits.newPerDay, limits.maxReviews, version]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} ${SECTION_META[section].label}`}>
      <Furi as="p" text={SECTION_META[section].jp} className="text-sm tracking-[0.3em] text-accent" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{SECTION_META[section].label}</h1>
      <p className="mt-2 text-stone-500">
        {srs
          ? 'Spaced repetition: due cards come back just before you’d forget them, plus a few new cards a day. The daily limits are shared by every deck in this section.'
          : 'Short sets that start with questions you haven’t seen, then the ones you missed.'}
      </p>

      {srs ? (
        <details className="group mt-6 rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium">
            Daily limits and custom study
            <span className="text-stone-400 transition group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <div className="border-t border-stone-200 px-5 py-5 dark:border-stone-800">
            <StudyOptions
              ids={sectionIds}
              deck={deckId(level, section, ALL_KINDS)}
              onChange={() => setVersion((v) => v + 1)}
              onAhead={(days) => navigate(`${base}/${ALL_KINDS}?ahead=${days}`)}
            />
          </div>
        </details>
      ) : (
        <div className="mt-6"><SetSizePicker /></div>
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
                {meta.label} <Furi text={meta.jp} className="ml-1 text-sm text-stone-400" />
              </p>
              <p className="text-sm tabular-nums text-stone-400">{count} questions</p>
            </div>
            <p className="mt-1 text-sm text-stone-500">{meta.blurb}</p>

            {practice && <PracticeProgress stats={practice} />}
            {deck && <DeckProgress stats={deck} />}

            <Actions className="mt-4">
              {practice && (
                <>
                  <Button onClick={() => navigate(`${base}/${meta.id}`)} count={setCount(prefs.setSize, count)}>
                    {practice.seen === 0 ? 'Start' : 'Continue'}
                  </Button>
                  {practice.wrong > 0 && (
                    <Button variant="secondary" onClick={() => navigate(`${base}/${meta.id}?mode=mistakes`)} count={practice.wrong}>
                      Retry mistakes
                    </Button>
                  )}
                </>
              )}
              {deck && (
                <Button onClick={() => navigate(`${base}/${meta.id}`)} disabled={deck.due + deck.learning + deck.fresh === 0} count={deck.due + deck.learning + deck.fresh}>
                  {deck.due + deck.learning + deck.fresh === 0 ? 'Done today' : 'Study'}
                </Button>
              )}
            </Actions>
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
            {stats.seen} of {stats.total} tried · <span className="text-emerald-700 dark:text-emerald-400">{stats.right} right</span>
            {stats.wrong > 0 && <> · <span className="text-rose-600">{stats.wrong} to retry</span></>}
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
        {stats.learning > 0 && `${stats.learning} learning · `}
        {stats.fresh} new today · {stats.learned} of {stats.total} learned
        {stats.dueTotal > stats.due && ` · ${stats.dueTotal - stats.due} waiting (review limit)`}
      </p>
    </div>
  )
}

/** "Questions per set", shared by every practice and drill page. */
export function SetSizePicker() {
  const { prefs, setSetSize } = usePrefs()
  return <Chips label="Questions per set" options={SET_SIZES} value={prefs.setSize} onChange={setSetSize} format={setSizeLabel} />
}

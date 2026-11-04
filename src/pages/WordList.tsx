import { useMemo, useState } from 'react'
import { Furi } from '../components/JP'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Chips, Layout, Pagination, ProgressBar } from '../components/Layout'
import { usePage } from '../lib/usePage'
import { StudyOptions } from '../components/StudyOptions'
import { usePrefs } from '../lib/prefs'
import { deckStats } from '../lib/srs'
import type { Level, Word } from '../lib/types'
import { loadStatus, searchWords, wordDeck, wordStats, type StatusMap } from '../lib/words'
import { cn } from '../lib/cn'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'known', label: 'Known' },
  { id: 'examples', label: 'With examples' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const PAGE = 50

const matches = (w: Word, f: Filter, status: StatusMap) =>
  f === 'all' ? true
  : f === 'examples' ? w.examples.length + w.inBank.length > 0
  : status[w.id] === f

/** The level's vocabulary list: search, filter by status, open a word. */
export function WordList({ level, words }: { level: Level; words: Word[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { limits } = usePrefs()
  const [, setVersion] = useState(0) // bumped by custom study to recount
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const filter = (FILTERS.find((f) => f.id === params.get('f'))?.id ?? 'all') as Filter
  const status = useMemo(() => loadStatus(words), [words])
  const stats = wordStats(words, status)
  const ids = useMemo(() => words.map((w) => w.id), [words])
  const deck = deckStats(ids, wordDeck(level), limits)
  const toStudy = deck.due + deck.learning + deck.fresh
  const base = `/${level.toLowerCase()}/learn/vocab`

  const results = useMemo(
    () => searchWords(words, query).filter((w) => matches(w, filter, status)),
    [words, query, filter, status],
  )
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('p') // new search or filter: back to page 1
    setParams(next, { replace: true })
  }
  const paged = usePage(results, PAGE)
  const detailed = words.filter((w) => w.url).length

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} Vocabulary list`}>
      <Furi as="p" text="語彙リスト" className="text-sm tracking-[0.3em] text-accent" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Vocabulary list</h1>
      <p className="mt-2 text-stone-500">
        {words.length} words from the JLPT {level} list. {detailed} have a full word page with example sentences.
        Flashcards bring each word back just before you'd forget it, Anki-style.
      </p>

      <div className="mt-6">
        <ProgressBar value={stats.known} max={stats.total} />
        <p className="mt-2 text-xs tabular-nums text-stone-400">
          <span className="text-emerald-700 dark:text-emerald-400">{stats.known} learned</span>
          {' · '}<span className="text-accent">{stats.learning} learning</span>
          {' · '}{stats.fresh} new
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium">Flashcards</p>
            <p className="mt-1 text-sm tabular-nums text-stone-500">
              {toStudy === 0 ? 'All caught up for today.' : (
                <>
                  {deck.due > 0 && <span className="font-medium text-accent">{deck.due} due · </span>}
                  {deck.learning > 0 && `${deck.learning} learning · `}
                  {deck.fresh} new today
                </>
              )}
            </p>
          </div>
          <Button onClick={() => navigate(`${base}/cards`)} disabled={toStudy === 0} count={toStudy}>
            {toStudy === 0 ? 'Done today' : 'Study'}
          </Button>
        </div>
        <details className="group mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
            Daily limits and custom study
            <span className="text-stone-400 transition group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <div className="pt-5">
            <StudyOptions ids={ids} deck={wordDeck(level)} onChange={() => setVersion((v) => v + 1)} onAhead={(d) => navigate(`${base}/cards?ahead=${d}`)} />
          </div>
        </details>
      </div>

      <div className="sticky top-14 z-[5] -mx-4 mt-10 bg-stone-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-stone-950/90">
        <input
          type="search"
          value={query}
          onChange={(e) => update('q', e.target.value)}
          placeholder="Search: 上がる, あがる, agaru or rise"
          aria-label="Search words"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:focus:border-stone-400"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Chips
            label="Filter"
            hideLabel
            options={FILTERS.map((f) => f.id)}
            value={filter}
            onChange={(f) => update('f', f)}
            format={(id) => FILTERS.find((f) => f.id === id)!.label}
          />
          <span className="ml-auto text-xs tabular-nums text-stone-400">
            {results.length > PAGE ? `${paged.start + 1}–${paged.start + paged.items.length} of ` : ''}{results.length} words
          </span>
        </div>
      </div>

      <div ref={paged.topRef} />
      <ul className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
        {paged.items.map((w) => (
          <li key={w.id}>
            <Link
              to={`${base}/${w.id}`}
              state={{ from: location.search }}
              className="flex items-baseline gap-3 rounded-lg px-2 py-3 hover:bg-stone-100 dark:hover:bg-stone-900"
            >
              <span
                className={cn(
                  'size-2 shrink-0 self-center rounded-full',
                  status[w.id] === 'known' ? 'bg-emerald-500' : status[w.id] === 'learning' ? 'bg-accent' : 'bg-stone-200 dark:bg-stone-800',
                )}
                aria-label={status[w.id]}
              />
              <span className="font-jp text-lg">{w.word}</span>
              {w.kana && <span className="font-jp text-sm text-stone-400">{w.kana}</span>}
              <span className="min-w-0 flex-1 truncate text-right text-sm text-stone-500">{w.meaning}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="py-12 text-center text-stone-500">No words match.</p>}
      <Pagination page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </Layout>
  )
}

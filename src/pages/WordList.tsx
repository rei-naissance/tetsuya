import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Layout, ProgressBar } from '../components/Layout'
import { usePrefs } from '../lib/prefs'
import type { Level, Word } from '../lib/types'
import { loadStatus, searchWords, wordStats, type StatusMap } from '../lib/words'
import { cn } from '../lib/cn'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'known', label: 'Known' },
  { id: 'examples', label: 'With examples' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const PAGE = 60

const matches = (w: Word, f: Filter, status: StatusMap) =>
  f === 'all' ? true
  : f === 'new' ? !status[w.id]
  : f === 'examples' ? w.examples.length + w.inBank.length > 0
  : status[w.id] === f

/** The level's vocabulary list: search, filter by status, open a word. */
export function WordList({ level, words }: { level: Level; words: Word[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { prefs } = usePrefs()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const filter = (FILTERS.find((f) => f.id === params.get('f'))?.id ?? 'all') as Filter
  const [shown, setShown] = useState(PAGE)
  const status = useMemo(loadStatus, [])
  const stats = wordStats(words, status)
  const base = `/${level.toLowerCase()}/learn/vocab`

  const results = useMemo(
    () => searchWords(words, query).filter((w) => matches(w, filter, status)),
    [words, query, filter, status],
  )
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    setShown(PAGE)
  }
  const detailed = words.filter((w) => w.url).length
  const unmarked = stats.total - stats.learning - stats.known

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} Vocabulary list`}>
      <p className="font-jp text-sm tracking-[0.3em] text-accent">語彙リスト</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Vocabulary list</h1>
      <p className="mt-2 text-stone-500">
        {words.length} words from the JLPT {level} list. {detailed} have a full word page with example sentences.
        Mark words as you go, then drill the ones you're learning.
      </p>

      <div className="mt-6">
        <ProgressBar value={stats.known} max={stats.total} />
        <p className="mt-2 text-xs tabular-nums text-stone-400">
          <span className="text-emerald-600 dark:text-emerald-400">{stats.known} known</span>
          {' · '}<span className="text-accent">{stats.learning} learning</span>
          {' · '}{unmarked} not marked
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => navigate(`${base}/cards?set=new`)} disabled={unmarked === 0}>
          Flashcards: {Math.min(prefs.setSize, unmarked)} new words
        </Button>
        <Button variant="outline" onClick={() => navigate(`${base}/cards?set=learning`)} disabled={stats.learning === 0}>
          Review learning ({stats.learning})
        </Button>
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
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => update('f', f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition',
                filter === f.id
                  ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                  : 'border-stone-200 text-stone-500 hover:border-stone-400 dark:border-stone-800',
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto self-center text-xs tabular-nums text-stone-400">{results.length} words</span>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
        {results.slice(0, shown).map((w) => (
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
                aria-label={status[w.id] ?? 'not marked'}
              />
              <span className="font-jp text-lg">{w.word}</span>
              {w.kana && <span className="font-jp text-sm text-stone-400">{w.kana}</span>}
              <span className="min-w-0 flex-1 truncate text-right text-sm text-stone-500">{w.meaning}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="py-12 text-center text-stone-500">No words match.</p>}
      {results.length > shown && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={() => setShown((n) => n + PAGE * 2)}>
            Show more ({results.length - shown} left)
          </Button>
        </div>
      )}
    </Layout>
  )
}

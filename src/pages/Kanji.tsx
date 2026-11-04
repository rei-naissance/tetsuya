import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Chips, Layout, Pagination, TextButton } from '../components/Layout'
import { Furi } from '../components/JP'
import { gradeLabel, kanjiPath, searchKanji } from '../lib/kanji'
import type { Kanji, KanjiStrokes, Level } from '../lib/types'
import { usePage } from '../lib/usePage'
import { useKeys } from '../lib/useKeys'
import { cn } from '../lib/cn'

export const kanjiBase = (level: Level) => `/${level.toLowerCase()}/learn/kanji`

const PAGE = 120

/** The kanji in a level's word list: search and open one. */
export function KanjiList({ level, kanji }: { level: Level; kanji: Kanji[] }) {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const hasEarlier = kanji.some((k) => k.earlier)
  const filter = hasEarlier && params.get('f') === 'new' ? 'new' : 'all'
  const base = kanjiBase(level)

  const results = useMemo(
    () => searchKanji(kanji, query).filter((k) => filter === 'all' || !k.earlier),
    [kanji, query, filter],
  )
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('p')
    setParams(next, { replace: true })
  }
  const paged = usePage(results, PAGE)
  const fresh = kanji.filter((k) => !k.earlier).length

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} Kanji`}>
      <Furi as="p" text="漢字" className="text-sm tracking-[0.3em] text-accent" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Kanji</h1>
      <p className="mt-2 text-stone-500">
        The {kanji.length} kanji used in the JLPT {level} word list{hasEarlier && `, ${fresh} of them new since N4`}.
        Most-used first, each with its readings, stroke order and the {level} words that use it.
      </p>

      <div className="sticky top-14 z-[5] -mx-4 mt-8 bg-stone-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-stone-950/90">
        <input
          type="search"
          value={query}
          onChange={(e) => update('q', e.target.value)}
          placeholder="Search: 会, かい, kai or meet"
          aria-label="Search kanji"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:focus:border-stone-400"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {hasEarlier && (
            <Chips
              label="Filter"
              hideLabel
              options={['all', 'new'] as const}
              value={filter}
              onChange={(f) => update('f', f)}
              format={(f) => (f === 'all' ? 'All' : 'New since N4')}
            />
          )}
          <span className="ml-auto text-xs tabular-nums text-stone-400">
            {results.length > PAGE ? `${paged.start + 1}–${paged.start + paged.items.length} of ` : ''}{results.length} kanji
          </span>
        </div>
      </div>

      <div ref={paged.topRef} />
      <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {paged.items.map((k) => (
          <li key={k.char}>
            <Link
              to={kanjiPath(base, k.char)}
              state={{ from: location.search }}
              title={k.meanings.slice(0, 3).join(', ')}
              className="flex h-full flex-col items-center rounded-xl border border-stone-200 bg-white px-1.5 pb-2 pt-2.5 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
            >
              <span className="font-jp-serif text-3xl leading-none" lang="ja">{k.char}</span>
              <span className="mt-2 w-full truncate text-center text-xs text-stone-500">{k.meanings[0] ?? '—'}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="py-12 text-center text-stone-500">No kanji match.</p>}
      <Pagination page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </Layout>
  )
}

/** One kanji: meanings, readings, stroke order, parts and the level's words that use it. */
export function KanjiDetail({ level, list, kanji, strokes }: {
  level: Level
  list: Kanji[]
  kanji: Kanji
  /** undefined while the stroke file loads; null when it failed or has no entry. */
  strokes: KanjiStrokes | null | undefined
}) {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? ''
  const base = kanjiBase(level)
  const vocab = `/${level.toLowerCase()}/learn/vocab`
  const index = list.indexOf(kanji)
  const prev = list[index - 1]
  const next = list[index + 1]
  const go = (k?: Kanji) => k && navigate(kanjiPath(base, k.char), { replace: true, state: { from } })
  const onList = (ch: string) => list.some((k) => k.char === ch)

  useKeys((e) => {
    if (e.key === 'ArrowLeft') go(prev)
    else if (e.key === 'ArrowRight') go(next)
  })

  const facts = [
    `${kanji.strokes} strokes`,
    gradeLabel(kanji.grade),
    kanji.freq ? `#${kanji.freq} most used` : undefined,
  ].filter(Boolean)

  return (
    <Layout back={{ to: `${base}${from}`, label: 'Kanji' }} title={`${index + 1} / ${list.length}`}>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <StrokeOrder key={kanji.char} char={kanji.char} strokes={strokes} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{facts.join(' · ')}</p>
          <p className="mt-3 text-2xl font-medium leading-snug">{kanji.meanings.join(', ') || '—'}</p>
          <dl className="mt-6 space-y-3">
            {kanji.on.length > 0 && (
              <Reading label="On'yomi" hint="Chinese-derived, mostly in compounds">
                {kanji.on.join('、')}
              </Reading>
            )}
            {kanji.kun.length > 0 && (
              <Reading label="Kun'yomi" hint="Native Japanese, often on its own">
                {kanji.kun.map((r, i) => (
                  <span key={i}>
                    {i > 0 && '、'}
                    {r.stem.replace(/-/g, '')}
                    {r.okuri && <span className="text-stone-400">{r.okuri}</span>}
                  </span>
                ))}
              </Reading>
            )}
          </dl>
          {kanji.parts && (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Parts</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {kanji.parts.map((p, i) => {
                  const isRadical = p === kanji.radicalForm
                  const cls = cn('grid size-11 place-items-center rounded-lg border font-jp-serif text-xl', isRadical ? 'border-accent/60' : 'border-stone-200 dark:border-stone-800')
                  const title = isRadical ? 'Radical' : undefined
                  return (
                    <span key={p} className="flex items-center gap-2">
                      {i > 0 && <span className="text-stone-400" aria-hidden>+</span>}
                      {onList(p) ? (
                        <Link to={kanjiPath(base, p)} state={{ from }} title={title} className={cn(cls, 'hover:border-stone-900 dark:hover:border-stone-400')}>{p}</Link>
                      ) : (
                        <span title={title} className={cn(cls, 'text-stone-600 dark:text-stone-300')} lang="ja">{p}</span>
                      )}
                    </span>
                  )
                })}
              </div>
              {kanji.radicalForm && kanji.parts.includes(kanji.radicalForm) && (
                <p className="mt-2 text-xs text-stone-400">Outlined in red: the radical, which dictionaries file it under.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">
          {level} words with {kanji.char}
        </h2>
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {kanji.words.map((w) => (
            <li key={w.id}>
              <Link to={`${vocab}/${w.id}`} className="flex items-baseline gap-3 rounded-lg px-2 py-3 hover:bg-stone-100 dark:hover:bg-stone-900">
                <span className="font-jp text-lg" lang="ja">
                  {[...w.word].map((c, i) => <span key={i} className={c === kanji.char ? 'text-accent' : undefined}>{c}</span>)}
                </span>
                {w.kana && <span className="font-jp text-sm text-stone-400">{w.kana}</span>}
                <span className="min-w-0 flex-1 truncate text-right text-sm text-stone-500">{w.meaning}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="mt-12 flex justify-between gap-4 border-t border-stone-200 pt-6 text-sm dark:border-stone-800">
        <NavLink kanji={prev} dir="prev" onClick={() => go(prev)} />
        <NavLink kanji={next} dir="next" onClick={() => go(next)} />
      </nav>
    </Layout>
  )
}

function Reading({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-20 shrink-0 text-sm text-stone-500" title={hint}>{label}</dt>
      <dd className="font-jp text-lg" lang="ja">{children}</dd>
    </div>
  )
}

const STROKE_TIME = 0.5 // seconds per stroke
const GAP = 0.12

/**
 * KanjiVG stroke order: the strokes draw themselves one after another over a
 * faint copy of the whole kanji. Replay restarts it; the step buttons show
 * one stroke at a time instead.
 */
function StrokeOrder({ char, strokes }: { char: string; strokes: KanjiStrokes | null | undefined }) {
  const [run, setRun] = useState(0)
  const [step, setStep] = useState<number | null>(null) // null = animating
  const [numbers, setNumbers] = useState(true)
  const box = 'size-48 shrink-0 rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:size-56'

  if (!strokes) {
    return (
      <div className={cn(box, 'grid place-items-center')}>
        <span className="font-jp-serif text-8xl" lang="ja">{char}</span>
        {strokes === undefined && <span className="sr-only">Loading stroke order</span>}
      </div>
    )
  }

  const n = strokes.paths.length
  const shown = step ?? n
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <svg viewBox="0 0 109 109" className={cn(box, 'touch-manipulation')} role="img" aria-label={`Stroke order of ${char}, ${n} strokes`}>
        <g className="stroke-stone-200 dark:stroke-stone-800" strokeWidth="0.5" strokeDasharray="2 2">
          <line x1="54.5" y1="0" x2="54.5" y2="109" />
          <line x1="0" y1="54.5" x2="109" y2="54.5" />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2">
          <g className="stroke-stone-200 dark:stroke-stone-700">
            {strokes.paths.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g key={run} className="stroke-stone-900 dark:stroke-stone-100">
            {strokes.paths.slice(0, shown).map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={1}
                className={cn(step === null && 'stroke-draw', step !== null && i === shown - 1 && 'stroke-accent')}
                style={step === null ? { ['--stroke-delay' as string]: `${i * (STROKE_TIME + GAP)}s`, ['--stroke-time' as string]: `${STROKE_TIME}s` } : undefined}
              />
            ))}
          </g>
        </g>
        {numbers && strokes.numbers && (
          <g className="fill-stone-400" fontSize="7" fontFamily="var(--font-sans)">
            {strokes.numbers.slice(0, shown).map(([x, y], i) => <text key={i} x={x} y={y}>{i + 1}</text>)}
          </g>
        )}
      </svg>
      <div className="flex items-center gap-1 text-sm">
        <StepButton label="Previous stroke" disabled={shown <= 1} onClick={() => setStep(Math.max(1, shown - 1))}>‹</StepButton>
        <span className="w-16 text-center text-xs tabular-nums text-stone-500">{step === null ? `${n} strokes` : `${shown} / ${n}`}</span>
        <StepButton label="Next stroke" disabled={step !== null && shown >= n} onClick={() => setStep(step === null ? 1 : Math.min(n, shown + 1))}>›</StepButton>
      </div>
      <div className="flex gap-4">
        <TextButton onClick={() => { setStep(null); setRun((r) => r + 1) }}>Replay</TextButton>
        <TextButton onClick={() => setNumbers((v) => !v)} aria-pressed={numbers}>{numbers ? 'Hide numbers' : 'Show numbers'}</TextButton>
      </div>
    </div>
  )
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-stone-800 dark:hover:text-stone-100"
    >
      {children}
    </button>
  )
}

function NavLink({ kanji, dir, onClick }: { kanji?: Kanji; dir: 'prev' | 'next'; onClick: () => void }) {
  if (!kanji) return <span />
  return (
    <button onClick={onClick} className={cn('group text-stone-500 hover:text-stone-900 dark:hover:text-stone-100', dir === 'next' && 'text-right')}>
      <span className="block text-xs text-stone-400">{dir === 'prev' ? '← Previous' : 'Next →'}</span>
      <span className="font-jp-serif text-xl" lang="ja">{kanji.char}</span>
    </button>
  )
}

import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Layout } from '../components/Layout'
import { JP } from '../components/JP'
import { loadAttempts, progressStats } from '../lib/progress'
import type { GrammarPattern, Level } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { cn } from '../lib/cn'
import { DrillProgress } from './Particles'

export const grammarBase = (level: Level) => `/${level.toLowerCase()}/learn/grammar`

const squash = (s = '') => s.toLowerCase().replace(/[^a-z぀-ヿ㐀-鿿]/g, '')

function searchPatterns(patterns: GrammarPattern[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return patterns
  const sq = squash(q)
  return patterns.filter((p) =>
    (sq && (squash(p.pattern).includes(sq) || squash(p.romaji).includes(sq)))
    || `${p.meaning} ${p.title ?? ''}`.toLowerCase().includes(q))
}

/** Grammar patterns: N4 lessons grouped by chapter, then the rest of the list. */
export function GrammarList({ level, patterns }: { level: Level; patterns: GrammarPattern[] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const base = grammarBase(level)
  const attempts = useMemo(loadAttempts, [])
  const drills = patterns.reduce((n, p) => n + p.drills.length, 0)

  const groups = useMemo(() => {
    const found = searchPatterns(patterns, query)
    const out: { title: string; items: GrammarPattern[] }[] = []
    for (const p of found) {
      const title = p.chapter ? `Chapter ${p.chapter}` : found.some((x) => x.chapter) ? 'More patterns' : 'Patterns'
      const last = out[out.length - 1]
      if (last?.title === title) last.items.push(p)
      else out.push({ title, items: [p] })
    }
    return out
  }, [patterns, query])
  const count = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} Grammar patterns`}>
      <p className="font-jp text-sm tracking-[0.3em] text-accent">文型</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Grammar patterns</h1>
      <p className="mt-2 text-stone-500">
        {patterns.length} JLPT {level} patterns, each with its meaning, how it's formed and example sentences.
        Drills blank out the pattern in real example sentences.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => navigate(`${base}/all/drill`)} disabled={!drills}>Drill all patterns ({drills})</Button>
      </div>

      <div className="sticky top-14 z-[5] -mx-4 mt-10 bg-stone-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-stone-950/90">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            if (e.target.value) next.set('q', e.target.value)
            else next.delete('q')
            setParams(next, { replace: true })
          }}
          placeholder="Search: ばかり, bakari or only"
          aria-label="Search patterns"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base outline-none placeholder:text-stone-400 focus:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:focus:border-stone-400"
        />
        <p className="mt-2 text-right text-xs tabular-nums text-stone-400">{count} patterns</p>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="mt-6">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-widest text-stone-400">{g.title}</h2>
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {g.items.map((p) => {
              const s = progressStats(p.drills.map((d) => d.id), attempts)
              return (
                <li key={p.id}>
                  <Link
                    to={`${base}/${p.id}`}
                    state={{ from: location.search }}
                    className="flex items-baseline gap-3 rounded-lg px-2 py-3 hover:bg-stone-100 dark:hover:bg-stone-900"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 self-center rounded-full',
                        s.seen === 0 ? 'bg-stone-200 dark:bg-stone-800' : s.wrong > 0 ? 'bg-accent' : 'bg-emerald-500',
                      )}
                      aria-label={s.seen === 0 ? 'not practised' : s.wrong > 0 ? 'has mistakes' : 'all right'}
                    />
                    <span className="font-jp text-lg">{p.pattern}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-sm text-stone-500">{p.title ?? p.meaning}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {count === 0 && <p className="py-12 text-center text-stone-500">No patterns match.</p>}
    </Layout>
  )
}

export function GrammarDetail({ level, patterns, pattern: p }: { level: Level; patterns: GrammarPattern[]; pattern: GrammarPattern }) {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? ''
  const base = grammarBase(level)
  const index = patterns.indexOf(p)
  const prev = patterns[index - 1]
  const next = patterns[index + 1]
  const go = (x?: GrammarPattern) => x && navigate(`${base}/${x.id}`, { replace: true, state: { from } })
  const [showAll, setShowAll] = useState(false)
  const stats = progressStats(p.drills.map((d) => d.id))

  useKeys((e) => {
    if (e.key === 'ArrowLeft') go(prev)
    else if (e.key === 'ArrowRight') go(next)
  })

  const examples = showAll ? p.examples : p.examples.slice(0, 6)

  return (
    <Layout back={{ to: `${base}${from}`, label: 'Patterns' }} title={`${index + 1} / ${patterns.length}`}>
      {p.chapter && <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Chapter {p.chapter}</p>}
      <h1 className="mt-2 font-jp text-4xl tracking-wide">{p.pattern}</h1>
      {p.romaji && <p className="mt-2 text-stone-400">{p.romaji}</p>}
      <p className="mt-5 text-lg">{p.meaning}</p>
      {p.title && p.title !== p.meaning && <p className="mt-1 text-stone-500">{p.title}</p>}
      {p.goal && <p className="mt-1 text-sm text-stone-400">{p.goal}</p>}

      {p.formation.length > 0 && (
        <Block title="Formation">
          <div className="space-y-1.5 rounded-xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
            {p.formation.map((f) => <JP key={f} as="p" text={f} className="leading-relaxed" />)}
          </div>
        </Block>
      )}

      {p.sections.map((s) => (
        <Block key={s.label} title={s.label}>
          {s.heading && <p className="font-medium">{s.heading}</p>}
          {s.text.map((t) => <JP key={t} as="p" text={t} className="mt-2 leading-relaxed text-stone-600 dark:text-stone-300" />)}
        </Block>
      ))}

      {p.notes.length > 0 && (
        <Block title="Notes">
          {p.notes.map((t) => <JP key={t} as="p" text={t} className="leading-relaxed text-stone-600 dark:text-stone-300" />)}
        </Block>
      )}

      <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <p className="font-medium">Drill <span className="text-sm font-normal text-stone-400">· {p.drills.length} questions from the examples</span></p>
        {p.drills.length > 0 ? (
          <>
            <DrillProgress stats={stats} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => navigate(`${base}/${p.id}/drill`)}>{stats.seen === 0 ? 'Start' : 'Practice again'}</Button>
              {stats.wrong > 0 && <Button variant="outline" onClick={() => navigate(`${base}/${p.id}/drill?mode=mistakes`)}>Retry mistakes ({stats.wrong})</Button>}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-stone-500">No drill: the pattern couldn't be picked out of the example sentences.</p>
        )}
      </div>

      {p.examples.length > 0 && (
        <Block title={`Examples (${p.examples.length})`}>
          <div className="space-y-5">
            {examples.map((ex) => (
              <div key={ex.ja} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <JP as="p" text={ex.ja} className="text-lg leading-[2.2]" />
                  {ex.romaji && <p className="text-sm italic text-stone-400">{ex.romaji}</p>}
                  {ex.en && <p className="text-sm text-stone-500">{ex.en}</p>}
                </div>
                {ex.audio && <PlayButton src={ex.audio} />}
              </div>
            ))}
          </div>
          {p.examples.length > examples.length && (
            <Button variant="ghost" className="mt-4" onClick={() => setShowAll(true)}>Show all {p.examples.length}</Button>
          )}
        </Block>
      )}

      {p.inBank.length > 0 && (
        <Block title="In this app's questions">
          <div className="space-y-3">
            {p.inBank.map((ex) => (
              // The id in the tooltip is what data/grammar-links.json uses to hide or add a sentence.
              <div key={ex.qid} title={ex.qid}>
                <JP as="p" text={ex.ja} className="text-lg leading-loose" />
              </div>
            ))}
          </div>
        </Block>
      )}

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {p.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-stone-500 underline-offset-4 hover:underline">
            {s.name} ↗
          </a>
        ))}
      </div>

      <nav className="mt-12 flex justify-between gap-4 border-t border-stone-200 pt-6 text-sm dark:border-stone-800">
        {prev ? <PatternNav p={prev} label="← Previous" onClick={() => go(prev)} /> : <span />}
        {next ? <PatternNav p={next} label="Next →" onClick={() => go(next)} right /> : <span />}
      </nav>
    </Layout>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">{title}</h2>
      {children}
    </section>
  )
}

function PatternNav({ p, label, onClick, right }: { p: GrammarPattern; label: string; onClick: () => void; right?: boolean }) {
  return (
    <button onClick={onClick} className={cn('text-stone-500 hover:text-stone-900 dark:hover:text-stone-100', right && 'text-right')}>
      <span className="block text-xs text-stone-400">{label}</span>
      <span className="font-jp text-base">{p.pattern}</span>
    </button>
  )
}

/** Plays a remote example recording; hidden if it fails to load. */
function PlayButton({ src }: { src: string }) {
  const [state, setState] = useState<'idle' | 'playing' | 'failed'>('idle')
  if (state === 'failed') return null
  const play = () => {
    const a = new Audio(src)
    setState('playing')
    a.onended = () => setState('idle')
    a.onerror = () => setState('failed')
    a.play().catch(() => setState('failed'))
  }
  return (
    <button
      onClick={play}
      aria-label="Play audio"
      className={cn(
        'grid size-9 shrink-0 place-items-center self-start rounded-full border text-xs transition',
        state === 'playing' ? 'border-accent text-accent' : 'border-stone-300 text-stone-500 hover:border-stone-900 dark:border-stone-700',
      )}
    >
      ▶
    </button>
  )
}

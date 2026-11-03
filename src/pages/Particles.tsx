import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Actions, Button, Layout, ProgressBar } from '../components/Layout'
import { SetSizePicker } from './SectionPage'
import { JP } from '../components/JP'
import type { ParticleData } from '../lib/learn'
import { loadAttempts, progressStats, type ProgressStats } from '../lib/progress'
import type { Level, ParticleContrast } from '../lib/types'
import { cn } from '../lib/cn'

export const particlesBase = (level: Level) => `/${level.toLowerCase()}/learn/particles`

/** N4 shows the N4 contrasts; N3 shows everything, its own first. */
export function contrastsFor(level: Level, all: ParticleContrast[]) {
  return level === 'N4' ? all.filter((c) => c.level === 'N4') : [...all.filter((c) => c.level === 'N3'), ...all.filter((c) => c.level !== 'N3')]
}

/** Particle contrasts: explanation pages plus drills, and the bank's particle questions. */
export function ParticleList({ level, data, bankCount }: { level: Level; data: ParticleData; bankCount: number }) {
  const navigate = useNavigate()
  const base = particlesBase(level)
  const contrasts = useMemo(() => contrastsFor(level, data.contrasts), [level, data])
  const stats = useMemo(() => {
    const attempts = loadAttempts()
    return new Map(contrasts.map((c) => [c.id, progressStats(c.drills.map((d) => d.id), attempts)]))
  }, [contrasts])
  const total = contrasts.reduce((n, c) => n + c.drills.length, 0)

  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }} title={`${level} Particles`}>
      <p className="font-jp text-sm tracking-[0.3em] text-accent">助詞</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Particles</h1>
      <p className="mt-2 text-stone-500">
        Particles taught side by side, the way they get confused: に vs で, まで vs までに, stacked particles like には and での.
        Each pair has a short explanation, example pairs and a drill.
      </p>

      <Actions className="mt-6">
        <Button onClick={() => navigate(`${base}/all/drill`)} count={total}>Drill all</Button>
        {bankCount > 0 && (
          <Button variant="secondary" onClick={() => navigate(`${base}/bank/drill`)} count={bankCount} title="Particle questions from the exercises">
            Exercise questions
          </Button>
        )}
      </Actions>
      <div className="mt-4">
        <SetSizePicker />
      </div>

      <div className="mt-8 space-y-3">
        {contrasts.map((c) => (
          <Link
            key={c.id}
            to={`${base}/${c.id}`}
            className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium"><JP text={c.title} /></p>
              <span className="shrink-0 text-xs text-stone-400">{c.level} · {c.drills.length} drills</span>
            </div>
            <p className="mt-1 text-sm text-stone-500"><JP text={c.summary} /></p>
            <DrillProgress stats={stats.get(c.id)!} />
          </Link>
        ))}
      </div>
    </Layout>
  )
}

export function ParticleDetail({ level, contrast }: { level: Level; contrast: ParticleContrast }) {
  const navigate = useNavigate()
  const base = particlesBase(level)
  const stats = progressStats(contrast.drills.map((d) => d.id))
  return (
    <Layout back={{ to: base, label: 'Particles' }} title={<JP text={contrast.title} />}>
      <div className="flex flex-wrap gap-2">
        {contrast.particles.map((p) => (
          <span key={p} className="rounded-lg bg-accent-soft px-3 py-1 font-jp text-xl text-accent dark:bg-accent/15">{p}</span>
        ))}
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight"><JP text={contrast.title} /></h1>
      <JP as="p" text={contrast.summary} className="mt-3 text-lg leading-relaxed text-stone-600 dark:text-stone-300" />

      <div className="mt-10 space-y-10">
        {contrast.points.map((pt, i) => (
          <section key={i}>
            <JP as="p" text={pt.rule} className="font-medium leading-relaxed" />
            <div className="mt-4 space-y-3 border-l-2 border-stone-200 pl-4 dark:border-stone-800">
              {pt.examples.map((ex) => (
                <div key={ex.ja}>
                  <JP as="p" text={ex.ja} className="text-lg leading-loose" />
                  {ex.en && <p className="text-sm text-stone-500">{ex.en}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <p className="font-medium">Drill <span className="text-sm font-normal text-stone-400">· {contrast.drills.length} questions</span></p>
        <DrillProgress stats={stats} />
        <Actions className="mt-4">
          <Button onClick={() => navigate(`${base}/${contrast.id}/drill`)} count={contrast.drills.length}>{stats.seen === 0 ? 'Start' : 'Continue'}</Button>
          {stats.wrong > 0 && <Button variant="secondary" onClick={() => navigate(`${base}/${contrast.id}/drill?mode=mistakes`)} count={stats.wrong}>Retry mistakes</Button>}
        </Actions>
      </div>
    </Layout>
  )
}

export function DrillProgress({ stats, className }: { stats: ProgressStats; className?: string }) {
  return (
    <div className={cn('mt-4', className)}>
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

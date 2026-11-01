import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import type { Level } from '../lib/types'
import { LEVELS } from '../lib/types'

const LEVEL_INFO: Record<Level, { title: string; desc: string }> = {
  N4: { title: 'Basic', desc: 'Everyday topics in basic vocabulary and kanji. About 300 kanji, 1,500 words.' },
  N3: { title: 'Intermediate', desc: 'Everyday situations at near-natural speed. About 650 kanji, 3,750 words.' },
}

export function LevelSelect() {
  return (
    <Layout back={{ to: '/', label: 'Home' }}>
      <h1 className="text-3xl font-semibold tracking-tight">Choose your level</h1>
      <p className="mt-2 text-stone-500">Progress is tracked separately for each level.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {LEVELS.map((level) => (
          <Link
            key={level}
            to={`/${level.toLowerCase()}`}
            className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 transition hover:-translate-y-0.5 hover:border-stone-900 hover:shadow-xl hover:shadow-stone-900/5 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400"
          >
            <span className="text-6xl font-semibold tracking-tighter">{level}</span>
            <p className="mt-6 font-medium">{LEVEL_INFO[level].title}</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">{LEVEL_INFO[level].desc}</p>
            <span className="absolute right-8 top-8 text-stone-300 transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

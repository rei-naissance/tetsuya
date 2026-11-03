import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import type { Level } from '../lib/types'
import { LEVELS } from '../lib/types'

const LEVEL_INFO: Record<Level, { title: string; desc: string }> = {
  N4: { title: 'Basic', desc: 'Everyday topics in basic vocabulary and kanji. About 300 kanji, 1,500 words.' },
  N3: { title: 'Intermediate', desc: 'Everyday situations at near-natural speed. About 650 kanji, 3,750 words.' },
}

/** Shown but not open yet. */
const COMING_LEVELS = [
  { name: 'N2', title: 'Upper intermediate', desc: 'Newspapers, articles and natural-speed conversation. About 1,000 kanji, 6,000 words.' },
  { name: 'N1', title: 'Advanced', desc: 'Complex writing and abstract topics in a wide range of settings. About 2,000 kanji, 10,000 words.' },
]
const COMING_TEXTBOOKS = [
  { name: 'Genki', jp: 'げんき', title: 'Genki I & II', desc: 'Vocabulary, kanji and grammar lesson by lesson, following the textbook.' },
  { name: 'Minna no Nihongo', jp: 'みんなの日本語', title: 'Shokyū I & II', desc: 'Vocabulary and grammar for each 課, following the textbook.' },
]

const card = 'relative overflow-hidden rounded-3xl border p-8'

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
            className={`group ${card} border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-900 hover:shadow-xl hover:shadow-stone-900/5 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400`}
          >
            <span className="text-6xl font-semibold tracking-tighter">{level}</span>
            <p className="mt-6 font-medium">{LEVEL_INFO[level].title}</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">{LEVEL_INFO[level].desc}</p>
            <span className="absolute right-8 top-8 text-stone-300 transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden>
              →
            </span>
          </Link>
        ))}
        {COMING_LEVELS.map((c) => (
          <ComingSoon key={c.name} title={c.title} desc={c.desc}>
            <span className="text-6xl font-semibold tracking-tighter">{c.name}</span>
          </ComingSoon>
        ))}
      </div>

      <h2 className="mb-4 mt-14 text-sm font-medium uppercase tracking-widest text-stone-400">Textbooks</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {COMING_TEXTBOOKS.map((c) => (
          <ComingSoon key={c.name} title={c.title} desc={c.desc}>
            <span className="text-3xl font-semibold tracking-tight">{c.name}</span>
            <span className="mt-1 block font-jp text-sm text-stone-400">{c.jp}</span>
          </ComingSoon>
        ))}
      </div>
    </Layout>
  )
}

/** A card for something not built yet: dashed, muted, not a link. */
function ComingSoon({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div aria-disabled="true" className={`${card} cursor-default border-dashed border-stone-300 bg-transparent text-stone-400 dark:border-stone-700 dark:text-stone-600`}>
      <div className="pr-28">{children}</div>
      <p className="mt-6 font-medium text-stone-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-stone-400 dark:text-stone-500">{desc}</p>
      <span className="absolute right-6 top-7 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:bg-stone-800 dark:text-stone-400">
        Coming soon
      </span>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

export function Hero() {
  return (
    <Layout>
      <section className="flex min-h-[70vh] flex-col justify-center">
        <p className="font-jp text-sm tracking-[0.3em] text-accent">日本語能力試験</p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Prepare for the JLPT,
          <br />
          <span className="text-stone-400 dark:text-stone-500">a little every day.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600 dark:text-stone-400">
          Focused practice for N4 and N3. Kanji and vocabulary come back on a spaced-repetition schedule.
          Grammar, reading and listening drill in short sets. Mock tests mix all five sections.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/levels"
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 font-medium text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            Start practicing <span aria-hidden>→</span>
          </Link>
          <span className="text-sm text-stone-400">No account. Progress stays in this browser.</span>
        </div>

        <dl className="mt-20 grid grid-cols-3 gap-6 border-t border-stone-200 pt-8 text-sm dark:border-stone-800">
          {[
            ['漢字・語彙', 'Spaced repetition'],
            ['文法・読解・聴解', 'Practice sets'],
            ['模擬試験', 'Mock tests'],
          ].map(([jp, en]) => (
            <div key={en}>
              <dt className="font-jp text-stone-900 dark:text-stone-100">{jp}</dt>
              <dd className="mt-1 text-stone-500">{en}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Layout>
  )
}

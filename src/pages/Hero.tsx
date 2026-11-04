import { Furi } from '../components/JP'
import { ButtonLink, Layout } from '../components/Layout'

export function Hero() {
  return (
    <Layout>
      <section className="flex min-h-[70vh] flex-col justify-center">
        <Furi as="p" text="日本語能力試験" className="text-sm tracking-[0.3em] text-accent" />
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Prepare for the JLPT,
          <br />
          <span className="text-stone-400 dark:text-stone-500">a little every day.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600 dark:text-stone-400">
          This is an app purely for learning intents and purposes. I basically scraped as much information
          on the JLPT as humanly possible and tried to fit in what I could here.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <ButtonLink to="/levels">Start practicing <span aria-hidden>→</span></ButtonLink>
          <span className="text-sm text-stone-400">All progress stays in this browser.</span>
        </div>

        <dl className="mt-20 grid grid-cols-3 gap-6 border-t border-stone-200 pt-8 text-sm dark:border-stone-800">
          {[
            ['漢字・語彙', 'Spaced repetition'],
            ['文法・読解・聴解', 'Practice sets'],
            ['模擬試験', 'Mock tests'],
          ].map(([jp, en]) => (
            <div key={en}>
              <dt className="text-stone-900 dark:text-stone-100"><Furi text={jp} /></dt>
              <dd className="mt-1 text-stone-500">{en}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Layout>
  )
}

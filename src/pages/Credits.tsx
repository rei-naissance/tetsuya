import type { ReactNode } from 'react'
import { Layout } from '../components/Layout'

/** Where the app's content comes from, and the licences that ask for credit. Linked from every page's footer. */
const SOURCES: { group: string; items: { name: string; url: string; what: string; licence?: ReactNode }[] }[] = [
  {
    group: 'Questions and lessons',
    items: [
      {
        name: 'Japanesetest4you',
        url: 'https://japanesetest4you.com',
        what: 'JLPT N4 and N3 exercises (vocabulary, grammar, reading, listening with its audio and pictures), the vocabulary lists and word pages, the grammar pattern pages and their example audio.',
        licence: 'All rights belong to Japanesetest4you; used here for personal study.',
      },
      {
        name: 'JapaneseJLPT',
        url: 'https://www.japanesejlpt.com',
        what: 'N4 grammar lessons, grammar tests and kanji tests.',
        licence: 'All rights belong to JapaneseJLPT; used here for personal study.',
      },
    ],
  },
  {
    group: 'Dictionary and sentences',
    items: [
      {
        name: 'JMdict',
        url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
        what: 'Word meanings in the lists shown after answering a question.',
        licence: <>© Electronic Dictionary Research and Development Group, <Licence href="https://www.edrdg.org/edrdg/licence.html">CC BY-SA 4.0</Licence>. Used through <a href="https://github.com/scriptin/jmdict-simplified" target="_blank" rel="noreferrer" className="underline underline-offset-2">jmdict-simplified</a>.</>,
      },
      {
        name: 'KANJIDIC2',
        url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
        what: 'Kanji meanings, on and kun readings, stroke counts, school grades and frequency ranks on the kanji pages.',
        licence: <>© Electronic Dictionary Research and Development Group, <Licence href="https://www.edrdg.org/edrdg/licence.html">CC BY-SA 4.0</Licence>. Used through <a href="https://github.com/scriptin/jmdict-simplified" target="_blank" rel="noreferrer" className="underline underline-offset-2">jmdict-simplified</a>.</>,
      },
      {
        name: 'KanjiVG',
        url: 'https://kanjivg.tagaini.net',
        what: 'Stroke order drawings, stroke numbers and kanji parts on the kanji pages.',
        licence: <>© Ulrich Apel and contributors, <Licence href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</Licence>.</>,
      },
      {
        name: 'Tatoeba',
        url: 'https://tatoeba.org',
        what: 'Extra example sentences, with English, on the vocabulary word pages and flashcards.',
        licence: <><Licence href="https://creativecommons.org/licenses/by/2.0/fr/">CC BY 2.0 FR</Licence>. Most Japanese and English pairs come from the Tanaka Corpus, which is in the public domain.</>,
      },
    ],
  },
  {
    group: 'Software and fonts',
    items: [
      {
        name: 'kuromoji.js',
        url: 'https://github.com/takuyaa/kuromoji.js',
        what: 'Splits Japanese text into words to add furigana and find words for the word lists.',
        licence: <Licence href="https://www.apache.org/licenses/LICENSE-2.0">Apache License 2.0</Licence>,
      },
      {
        name: 'WanaKana',
        url: 'https://github.com/WaniKani/WanaKana',
        what: 'Romaji ↔ kana conversion for search.',
        licence: <Licence href="https://github.com/WaniKani/WanaKana/blob/master/LICENSE">MIT License</Licence>,
      },
      {
        name: 'Inter, Noto Sans JP, Noto Serif JP',
        url: 'https://fonts.google.com',
        what: 'The app’s typefaces, served by Google Fonts.',
        licence: <Licence href="https://openfontlicense.org">SIL Open Font License 1.1</Licence>,
      },
    ],
  },
  {
    group: 'Written for this app',
    items: [
      {
        name: 'Translations and particle lessons',
        url: '',
        what: 'The English translations of question sentences and passages, and the particle explanations and drills, were written by Claude (an AI model by Anthropic). They haven’t been checked by a translator or teacher yet.',
      },
      {
        name: 'Mock test layout',
        url: 'https://www.jlpt.jp/e/guideline/testsections.html',
        what: 'The papers, question types and time limits follow the official test sections published at jlpt.jp; item counts are the post-2020 figures, which can vary slightly between sessions.',
      },
    ],
  },
]

function Licence({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{children}</a>
}

export function Credits() {
  return (
    <Layout back={{ to: '/', label: 'Home' }} title="Credits">
      <h1 className="text-3xl font-semibold tracking-tight">Credits</h1>
      <p className="mt-2 text-stone-500">
        Tetsuya is a personal study project built on other people’s work. Here’s where everything comes from.
        It isn’t affiliated with the Japan Foundation, JEES (the organisers of the JLPT) or any of the sites below.
      </p>

      {SOURCES.map((s) => (
        <section key={s.group} className="mt-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">{s.group}</h2>
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {s.items.map((it) => (
              <li key={it.name} className="px-5 py-4">
                <p className="font-medium">
                  {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{it.name} ↗</a> : it.name}
                </p>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{it.what}</p>
                {it.licence && <p className="mt-1 text-xs text-stone-500">{it.licence}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Layout>
  )
}

# Tetsuya · JLPT N4 / N3 practice

A small, distraction-free web app for JLPT N4 and N3 practice. It has no backend and no accounts. All progress stays in the browser's `localStorage`.

- **Kanji & Vocabulary** use Anki-style spaced repetition (simplified SM-2).
- **Grammar, Reading & Listening** are drilled in short sets (5, 10 or 20 questions) with instant feedback. Each set starts with questions you haven't seen, then the ones you missed, and there's a "Retry mistakes" set.
- **Every section is split by JLPT question type** (問題), e.g. grammar → 文法形式の判断 / 文の組み立て (★) / 文章の文法, so you can drill one format at a time or all of them mixed.
- **Learn** (a sandbox next to the question practice):
  - **Vocabulary list**: the full JLPT word list for the level, searchable by kanji, kana, romaji or English. Each word has a page with meaning, word type, example sentences and sentences from this app's questions. Mark words "learning" or "known" and drill them as flashcards.
  - **Kanji**: every kanji in the level's word list, most-used first, searchable by kanji, reading (kana or romaji) or English. Each has a page with meanings, on and kun readings, an animated stroke order you can also step through, its parts and the level's words that use it. Word pages link to their kanji.
  - **Grammar patterns**: one page per pattern with meaning, formation, explanations, examples (with audio where the source has it) and the app's questions that use it, plus a drill that blanks the pattern out of its examples.
  - **Particles**: hand-written contrasts (に vs で, まで vs までに, には / での…) with explanations, example pairs and drills, plus a drill of the particle questions already in the exercises. **Draft: not yet checked by a teacher.**
- **Mock tests** draw a randomized set from all five sections and score it at the end, with a per-section breakdown and a mistake review.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Build | **Vite** | Instant dev server; outputs a plain static site |
| UI | **React 18 + TypeScript** | Component model, type-safe question data |
| Styling | **Tailwind CSS v4** | Utility classes; no separate design system to maintain |
| Routing | **react-router (HashRouter)** | Works on any static host with no server rewrites |
| Storage | **localStorage** | Enough for SRS state (a few KB per thousand cards) |
| Tests | **Vitest** | Unit tests for the SRS scheduler |

Next.js would add a server runtime this app doesn't need, so it isn't used here.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Both `dev` and `build` first run `npm run data`, which converts `data/` into the app's format (see [Question data](#question-data)).

To create a static build in `dist/` for Netlify, GitHub Pages, Vercel or any file host, run:

```bash
npm run build
```

Run the SRS unit tests with:

```bash
npm test
```

## Deploying (Vercel)

Import the repository in Vercel; it detects Vite, so the defaults work: `npm run build`, output `dist`. The build regenerates `public/data` and `public/media` from `data/` (the `prebuild` script), so **`data/` and `scripts/` must be committed**. Without them the site builds with no questions.

- **Routing:** the app uses hash URLs (`/#/n4/...`), so no rewrite rules are needed.
- **Link previews:** `og:image` needs an absolute URL. On Vercel it is filled in from the production domain (`VERCEL_PROJECT_PRODUCTION_URL`, see `vite.config.ts`). Set `VITE_SITE_URL` (e.g. `https://example.com`) to use a custom domain instead.
- **Icons:** `public/favicon.ico` (16/32/48) and `favicon.png` are for tabs. `apple-touch-icon.png`, `icon-192/512.png` and `icon-maskable-512.png` (listed in `site.webmanifest`) are for home screens, on the app's background colour. `og-image.png` is the link preview. They're all made from the 徹夜 logo PNG: the tab icon is 徹 alone, because both characters are unreadable at 16 px.
- **Size:** about 64 MB and 340 files, mostly listening audio.

## Project structure

```
data/                       ← source exercises (jlpt_<level>_<section>_data.json + listening media,
                              plus the extra sets below)
scripts/
  build-data.mjs            ← converts data/ → public/data + public/media
  japanese.mjs              ← furigana (kuromoji) and JMdict glossary helpers
  kanji.mjs                 ← KANJIDIC2 + KanjiVG → data/kanji.json
public/                     ← static files; data/ and media/ inside it are generated and git-ignored
  data/n4.json, n3.json     ← question banks the app fetches at runtime
  data/n4-words.json, …     ← vocabulary lists for the word browser
  data/n4-kanji.json, …     ← kanji pages; data/kanji-strokes.json holds their stroke paths
  data/n4-grammar.json, …   ← grammar patterns
  data/particles.json       ← particle contrasts
  favicon.ico, favicon.png, apple-touch-icon.png, icon-*.png, site.webmanifest, og-image.png
                            ← icons and link preview, made from the 徹夜 logo
  media/n4/, media/n3/      ← listening audio + pictures
src/
  lib/
    types.ts                ← Question / Level / Section types
    data.ts                 ← loads + validates JSON, filters by section
    srs.ts                  ← SM-2 scheduler + localStorage persistence
    srs.test.ts
    progress.ts             ← practice history + "unseen first" set picker
    progress.test.ts
    words.ts                ← word list loading, search, learning/known marks
    words.test.ts
    learn.ts                ← loads grammar patterns and particles
    random.ts               ← shuffle / sample / choice shuffling
    history.ts              ← mock-test score history
    storage.ts              ← safe localStorage JSON wrapper
    prefs.tsx               ← furigana, set size and new-cards-per-day preferences
    useQuestions.ts, useKeys.ts
  components/
    Layout.tsx              ← header, Button, ProgressBar
    QuestionView.tsx        ← renders any question (passage / audio / choices)
    JP.tsx                  ← furigana + underline markup renderer
  pages/
    Hero.tsx  LevelSelect.tsx  ModeSelect.tsx
    SectionPage.tsx         ← a section's question types, with progress
    Review.tsx              ← SRS session (kanji, vocabulary), one deck per type
    Practice.tsx            ← practice set (grammar, reading, listening)
    MockTest.tsx
    WordList.tsx  WordDetail.tsx  WordCards.tsx   ← Learn → vocabulary list
    Kanji.tsx               ← Learn → kanji (list + kanji page with stroke order)
    Grammar.tsx             ← Learn → grammar patterns (list + pattern page)
    Particles.tsx           ← Learn → particles (list + contrast page)
  App.tsx                   ← routes
```

## Question data

### Source: `data/`

The exercise files in `data/` are converted by `scripts/build-data.mjs` (`npm run data`, also run automatically before `dev` and `build`). It writes `public/data/<level>.json` and copies listening media into `public/media/<level>/`. Both outputs are generated, so they're git-ignored. To change the question bank, edit or add files in `data/` and restart `npm run dev`.

What the converter does with each section:

| Section | Source | Conversion |
|---|---|---|
| **Kanji** (SRS) | `jlpt_n4_kanji_tests.json` | Reading and writing questions on the 【bracketed】 word. The source has no answer field, so the answer is the choice that matches the item's full sentence and kana sentence. The sentence, its kana and the English are shown after answering |
| | The word lists attached to every exercise (`vocabulary`, and the "New words" lines in listening pages) | Each word containing kanji becomes a reading card. Romaji is converted to hiragana. Three distractor readings of similar length are picked deterministically. The English meaning is shown after answering |
| **Vocabulary** (SRS) | `jlpt_<level>_vocabulary_data.json` | Fill-in-the-blank, paraphrase (`A => B`), and usage questions. Each type gets its own JLPT-style instruction |
| **Grammar** | `jlpt_<level>_grammar_data.json` | Fill-in-the-blank and ★ sentence-ordering questions. Missing N3 answer keys are taken from `jtest4you_n3_grammar_exercises.json`, but only where the same question text appears on that page |
| | `jlpt_n4_grammar_tests.json` | Fill-in-the-blank questions. The spaces left by stripped furigana are removed, and each `A:` / `B:` speaker starts a new line |
| **Reading** | `jlpt_<level>_reading_data.json` | Questions keep their passage and a `group` id, so a passage's questions always appear together and in order |
| **Listening** | `jlpt_<level>_listening_data.json` + media | Answers come from the page's answer key. Picture choices show the picture with 1–4 buttons, which are never shuffled. Spoken choices (3 or 4) show only the buttons. N3 text choices are shown as text. The site's "QUESTION N" placeholder images are dropped |

After answering, fill-in-the-blank questions show the completed sentence. Any glossary words from that exercise's word list that appear in the question are listed too.

### Furigana, word meanings and translations

These are added to every question at build time (`scripts/japanese.mjs`):

- **Furigana.** The [kuromoji](https://github.com/takuyaa/kuromoji.js) tokenizer adds `{漢字|かな}` to every kanji word that has none. It skips the underlined word of a kanji question, and that word anywhere else in the sentence, and never touches kanji-question choices, so furigana can't give the answer away. A few readings kuromoji gets wrong are fixed in `READINGS` (日本 → にほん, この間 → このあいだ, 何 → なん before a counter).
- **Known readings win.** In a kanji-reading or spelling question the right reading of the tested word is part of the question, so it overrides the tokenizer's guess, which can't tell 通う from 通る in 通って. The explanation then shows {通|かよ}って, and the word list shows 通う, not 通る. If no dictionary entry fits the reading, the word is left out of the list rather than listed wrong.
- **Whole sentences.** The sentence is read with its markup taken out, so a word cut by an underline (以**上**) is still read in context; an underline that cuts a word moves out to the word's edge (except in kanji questions, where it is exactly the tested word). App labels typed in the code (section names, question types, headings) get their readings from `src/lib/ruby.ts`.
- **Word meanings.** The content words of each question are looked up in `data/dictionary.json`, a subset of [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) (© EDRDG, CC BY-SA 4.0; credited on the Credits page). They're added after the exercise's own word list: up to 12 per question, 30 for a reading passage. To rebuild the subset, download `jmdict-eng-*.json` from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified/releases) and run `npm run data -- --jmdict <file>`.
- **Translations.** `data/translations.json` maps each Japanese sentence (markup removed) to English: the filled-in sentence for fill-in-the-blank questions, both sides of paraphrase questions, the correct sentence for usage questions, and reading passages with their questions and choices. Kanji questions already carry English in their explanations, and listening has no transcripts to translate. The translations were written by Claude and haven't been checked by a translator. `npm run data -- --untranslated <file>` writes any sentences still missing (for new or changed questions).

**Kanji word cards** (`kind: "words"`) are built from the exercise word lists. Their wrong choices are near misses of the right reading, the way the JLPT writes them (`misreadings` in `scripts/japanese.mjs`): voicing (こたえ → ごたえ), long vowels (こ ↔ こう, せ ↔ せい), a small っ in or out, きょ → き; only the part read off the kanji changes, and no wrong choice is another real reading in the deck. Vowel changes (まける → もける) are a fallback for short readings.

**Question types.** Every question gets a `kind`, the JLPT question type it belongs to. The app groups practice by it (see `KINDS` in `src/lib/types.ts`):

| Section | `kind` values |
|---|---|
| Kanji | `reading` 漢字読み, `writing` 表記, `words` (cards built from the word lists) |
| Vocabulary | `context` 文脈規定, `paraphrase` 言い換え類義, `usage` 用法 |
| Grammar | `form` 文法形式の判断, `order` 文の組み立て (★), `passage` 文章の文法 |
| Reading | `comprehension` 内容理解 |
| Listening | `picture` (has a picture), `response` (3 choices, 即時応答), `audio` (the rest) |

**Skipped items.** The script prints a per-section report every time it runs; `npm run data -- --skipped` also lists each skipped question's page and reason. A question is skipped when it has no answer key, lost choices in the scrape, has no passage, has a type the converter doesn't recognise, or (kanji tests) when its sentence doesn't single out one choice. Right now only one is skipped: a japanesejlpt.com grammar question whose page lists the same choice twice.

Fix the source file and the question is picked up on the next run.

### Vocabulary list (Learn)

`data/jlpt_<level>_vocab_list.json` comes from `scrape_vocab_list.py` (in the parent `scripts` folder). It scrapes the japanesetest4you JLPT vocabulary list, plus the word page for each entry that links to one. About half the entries have a page (N4: 287 of 536, N3: 824 of 1723). Those get kana, other spellings, word type, a fuller meaning, example sentences with romaji and English, similar words, and a link to a conjugation chart. The rest only have the list line, so their kana is converted from the romaji.

The converter writes `public/data/<level>-words.json`. It also searches the question bank's complete sentences (no blanks or ★) for each word and keeps up to 3 as "In this app's questions". It matches verb and い-adjective stems (上がる finds 上がって), skips one-kanji words inside compounds (味 not in 興味), and skips sentences that belong to a longer list word (合う not in 間に合う). With those, 433 of the N4 words and 1141 of the N3 words have at least one example. Up to 8 page examples are kept per word, and the word is underlined in each one it can be found in.

**Tatoeba sentences.** `data/tatoeba.json` adds example sentences with English from [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR; most Japanese/English pairs come from the public-domain Tanaka Corpus) to every list word it can, after the word page's own examples, up to 10 per word. That gives sentences to the words without a word page (N4: 522 of 536 words now have examples, N3: 1686 of 1723). Tatoeba and its licence are credited on the Credits page (`/credits`, linked from every page's footer); each sentence keeps its Tatoeba id in the data. Words are matched through Tatoeba's Japanese indices, which list every word's dictionary form (通って is indexed as 通う), and homographs are told apart by reading (方 かた vs ほう). Short sentences whose other words are on the level's list, and ones Tatoeba marks as good examples, come first.

To rebuild the subset, download `jpn_indices.tar.bz2`, `per_language/jpn/jpn_sentences.tsv.bz2` and `per_language/eng/eng_sentences.tsv.bz2` from [tatoeba.org/downloads](https://tatoeba.org/en/downloads), unpack them into one folder and run `npm run data -- --tatoeba <folder>` (`scripts/tatoeba.mjs`). The downloads aren't needed for a normal build.

### Kanji (Learn)

`data/kanji.json` is a subset of [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) (© EDRDG, CC BY-SA 4.0) and [KanjiVG](https://kanjivg.tagaini.net) (© Ulrich Apel, CC BY-SA 3.0) for every kanji in the two word lists (headwords and other spellings). The converter writes `public/data/<level>-kanji.json`: the kanji in that level's headwords, sorted by KANJIDIC2's newspaper frequency rank (kanji outside the top 2,500 come last, by stroke count), each with the level's words written with it. N3 kanji that are also on the N4 list are flagged `earlier`, and the list can hide them. Stroke paths (rounded to 0.1, in KanjiVG's 109×109 box, in stroke order) and stroke-number positions go in `public/data/kanji-strokes.json`, which only the kanji page loads.

To rebuild the subset, download `kanjidic2-en-*.json.tgz` from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified/releases) and the `kanjivg-*-main.zip` release from [KanjiVG](https://github.com/KanjiVG/kanjivg/releases), unpack both and run `npm run data -- --kanjidic <kanjidic2-en.json> --kanjivg <kanjivg folder>/kanji` (`scripts/kanji.mjs`). The downloads aren't needed for a normal build.

### Grammar patterns (Learn)

`scrape_grammar.py` (parent `scripts` folder) scrapes two sites:

- **japanesetest4you**, N4 and N3 → `data/jlpt_<level>_grammar_patterns.json`. The grammar list, plus each pattern's page: meaning, sometimes formation and notes, and example sentences with romaji, English and audio links.
- **japanesejlpt**, N4 only → `data/jlpt_n4_grammar_lessons.json`. Each lesson has a title, a goal, "why it means that" and "how it is built" explanations, formation, and examples. These keep their furigana, and the site marks the pattern in each one.

The converter merges them into `public/data/<level>-grammar.json`. japanesejlpt lessons come first in chapter order. A japanesetest4you pattern with the same Japanese (or the same romaji as a lesson's URL) is folded into that lesson; the rest follow in list order. Up to 10 japanesetest4you examples are kept per pattern, with the pattern underlined where it can be found.

**Drills** come from examples where the pattern is underlined: the underlined part becomes the blank. The 3 wrong choices are other patterns' underlined parts of a similar length, picked deterministically. Because the wrong choices are picked automatically, a drill can sometimes have a second choice that also fits.

**In this app's questions** lists up to 3 grammar-form questions per pattern. Each question goes to exactly one pattern: the one with the longest piece covering the answer in the filled-in sentence. So 起きた（ばかり） goes to ～たばかりです, not ～ばかり. Equally long matches share the question; the two らしい lessons, for example, match the same sentences. This is one pass over the questions, each checking a short window around the blank (about 30 ms for N4).

`data/grammar-links.json` corrects what that misses. Per level, key a pattern exactly as the app shows it, then `hide` question ids from it or `add` ids to it. Hover a sentence on a pattern page to see its id. The script warns about pattern names or ids it can't find.

### Particles (Learn)

`data/particles.json` is hand-written, not scraped. Each contrast has a summary, rules with example pairs, and fill-in drills with an explanation. N4 shows the N4 contrasts; N3 shows all of them. The converter also lists every grammar question in the bank whose choices are all particles, for the "Particle questions from the exercises" drill. The file is a **draft written by Claude**; have it checked before relying on it, and edit it freely: drill ids are `p-<contrast id>-<n>`, so keep a contrast's id stable to keep its progress.

**Malformed source choices.** Some source questions have the rest of the question (extra dialogue lines, or the underlined phrase in reading) at the front of their `choices` array. The converter moves those pieces back into the question text. The answer index always counts from the last four choices.

### App format

`public/data/<level>.json` looks like this. You can also hand-write questions in this shape.

```jsonc
{
  "level": "N4",
  "questions": [
    {
      "id": "n4-grammar-ex1-q1",           // REQUIRED, unique and stable (SRS progress is keyed by id)
      "section": "grammar",                // kanji | vocabulary | grammar | reading | listening
      "prompt": "（　　）に{何|なに}を{入|い}れますか。",
      "target": "あの人は病気ではない（　　）くすりをたくさん飲んでいます。",  // optional, shown large
      "choices": ["ので", "ために", "のに", "から"],
      "answer": 2,                         // zero-based index into choices
      "explanation": "あの人は病気ではない**のに**くすりを…",  // optional, shown after answering
      "glossary": [{ "word": "病気", "reading": "びょうき", "meaning": "illness" }],  // optional
      "en": { "sentence": "That person isn't sick, and yet…" }  // optional: sentence, passage, prompt, choices[]
    },
    {
      "id": "n4-reading-ex1-q1",
      "section": "reading",
      "passage": "A「日本人が昼ごはんに…」",
      "group": "n4-reading-ex1-abc",       // optional; same group = kept together, in order
      "prompt": "[ 1 ] には何を入れますか。",
      "choices": ["…", "…", "…", "…"],
      "answer": 2
    },
    {
      "id": "n4-listening-ex1-q1",
      "section": "listening",
      "audio": "media/n4/ex1_audio_1.mp3", // relative to /public
      "image": "media/n4/ex1_image_1.gif", // optional
      "transcript": "女：…",               // optional; shown after answering, or up front if audio is missing
      "prompt": "音声を聞いて…",
      "choices": ["1", "2", "3", "4"],
      "answer": 1,
      "keepOrder": true                    // don't shuffle (choices refer to the picture/audio)
    }
  ]
}
```

**Text markup.** Every text field supports:

| Markup | Renders as |
|---|---|
| `{漢字|かんじ}` | Furigana (ruby). The header toggle hides it everywhere |
| `**word**` | Underlined target word. It may contain furigana |
| `\n` | Line break |

Choices are shuffled every time a question is shown, unless `keepOrder` is set. The app also skips malformed questions with a console warning instead of crashing.

## How the SRS works

`src/lib/srs.ts` implements a simplified SM-2 with learning steps, like Anki. It's used by the kanji and vocabulary decks and by the vocabulary-list flashcards.

- **New cards** go through learning steps inside the session: **1 min → 10 min**, then Good graduates them to **1 day**. Again goes back to the first step.
- **Graduated cards** grow by grade:

| Grade | Effect |
|---|---|
| **Again** | Lapse: ease −0.20, relearning step of 10 min, then the interval restarts at 20% of what it was |
| **Hard** | interval × 1.2, ease −0.15 |
| **Good** | interval × ease; ease +0.05 if below 2.5 (so it recovers after lapses) |
| **Easy** | interval × ease × 1.3, ease +0.15 |

- Ease starts at 2.5 and is clamped to 1.3–3.5. A card with an interval of 21+ days counts as learned.
- A session (`src/lib/useSrsSession.ts`) shows learning cards as their step comes due, otherwise **due reviews first** (most overdue first), then the day's new cards. When only learning cards are left, they're shown up to 20 minutes early, so a session ends once everything in it has graduated. The header shows Anki's three counts: new · learning · due.
- **Daily limits** (Daily limits and custom study, on each flashcard section and the word list): **new cards a day** (default 10) and **reviews a day** (default 200, or No limit). Any whole number can be typed. Due reviews past the limit wait for the next day; cards already in learning steps are never held back.
- Limits are counted **per section** (`N4-kanji`, `N4-vocabulary`, `N4-words`), shared by every question-type deck in it and by Mixed, so studying from several decks can't multiply the allowance. Counts live in `tetsuya:srs:daily:v1` and start over only when the **study day** changes, at **4 a.m.** like Anki (a late-night session stays on the same day). Changing a limit never clears them: lowering it below what you've done gives 0 left, raising it gives the difference.
- **Custom study** (same panel, and on the finished screen): add any number of extra **new cards** or **reviews** for today only, or **review ahead**: the graduated cards due in the next N days, ignoring the limits. An early review grows the interval from the time that actually passed since the last review and never shortens it, so cramming can't push a card further out than it earned.
- "I already know this" on a new card schedules it 30 days out.
- Each question type is its own deck (`N4-kanji-reading`), the Mixed option uses the section deck (`N4-kanji`), and the vocabulary list is `N4-words` (new words in list order).
- The app only shows **Again** and **Good**, the two most Anki users stick to (`GRADES` in `src/pages/Review.tsx`; the scheduler still supports Hard and Easy). Kanji and vocabulary questions are multiple choice: a wrong answer counts as Again, a right one offers Again (if you guessed) or Good. Word flashcards flip, then take either grade. Each button shows when the card comes back.
- Keyboard: `1–4` answers; after that `1` = Again, `2`/`Space`/`Enter` = Good. `Space` also flips a word card.

**Mixed shares progress** with the question types in a section: it's a shuffle of the same questions, so a question you answer in Grammar form also counts as tried in Grammar Mixed.

`localStorage` keys:

| Key | Contents |
|---|---|
| `tetsuya:srs:cards:v1` | `{ [questionId or wordId]: { ease, interval, reps, lapses, due, last, step?, relearn? } }` |
| `tetsuya:srs:daily:v1` | For the current study day, per section: new cards introduced, reviews done, extra new cards and extra reviews allowed |
| `tetsuya:mock:history:v1` | Last 50 mock-test results |
| `tetsuya:practice:v1` | Practice history per question: times seen, times right, last answer right?, when. Also covers grammar-pattern and particle drills |
| `tetsuya:words:v1` | Old vocabulary marks from before word flashcards used SRS. Converted to cards on first load (known → learned, learning → due), then removed |
| `tetsuya:prefs:v1` | Furigana, questions per set (0 = all), new cards a day, reviews a day (0 = no limit) |

"Reset progress" at the bottom of a level page clears all of the above except prefs.

## Tuning

| What | Where |
|---|---|
| Daily limits (defaults, quick picks, day start) | `NEW_PER_DAY`, `MAX_REVIEWS`, `DAY_STARTS_AT` in `src/lib/srs.ts`; `NEW_PER_DAY_PRESETS`, `MAX_REVIEWS_PRESETS` in `src/lib/prefs.tsx` |
| Learning steps | `LEARN_STEPS`, `RELEARN_STEPS` in `src/lib/srs.ts` |
| Practice set sizes | `SET_SIZES` in `src/lib/prefs.tsx` |
| Question types and their labels | `KINDS` in `src/lib/types.ts` |
| Mock test layout (papers, 問題, counts, minutes) | `JLPT_FORMAT` in `src/lib/mock.ts` |
| Instructions shown per question type | `PROMPTS` in `scripts/build-data.mjs` |
| Accent color, fonts | `@theme` block in `src/index.css` |
| Buttons, action rows, pickers | The design-system block in `src/components/Layout.tsx` |

## Credits

Sources and licences are listed once, on the Credits page (`src/pages/Credits.tsx`, route `/credits`), which every page links to from its footer. Pages themselves don't carry source links or licence notes. Add a source there when you add data from somewhere new.

## Design system

Every action uses the shared components in `src/components/Layout.tsx`, so buttons don't drift in size or style:

| Piece | Use |
|---|---|
| `Button` / `ButtonLink` | `variant`: **primary** (the one main action of a row), **secondary** (others beside it), **ghost** (Previous, Back). `size`: **md** (44px, min 7rem wide; every standalone action), **sm** (36px; pagination, header), **tile** (56px, two lines; grade buttons), **icon** (36px circle; play audio) |
| `count` prop | A number inside the button ("Drill all 84") instead of a long label. Labels are short verbs: Start, Continue, Study, Retry mistakes |
| `TextButton` | Minor actions that shouldn't compete with buttons: Submit early, I already know this, Reset progress (`tone="danger"`) |
| `Actions` | A row of actions, primary first: `align="center"` on end screens, `"start"` in cards, `"between"` for answer footers and Previous / Next |
| `Chips` | The one single-choice picker (questions per set, word filters) |
| `NumberField` | A typed number with quick picks (daily limits) |

**Gaps.** Blanks in question text are drawn as one `Gap` badge (`src/components/JP.tsx`, parsing in `src/lib/gaps.ts`), whatever way the source wrote them:

| Gap | Written as | Color |
|---|---|---|
| Numbered (reading, text grammar) | `[ 1 ]`, `「１」`, `「___１___」` | Its own hue per number, `--gap-1` … `--gap-5` in `src/index.css`, the same in the passage, the question and the English translation |
| Blank (grammar form, vocabulary, sentence order) | `（　　）` | `--gap-0` (neutral) |
| Star (sentence order) | `★` | The accent |

The gap a question asks about is solid and the others are faded; once answered, it shows the right answer (the English choice in the translation, when there is one). `（１）` isn't a gap: in these passages it numbers list items. The tested word in kanji and vocabulary questions stays an accent underline. Every gap color passes 4.5:1 on its badge in both themes.

Class names aren't merged, so a size or shape is never overridden with `className`; add a size to `buttonClass` instead. A few controls are purpose-built and stay their own: answer choices, the flashcard, the mock-test question grid, and the Previous / Next word links.

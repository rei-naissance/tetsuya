# Tetsuya · JLPT N4 / N3 practice

A small, distraction-free web app for JLPT N4 and N3 practice. It has no backend and no accounts. All progress stays in the browser's `localStorage`.

- **Kanji & Vocabulary** use Anki-style spaced repetition (simplified SM-2).
- **Grammar, Reading & Listening** are drilled in short sets (5, 10 or 20 questions) with instant feedback. Each set starts with questions you haven't seen, then the ones you missed, and there's a "Retry mistakes" set.
- **Every section is split by JLPT question type** (問題), e.g. grammar → 文法形式の判断 / 文の組み立て (★) / 文章の文法, so you can drill one format at a time or all of them mixed.
- **Learn** (a sandbox next to the question practice):
  - **Vocabulary list**: the full JLPT word list for the level, searchable by kanji, kana, romaji or English. Each word has a page with meaning, word type, example sentences and sentences from this app's questions. Mark words "learning" or "known" and drill them as flashcards.
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
public/                     ← static files; data/ and media/ inside it are generated and git-ignored
  data/n4.json, n3.json     ← question banks the app fetches at runtime
  data/n4-words.json, …     ← vocabulary lists for the word browser
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
    prefs.tsx               ← furigana on/off preference
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
      "glossary": [{ "word": "病気", "reading": "びょうき", "meaning": "illness" }]  // optional
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

`src/lib/srs.ts` implements a simplified SM-2, similar to Anki:

| Grade | Effect |
|---|---|
| **Again** | Card resets, ease −0.20, due again in 10 min, and re-queued at the end of the current session |
| **Hard** | interval × 1.2, ease −0.15 |
| **Good** | interval × ease |
| **Easy** | interval × ease × 1.3, ease +0.15 |

- New cards step through **1 day → 3 days** (Good) before multiplicative growth starts. Ease starts at 2.5 and is clamped to 1.3–3.5.
- Each session shows **due cards first** (most overdue first), then up to **10 new cards per deck per day** (`NEW_PER_DAY`). Each question type is its own deck (`N4-kanji-reading`), and the Mixed option uses the section deck (`N4-kanji`).
- Every question is multiple choice. A wrong answer counts as **Again**. A right answer lets you rate Hard / Good / Easy, and each button shows a preview of the next interval.
- Keyboard: `1–4` answers. After answering, `1–4` grades and `Enter` = Good (or Continue).

`localStorage` keys:

| Key | Contents |
|---|---|
| `tetsuya:srs:cards:v1` | `{ [questionId]: { ease, interval, reps, lapses, due, last } }` |
| `tetsuya:srs:daily:v1` | New cards introduced today, per deck |
| `tetsuya:mock:history:v1` | Last 50 mock-test results |
| `tetsuya:practice:v1` | Practice history per question: times seen, times right, last answer right?, when. Also covers grammar-pattern and particle drills |
| `tetsuya:words:v1` | Vocabulary list marks: `{ [wordId]: "learning" \| "known" }` |
| `tetsuya:prefs:v1` | Furigana and questions-per-set preferences |

"Reset progress" at the bottom of a level page clears all of the above except prefs.

## Tuning

| What | Where |
|---|---|
| New cards per day | `NEW_PER_DAY` in `src/lib/srs.ts` |
| Practice set sizes | `SET_SIZES` in `src/lib/prefs.tsx` |
| Question types and their labels | `KINDS` in `src/lib/types.ts` |
| Mock test composition | `MOCK_PLAN` in `src/pages/MockTest.tsx` |
| Instructions shown per question type | `PROMPTS` in `scripts/build-data.mjs` |
| Accent color, fonts | `@theme` block in `src/index.css` |

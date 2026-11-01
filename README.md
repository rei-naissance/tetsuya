# Tetsuya · JLPT N4 / N3 practice

A small, distraction-free web app for JLPT N4 and N3 practice. It has no backend and no accounts. All progress stays in the browser's `localStorage`.

- **Kanji & Vocabulary** use Anki-style spaced repetition (simplified SM-2).
- **Grammar, Reading & Listening** are drilled in randomized 10-question sets with instant feedback.
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

Open http://localhost:5173. To create a static build in `dist/` for Netlify, GitHub Pages, Vercel or any file host, run:

```bash
npm run build
```

Run the SRS unit tests with:

```bash
npm test
```

## Project structure

```
public/
  data/n4.json, n3.json     ← your question banks (fetched at runtime)
  audio/                    ← listening audio files
src/
  lib/
    types.ts                ← Question / Level / Section types
    data.ts                 ← loads + validates JSON, filters by section
    srs.ts                  ← SM-2 scheduler + localStorage persistence
    srs.test.ts
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
    Review.tsx              ← SRS session (kanji, vocabulary)
    Practice.tsx            ← practice set (grammar, reading, listening)
    MockTest.tsx
  App.tsx                   ← routes
```

## Plugging in your data

Replace `public/data/n4.json` and `public/data/n3.json`. The files are fetched at runtime, so in dev you only need to refresh the page, and a deployed site picks up new data without a rebuild.

```jsonc
{
  "level": "N4",
  "version": 1,
  "questions": [
    {
      "id": "n4-kanji-001",                 // REQUIRED, unique, never change it (SRS progress is keyed by id)
      "section": "kanji",                   // kanji | vocabulary | grammar | reading | listening
      "prompt": "＿＿のことばはひらがなでどう書きますか。",
      "target": "{毎朝|まいあさ}、**駅**まで{歩|ある}きます。",   // optional, shown large
      "choices": ["えき", "えぎ", "いき", "えっき"],
      "answer": 0,                          // zero-based index into choices
      "explanation": "駅（えき）= station."  // optional, shown after answering
    },
    {
      "id": "n4-reading-001",
      "section": "reading",
      "passage": "わたしは{毎朝|まいあさ}７{時|じ}に…",  // optional reading passage
      "prompt": "…",
      "choices": ["…", "…", "…", "…"],
      "answer": 0
    },
    {
      "id": "n4-listening-001",
      "section": "listening",
      "audio": "audio/n4/listening-001.mp3",   // optional, relative to /public
      "transcript": "女：…\n男：…",            // optional, shown after answering (or up front if there's no audio)
      "image": "img/n4/l-001.png",             // optional, relative to /public
      "prompt": "…",
      "choices": ["…", "…", "…", "…"],
      "answer": 0
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

**Notes**

- Choices are shuffled every time a question is shown, so it is fine to always put the correct answer at index `0`.
- Malformed questions (missing id, duplicate id, bad `answer` index, unknown section) are skipped with a console warning instead of breaking the app.
- Reading questions that share an identical `passage` are kept next to each other in mock tests.
- Missing audio files fall back to showing the transcript.

## How the SRS works

`src/lib/srs.ts` implements a simplified SM-2, similar to Anki:

| Grade | Effect |
|---|---|
| **Again** | Card resets, ease −0.20, due again in 10 min, and re-queued at the end of the current session |
| **Hard** | interval × 1.2, ease −0.15 |
| **Good** | interval × ease |
| **Easy** | interval × ease × 1.3, ease +0.15 |

- New cards step through **1 day → 3 days** (Good) before multiplicative growth starts. Ease starts at 2.5 and is clamped to 1.3–3.5.
- Each session shows **due cards first** (most overdue first), then up to **10 new cards per deck per day** (`NEW_PER_DAY`).
- Every question is multiple choice. A wrong answer counts as **Again**. A right answer lets you rate Hard / Good / Easy, and each button shows a preview of the next interval.
- Keyboard: `1–4` answers. After answering, `1–4` grades and `Enter` = Good (or Continue).

`localStorage` keys:

| Key | Contents |
|---|---|
| `tetsuya:srs:cards:v1` | `{ [questionId]: { ease, interval, reps, lapses, due, last } }` |
| `tetsuya:srs:daily:v1` | New cards introduced today, per deck |
| `tetsuya:mock:history:v1` | Last 50 mock-test results |
| `tetsuya:prefs:v1` | Furigana preference |

"Reset progress" at the bottom of a level page clears all of the above except prefs.

## Tuning

| What | Where |
|---|---|
| New cards per day | `NEW_PER_DAY` in `src/lib/srs.ts` |
| Practice set size | `PRACTICE_SET_SIZE` in `src/pages/Practice.tsx` |
| Mock test composition | `MOCK_PLAN` in `src/pages/MockTest.tsx` |
| Accent color, fonts | `@theme` block in `src/index.css` |

/**
 * Converts the raw scraped exercise files in /data into the app's question
 * format (public/data/<level>.json) and copies the listening media the app
 * needs into public/media/<level>/.
 *
 *   node scripts/build-data.mjs        (runs automatically before dev / build)
 *
 * Input files:   data/jlpt_<n4|n3>_<vocabulary|grammar|reading|listening>_data.json
 *                data/jlpt_<n4|n3>_listening_media/*
 *                data/jtest4you_n3_grammar_exercises.json  (answer keys missing above)
 *                data/jlpt_n4_<grammar|kanji>_tests.json   (extra question sets)
 *                data/jlpt_<n4|n3>_vocab_list.json         (word browser → public/data/<level>-words.json)
 *                data/jlpt_<n4|n3>_grammar_patterns.json   (grammar patterns → public/data/<level>-grammar.json)
 *                data/jlpt_n4_grammar_lessons.json
 *                data/grammar-links.json                   (hand corrections for "In this app's questions")
 *                data/particles.json                       (hand-written → public/data/particles.json)
 *
 * Questions that can't be used as-is (no answer key, lost choices, missing
 * passage) are skipped and listed in the report this script prints.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { toHiragana } from 'wanakana'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'data')
const OUT_DATA = path.join(ROOT, 'public', 'data')
const OUT_MEDIA = path.join(ROOT, 'public', 'media')
const LEVELS = ['n4', 'n3']

const PROMPTS = {
  n4: {
    blank: '（　　）に{何|なに}を{入|い}れますか。',
    star: '★に{入|はい}るものはどれですか。',
    paraphrase: '＿＿の{文|ぶん}とだいたい{同|おな}じ{意味|いみ}の{文|ぶん}はどれですか。',
    usage: 'つぎのことばの{使|つか}い{方|かた}でいちばんいいものはどれですか。',
    kanji: '＿＿のことばはひらがなでどう{書|か}きますか。',
    kanjiWrite: '＿＿のことばはどう{書|か}きますか。',
    listening: '{音声|おんせい}を{聞|き}いて、{正|ただ}しい{答|こた}えを{選|えら}んでください。',
  },
  n3: {
    blank: '（　　）に{入|い}れるのに{最|もっと}もよいものを{選|えら}びなさい。',
    star: '★に{入|はい}る{最|もっと}もよいものを{選|えら}びなさい。',
    paraphrase: '＿＿に{意味|いみ}が{最|もっと}も{近|ちか}いものを{選|えら}びなさい。',
    usage: 'つぎの{言葉|ことば}の{使|つか}い{方|かた}として{最|もっと}もよいものを{選|えら}びなさい。',
    kanji: '＿＿のことばの{読|よ}み{方|かた}として{最|もっと}もよいものを{選|えら}びなさい。',
    kanjiWrite: '＿＿のことばを{漢字|かんじ}で{書|か}くとき、{最|もっと}もよいものを{選|えら}びなさい。',
    listening: '{音声|おんせい}を{聞|き}いて、{正|ただ}しい{答|こた}えを{選|えら}びなさい。',
  },
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const readOptional = (name) => (fs.existsSync(path.join(SRC, name)) ? readJSON(path.join(SRC, name)) : [])
// A blank is "_______" or, on a few pages, "（　　）".
const BLANK = /[\s　]*(?:_{3,}|（[\s　]*）)[\s　]*/g
const BLANK_TEST = /_{3,}|（[\s　]*）/
// Passage gaps written "「___１___」" → "「１」"
const NUMBERED_SLOT = /「_{2,}[\s　]*([０-９0-9]+)[\s　]*_{2,}」/g
const hasKanji = (s) => /[一-龯㐀-䶿々]/.test(s)
const isKana = (s) => /^[぀-ゟー]+$/.test(s)
// A dialogue line, e.g. "B 「…", "たなか「…", "女１　「…"
const SPEAKER = /^[^\s「」。、]{1,6}[\s　]*「/

/** Deterministic PRNG so regenerated files are stable between runs. */
function rng(seedText) {
  let h = 2166136261
  for (const ch of seedText) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32
  }
}

function romajiToKana(romaji) {
  if (!romaji) return null
  // Keep n' (げんいん); any other apostrophe is noise ("ta'nin").
  const clean = romaji.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, '').replace(/(?<!n)'/g, '')
  const kana = toHiragana(clean, { customKanaMapping: { "n'": 'ん' } })
  return isKana(kana) ? kana : null
}

/** "sentence\nANSWER\nrest" → "sentence**ANSWER**rest" (filled-in sentence). */
function filledSentence(explanation) {
  const parts = explanation.split('\n')
  if (parts.length < 3 || parts.length % 2 === 0) return undefined
  return parts.map((p, i) => (i % 2 ? `**${p.trim()}**` : p)).join('')
}

function makeReport() {
  const r = { kept: {}, skipped: {}, items: [] }
  return {
    keep: (sec) => (r.kept[sec] = (r.kept[sec] ?? 0) + 1),
    skip: (sec, why, where) => {
      (r.skipped[sec] ??= {})[why] = (r.skipped[sec][why] ?? 0) + 1
      r.items.push({ section: sec, why, where })
    },
    data: r,
  }
}

/* ------------------------------------------------------------------ */
/* vocabulary lists → glossary + kanji deck                            */
/* ------------------------------------------------------------------ */

function parseListeningWords(exercise) {
  return exercise.text_content
    .map((line) => line.match(/^([^\s(（:]+) \(([a-z' ]+)\): (.+)$/))
    .filter(Boolean)
    .map(([, word, reading, meaning]) => ({ word, reading, meaning }))
}

function toGlossEntry({ word, reading, meaning }) {
  const kana = romajiToKana(reading)
  return { word: word.trim(), reading: kana ?? undefined, meaning: meaning.trim() }
}

/** Words from the exercise's list that actually appear in the question. */
function glossaryFor(text, words) {
  const seen = new Set()
  return words
    .filter((w) => hasKanji(w.word) && text.includes(w.word) && !seen.has(w.word) && seen.add(w.word))
    .slice(0, 8)
}

function buildKanjiDeck(level, words, report) {
  const byWord = new Map()
  for (const w of words) {
    if (!hasKanji(w.word) || !w.reading) continue
    if (!byWord.has(w.word)) byWord.set(w.word, w)
  }
  const cards = [...byWord.values()]
  const readings = [...new Set(cards.map((c) => c.reading))]

  return cards.map((card) => {
    const rand = rng(`${level}:${card.word}`)
    // Distractors: other readings of similar length, preferring ones that share
    // the first or last kana with the answer so the choice isn't trivial.
    const scored = readings
      .filter((r) => r !== card.reading)
      .map((r) => {
        let score = Math.abs(r.length - card.reading.length) * 2
        if (r[0] !== card.reading[0]) score += 1
        if (r.at(-1) !== card.reading.at(-1)) score += 1
        return { r, score: score + rand() * 2.5 }
      })
      .sort((a, b) => a.score - b.score)
    report.keep('kanji')
    return {
      id: `${level}-kanji-${card.word}`,
      section: 'kanji',
      kind: 'words',
      prompt: PROMPTS[level].kanji,
      target: `**${card.word}**`,
      choices: [card.reading, ...scored.slice(0, 3).map((s) => s.r)],
      answer: 0,
      explanation: `${card.word}（${card.reading}）— ${card.meaning}`,
    }
  })
}

/* ------------------------------------------------------------------ */
/* vocabulary / grammar / reading questions                            */
/* ------------------------------------------------------------------ */

function convertQuestion(level, section, exercise, raw, words, report) {
  const id = `${level}-${section}-ex${exercise.exercise_number}-q${raw.question_number}`
  const where = `${exercise.url}#q${raw.question_number}`

  if (!raw.correct_choice_number) return report.skip(section, 'no answer key', where)
  if (raw.choices.length < 4) return report.skip(section, 'choices lost in scrape', where)

  // Scraped pages sometimes leaked the rest of the question (dialogue lines,
  // the underlined phrase, …) into the front of the choices array. The answer
  // index always refers to the last four entries.
  const choices = raw.choices.slice(-4).map((c) => c.trim())
  const extras = raw.choices.slice(0, -4)
  let text = raw.question.trim()
  for (const piece of extras) {
    if (/^とあるが/.test(piece)) text = `${text.replace(/^(\[\d+\]|\(\d+\))?(.+)$/, '$1**$2**')}${piece}`
    else text += (SPEAKER.test(piece) ? '\n' : '') + piece.trim()
  }
  const answer = raw.correct_choice_number - 1
  const explanation = (raw.explanation ?? '').replace(/[—-]>/g, '=>')

  const q = { id, section, choices, answer }

  const passage = (raw.reading_passage ?? '').replace(/^Reading passage \d+\s*\n?/i, '').replace(NUMBERED_SLOT, '「$1」').trim()

  if (section === 'reading') {
    if (!passage) return report.skip(section, 'passage missing', where)
    Object.assign(q, { kind: 'comprehension', prompt: text, passage, group: `${level}-reading-ex${exercise.exercise_number}-${hashText(passage)}` })
  } else if (section === 'grammar' && passage) {
    // 文章の文法: a passage with numbered gaps 「１」…「５」, one question per gap.
    Object.assign(q, {
      kind: 'passage',
      prompt: text.replace(NUMBERED_SLOT, '「$1」'),
      passage,
      group: `${level}-grammar-ex${exercise.exercise_number}-${hashText(passage)}`,
    })
  } else if (BLANK_TEST.test(text)) {
    // Sentence-ordering items (文の組み立て) mark the asked-for slot with ★.
    const order = text.includes('★')
    Object.assign(q, {
      kind: section === 'vocabulary' ? 'context' : order ? 'order' : 'form',
      prompt: order ? PROMPTS[level].star : PROMPTS[level].blank,
      target: text.replace(BLANK, '（　　）'),
      // No explanation in the source: show the sentence with the answer filled in.
      explanation: filledSentence(explanation)
        ?? (order ? undefined : text.replace(BLANK, `**${choices[answer]}**`)),
    })
  } else if (explanation.includes('=>') || (!explanation && /[。」]$/.test(text) && choices.every((c) => /。$/.test(c)))) {
    // Paraphrase: "underlined => answer". Underline the phrase if it's a part
    // of the sentence, otherwise the whole sentence (also when, as on newer
    // pages, there's no explanation but every choice is a full sentence).
    const underlined = explanation.split('=>')[0].trim()
    const target = underlined && underlined !== text && text.includes(underlined)
      ? text.replace(underlined, `**${underlined}**`)
      : `**${text}**`
    Object.assign(q, { kind: 'paraphrase', prompt: PROMPTS[level].paraphrase, target })
  } else if (text.length <= 10 && !/[。？]/.test(text)) {
    Object.assign(q, { kind: 'usage', prompt: PROMPTS[level].usage, target: `**${text}**` })
  } else {
    return report.skip(section, 'unrecognised question type', where)
  }

  const gloss = glossaryFor([q.target, q.prompt, ...choices].join(' '), words)
  if (gloss.length) q.glossary = gloss
  if (!q.explanation) delete q.explanation
  report.keep(section)
  return q
}

function hashText(s) {
  let h = 0
  for (const ch of s) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0
  return (h >>> 0).toString(36)
}

/* ------------------------------------------------------------------ */
/* listening                                                           */
/* ------------------------------------------------------------------ */

/** The site uses a 593×441 "QUESTION N" card when there's no picture. */
function isPlaceholderImage(file) {
  const b = fs.readFileSync(file)
  if (b.subarray(0, 3).toString() !== 'GIF') return false
  return b.readUInt16LE(6) === 593 && b.readUInt16LE(8) === 441
}

function convertListening(level, exercise, report, mediaToCopy) {
  const n = exercise.exercise_number
  const block = exercise.text_content.find((t) => t.startsWith('1. Question 1') && t.includes('Answer Key'))
  const keys = [...(exercise.text_content.find((t) => /^Question 1: /.test(t)) ?? '').matchAll(/Question (\d+): (\d)/g)]
    .map((m) => Number(m[2]) - 1)
  if (!block || !keys.length) {
    report.skip('listening', 'no answer key', exercise.url)
    return []
  }

  // Split the question area on the "N. Question N" headers. Questions have 3
  // or 4 choices; A–F reference lists (e.g. "A. いちご") become part of the
  // prompt. A numbered run that restarts at "1" is a question whose header
  // went missing in the scrape.
  const body = block.split('Answer Key')[0].split(/\n(?:View transcript|Click here)\n/)[0]
  const groups = []
  for (const segment of body.split(/^\d+\. Question \d+$/m)) {
    const lines = segment
      .replace(/^([A-F][.．])\n/gm, '$1 ') // re-join a label split from its text ("E.\nカレー")
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) continue
    const preamble = lines.filter((l) => /^[A-F][.．]\s*/.test(l))
    const choices = lines.filter((l) => !preamble.includes(l))
    if (choices.every((c) => /^\d$/.test(c))) {
      for (const c of choices) {
        if (c === '1') groups.push({ preamble, choices: [] })
        groups.at(-1)?.choices.push(c)
      }
    } else {
      groups.push({ preamble, choices })
    }
  }
  if (groups.length !== keys.length || groups.some((g) => g.choices.length < 3 || g.choices.length > 4)) {
    report.skip('listening', 'choices and answer key do not line up', `${exercise.url} (${groups.length} choice groups, ${keys.length} answers)`)
    return []
  }

  const mediaDir = path.join(SRC, `jlpt_${level}_listening_media`)
  const audio = exercise.media_files.filter((f) => f.includes('_audio_'))
  const images = exercise.media_files.filter((f) => f.includes('_image_'))
  const imagesUsable = images.length === keys.length

  return keys.map((answer, i) => {
    const audioFile = audio[i]
    if (!audioFile || !fs.existsSync(path.join(mediaDir, audioFile))) {
      report.skip('listening', 'audio file missing', `${exercise.url}#q${i + 1}`)
      return null
    }
    mediaToCopy.push([path.join(mediaDir, audioFile), path.join(OUT_MEDIA, level, audioFile)])

    let image
    const imgFile = images[i]
    if (imagesUsable && imgFile && fs.existsSync(path.join(mediaDir, imgFile)) && !isPlaceholderImage(path.join(mediaDir, imgFile))) {
      image = `media/${level}/${imgFile}`
      mediaToCopy.push([path.join(mediaDir, imgFile), path.join(OUT_MEDIA, level, imgFile)])
    }

    const { preamble, choices } = groups[i]
    const numeric = choices.every((c, j) => c === String(j + 1))
    report.keep('listening')
    return {
      id: `${level}-listening-ex${n}-q${i + 1}`,
      section: 'listening',
      // Picture questions, 3-choice quick responses (即時応答), everything else.
      kind: image ? 'picture' : choices.length === 3 ? 'response' : 'audio',
      prompt: PROMPTS[level].listening + (preamble.length ? `\n\n${preamble.join('\n')}` : ''),
      audio: `media/${level}/${audioFile}`,
      ...(image && { image }),
      choices,
      answer,
      // Numbered choices refer to positions in the picture / audio, so they must not be shuffled.
      ...(numeric && { keepOrder: true }),
    }
  }).filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* extra sources                                                       */
/* ------------------------------------------------------------------ */

/**
 * jtest4you_n3_grammar_exercises.json is a second scrape of the N3 grammar
 * pages that kept the "Answer Key" block (sometimes with every question
 * squashed into the first one's choices). Returns { [exercise]: { lines, keys } }
 * so a key is only used when the same question text is on that page.
 */
function loadN3GrammarKeys() {
  const pages = {}
  for (const ex of readOptional('jtest4you_n3_grammar_exercises.json')) {
    const lines = ex.questions.flatMap((q) => [q.question, ...q.choices]).map((l) => l.replace(/^\d+\.\s*/, '').trim())
    const keys = {}
    for (const l of lines) {
      const m = l.match(/^Question (\d+): ([1-4])\b/)
      if (m) keys[m[1]] = Number(m[2])
    }
    pages[ex.exercise_number] = { lines, keys }
  }
  return pages
}

function withFallbackKey(exercise, raw, pages) {
  if (raw.correct_choice_number) return raw
  const page = pages[exercise.exercise_number]
  const key = page?.keys[raw.question_number]
  if (!key || !page.lines.includes(raw.question.trim())) return raw
  return { ...raw, correct_choice_number: key }
}

/**
 * japanesejlpt.com text had its furigana stripped, leaving spaces around
 * every kanji ("買 って"). Drop spaces next to Japanese text and put each
 * "A:" / "B:" speaker on its own line.
 */
const tidyJa = (s) => s
  .replace(/\s*\b([AB]):\s*/g, (_, who, at) => `${at ? '\n' : ''}${who}：`)
  .replace(/[ \t　]+(?=[^\x00-\x7F])|(?<=[^\x00-\x7F])[ \t　]+/g, '')
  .replace(/\s*\(\s*\[\.\.\.\]\s*\)\s*/g, '（　　）')
  .trim()

function convertGrammarTests(level, report) {
  return readOptional(`jlpt_${level}_grammar_tests.json`).flatMap((page) =>
    page.questions.flatMap((raw) => {
      const choices = raw.choices.map(tidyJa)
      const answer = choices.indexOf(tidyJa(raw.answer ?? ''))
      if (choices.length !== 4) return (report.skip('grammar', 'choices lost in scrape', `${page.url}#q${raw.question_number}`), [])
      if (answer < 0) return (report.skip('grammar', 'no answer key', `${page.url}#q${raw.question_number}`), [])
      const target = tidyJa(raw.question)
      report.keep('grammar')
      return [{
        id: `${level}-grammar-test${page.page}-q${raw.question_number}`,
        section: 'grammar',
        kind: 'form',
        prompt: PROMPTS[level].blank,
        target,
        choices,
        answer,
        explanation: target.replace('（　　）', `**${choices[answer]}**`),
      }]
    }),
  )
}

/**
 * jlpt_n4_kanji_tests.json: "…【word】…" with four choices and no answer
 * field, but each item carries "full sentence | kana sentence | English",
 * which identifies the answer:
 *   - writing questions: the one choice that, put in the brackets, gives the sentence;
 *   - reading questions: a choice found in the kana sentence, preferring the
 *     one followed by the same kana as in the question, then the longest.
 */
function kanjiTestAnswer(raw) {
  const [sentence = '', kanaLine = ''] = raw.translation_answer.split(' | ')
  const fits = raw.choices.map((c) => raw.question.replace(/【.+?】/, c) === sentence)
  if (fits.filter(Boolean).length === 1) return fits.indexOf(true)

  const kana = kanaLine.replace(/\s/g, '')
  const next = raw.question.match(/】([぀-ゟ]?)/)?.[1] ?? ''
  const ranked = raw.choices
    .map((c, i) => ({ i, score: kana.includes(c) || sentence.includes(c) ? (kana.includes(c + next) ? 100 : 0) + c.length : -1 }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
  if (!ranked.length || ranked[1]?.score === ranked[0].score) return -1
  return ranked[0].i
}

function convertKanjiTests(level, report) {
  return readOptional(`jlpt_${level}_kanji_tests.json`).flatMap((page) =>
    page.questions.flatMap((raw) => {
      // Each page also scraped its "Question 11 / Submit / Feedback" footer.
      if (!/【.+?】/.test(raw.question) || !raw.translation_answer) return []
      if (raw.choices.length !== 4) return (report.skip('kanji', 'choices lost in scrape', `${page.url}#q${raw.question_number}`), [])
      const answer = kanjiTestAnswer(raw)
      if (answer < 0) return (report.skip('kanji', 'answer not derivable', `${page.url}#q${raw.question_number}`), [])
      const word = raw.question.match(/【(.+?)】/)[1]
      const [sentence, kana, english] = raw.translation_answer.split(' | ')
      report.keep('kanji')
      return [{
        id: `${level}-kanji-test${page.page}-q${raw.question_number}`,
        section: 'kanji',
        // Kana in the brackets → pick the kanji spelling; kanji → pick the reading.
        kind: isKana(word) ? 'writing' : 'reading',
        prompt: isKana(word) ? PROMPTS[level].kanjiWrite : PROMPTS[level].kanji,
        target: raw.question.replace(/【(.+?)】/, '**$1**'),
        choices: raw.choices,
        answer,
        explanation: [sentence, kana, english].filter(Boolean).join('\n'),
      }]
    }),
  )
}

/* ------------------------------------------------------------------ */
/* vocabulary list → word browser (learn mode)                         */
/* ------------------------------------------------------------------ */

const plain = (s) => s.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '')

/**
 * Strings to look for when finding a word in a sentence: its spellings and
 * kana, plus the stem of verbs and い-adjectives so 上がる also finds 上がって.
 * Short kana-only forms are left out; they match inside unrelated words.
 */
function searchForms(word, spellings, kana, type) {
  const inflects = /[うくぐすつぬぶむるい]$/.test(word) && (!type || /verb|adjective-i|いadjective|^adjective/.test(type))
  const forms = new Set()
  const stems = new Set()
  for (const f of [word, ...spellings, kana].filter(Boolean)) {
    const min = hasKanji(f) ? 1 : 3
    if (f.length >= min) forms.add(f)
    if (inflects && /[ぁ-ん]$/.test(f) && f.length - 1 >= min) stems.add(f.slice(0, -1))
  }
  for (const f of forms) stems.delete(f)
  return Object.assign([...forms, ...stems].sort((a, b) => b.length - a.length), { stems })
}

// A one-kanji word only counts on its own, so 味 doesn't match inside 興味.
// A one-kanji stem (合 of 合う) just needs kana after it: 性格合いません.
const KANJI = /[一-龯㐀-䶿々]/
function findForm(sentence, form, isStem) {
  for (let i = sentence.indexOf(form); i >= 0; i = sentence.indexOf(form, i + 1)) {
    if (form.length > 1) return i
    if (!KANJI.test(sentence[i + 1] ?? '') && (isStem || !KANJI.test(sentence[i - 1] ?? ''))) return i
  }
  return -1
}

function highlight(sentence, forms) {
  for (const f of forms) {
    const i = findForm(sentence, f, forms.stems?.has(f))
    if (i >= 0) return `${sentence.slice(0, i)}**${f}**${sentence.slice(i + f.length)}`
  }
  return null
}

/** Complete sentences from the question bank (no blanks, no ★) to search for words in. */
function bankSentences(questions) {
  const out = []
  const seen = new Set()
  for (const q of questions) {
    if (q.kind === 'words') continue
    for (const text of [q.target, q.passage, q.explanation]) {
      if (!text) continue
      for (const s of plain(text).split(/(?<=[。？！])|\n/)) {
        // Drop a dialogue speaker ("さとう　「…") and unpaired quotes.
        const t = s.trim().replace(SPEAKER, '').replace(/^「|」$/g, '').trim()
        if (t.length < 8 || t.length > 80 || /[（(][\s　]*[)）]|★|_{2,}|[０-９]」|^[A-Za-z]/.test(t) || !hasKanji(t) || seen.has(t)) continue
        seen.add(t)
        out.push({ ja: t, qid: q.id })
      }
    }
  }
  return out
}

const MAX_EXAMPLES = 8

function buildWords(level, questions) {
  const list = readOptional(`jlpt_${level}_vocab_list.json`)
  const file = path.join(OUT_DATA, `${level}-words.json`)
  if (!list.length) return fs.rmSync(file, { force: true }), null
  const sentences = bankSentences(questions)
  const headwords = list.flatMap((e) => e.word.replace(/\s+/g, '').split(/[/／]/))
  const ids = new Set()
  const words = list.map((e) => {
    const d = e.detail ?? {}
    // "王/王様" lists two words; the first is the headword.
    const [word, ...alsoWritten] = e.word.replace(/\s+/g, '').split(/[/／]/)
    const romaji = e.romaji?.split(/[/／]/)[0]
    const kana = d.kana || (isKana(word) ? word : romajiToKana(romaji ?? ''))
    const spellings = [...new Set([...alsoWritten, ...(d.kanji ?? [])])].filter((k) => k !== word)
    const type = d.type?.toLowerCase()
    const forms = searchForms(word, spellings, kana, type)
    // Longer list words containing this one (間に合う for 合う): their sentences aren't about this word.
    const longer = headwords.filter((h) => h.length > word.length && forms.some((f) => h.includes(f)))
    let id = `${level}-w-${hashText(`${word}|${e.romaji ?? ''}`)}`
    while (ids.has(id)) id += 'x'
    ids.add(id)
    return {
      id,
      word,
      kana: kana && kana !== word ? kana : undefined,
      romaji: d.romaji || e.romaji || undefined,
      meaning: e.meaning.replace(/​/g, '').trim(),
      fullMeaning: d.meaning && d.meaning !== e.meaning ? d.meaning : undefined,
      type: type || undefined,
      spellings: spellings.length ? spellings : undefined,
      examples: (d.examples ?? []).slice(0, MAX_EXAMPLES).map((x) => ({ ...x, ja: highlight(x.ja, forms) ?? x.ja })),
      similar: d.similar?.length ? d.similar : undefined,
      conjugation: d.conjugation,
      url: e.url ?? undefined,
      inBank: sentences
        .map((s) => ({ ...s, ja: highlight(s.ja, forms) }))
        .filter((s) => s.ja && !longer.some((h) => s.ja.replace(/\*\*/g, '').includes(/[ぁ-ん]$/.test(h) ? h.slice(0, -1) : h)))
        .slice(0, 3),
    }
  })
  fs.writeFileSync(file, JSON.stringify({ level: level.toUpperCase(), words }))
  return {
    total: words.length,
    detailed: words.filter((w) => w.url).length,
    withExamples: words.filter((w) => w.examples.length || w.inBank.length).length,
  }
}

/* ------------------------------------------------------------------ */
/* particle contrasts (hand-written) → learn mode                      */
/* ------------------------------------------------------------------ */

const fillBlank = (sentence, answer) => sentence.replace(/（[\s　]*）/, `**${answer}**`)

/** A fill-the-blank drill in the app's question format. */
function blankQuestion(id, level, ja, choices, answer, why) {
  return {
    id,
    section: 'grammar',
    kind: 'particle',
    prompt: PROMPTS[level].blank,
    target: ja,
    choices,
    answer,
    explanation: [why, fillBlank(ja, choices[answer])].filter(Boolean).join('\n'),
  }
}

// Particle questions already in the bank: every choice is one of these.
const PARTICLES = new Set('は が を に で へ と も や の から まで より までに には では とは にも でも へは からは とも ほど だけ しか ばかり など か って にとって について によって として に対して ので のに ながら さえ こそ くらい ぐらい へと との での からの までの への にしか でしか とか なら ずつ'.split(' '))
const isParticleQuestion = (q) => q.section === 'grammar' && q.choices.every((c) => PARTICLES.has(c.replace(/[\s　]/g, '')))

function buildParticles(byLevel) {
  const src = readOptional('particles.json')
  const file = path.join(OUT_DATA, 'particles.json')
  if (!src.contrasts) return fs.rmSync(file, { force: true }), null
  const contrasts = src.contrasts.map((c) => ({
    ...c,
    drills: c.drills.map((d, i) =>
      blankQuestion(`p-${c.id}-${i + 1}`, c.level.toLowerCase(), d.ja, d.choices, d.answer, d.why)),
  }))
  const bank = Object.fromEntries(byLevel.map(({ level, questions }) =>
    [level.toUpperCase(), questions.filter(isParticleQuestion).map((q) => q.id)]))
  fs.writeFileSync(file, JSON.stringify({ note: src.note, contrasts, bank }))
  return { contrasts: contrasts.length, drills: contrasts.reduce((n, c) => n + c.drills.length, 0), bank }
}

/* ------------------------------------------------------------------ */
/* grammar patterns → learn mode                                       */
/* ------------------------------------------------------------------ */

const MAX_SITE_EXAMPLES = 10
const DRILLS_PER_PATTERN = 6
// Japanese runs of 2+ characters: the searchable pieces of "あまり～ない" or "Verb + 必要がある".
const jaRuns = (s) => s.match(/[ぁ-ゟァ-ヿ一-龯々]{2,}/g) ?? []
const patternKey = (s) => s.replace(/[^ぁ-ゟァ-ヿ一-龯々]/g, '')
const romajiKey = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '')

/** Underlines the longest piece of the pattern found in a sentence. */
function highlightPattern(ja, pieces) {
  if (ja.includes('**')) return ja
  const p = pieces.find((x) => ja.includes(x))
  return p ? ja.replace(p, `**${p}**`) : ja
}

/**
 * Merges the two sites into one entry per pattern. japanesejlpt (N4) lessons
 * come first, in chapter order; japanesetest4you patterns with the same
 * Japanese (or the same romaji as a lesson's URL) are folded into them, and
 * the rest follow in list order.
 */
function mergeGrammar(level) {
  const site = readOptional(`jlpt_${level}_grammar_patterns.json`)
  const lessons = level === 'n4' ? readOptional('jlpt_n4_grammar_lessons.json') : []
  const merged = lessons.map((l) => ({ lesson: l, site: [] }))
  const byKey = new Map()
  const byFirst = new Map()
  for (const m of merged) {
    for (const k of alternativeKeys(m.lesson.pattern)) if (!byKey.has(k)) byKey.set(k, m) // first lesson wins
    const slug = m.lesson.url.split('/').filter(Boolean).pop()
    byKey.set(romajiKey(slug), m)
    const first = slug.split('-')[0]
    byFirst.set(first, byFirst.has(first) ? null : m) // only when one lesson starts with it
  }
  for (const s of site) {
    const m = alternativeKeys(s.pattern).map((k) => byKey.get(k)).find(Boolean)
      ?? byKey.get(romajiKey(s.romaji))
      ?? byFirst.get(romajiKey(s.romaji))
    if (m) m.site.push(s)
    else merged.push({ lesson: null, site: [s] })
  }
  return merged
}

/**
 * Match keys for each spelling of a pattern: "～必要があります・～が必要です" →
 * ["必要がある", "が必要"]. Notes in brackets go, and polite endings are made
 * plain so "～かもしれません" matches "かもしれない".
 */
function alternativeKeys(pattern) {
  return pattern
    .replace(/[(（][^)）]*[)）]/g, '')
    .split(/[・/／]/)
    .map((alt) => patternKey(alt)
      .replace(/あります$/, 'ある').replace(/います$/, 'いる').replace(/ません$/, 'ない')
      .replace(/(です|だ)$/, ''))
    .filter((k) => k.length > 0)
}

const BANK_PER_PATTERN = 3

/** Does `piece` occur over the answer at [s, e) of `text`? It may cover the
 *  whole answer (all but its last character) or sit inside it, nearly as long. */
function covers(text, piece, s, e) {
  for (let i = text.indexOf(piece); i >= 0; i = text.indexOf(piece, i + 1)) {
    const j = i + piece.length
    if (i <= s && j >= e - 1 && j > s) return true
    if (i >= s && j <= e && piece.length >= e - s - 1) return true
  }
  return false
}

/**
 * Links grammar questions to the pattern their answer belongs to, for "In this
 * app's questions". Each question goes to the pattern with the LONGEST piece
 * covering the answer in the filled-in sentence, so 起きた[ばかり] goes to
 * ～たばかり, not ～ばかり; equally long matches (two lessons on らしい) share it.
 * One pass over the questions, each checking only a short window around the
 * blank. data/grammar-links.json can then hide or add questions by hand.
 */
function assignBank(level, patterns, questions) {
  const maxLen = Math.max(...patterns.flatMap((p) => p.pieces.map((x) => x.length)))
  const blank = new RegExp(BLANK.source) // first blank only
  const found = new Map(patterns.map((p) => [p, []]))
  const byId = new Map()
  for (const q of questions) {
    if (!q.target) continue
    const target = plain(q.target)
    const m = target.match(blank)
    const answer = plain(q.choices[q.answer]).replace(/[\s　]/g, '')
    if (!m || !answer || /[/／]/.test(answer)) continue
    const filled = target.slice(0, m.index) + answer + target.slice(m.index + m[0].length)
    const lo = Math.max(0, m.index - maxLen)
    const window = filled.slice(lo, m.index + answer.length + maxLen)
    const s = m.index - lo
    const e = s + answer.length
    let best = 0
    let winners = []
    for (const p of patterns) {
      // pieces are longest first: the first that covers is this pattern's best
      const piece = p.pieces.find((x) => x.length >= best && covers(window, x, s, e))
      if (!piece) continue
      if (piece.length > best) { best = piece.length; winners = [p] }
      else winners.push(p)
    }
    const entry = { ja: `${target.slice(0, m.index)}**${answer}**${target.slice(m.index + m[0].length)}`, qid: q.id }
    byId.set(q.id, entry)
    for (const p of winners) found.get(p).push(entry)
  }

  // Hand corrections: { "<level>": { "<pattern as shown>": { "hide": [qid], "add": [qid] } } }
  const links = readOptional('grammar-links.json')[level] ?? {}
  for (const [name, { hide = [], add = [] }] of Object.entries(links)) {
    const p = patterns.find((x) => x.pattern === name)
    if (!p) { console.warn(`  grammar-links.json: no ${level} pattern "${name}"`); continue }
    const list = found.get(p).filter((x) => !hide.includes(x.qid))
    for (const qid of add) {
      if (byId.has(qid)) list.unshift(byId.get(qid))
      else console.warn(`  grammar-links.json: no ${level} grammar question "${qid}"`)
    }
    found.set(p, list)
  }
  for (const p of patterns) p.inBank = found.get(p).slice(0, BANK_PER_PATTERN)
}

function buildGrammar(level, questions) {
  const merged = mergeGrammar(level)
  const file = path.join(OUT_DATA, `${level}-grammar.json`)
  if (!merged.length) return fs.rmSync(file, { force: true }), null
  const grammarQs = questions.filter((q) => q.section === 'grammar' && q.kind === 'form')

  const patterns = merged.map(({ lesson, site }) => {
    const first = site[0]
    const page = first?.page ?? {}
    const pattern = lesson?.pattern ?? first.pattern
    const formation = lesson?.formation?.length ? lesson.formation : page.formation ?? []
    const pieces = [...new Set([
      ...jaRuns(pattern), ...alternativeKeys(pattern),
      ...site.flatMap((s) => [...jaRuns(s.pattern), ...alternativeKeys(s.pattern)]),
      ...formation.flatMap(jaRuns),
    ])].sort((a, b) => b.length - a.length)
    const siteExamples = site.flatMap((s) => s.page?.examples ?? []).slice(0, MAX_SITE_EXAMPLES)
    const examples = [
      ...(lesson?.examples ?? []).map(({ section, ...ex }) => ex),
      ...siteExamples.map((ex) => ({ ...ex, ja: highlightPattern(ex.ja, pieces) })),
    ]
    const id = `${level}-g-${hashText(patternKey(pattern) + '|' + (lesson?.url ?? first.url ?? first.pattern))}`
    return {
      id,
      pattern,
      romaji: first?.romaji ?? undefined,
      meaning: first?.meaning ?? page.meaning ?? lesson?.title ?? '',
      title: lesson?.title,
      goal: lesson?.goal,
      chapter: lesson?.chapter ?? undefined,
      formation,
      notes: page.notes ?? [],
      sections: lesson?.sections ?? [],
      examples,
      sources: [
        ...(lesson ? [{ name: 'japanesejlpt', url: lesson.url }] : []),
        ...site.filter((s) => s.url).map((s) => ({ name: 'japanesetest4you', url: s.url })),
      ],
      inBank: [],
      drills: [],
      pieces,
    }
  })
  assignBank(level, patterns, grammarQs)

  // Drills: blank out the underlined part of an example; the wrong choices
  // are other patterns' underlined parts of a similar length.
  const answerOf = (ja) => plain(ja.match(/\*\*(.+?)\*\*/)?.[1] ?? '')
  const pool = [...new Set(patterns.flatMap((p) => p.examples.map((e) => answerOf(e.ja))).filter((a) => a.length >= 1))]
  for (const p of patterns) {
    const rand = rng(p.id)
    const own = new Set(p.examples.map((e) => answerOf(e.ja)))
    p.drills = p.examples
      .filter((e) => answerOf(e.ja) && e.ja.match(/\*\*/g).length === 2)
      .slice(0, DRILLS_PER_PATTERN)
      .map((e, i) => {
        const answer = answerOf(e.ja)
        // Prefer look-alikes: same first or last character (ても → てみる, でも), then similar length.
        const likeness = (a) => (a[0] === answer[0] ? 2 : 0) + (a.at(-1) === answer.at(-1) ? 1 : 0) - Math.abs(a.length - answer.length) / 2
        const near = pool
          .filter((a) => !own.has(a) && !a.includes(answer) && !answer.includes(a) && Math.abs(a.length - answer.length) <= 2)
          .map((a) => ({ a, score: likeness(a) + rand() }))
          .sort((x, y) => y.score - x.score)
          .slice(0, 8)
          .map((x) => x.a)
        const wrong = []
        while (wrong.length < 3 && near.length) wrong.push(near.splice(Math.floor(rand() * near.length), 1)[0])
        if (wrong.length < 3) return null
        const choices = [answer, ...wrong]
        return {
          ...blankQuestion(`${p.id}-d${i + 1}`, level, e.ja.replace(/\*\*.+?\*\*/, '（　　）'), choices, 0, e.en),
          kind: 'pattern',
        }
      })
      .filter(Boolean)
  }

  fs.writeFileSync(file, JSON.stringify({ level: level.toUpperCase(), patterns: patterns.map(({ pieces, ...p }) => p) }))
  return {
    total: patterns.length,
    lessons: patterns.filter((p) => p.title).length,
    drills: patterns.reduce((n, p) => n + p.drills.length, 0),
    noExamples: patterns.filter((p) => !p.examples.length).length,
  }
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function copyIfChanged(from, to) {
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) return false
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  return true
}

function buildLevel(level) {
  const report = makeReport()
  const file = (sec) => path.join(SRC, `jlpt_${level}_${sec}_data.json`)
  const load = (sec) => (fs.existsSync(file(sec)) ? readJSON(file(sec)) : [])

  const vocabulary = load('vocabulary')
  const grammar = load('grammar')
  const reading = load('reading')
  const listening = load('listening')

  // Every exercise ships a word list; pool them for the glossary and kanji deck.
  const exerciseWords = (ex) => (ex.vocabulary ?? parseListeningWords(ex)).map(toGlossEntry)
  const allWords = [vocabulary, grammar, reading, listening].flat().flatMap(exerciseWords)

  const grammarKeys = level === 'n3' ? loadN3GrammarKeys() : {}

  const questions = [
    ...convertKanjiTests(level, report),
    ...buildKanjiDeck(level, allWords, report),
    ...[['vocabulary', vocabulary], ['grammar', grammar], ['reading', reading]].flatMap(([section, exercises]) =>
      exercises.flatMap((ex) => {
        const words = exerciseWords(ex)
        return ex.questions
          .map((raw) => (section === 'grammar' ? withFallbackKey(ex, raw, grammarKeys) : raw))
          .map((raw) => convertQuestion(level, section, ex, raw, words, report))
          .filter(Boolean)
      }),
    ),
    ...convertGrammarTests(level, report),
  ]

  const mediaToCopy = []
  questions.push(...listening.flatMap((ex) => convertListening(level, ex, report, mediaToCopy)))

  fs.mkdirSync(OUT_DATA, { recursive: true })
  const out = { level: level.toUpperCase(), version: 1, generatedFrom: 'data/', questions }
  fs.writeFileSync(path.join(OUT_DATA, `${level}.json`), JSON.stringify(out))
  const copied = mediaToCopy.filter(([from, to]) => copyIfChanged(from, to)).length
  const words = buildWords(level, questions)
  const patterns = buildGrammar(level, questions)

  return { level, report: report.data, total: questions.length, media: mediaToCopy.length, copied, words, patterns, questions }
}

const results = LEVELS.map(buildLevel)
const particles = buildParticles(results)
for (const { level, report, total, media, copied, words, patterns: grammar } of results) {
  console.log(`\n${level.toUpperCase()}: ${total} questions → public/data/${level}.json  (${media} media files, ${copied} copied)`)
  if (words) console.log(`  words       ${String(words.total).padStart(4)} → public/data/${level}-words.json  (${words.detailed} with a word page, ${words.withExamples} with example sentences)`)
  else console.log(`  words          — no data/jlpt_${level}_vocab_list.json, word browser disabled`)
  if (grammar) console.log(`  patterns    ${String(grammar.total).padStart(4)} → public/data/${level}-grammar.json  (${grammar.lessons} with a lesson, ${grammar.drills} drills, ${grammar.noExamples} without examples)`)
  else console.log(`  patterns       — no grammar pattern files in data/`)
  for (const sec of new Set([...Object.keys(report.kept), ...Object.keys(report.skipped)])) {
    const n = report.kept[sec] ?? 0
    const skipped = Object.entries(report.skipped[sec] ?? {}).map(([why, k]) => `${k} ${why}`).join(', ')
    console.log(`  ${sec.padEnd(11)} ${String(n).padStart(4)} kept${skipped ? `   skipped: ${skipped}` : ''}`)
  }
}

if (particles) {
  const bank = Object.entries(particles.bank).map(([lv, ids]) => `${lv} ${ids.length}`).join(', ')
  console.log(`\nParticles: ${particles.contrasts} contrasts, ${particles.drills} drills → public/data/particles.json  (bank particle questions: ${bank})`)
}

// `npm run data -- --skipped` lists every skipped question and why.
if (process.argv.includes('--skipped')) {
  for (const { level, report } of results) {
    console.log(`\n${level.toUpperCase()} skipped:`)
    for (const { section, why, where } of report.items) console.log(`  ${section.padEnd(11)} ${why.padEnd(28)} ${where ?? ''}`)
  }
}

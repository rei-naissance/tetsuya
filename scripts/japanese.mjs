/**
 * Build-time Japanese helpers for scripts/build-data.mjs:
 *   - furigana: adds {漢字|かな} markup to plain text with the kuromoji tokenizer
 *   - glossary: dictionary forms of the content words in a text, looked up in
 *     data/dictionary.json (a JMdict subset, see makeDictionary)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import kuromoji from 'kuromoji'
import { toHiragana } from 'wanakana'

const require = createRequire(import.meta.url)

export function loadTokenizer() {
  const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict')
  return new Promise((resolve, reject) =>
    kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))))
}

const KANJI = /[一-龯㐀-䶿々〆ヶ]/
const isKana = (c) => /[぀-ゟ゠-ヿー]/.test(c)
const hira = (s) => toHiragana(s, { passRomaji: true })

/**
 * One token → markup. Kana around the kanji stays outside the ruby, and kana
 * inside (取り扱い) splits it: {取|と}り{扱|あつか}い.
 */
function rubyToken(surface, reading) {
  if (!KANJI.test(surface) || !reading || reading === '*') return surface
  const r = hira(reading)
  let a = 0
  while (a < surface.length && isKana(surface[a]) && hira(surface[a]) === r[a]) a++
  let b = 0
  while (b < surface.length - a && isKana(surface.at(-1 - b)) && hira(surface.at(-1 - b)) === r.at(-1 - b)) b++
  const core = surface.slice(a, surface.length - b)
  const coreR = r.slice(a, r.length - b)
  if (!coreR || !KANJI.test(core)) return surface
  const runs = core.match(/[^぀-ゟ゠-ヿー]+|[぀-ゟ゠-ヿー]+/g)
  let inner = `{${core}|${coreR}}`
  if (runs.length > 1) {
    const re = new RegExp(`^${runs.map((x) => (isKana(x[0]) ? hira(x) : '(.+?)')).join('')}$`)
    const m = coreR.match(re)
    if (m) {
      let i = 1
      inner = runs.map((x) => (isKana(x[0]) ? x : `{${x}|${m[i++]}}`)).join('')
    }
  }
  return surface.slice(0, a) + inner + surface.slice(surface.length - b)
}

// kuromoji's dictionary picks the rarer reading for these.
const READINGS = { 日本: 'ニホン', 日本人: 'ニホンジン', 日本語: 'ニホンゴ', この間: 'コノアイダ' }

function readingOf(t, next) {
  if (READINGS[t.surface_form]) return READINGS[t.surface_form]
  // 何 is なん before a counter or a t/d/n sound (何曜日, 何で, 何の), なに otherwise.
  if (t.surface_form === '何' && next && (next.pos === '名詞' || /^[タ-ドナ-ノ]/.test(next.reading ?? ''))) return 'ナン'
  return t.reading
}

const MARKUP = /(\{[^|}]+\|[^}]+\}|\*\*)/

/** Furigana markup for a word whose reading is known: 通って + かよって → {通|かよ}って. */
export const rubyFor = (surface, reading) => rubyToken(surface, reading)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Adds furigana to every kanji word in `text` that has none yet. Existing
 * markup is kept; with `skipBold`, the **underlined** part is left bare (the
 * word a kanji question asks about). `known` words get their given reading
 * instead of the tokenizer's guess, which can't tell 通う from 通る in 通って.
 *
 * The sentence is read whole, with the markup taken out, so a word cut by an
 * underline (以**上**) is still read in context; the markup goes back after.
 */
export function addFurigana(tokenizer, text, { skipBold = false, known = [] } = {}) {
  if (!text || !KANJI.test(text)) return text

  // 1. Plain text, plus where the markup sat in it.
  let plainText = ''
  const rubyAt = new Map() // start → { end, markup } for existing {漢字|かな}
  const marks = new Map()  // index → number of ** before that character
  for (const part of text.split(MARKUP)) {
    if (!part) continue
    if (part === '**') marks.set(plainText.length, (marks.get(plainText.length) ?? 0) + 1)
    else if (part.startsWith('{')) {
      const base = part.slice(1, part.indexOf('|'))
      rubyAt.set(plainText.length, { end: plainText.length + base.length, markup: part })
      plainText += base
    } else plainText += part
  }
  const n = plainText.length
  const isFixed = new Array(n).fill(false)
  for (const [s, { end }] of rubyAt) for (let i = s; i < end; i++) isFixed[i] = true
  // The same word elsewhere in the sentence would give the answer away too.
  const bare = skipBold ? [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => plain(m[1])).join(' ') : ''

  // 2. Known words (by position), and tokens for everything, line by line.
  const knownAt = new Map()
  for (const k of known) {
    for (let i = plainText.indexOf(k.surface); i >= 0; i = plainText.indexOf(k.surface, i + k.surface.length)) knownAt.set(i, k)
  }
  const tokenAt = new Map() // start → { end, surface, reading }
  let offset = 0
  for (const line of plainText.split('\n')) {
    const tokens = tokenizer.tokenize(line)
    let pos = offset
    tokens.forEach((t, i) => {
      tokenAt.set(pos, { end: pos + t.surface_form.length, surface: t.surface_form, reading: readingOf(t, tokens[i + 1]) })
      pos += t.surface_form.length
    })
    offset += line.length + 1
  }

  // An underline that cuts a word (以**上**がる) moves out to the word's
  // edge, so the word is read whole. Not in kanji questions, where the
  // underline is exactly the tested word.
  if (!skipBold) {
    for (const [s, t] of tokenAt) {
      if (!KANJI.test(t.surface) || isFixed[s]) continue
      for (let p = s + 1; p < t.end; p++) {
        const count = marks.get(p)
        if (!count) continue
        marks.delete(p)
        // Opening (an odd number of ** before p) goes to the start, closing to the end.
        const before = [...marks].filter(([q]) => q < p).reduce((a, [, c]) => a + c, 0)
        const to = before % 2 === 0 ? s : t.end
        marks.set(to, (marks.get(to) ?? 0) + count)
      }
    }
  }
  const boldAt = new Array(n).fill(false)
  for (let i = 0, open = false; i < n; i++) {
    if ((marks.get(i) ?? 0) % 2) open = !open
    boldAt[i] = open
  }

  // 3. Rebuild: markup back in place, furigana on each word that has none.
  const boundaries = new Set([...marks.keys(), ...rubyAt.keys(), ...knownAt.keys(), n])
  for (const [s, { end }] of rubyAt) boundaries.add(end)
  for (const [s, k] of knownAt) boundaries.add(s + k.surface.length)
  const nextBoundary = (i, limit) => { for (let j = i + 1; j < limit; j++) if (boundaries.has(j)) return j; return limit }
  let out = ''
  let i = 0
  let tok = null // the token we're inside
  while (i < n) {
    out += '**'.repeat(marks.get(i) ?? 0)
    if (rubyAt.has(i)) { const r = rubyAt.get(i); out += r.markup; i = r.end; continue }
    if (tokenAt.has(i)) tok = tokenAt.get(i)
    const k = knownAt.get(i)
    if (k && ![...Array(k.surface.length - 1).keys()].some((d) => marks.has(i + d + 1))) {
      out += skipBold && boldAt[i] ? k.surface : rubyFor(k.surface, k.reading)
      i += k.surface.length
      continue
    }
    const end = nextBoundary(i, tok && tok.end > i ? tok.end : n)
    const surface = plainText.slice(i, end)
    let piece = surface
    if (KANJI.test(surface) && !(skipBold && boldAt[i]) && !(bare && bare.includes(surface)) && !isFixed[i]) {
      piece = tok && i === tokStart(tok) && end === tok.end
        ? rubyToken(surface, tok.reading)
        // A token cut by markup: read the piece on its own.
        : tokenizer.tokenize(surface).map((t, j, all) => rubyToken(t.surface_form, readingOf(t, all[j + 1]))).join('')
    }
    out += piece
    i = end
  }
  out += '**'.repeat(marks.get(n) ?? 0)
  return out

  function tokStart(t) { return t.end - t.surface.length }
}

const GODAN = 'うつるくぐむぶぬす'

/** 通る → 通う, 通つ…: the other verbs the same て / た form could come from. */
export function verbAlternates(lemma) {
  if (!KANJI.test(lemma) || !GODAN.includes(lemma.at(-1))) return []
  return [...GODAN].map((e) => lemma.slice(0, -1) + e).filter((x) => x !== lemma)
}

/* ------------------------------------------------------------------ */
/* glossary                                                            */
/* ------------------------------------------------------------------ */

const plain = (s) => s.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '')

const CONTENT = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞'])
const SKIP_DETAIL = new Set(['数', '非自立', '代名詞', '接尾', '固有名詞', '特殊', '副詞可能'])
// Too basic to be worth a line in the glossary.
const STOP = new Set(['する', 'いる', 'ある', 'なる', 'いう', 'こと', 'もの', 'とき', 'ところ', 'よう', 'ため', 'くる', 'できる',
  'やる', 'みる', 'おく', 'しまう', 'いく', 'くれる', 'もらう', 'あげる', 'ない', 'いい', 'よい', 'そう', 'これ', 'それ', 'あれ', 'どれ',
  'この', 'その', 'あの', 'どの', 'ここ', 'そこ', 'あそこ', 'どこ', 'わたし', '私', 'です', 'ます'])

/** Dictionary forms of the content words in `text`, in order, with their readings. */
export function contentWords(tokenizer, text) {
  const out = []
  const seen = new Set()
  for (const line of plain(text).split('\n')) {
    const tokens = tokenizer.tokenize(line)
    for (const [i, t] of tokens.entries()) {
      if (!CONTENT.has(t.pos) || SKIP_DETAIL.has(t.pos_detail_1)) continue
      const lemma = t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form
      if (STOP.has(lemma) || seen.has(lemma) || lemma.length < 2 && !KANJI.test(lemma)) continue
      if (!/[぀-ヿ一-龯々]/.test(lemma)) continue
      // Kana text is easy to mis-split (あき → あきる), so a kana word only
      // counts when it isn't inflected.
      if (!KANJI.test(lemma) && lemma !== t.surface_form) continue
      seen.add(lemma)
      // kuromoji gives the reading of the surface form; for an inflected verb
      // that's not the dictionary form's, so only keep it for uninflected words.
      const reading = readingOf(t, tokens[i + 1])
      out.push({ lemma, reading: lemma === t.surface_form && reading && reading !== '*' ? hira(reading) : undefined })
    }
  }
  return out
}

/**
 * Builds the JMdict subset: for each lemma, its entries' readings and short
 * meanings, best first (common, not a suffix). A kana lemma only gets one
 * entry, and only if that word is usually written in kana or is a common
 * word of 3+ kana: short kana strings are often a mis-split (けい of けいざい).
 */
export function makeDictionary(jmdictFile, lemmas) {
  const { words } = JSON.parse(fs.readFileSync(jmdictFile, 'utf8'))
  const byForm = new Map()
  for (const w of words) {
    for (const f of [...w.kanji, ...w.kana]) {
      if (!lemmas.has(f.text)) continue
      const list = byForm.get(f.text) ?? []
      list.push(w)
      byForm.set(f.text, list)
    }
  }
  const out = {}
  for (const [form, entries] of byForm) {
    const isKanji = KANJI.test(form)
    const score = (w) => {
      const own = (isKanji ? w.kanji : w.kana).find((f) => f.text === form)
      let s = own?.common ? 4 : 0
      if (w.kanji.some((k) => k.common) || w.kana.some((k) => k.common)) s += 2
      if (!isKanji && kanaWord(w)) s += 3
      if (w.sense[0]?.partOfSpeech.some((p) => p === 'suf' || p === 'pref')) s -= 3
      return s
    }
    const ranked = [...new Set(entries)].sort((a, b) => score(b) - score(a))
    if (!isKanji) {
      const best = ranked[0]
      const own = best.kana.find((f) => f.text === form)
      if (kanaWord(best) || (own?.common && form.length >= 3)) out[form] = [{ m: shortMeaning(best) }]
      continue
    }
    const seen = new Set()
    out[form] = ranked.map((w) => {
      const r = (w.kana.find((k) => k.common && (k.appliesToKanji[0] === '*' || k.appliesToKanji.includes(form))) ?? w.kana[0])?.text
      return { r, m: shortMeaning(w) }
    }).filter((e) => e.m && !seen.has(e.r) && seen.add(e.r))
  }
  return out
}

const kanaWord = (w) => w.kanji.length === 0 || w.sense[0]?.misc?.includes('uk')

/**
 * The dictionary form of `surface` given its right reading. The tokenizer
 * reads 通って as 通る; with the reading かよって this returns 通う.
 * undefined when no dictionary entry fits the reading.
 */
export function lemmaForReading(tokenizer, dict, surface, reading) {
  const token = tokenizer.tokenize(surface).find((t) => CONTENT.has(t.pos))
  if (!token) return undefined
  const lemma = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form
  // The reading of the kanji part: {通|かよ}って → かよ
  const kr = (rubyFor(surface, reading).match(/\{[^|}]+\|([^}]+)\}/) || [])[1]
  if (!kr) return { lemma, entry: lookupWord(dict, lemma) }
  for (const cand of [lemma, ...verbAlternates(lemma)]) {
    const entry = (dict[cand] ?? []).find((e) => e.r?.startsWith(kr))
    if (entry) return { lemma: cand, entry }
  }
  return undefined
}

/** The dictionary entry for a word, matching the reading it has in the sentence when known. */
export function lookupWord(dict, lemma, reading) {
  const entries = dict[lemma]
  if (!entries?.length) return undefined
  return (reading && entries.find((e) => e.r === reading)) || entries[0]
}

function shortMeaning(entry) {
  const parts = []
  for (const sense of entry.sense.slice(0, 2)) {
    const g = sense.gloss.filter((x) => x.lang === 'eng' || !x.lang).slice(0, 3).map((x) => x.text).join(', ')
    if (g && (parts.length === 0 || parts.join('; ').length + g.length < 70)) parts.push(g)
  }
  return parts.join('; ')
}

/* ------------------------------------------------------------------ */
/* misreadings: JLPT-style wrong choices for a kanji reading           */
/* ------------------------------------------------------------------ */

const VOICE = Object.fromEntries([
  ...'かが きぎ くぐ けげ こご さざ しじ すず せぜ そぞ ただ てで とど はば ひび ふぶ へべ ほぼ'.split(' ').flatMap(([a, b]) => [[a, [b]], [b, [a]]]),
  ...'はぱ ひぴ ふぷ へぺ ほぽ'.split(' ').map(([a, b]) => [b, [a]]),
])
for (const [a, b] of ['はぱ', 'ひぴ', 'ふぷ', 'へぺ', 'ほぽ']) VOICE[a] = [...VOICE[a], b]
const O_ROW = new Set('おこそとのほもよろごぞどぼぽょ')
const U_ROW = new Set('うくすつぬふむゆるぐずぶぷゅ')
const E_ROW = new Set('えけせてねへめれげぜでべぺ')
const SMALL = new Set('ゃゅょぁぃぅぇぉ')
const YOON_BASE = new Set('きしちにひみりぎじびぴ')
const GEMINATE_BEFORE = /^[かきくけこさしすせそたちてとぱぴぷぺぽ]/ // not つ: っつ never looks real

/** "きょうしつ" → ["きょ", "う", "し", "つ"] */
function morae(kana) {
  const out = []
  for (const ch of kana) {
    if (SMALL.has(ch) && out.length) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

const VOWELS = new Set('あいうえお')
const ROWS = ['かきくけこ', 'がぎぐげご', 'さしすせそ', 'ざじずぜぞ', 'たちつてと', 'だぢづでど', 'なにぬねの', 'はひふへほ', 'ばびぶべぼ', 'ぱぴぷぺぽ', 'まみむめも', 'らりるれろ']
const ROW_OF = Object.fromEntries(ROWS.flatMap((r) => [...r].map((c) => [c, r])))

/**
 * One-step changes to a kana string, the kinds of slip the JLPT uses as
 * wrong choices: voicing (か/が, は/ば/ぱ), long vowels (こ/こう, せ/せい,
 * きょ/きょう), small っ in or out, and plain / small ゃゅょ (き/きょ).
 * With `vowels`, also a changed vowel (ま → も) and き → きょ, used only as a fallback.
 */
function oneStep(kana, { vowels = false } = {}) {
  const m = morae(kana)
  const out = new Set()
  const at = (i, ...rep) => [...m.slice(0, i), ...rep, ...m.slice(i + 1)].join('')
  m.forEach((mora, i) => {
    const head = mora[0]
    const last = mora.at(-1)
    const next = m[i + 1]
    const prev = m[i - 1]
    for (const v of VOICE[head] ?? []) out.add(at(i, v + mora.slice(1)))
    if (!VOWELS.has(head)) {
      // こ ↔ こう, きょ ↔ きょう, しゅ ↔ しゅう
      if ((O_ROW.has(last) || last === 'ゅ') && next !== 'う' && next !== 'お') out.add(at(i, mora, 'う'))
      if ((O_ROW.has(last) || U_ROW.has(last)) && next === 'う') out.add([...m.slice(0, i + 1), ...m.slice(i + 2)].join(''))
      // せ ↔ せい
      if (E_ROW.has(last) && next !== 'い' && next !== 'ん' && !VOWELS.has(next ?? '')) out.add(at(i, mora, 'い'))
      if (E_ROW.has(last) && next === 'い') out.add([...m.slice(0, i + 1), ...m.slice(i + 2)].join(''))
    }
    // きょ → き always; き → きょ / きゅ only as a fallback (it's rarely the slip)
    if (mora.length === 2 && SMALL.has(mora[1]) && YOON_BASE.has(mora[0])) out.add(at(i, mora[0]))
    if (vowels && mora.length === 1 && YOON_BASE.has(mora)) for (const sm of 'ょゅ') out.add(at(i, mora + sm))
    // small っ out, or in before a k/s/t/p mora in the middle after a short syllable
    if (mora === 'っ') out.add([...m.slice(0, i), ...m.slice(i + 1)].join(''))
    else if (i > 0 && next && GEMINATE_BEFORE.test(mora) && prev && prev.length === 1 && !VOWELS.has(prev) && prev !== 'ん' && prev !== 'っ' && prev !== 'ー') {
      out.add([...m.slice(0, i), 'っ', ...m.slice(i)].join(''))
    }
    if (vowels && mora.length === 1 && ROW_OF[mora]) for (const v of ROW_OF[mora]) if (v !== mora && v !== 'ぢ' && v !== 'づ') out.add(at(i, v))
  })
  out.delete(kana)
  return [...out]
}

/**
 * Up to `n` plausible wrong readings for `word` read as `reading`, the way
 * the JLPT writes them (こたえ → ごたえ, こだえ, こたええ…). Only the part
 * read off the kanji changes; kana written in the word (okurigana) stays.
 * `avoid` holds real readings that must not appear as wrong choices.
 */
export function misreadings(word, reading, rand, n = 3, avoid = new Set()) {
  // Split off kana the word spells out, at either end.
  let a = 0
  while (a < word.length && isKana(word[a]) && hira(word[a]) === reading[a]) a++
  let b = 0
  while (b < word.length - a && isKana(word.at(-1 - b)) && hira(word.at(-1 - b)) === reading.at(-1 - b)) b++
  const pre = reading.slice(0, a)
  const core = reading.slice(a, reading.length - b)
  const post = reading.slice(reading.length - b)
  if (!core) return []
  const ok = (r) => r !== reading && !avoid.has(r) && r.length > 0
  const one = oneStep(core).map((c) => pre + c + post).filter(ok)
  // Fallbacks when that isn't enough (short readings like め, まける):
  // a changed vowel, then two small changes.
  const more = one.length >= n ? [] : [...new Set([
    ...oneStep(core, { vowels: true }),
    ...oneStep(core).flatMap((c) => oneStep(c)),
  ].map((c) => pre + c + post))].filter((r) => ok(r) && !one.includes(r))
  const pick = (list, k) => {
    const pool = [...list]
    const got = []
    while (pool.length && got.length < k) got.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
    return got
  }
  const first = pick(one, n)
  return [...first, ...pick(more, n - first.length)]
}

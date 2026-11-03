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

/**
 * Adds furigana to every kanji word in `text` that has none yet. Existing
 * markup is kept; with `skipBold`, the **underlined** part is left bare (the
 * word a kanji question asks about).
 */
export function addFurigana(tokenizer, text, { skipBold = false } = {}) {
  if (!text || !KANJI.test(text)) return text
  // The same word elsewhere in the sentence would give the answer away too.
  const bare = skipBold ? [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]).join(' ') : ''
  let bold = false
  return text.split(MARKUP).map((part) => {
    if (part === '**') { bold = !bold; return part }
    if (!part || part.startsWith('{') || (bold && skipBold) || !KANJI.test(part)) return part
    return part.split('\n').map((line) =>
      tokenizer.tokenize(line).map((t, i, all) =>
        bare && bare.includes(t.surface_form) ? t.surface_form : rubyToken(t.surface_form, readingOf(t, all[i + 1]))).join('')).join('\n')
  }).join('')
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

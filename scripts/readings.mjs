/**
 * Checks and repairs word readings converted from romaji.
 *
 * The scraped word lists give readings in romaji, and turning those into
 * kana goes wrong in predictable ways: "honya" becomes ほにゃ (本屋 is ほんや),
 * the particle "o" becomes お (気をつける), "wa" becomes わ (実は), "zu" ず
 * where the word has づ (片付ける), and the source itself has the odd typo
 * (kangeru for 考える). A reading is accepted when it can be built from the
 * kanji's own readings in KANJIDIC (allowing rendaku and small っ); otherwise
 * the usual romaji mistakes are undone, and only then is a reading from
 * another source (the tokenizer, the word list, the dictionary) used, and
 * only if it's a near miss of the original, so a real special reading
 * (一人 ひとり, 明後日 あさって) is never swapped for a tokenizer's guess.
 */
import { toHiragana } from 'wanakana'

const hira = (s) => toHiragana(s, { passRomaji: true, convertLongVowelMark: false })
const KANJI_CHAR = /[一-龯㐀-䶿々〆ヶヵ]/
const isKanaChar = (c) => /[぀-ゟ゠-ヿー]/.test(c)

const VOICED = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
}
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' }

/** Every way a kanji may be read inside a word: its readings plus rendaku and っ forms. */
function readingSet(entry) {
  const base = new Set()
  for (const on of entry.on ?? []) base.add(hira(on))
  for (const { stem, okuri } of entry.kun ?? []) {
    const s = hira(stem.replace(/[-.]/g, ''))
    if (!s) continue
    base.add(s)
    if (okuri) base.add(s + hira(okuri))
    // 話 はなし, 答 こたえ: the stem plus the first okurigana kana, as nouns use it.
    if (okuri) base.add(s + hira(okuri)[0])
  }
  const out = new Set(base)
  for (const r of base) {
    const first = r[0]
    if (VOICED[first]) out.add(VOICED[first] + r.slice(1))
    if (HALF[first]) out.add(HALF[first] + r.slice(1))
    // 知 じ (存知), 地 じ: ち/し often voice to じ.
    if (first === 'ち' || first === 'し') out.add('じ' + r.slice(1))
    // 一 いっ, 学 がっ, 日 にっ, 出 しゅっ
    if (r.length > 1 && 'つちくき'.includes(r.at(-1))) out.add(r.slice(0, -1) + 'っ')
    // A long vowel shortened (料 りょう → りょ is NOT allowed; but 王 おう in 女王 じょおう is): skip.
  }
  return out
}

export function makeReadingChecker(kanjiData) {
  const sets = new Map()
  const setFor = (ch) => {
    if (ch === 'ヶ' || ch === 'ヵ') return new Set(['か', 'が', 'こ'])
    if (!kanjiData[ch]) return null
    if (!sets.has(ch)) sets.set(ch, readingSet(kanjiData[ch]))
    return sets.get(ch)
  }

  /** Can this run of kanji be read as `reading`, kanji by kanji? null = some kanji unknown. */
  function runFits(chars, reading) {
    const options = []
    for (let i = 0; i < chars.length; i++) {
      const s = chars[i] === '々' ? options[i - 1] : setFor(chars[i])
      if (!s) return null
      options.push(s)
    }
    const memo = new Map()
    const go = (i, pos) => {
      if (i === chars.length) return pos === reading.length
      const key = i * 100 + pos
      if (memo.has(key)) return memo.get(key)
      let ok = false
      for (const r of options[i]) {
        if (reading.startsWith(r, pos) && go(i + 1, pos + r.length)) { ok = true; break }
      }
      memo.set(key, ok)
      return ok
    }
    return go(0, 0)
  }

  /**
   * Lines the reading up with the word's kana: kana the word spells out must
   * be in the reading (as particles too: を for お, は for わ), and comes back
   * as written (ケーキや, じつは). null when the reading doesn't fit the word.
   */
  function align(word, reading) {
    const runs = word.match(/[^぀-ゟ゠-ヿー]+|[぀-ゟ゠-ヿー]+/g) ?? []
    const kanaPattern = (run) => [...hira(run)].map((c) => {
      const alt = { を: 'お', は: 'わ', へ: 'え', づ: 'ず', ぢ: 'じ' }[c]
      if (c === 'ー') return '(?:ー|[あいうえおー])'
      return alt ? `[${c}${alt}]` : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    const re = new RegExp(`^${runs.map((x) => (isKanaChar(x[0]) ? kanaPattern(x) : '(.+?)')).join('')}$`)
    const m = hira(reading).match(re)
    if (!m) return null
    let i = 1
    return { reading: runs.map((x) => (isKanaChar(x[0]) ? x : m[i++])).join(''), parts: runs.map((x) => x) , groups: m.slice(1) }
  }

  /**
   * Every kanji run reads as its kanji allow. 'unknown' when a kanji isn't
   * in the data, so it can't be told.
   */
  function plausible(word, reading) {
    const a = align(word, reading)
    if (!a) return false
    const kanjiRuns = a.parts.filter((x) => !isKanaChar(x[0]))
    let unknown = false
    for (const [i, run] of kanjiRuns.entries()) {
      const fits = runFits([...run], a.groups[i])
      if (fits === false) return false
      if (fits === null) unknown = true
    }
    return unknown ? 'unknown' : true
  }

  return { align, plausible }
}

/** Fixes for the ways romaji conversion goes wrong, each tried on its own. */
function romajiVariants(r) {
  const out = new Set()
  const NA = { な: 'あ', に: 'い', ぬ: 'う', ね: 'え', の: 'お' }
  const chars = [...r]
  chars.forEach((c, i) => {
    const at = (s) => [...chars.slice(0, i), s, ...chars.slice(i + 1)].join('')
    if (c === 'ず') out.add(at('づ'))
    if (c === 'じ') out.add(at('ぢ'))
    // "honya" read as ho-nya: ほにゃ → ほんや; "anzenunten": ぬ → んう
    if (c === 'に' && /[ゃゅょ]/.test(chars[i + 1] ?? '')) {
      out.add([...chars.slice(0, i), 'ん', { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' }[chars[i + 1]], ...chars.slice(i + 2)].join(''))
    }
    if (NA[c] && i > 0) out.add(at('ん' + NA[c]))
    // A doubled n: "annnai" → あんんない
    if (c === 'ん' && chars[i + 1] === 'ん') out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
  })
  out.delete(r)
  return [...out]
}

/** Levenshtein distance on kana. */
export function distance(a, b) {
  a = hira(a); b = hira(b)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

const loose = (s) => hira(s).replace(/づ/g, 'ず').replace(/ぢ/g, 'じ').replace(/を/g, 'お').replace(/ー/g, '')

/**
 * The right reading of `word`, given `reading` (from romaji) and readings
 * from other sources (`others`, most trusted first). Returns the reading and
 * why it changed, if it did.
 */
// Real readings the kanji data can't explain, where a tokenizer's near miss would win.
const SPECIAL = { 格好いい: 'かっこいい', 所為: 'せい' }

export function resolveReading(checker, word, reading, others = []) {
  if (!reading || !KANJI_CHAR.test(word)) return { reading }
  if (SPECIAL[word]) return { reading: SPECIAL[word], why: SPECIAL[word] !== reading ? 'special' : undefined }
  const { align, plausible } = checker
  const a = align(word, reading)?.reading
  const alts = others.filter(Boolean).map((o) => align(word, o)?.reading).filter(Boolean)

  // Another source agrees once ず/づ and を/お are set aside: trust its spelling.
  const same = alts.find((o) => loose(o) === loose(a ?? reading) && plausible(word, o))
  if (same) return { reading: same, why: same !== reading ? 'spelling' : undefined }
  const fits = a && plausible(word, a)
  // A kanji the data doesn't have (携): believe the reading unless another source is one kana off.
  if (fits === 'unknown') {
    const close = alts.find((o) => distance(o, a) === 1 && plausible(word, o))
    return close ? { reading: close, why: 'typo' } : { reading: a, why: a !== reading ? 'kana' : undefined }
  }
  if (fits) return { reading: a, why: a !== reading ? 'kana' : undefined }

  for (const v of romajiVariants(hira(a ?? reading))) {
    const av = align(word, v)?.reading
    if (av && plausible(word, av)) return { reading: av, why: 'romaji' }
  }
  const near = alts.find((o) => plausible(word, o) && distance(o, a ?? reading) <= 2)
  if (near) return { reading: near, why: 'typo' }
  return { reading: a ?? reading }
}

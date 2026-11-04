/**
 * Kanji data for the kanji pages, from two open datasets:
 *
 *   KANJIDIC2 (EDRDG, CC BY-SA 4.0), as JSON from github.com/scriptin/jmdict-simplified
 *     (kanjidic2-en-*.json): readings, meanings, stroke count, grade, frequency.
 *   KanjiVG (Ulrich Apel, CC BY-SA 3.0), the "main" release zip from github.com/KanjiVG/kanjivg
 *     (kanji/<5-digit hex>.svg): stroke paths in stroke order, stroke number positions, parts.
 *
 * makeKanjiData() keeps only the kanji the app uses, so the result can be
 * committed as data/kanji.json and the big source files stay out of the repo.
 */
import fs from 'node:fs'
import path from 'node:path'

export const KANJI_NOTE = 'Subset of KANJIDIC2 (https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), (c) EDRDG, CC BY-SA 4.0, '
  + 'and KanjiVG (https://kanjivg.tagaini.net), (c) Ulrich Apel, CC BY-SA 3.0. '
  + 'Regenerate with: npm run data -- --kanjidic <kanjidic2-en.json from github.com/scriptin/jmdict-simplified> '
  + '--kanjivg <the kanji/ folder of a KanjiVG main release>'

export const KANJI_CHAR = /[一-龯㐀-䶿]/
export const kanjiIn = (s) => [...s].filter((c) => KANJI_CHAR.test(c))

/** あ.う → あう with the okurigana after the dot kept apart: { stem: 'あ', okuri: 'う' }. */
const splitKun = (r) => {
  const [stem, okuri] = r.split('.')
  return okuri ? { stem, okuri } : { stem }
}

function fromKanjidic(c) {
  const groups = c.readingMeaning?.groups ?? []
  const readings = groups.flatMap((g) => g.readings)
  const on = readings.filter((r) => r.type === 'ja_on').map((r) => r.value)
  const kun = readings.filter((r) => r.type === 'ja_kun').map((r) => splitKun(r.value))
  const meanings = groups.flatMap((g) => g.meanings.filter((m) => m.lang === 'en').map((m) => m.value))
  return {
    meanings,
    on,
    kun,
    strokes: c.misc.strokeCounts[0],
    grade: c.misc.grade ?? undefined,
    freq: c.misc.frequency ?? undefined,
    radical: c.radicals.find((r) => r.type === 'classical')?.value,
  }
}

/**
 * Rounds a path's numbers to 0.1. KanjiVG leans on the sign or a second dot
 * to separate numbers ("1.65-0.03", "1.5.25"), and rounding can drop the sign
 * (-0.03 → 0), so every number is written back with a space before it.
 */
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi
const round = (d) => d
  .replace(NUMBER, (n) => ` ${Math.round(Number(n) * 10) / 10 || 0}`)
  .replace(/[\s,]+/g, ' ')
  .replace(/\s*([a-z])\s*/gi, '$1')
  .trim()

/**
 * Stroke paths in document order (= stroke order), stroke number positions,
 * and the kanji's top-level parts (会 → 人, 云), read from one KanjiVG file.
 */
export function parseKanjiVG(svg) {
  const strokes = [...svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map((m) => round(m[1]))
  const numbers = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)">\d+<\/text>/g)]
    .map((m) => [Number(m[1]), Number(m[2])])

  // Walk the <g> tree under the kanji's own group; depth 1 groups are its parts.
  const parts = []
  let radical
  let depth = -1
  for (const m of svg.matchAll(/<g\b([^>]*)>|<\/g>/g)) {
    if (m[0] === '</g>') { if (depth >= 0) depth--; continue }
    const attrs = m[1]
    if (depth < 0) {
      if (/id="kvg:[0-9a-f]+"/.test(attrs)) depth = 0
      continue
    }
    depth++
    const el = attrs.match(/kvg:element="([^"]+)"/)?.[1]
    if (!el) continue
    if (depth === 1 && !parts.includes(el)) parts.push(el)
    if (!radical && /kvg:radical="(general|tradit)"/.test(attrs)) radical = el
  }
  return { strokes, numbers: numbers.length === strokes.length ? numbers : undefined, parts: parts.length > 1 ? parts : undefined, radical }
}

const vgFile = (dir, ch) => path.join(dir, `${ch.codePointAt(0).toString(16).padStart(5, '0')}.svg`)

/** { 会: { meanings, on, kun, strokes, grade, freq, radical, parts, paths, numbers }, … } for `chars`. */
export function makeKanjiData(kanjidicFile, kanjivgDir, chars) {
  const dic = JSON.parse(fs.readFileSync(kanjidicFile, 'utf8'))
  const byChar = new Map(dic.characters.map((c) => [c.literal, c]))
  const out = {}
  const missing = { kanjidic: [], kanjivg: [] }
  for (const ch of [...chars].sort()) {
    const c = byChar.get(ch)
    if (!c) { missing.kanjidic.push(ch); continue }
    const entry = fromKanjidic(c)
    const file = vgFile(kanjivgDir, ch)
    if (fs.existsSync(file)) {
      const vg = parseKanjiVG(fs.readFileSync(file, 'utf8'))
      Object.assign(entry, { paths: vg.strokes, numbers: vg.numbers, parts: vg.parts, radicalForm: vg.radical })
    } else missing.kanjivg.push(ch)
    out[ch] = entry
  }
  return { kanji: out, missing }
}

/**
 * Picks example sentences for the vocabulary list from the Tatoeba corpus
 * (https://tatoeba.org, CC BY 2.0 FR; most Japanese/English pairs come from
 * the public-domain Tanaka Corpus). Used by `npm run data -- --tatoeba <dir>`,
 * where <dir> holds these files from https://tatoeba.org/en/downloads:
 *
 *   jpn_indices.csv     (jpn_indices.tar.bz2)  sentence id, English id, B-line
 *   jpn_sentences.tsv   (per_language/jpn)     id, lang, text
 *   eng_sentences.tsv   (per_language/eng)     id, lang, text
 *
 * The B-line lists the dictionary headword of every word in the sentence,
 * e.g. 通う(かよう){通って}~, so words are matched exactly, not by guessing.
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const KANJI = /[一-龯㐀-䶿々]/
/** Per word; fewer when the word page already has examples. */
export const TATOEBA_PER_WORD = 3
const MAX_LENGTH = 40

/** "通う(かよう)[01]{通って}~" → { head, reading, surface, checked } */
function parseToken(tok) {
  const m = tok.match(/^([^([{~]+)(?:\(([^)]*)\))?(?:\[\d+\])?(?:\{([^}]*)\})?(~)?$/)
  if (!m) return null
  return { head: m[1], reading: m[2], surface: m[3] ?? m[1], checked: !!m[4] }
}

async function readTsv(file, onRow) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
  for await (const line of rl) onRow(line.split('\t'))
}

/**
 * words: { id, word, kana?, spellings? }[] per level. Returns
 * { [wordId]: { id, ja, en }[] }, `ja` with the word marked **…**.
 */
export async function pickTatoeba(dir, wordsByLevel) {
  // 1. Index: which sentence uses which headword, in what form.
  const uses = new Map() // headword → [{ jid, eid, token }]
  const tokensOf = new Map() // jid → tokens (for difficulty)
  await readTsv(path.join(dir, 'jpn_indices.csv'), ([jid, eid, bline]) => {
    if (!bline || !eid || eid === '-1') return
    const tokens = bline.split(' ').map(parseToken).filter(Boolean)
    tokensOf.set(jid, tokens)
    for (const t of tokens) {
      const list = uses.get(t.head) ?? []
      list.push({ jid, eid, token: t })
      uses.set(t.head, list)
    }
  })

  // 2. Text of the sentences the words could use.
  const needJ = new Set()
  const needE = new Set()
  const allWords = Object.values(wordsByLevel).flat()
  for (const w of allWords) {
    for (const form of forms(w)) for (const u of uses.get(form) ?? []) { needJ.add(u.jid); needE.add(u.eid) }
  }
  const ja = new Map()
  const en = new Map()
  await readTsv(path.join(dir, 'jpn_sentences.tsv'), ([id, , text]) => needJ.has(id) && ja.set(id, text))
  await readTsv(path.join(dir, 'eng_sentences.tsv'), ([id, , text]) => needE.has(id) && en.set(id, text))

  // 3. Per level, the best few sentences for each word.
  const out = {}
  for (const [, words] of Object.entries(wordsByLevel)) {
    const known = new Set(words.flatMap(forms))
    for (const w of words) {
      const seen = new Set()
      const candidates = []
      for (const form of forms(w)) {
        for (const { jid, eid, token } of uses.get(form) ?? []) {
          const text = ja.get(jid)
          const english = en.get(eid)
          if (!text || !english || seen.has(jid) || text.length > MAX_LENGTH) continue
          // A reading in the index tells homographs apart: 方(かた) is not 方(ほう).
          if (token.reading && w.kana && token.reading !== w.kana) continue
          const at = text.indexOf(token.surface)
          if (at < 0) continue
          seen.add(jid)
          candidates.push({ jid, text, english, at, surface: token.surface, score: difficulty(text, tokensOf.get(jid), known, token.checked) })
        }
      }
      candidates.sort((a, b) => a.score - b.score || a.text.length - b.text.length)
      const picked = []
      for (const c of candidates) {
        // Skip near-duplicates (same sentence with different punctuation).
        if (picked.some((p) => p.text.replace(/[。、！？]/g, '') === c.text.replace(/[。、！？]/g, ''))) continue
        picked.push(c)
        if (picked.length === TATOEBA_PER_WORD) break
      }
      if (picked.length) {
        out[w.id] = picked.map((c) => ({
          id: Number(c.jid),
          ja: c.text.slice(0, c.at) + `**${c.surface}**` + c.text.slice(c.at + c.surface.length),
          en: c.english,
        }))
      }
    }
  }
  return out
}

/** The forms a word is indexed under: its spelling, other spellings, or its kana if it has no kanji. */
function forms(w) {
  const list = [w.word, ...(w.spellings ?? [])]
  if (!KANJI.test(w.word) && w.kana) list.push(w.kana)
  return [...new Set(list)]
}

/**
 * Lower is easier: short sentences whose other kanji words are on the
 * level's list, and ones Tatoeba marks as good examples (~).
 */
function difficulty(text, tokens = [], known, checked) {
  const unknown = tokens.filter((t) => KANJI.test(t.head) && !known.has(t.head)).length
  return text.length + unknown * 6 - (checked ? 8 : 0)
}

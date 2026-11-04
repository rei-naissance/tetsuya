/**
 * Gaps in question text: the blanks a question asks you to fill. The source
 * sites write them several ways; they're all drawn as the same Gap badge.
 *
 *   numbered  [ 1 ]   「１」   「___１___」   ___１___     (reading, text grammar)
 *   blank     （　　）                                  (grammar form, vocabulary, sentence order)
 *   star      ★                                        (the slot asked about in sentence order)
 *
 * （１） is left alone: in these passages it numbers list items, not gaps.
 * English translations write numbered gaps as [ 1 ] or "1", and blanks as ( ).
 */
export type GapKind = 'numbered' | 'blank' | 'star'
export interface GapMatch { index: number; length: number; kind: GapKind; n?: number }

const JA = /\[\s*([0-9０-９]+)\s*\]|「\s*_*\s*([0-9０-９]+)\s*_*\s*」|_{2,}\s*([0-9０-９]+)\s*_{2,}|（[\s　]*）|★/g
const EN = /\[\s*(\d+)\s*\]|["“]\s*(\d)\s*["”]|「\s*(\d)\s*」|\(\s*[.…\s]*\)|（[\s　]*）/g

const toNumber = (s: string) => Number(s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10)))

/** Every gap in `text`, in order. */
export function findGaps(text: string, lang: 'ja' | 'en' = 'ja'): GapMatch[] {
  const re = new RegExp((lang === 'ja' ? JA : EN).source, 'g')
  const out: GapMatch[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const digits = m[1] ?? m[2] ?? m[3]
    out.push({
      index: m.index,
      length: m[0].length,
      kind: digits ? 'numbered' : m[0] === '★' ? 'star' : 'blank',
      n: digits ? toNumber(digits) : undefined,
    })
  }
  return out
}

/** The gap a question asks about: the first numbered gap in its prompt, or ★ / the blank. */
export function activeGap(prompt: string, target = ''): GapTarget | undefined {
  const numbered = findGaps(prompt).find((g) => g.kind === 'numbered')
  if (numbered) return { kind: 'numbered', n: numbered.n }
  if (target.includes('★')) return { kind: 'star' }
  if (findGaps(target).some((g) => g.kind === 'blank')) return { kind: 'blank' }
  return undefined
}

export interface GapTarget { kind: GapKind; n?: number }

export const sameGap = (g: { kind: GapKind; n?: number }, t?: GapTarget) =>
  !!t && g.kind === t.kind && (g.kind !== 'numbered' || g.n === t.n)

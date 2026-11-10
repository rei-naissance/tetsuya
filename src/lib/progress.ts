import { shuffle } from './random'
import { readJSON, removeKey, writeJSON } from './storage'

/**
 * Per-question practice history for the non-SRS sections, so practice sets
 * can serve unseen questions first and offer a "retry mistakes" set.
 */
export interface Attempt { seen: number; correct: number; lastCorrect: boolean; at: number }
export type AttemptMap = Record<string, Attempt>

const KEY = 'tetsuya:practice:v1'

export function loadAttempts(): AttemptMap {
  return readJSON<AttemptMap>(KEY, {})
}

export function recordAttempt(id: string, correct: boolean, now = Date.now()): void {
  const all = loadAttempts()
  const prev = all[id] ?? { seen: 0, correct: 0, lastCorrect: false, at: 0 }
  all[id] = { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), lastCorrect: correct, at: now }
  writeJSON(KEY, all)
}

export function resetAttempts(): void {
  removeKey(KEY)
}

export interface ProgressStats { total: number; seen: number; right: number; wrong: number }

/** right / wrong count each question by its most recent answer. */
export function progressStats(ids: string[], attempts = loadAttempts()): ProgressStats {
  let seen = 0, right = 0
  for (const id of ids) {
    const a = attempts[id]
    if (!a) continue
    seen++
    if (a.lastCorrect) right++
  }
  return { total: ids.length, seen, right, wrong: seen - right }
}

export type SetMode = 'next' | 'mistakes'

/**
 * Picks a practice set of about `n` questions.
 *  - "next": unseen first, then last-answered-wrong, then the longest-ago right.
 *  - "mistakes": only questions whose last answer was wrong.
 * Questions sharing a `group` (one passage) come as a unit, in id order, and
 * count by their member questions; a group may push the set up to n + 2.
 */
export function pickSet<Q extends { id: string; group?: string }>(
  items: readonly Q[], n: number, mode: SetMode, attempts: AttemptMap = loadAttempts(),
): Q[] {
  const groups = new Map<string, Q[]>()
  for (const q of items) {
    const key = q.group ?? q.id
    groups.set(key, [...(groups.get(key) ?? []), q])
  }
  // rank 0 = unseen, 1 = wrong, 2 = right; a group takes its "neediest" member.
  const rank = (q: Q) => (!attempts[q.id] ? 0 : attempts[q.id].lastCorrect ? 2 : 1)
  const ranked = shuffle([...groups.values()]).map((members) => ({
    members,
    rank: Math.min(...members.map(rank)),
    at: Math.max(...members.map((q) => attempts[q.id]?.at ?? 0)),
  }))
  const pool = mode === 'mistakes'
    ? ranked.filter((g) => g.members.some((q) => rank(q) === 1))
    : ranked.sort((a, b) => a.rank - b.rank || (a.rank === 2 ? a.at - b.at : 0))

  // The ranking decides WHICH questions make the set; the set itself comes in
  // a fresh order, so a restudy isn't the last session replayed.
  const chosen: Q[][] = []
  let count = 0
  for (const { members } of pool) {
    if (count >= n) break
    if (count > 0 && count + members.length > n + 2) continue
    chosen.push(members)
    count += members.length
  }
  return shuffle(chosen).flat()
}

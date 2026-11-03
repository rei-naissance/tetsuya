/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample<T>(items: readonly T[], n: number): T[] {
  return shuffle(items).slice(0, n)
}

/** Shuffle a question's choices, remapping the answer index to match. */
export function shuffleChoices<Q extends {
  choices: string[]
  answer: number
  keepOrder?: boolean
  en?: { choices?: (string | null)[] }
}>(q: Q): Q {
  if (q.keepOrder) return q
  const order = shuffle(q.choices.map((_, i) => i))
  const en = q.en?.choices ? { ...q.en, choices: order.map((i) => q.en!.choices![i]) } : q.en
  return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer), en }
}

/**
 * Picks roughly `n` questions, treating each `group` (e.g. a reading passage
 * and its questions) as one unit: whole groups are drawn at random and their
 * questions stay together in their original order.
 */
export function sampleGrouped<Q extends { id: string; group?: string }>(items: readonly Q[], n: number): Q[] {
  const groups = new Map<string, Q[]>()
  for (const q of items) {
    const key = q.group ?? q.id
    groups.set(key, [...(groups.get(key) ?? []), q])
  }
  const out: Q[] = []
  for (const group of shuffle([...groups.values()])) {
    if (out.length >= n) break
    // Don't let one long group overshoot the target by much.
    if (out.length > 0 && out.length + group.length > n + 2) continue
    out.push(...group)
  }
  return out
}

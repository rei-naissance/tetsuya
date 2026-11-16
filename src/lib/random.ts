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

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/**
 * Wrong choices drawn afresh from a question's pool, so a card seen again
 * doesn't bring back the same four options. About two times in three one
 * wrong choice is a near miss of another (こたえ, ごたえ, ごだえ): when every
 * wrong choice is one small change from the answer, the answer is simply the
 * one the others have in common, and that's guessable without knowing it.
 */
export function drawDistractors<Q extends {
  choices: string[]
  answer: number
  distractors?: { near: string[]; far: string[][] }
}>(q: Q): Q {
  const d = q.distractors
  if (!d || d.near.length < 3) return q
  const right = q.choices[q.answer]
  let wrong: string[] | undefined
  const parents = d.near.map((x, i) => [x, d.far[i] ?? []] as const).filter(([, kids]) => kids.length)
  if (parents.length && Math.random() < 0.65) {
    const [parent, kids] = pick(parents)
    const kid = pick(kids)
    const other = pick(d.near.filter((x) => x !== parent && x !== kid))
    if (other) wrong = [parent, kid, other]
  }
  wrong ??= shuffle(d.near).slice(0, 3)
  return { ...q, choices: [right, ...wrong], answer: 0 }
}

/**
 * Shuffle a question's choices, remapping the answer index to match. Wrong
 * choices are redrawn first when the question has a pool of them.
 */
export function shuffleChoices<Q extends {
  choices: string[]
  answer: number
  keepOrder?: boolean
  distractors?: { near: string[]; far: string[][] }
  en?: { choices?: (string | null)[] }
}>(original: Q): Q {
  if (original.keepOrder) return original
  const q = drawDistractors(original)
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

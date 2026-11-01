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
export function shuffleChoices<Q extends { choices: string[]; answer: number }>(q: Q): Q {
  const order = shuffle(q.choices.map((_, i) => i))
  return { ...q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer) }
}

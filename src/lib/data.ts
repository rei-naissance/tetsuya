import type { Level, LevelData, Question, Section } from './types'
import { SECTIONS } from './types'

const cache = new Map<Level, Promise<Question[]>>()

/**
 * Loads /data/<level>.json from the public folder. Fetched at runtime, so you
 * can replace the JSON files without rebuilding the app.
 */
export function loadQuestions(level: Level): Promise<Question[]> {
  let p = cache.get(level)
  if (!p) {
    const url = `${import.meta.env.BASE_URL}data/${level.toLowerCase()}.json`
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
        return res.json() as Promise<LevelData>
      })
      .then((data) => validate(data.questions ?? []))
    p.catch(() => cache.delete(level))
    cache.set(level, p)
  }
  return p
}

export function bySection(questions: Question[], section: Section): Question[] {
  return questions.filter((q) => q.section === section)
}

/** Drops malformed entries (with a console warning) rather than crashing the UI. */
function validate(questions: Question[]): Question[] {
  const seen = new Set<string>()
  return questions.filter((q, i) => {
    const problem =
      !q.id ? 'missing id'
      : seen.has(q.id) ? `duplicate id "${q.id}"`
      : !SECTIONS.includes(q.section) ? `unknown section "${q.section}"`
      : !Array.isArray(q.choices) || q.choices.length < 2 ? 'needs at least 2 choices'
      : !(q.answer >= 0 && q.answer < q.choices.length) ? 'answer index out of range'
      : null
    if (problem) {
      console.warn(`[data] skipping question #${i} (${q.id ?? '?'}): ${problem}`)
      return false
    }
    seen.add(q.id)
    return true
  })
}

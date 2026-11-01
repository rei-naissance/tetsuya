import { readJSON, writeJSON, removeKey } from './storage'
import type { Level, Section } from './types'

export interface MockResult {
  level: Level
  date: number
  correct: number
  total: number
  seconds: number
  bySection: Partial<Record<Section, { correct: number; total: number }>>
}

const KEY = 'tetsuya:mock:history:v1'
const MAX = 50

export function loadHistory(level?: Level): MockResult[] {
  const all = readJSON<MockResult[]>(KEY, [])
  return level ? all.filter((r) => r.level === level) : all
}

export function saveResult(result: MockResult): void {
  writeJSON(KEY, [result, ...loadHistory()].slice(0, MAX))
}

export function clearHistory(): void {
  removeKey(KEY)
}

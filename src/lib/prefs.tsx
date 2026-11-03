import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from './storage'
import { MAX_REVIEWS, NEW_PER_DAY, type Limits } from './srs'

interface Prefs {
  furigana: boolean
  /** Questions per practice set; 0 = all of them. */
  setSize: number
  /** New flashcards per section per day. */
  newPerDay: number
  /** Reviews per section per day; 0 = no limit. */
  maxReviews: number
}
const KEY = 'tetsuya:prefs:v1'
const DEFAULTS: Prefs = { furigana: true, setSize: 10, newPerDay: NEW_PER_DAY, maxReviews: MAX_REVIEWS }
export const SET_SIZES = [5, 10, 20, 50, 0]
/** Quick picks next to the number fields; any whole number can be typed. */
export const NEW_PER_DAY_PRESETS = [5, 10, 20, 50]
export const MAX_REVIEWS_PRESETS = [100, 200, 500, 0]

/** How many to take from a pool of `available` for a set-size setting. */
export const setCount = (setSize: number, available: number) => (setSize === 0 ? available : Math.min(setSize, available))

const PrefsContext = createContext<{
  prefs: Prefs
  toggleFurigana: () => void
  setSetSize: (n: number) => void
  setLimits: (l: Partial<Limits>) => void
  /** The daily limits, ready to pass to the SRS functions. */
  limits: Limits
} | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Spread over the defaults so prefs saved by older versions gain new fields.
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULTS, ...readJSON<Partial<Prefs>>(KEY, {}) }))
  useEffect(() => writeJSON(KEY, prefs), [prefs])
  const toggleFurigana = () => setPrefs((p) => ({ ...p, furigana: !p.furigana }))
  const setSetSize = (setSize: number) => setPrefs((p) => ({ ...p, setSize }))
  const setLimits = (l: Partial<Limits>) => setPrefs((p) => ({ ...p, ...l }))
  const limits = { newPerDay: prefs.newPerDay, maxReviews: prefs.maxReviews }
  return (
    <PrefsContext.Provider value={{ prefs, toggleFurigana, setSetSize, setLimits, limits }}>
      <div className={prefs.furigana ? undefined : 'hide-furigana'}>{children}</div>
    </PrefsContext.Provider>
  )
}

export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return ctx
}

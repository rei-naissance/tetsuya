import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from './storage'

interface Prefs {
  furigana: boolean
  /** Questions per practice set. */
  setSize: number
}
const KEY = 'tetsuya:prefs:v1'
const DEFAULTS: Prefs = { furigana: true, setSize: 10 }
export const SET_SIZES = [5, 10, 20]

const PrefsContext = createContext<{
  prefs: Prefs
  toggleFurigana: () => void
  setSetSize: (n: number) => void
} | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Spread over the defaults so prefs saved by older versions gain new fields.
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULTS, ...readJSON<Partial<Prefs>>(KEY, {}) }))
  useEffect(() => writeJSON(KEY, prefs), [prefs])
  const toggleFurigana = () => setPrefs((p) => ({ ...p, furigana: !p.furigana }))
  const setSetSize = (setSize: number) => setPrefs((p) => ({ ...p, setSize }))
  return (
    <PrefsContext.Provider value={{ prefs, toggleFurigana, setSetSize }}>
      <div className={prefs.furigana ? undefined : 'hide-furigana'}>{children}</div>
    </PrefsContext.Provider>
  )
}

export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return ctx
}

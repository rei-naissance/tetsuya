import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from './storage'

interface Prefs { furigana: boolean }
const KEY = 'tetsuya:prefs:v1'

const PrefsContext = createContext<{ prefs: Prefs; toggleFurigana: () => void } | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => readJSON(KEY, { furigana: true }))
  useEffect(() => writeJSON(KEY, prefs), [prefs])
  const toggleFurigana = () => setPrefs((p) => ({ ...p, furigana: !p.furigana }))
  return (
    <PrefsContext.Provider value={{ prefs, toggleFurigana }}>
      <div className={prefs.furigana ? undefined : 'hide-furigana'}>{children}</div>
    </PrefsContext.Provider>
  )
}

export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>')
  return ctx
}

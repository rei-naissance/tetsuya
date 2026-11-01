import { useEffect, useRef } from 'react'

/** Global keyboard shortcuts; ignored while typing in form fields. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, audio')) return
      // A focused button already handles Enter/Space itself; don't fire twice.
      if ((e.key === 'Enter' || e.key === ' ') && el.closest('button, a')) return
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

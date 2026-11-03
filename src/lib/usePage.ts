import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Splits `items` into pages of `size`, with the page number in the URL (?p=)
 * so back navigation returns to the same page. Put `topRef` on the element
 * the list starts at: changing page scrolls back to it.
 */
export function usePage<T>(items: readonly T[], size: number) {
  const [params, setParams] = useSearchParams()
  const topRef = useRef<HTMLDivElement>(null)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('p'))) || 1))

  const setPage = (p: number) => {
    const next = new URLSearchParams(params)
    if (p > 1) next.set('p', String(p))
    else next.delete('p')
    setParams(next)
    const top = topRef.current
    if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - 72) })
  }

  return { page, pages, setPage, topRef, start: (page - 1) * size, items: items.slice((page - 1) * size, page * size) }
}

import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * Renders Japanese text with lightweight markup:
 *   {漢字|かんじ}  → furigana (ruby)
 *   **word**       → underlined target word (may contain furigana)
 *   newlines       → line breaks
 */
const TOKEN = /\{([^|}]+)\|([^}]+)\}|\*\*(.+?)\*\*/g

function parse(text: string, key = 'k'): ReactNode[] {
  const out: ReactNode[] = []
  const re = new RegExp(TOKEN.source, 'g')
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}-${m.index}`
    if (m[1]) {
      out.push(
        <ruby key={k}>
          {m[1]}<rp>(</rp><rt>{m[2]}</rt><rp>)</rp>
        </ruby>,
      )
    } else {
      out.push(
        <span key={k} className="font-medium underline decoration-accent decoration-2 underline-offset-[0.35em]">
          {parse(m[3], k)}
        </span>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function JP({ text, className, as: Tag = 'span' }: { text: string; className?: string; as?: 'span' | 'p' | 'div' | 'h2' }) {
  return <Tag lang="ja" className={cn('font-jp whitespace-pre-line', className)}>{parse(text)}</Tag>
}

import type { ReactNode } from 'react'
import { findGaps, sameGap, type GapMatch, type GapTarget } from '../lib/gaps'
import { ruby } from '../lib/ruby'
import { cn } from '../lib/cn'

/** Which gap the question asks about, and (after answering) what goes in it. */
export interface GapOptions {
  active?: GapTarget
  /** Shown inside the active gap, e.g. the right answer once revealed. */
  fill?: string
}

/**
 * Renders Japanese text with lightweight markup:
 *   {漢字|かんじ}  → furigana (ruby)
 *   **word**       → underlined target word (may contain furigana)
 *   gaps           → Gap badges ([ 1 ], 「１」, （　　）, ★; see src/lib/gaps.ts)
 *   newlines       → line breaks
 */
const TOKEN = /\{([^|}]+)\|([^}]+)\}|\*\*(.+?)\*\*/g

function parse(text: string, key = 'k', gaps?: GapOptions): ReactNode[] {
  const out: ReactNode[] = []
  const re = new RegExp(TOKEN.source, 'g')
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...withGaps(text.slice(last, m.index), 'ja', `${key}-t${last}`, gaps))
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
          {parse(m[3], k, gaps)}
        </span>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(...withGaps(text.slice(last), 'ja', `${key}-t${last}`, gaps))
  return out
}

/** Plain text with its gaps turned into badges. */
function withGaps(text: string, lang: 'ja' | 'en', key: string, gaps?: GapOptions): ReactNode[] {
  const found = findGaps(text, lang)
  if (!found.length) return [text]
  const out: ReactNode[] = []
  let last = 0
  for (const g of found) {
    if (g.index > last) out.push(text.slice(last, g.index))
    out.push(<Gap key={`${key}-g${g.index}`} gap={g} options={gaps} />)
    last = g.index + g.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * One gap. Numbered gaps each get their own color (--gap-1 … --gap-5 in
 * index.css), the same in the passage, the question and the translation.
 * The gap being asked about is solid, the rest are faded; once answered it
 * shows the answer.
 */
function Gap({ gap, options }: { gap: GapMatch; options?: GapOptions }) {
  const active = sameGap(gap, options?.active)
  const muted = !!options?.active && !active
  const label = gap.kind === 'numbered' ? String(gap.n) : gap.kind === 'star' ? '★' : ''
  const fill = active ? options?.fill : undefined
  return (
    <span
      className="gap"
      data-kind={gap.kind}
      data-n={gap.kind === 'numbered' ? ((gap.n! - 1) % 5) + 1 : undefined}
      data-active={active || undefined}
      data-muted={muted || undefined}
      data-filled={fill ? '' : undefined}
      aria-label={gap.kind === 'numbered' ? `gap ${gap.n}` : gap.kind === 'star' ? 'star slot' : 'blank'}
    >
      {fill ? <>{label && <span className="gap-num">{label}</span>}<span lang="ja" className="gap-fill">{parse(fill)}</span></> : label}
    </span>
  )
}

export function JP({ text, className, as: Tag = 'span', gaps }: {
  text: string
  className?: string
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2'
  gaps?: GapOptions
}) {
  // Classes aren't merged, so a font passed in (font-jp-serif, font-sans) replaces the default.
  const font = /font-(jp-serif|sans)/.test(className ?? '') ? '' : 'font-jp'
  return <Tag lang="ja" className={cn(font, 'whitespace-pre-line', className)}>{parse(text, 'k', gaps)}</Tag>
}

/** English text (translations) with the same gap badges as the Japanese it translates. */
export function EN({ text, className, as: Tag = 'p', gaps }: { text: string; className?: string; as?: 'span' | 'p'; gaps?: GapOptions }) {
  return <Tag className={cn('whitespace-pre-line', className)}>{withGaps(text, 'en', 'en', gaps)}</Tag>
}

/** An app label (section name, question type…) with furigana from src/lib/ruby.ts. */
export function Furi({ text, className, as }: { text: string; className?: string; as?: 'span' | 'p' | 'div' | 'h1' | 'h2' }) {
  return <JP as={as} text={ruby(text)} className={className} />
}

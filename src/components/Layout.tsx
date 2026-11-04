import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { usePrefs } from '../lib/prefs'
import { cn } from '../lib/cn'

export function Layout({ back, title, right, children, wide }: {
  back?: { to: string; label: string }
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const { prefs, toggleFurigana } = usePrefs()
  const width = wide ? 'max-w-4xl' : 'max-w-2xl'
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur dark:border-stone-800/70 dark:bg-stone-950/85">
        <div className={cn('mx-auto flex h-14 items-center gap-3 px-4 sm:px-6', width)}>
          {back ? (
            <Link
              to={back.to}
              className="-ml-2 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <span aria-hidden>←</span> {back.label}
            </Link>
          ) : (
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-md bg-hanko font-jp-serif text-sm text-white">鉄</span>
              Tetsuya
            </Link>
          )}
          <div className="min-w-0 flex-1 truncate text-center text-sm font-medium text-stone-600 dark:text-stone-300">{title}</div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            <button
              onClick={toggleFurigana}
              title={prefs.furigana ? 'Hide furigana' : 'Show furigana'}
              aria-pressed={prefs.furigana}
              className={buttonClass(prefs.furigana ? 'secondary' : 'ghost', 'sm', cn('font-jp', !prefs.furigana && 'line-through opacity-60'))}
            >
              ふりがな
            </button>
          </div>
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12', width)}>{children}</main>
      {/* Sources and licences live on one page instead of on every page that uses them. */}
      <footer className={cn('mx-auto w-full px-4 pb-8 text-center text-xs text-stone-400 sm:px-6', width)}>
        <Link to="/credits" className="underline-offset-4 hover:text-stone-900 hover:underline dark:hover:text-stone-100">Credits and licences</Link>
      </footer>
    </div>
  )
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[40vh] place-items-center text-center text-stone-500">{children}</div>
}

/* ------------------------------------------------------------------ */
/* Design system: buttons, action rows, pickers                        */
/*                                                                      */
/*   variant  primary    the one main action of a row (at most one)     */
/*            secondary  other actions next to it                       */
/*            ghost      low-emphasis (Previous, Back)                   */
/*   size     md         44px tall, min 7rem wide: every standalone     */
/*                       action                                         */
/*            sm         36px tall: dense controls (pages, pickers)     */
/*            tile       56px, two lines: grade buttons (label + wait)  */
/*            icon       36px circle: play audio                        */
/*   Classes aren't merged, so never override size or shape with        */
/*   className: add a size here instead.                                */
/*   Labels are short verbs; a count goes in the `count` badge, not the  */
/*   label. Minor actions (Submit early, Reset) are TextButtons.         */
/*   Rows: <Actions>, primary first; centered on end screens,           */
/*   start-aligned in cards, "between" for Previous / Next footers.     */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'tile' | 'icon'

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40',
    size === 'md' && 'h-11 min-w-28 gap-2 rounded-xl px-5 text-sm',
    size === 'sm' && 'h-9 min-w-9 gap-2 rounded-xl px-3 text-sm',
    size === 'tile' && 'h-14 flex-col rounded-xl px-5 text-sm',
    size === 'icon' && 'size-9 rounded-full text-xs',
    variant === 'primary' && 'bg-stone-900 text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white',
    variant === 'secondary' && 'border border-stone-300 bg-white text-stone-900 hover:border-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-300',
    variant === 'ghost' && 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100',
    className,
  )

type ButtonOwnProps = { variant?: ButtonVariant; size?: ButtonSize; count?: number; children?: ReactNode }

/** A number shown inside a button: "Drill all  84". */
function Count({ n }: { n?: number }) {
  return n === undefined ? null : <span className="tabular-nums opacity-70">{n}</span>
}

export function Button({ variant, size, count, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & ButtonOwnProps) {
  return (
    <button {...props} className={buttonClass(variant, size, className)}>
      {children}
      <Count n={count} />
    </button>
  )
}

/** A link that looks like a Button. */
export function ButtonLink({ variant, size, count, className, children, ...props }: LinkProps & ButtonOwnProps) {
  return (
    <Link {...props} className={buttonClass(variant, size, className)}>
      {children}
      <Count n={count} />
    </Link>
  )
}

/** A minor action that shouldn't compete with buttons: Submit early, Reset progress. */
export function TextButton({ tone = 'neutral', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'danger' }) {
  return (
    <button
      {...props}
      className={cn(
        'text-sm text-stone-500 underline-offset-4 transition hover:underline disabled:opacity-40',
        tone === 'danger' ? 'hover:text-rose-600' : 'hover:text-stone-900 dark:hover:text-stone-100',
        className,
      )}
    />
  )
}

/**
 * A TextButton that asks inline before acting, instead of the browser's
 * confirm() dialog (which freezes the page while it waits, and shows up as a
 * very slow interaction). Cancels itself after a few seconds.
 */
export function ConfirmTextButton({ question, confirmLabel, onConfirm, tone, children }: {
  question: string
  confirmLabel: string
  onConfirm: () => void
  tone?: 'neutral' | 'danger'
  children: ReactNode
}) {
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    if (!asking) return
    const t = setTimeout(() => setAsking(false), 6000)
    return () => clearTimeout(t)
  }, [asking])
  if (!asking) return <TextButton tone={tone} onClick={() => setAsking(true)}>{children}</TextButton>
  return (
    <div role="alertdialog" aria-label={question} className="flex flex-wrap items-center justify-center gap-3 text-sm">
      <span className="text-stone-600 dark:text-stone-300">{question}</span>
      <Button size="sm" autoFocus onClick={() => { setAsking(false); onConfirm() }}>{confirmLabel}</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
    </div>
  )
}

/** A row of actions, primary first. */
export function Actions({ align = 'start', className, children }: { align?: 'start' | 'center' | 'between'; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3',
        align === 'center' && 'justify-center',
        align === 'between' && 'justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

const segment = (on: boolean) =>
  cn(
    'h-8 min-w-9 rounded-lg px-2.5 text-sm tabular-nums transition',
    on ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100',
  )

/** The one picker style: a segmented row for a single choice (set size, filters). */
export function Chips<T extends string | number>({ label, hideLabel, options, value, onChange, format = String }: {
  label: string
  hideLabel?: boolean
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-stone-500">
      {!hideLabel && label}
      <div className="flex flex-wrap rounded-xl border border-stone-200 bg-white p-0.5 dark:border-stone-800 dark:bg-stone-900" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={segment(value === o)}>
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * A whole-number setting: a typed value with quick picks next to it.
 * `zeroLabel` names what 0 means ("No limit"); 0 is only allowed if given.
 */
export function NumberField({ label, hint, value, onChange, presets = [], max = 9999, zeroLabel }: {
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  presets?: number[]
  max?: number
  zeroLabel?: string
}) {
  const shown = (n: number) => (n === 0 && zeroLabel ? '' : String(n))
  const [draft, setDraft] = useState(shown(value))
  useEffect(() => setDraft(shown(value)), [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const n = draft.trim() === '' && zeroLabel ? 0 : Math.floor(Number(draft))
    if (Number.isFinite(n) && n >= (zeroLabel ? 0 : 1) && n <= max) onChange(n)
    else setDraft(shown(value))
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="w-40 text-stone-600 dark:text-stone-300">
        {label}
        {hint && <span className="block text-xs text-stone-400">{hint}</span>}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={zeroLabel ? 0 : 1}
        max={max}
        value={draft}
        placeholder={zeroLabel}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-9 w-24 rounded-xl border border-stone-300 bg-white px-3 tabular-nums outline-none placeholder:text-stone-400 focus:border-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-stone-300"
      />
      {presets.length > 0 && (
        <div className="flex flex-wrap rounded-xl border border-stone-200 bg-white p-0.5 dark:border-stone-800 dark:bg-stone-900" role="group" aria-label={`${label} presets`}>
          {presets.map((p) => (
            <button key={p} onClick={() => onChange(p)} aria-pressed={value === p} className={segment(value === p)}>
              {p === 0 ? zeroLabel : p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Page numbers to show: always the first and last, plus one either side of the current one (fits a phone). */
export function pageList(page: number, pages: number): (number | '…')[] {
  const out: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
}

/** Numbered pages with previous / next. `page` is 1-based. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="Pages">
      <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1}>
        ← <span className="sr-only sm:not-sr-only">Prev</span>
      </Button>
      {pageList(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-stone-400">…</span>
        ) : (
          <Button key={p} variant={p === page ? 'primary' : 'ghost'} size="sm" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} className="tabular-nums">
            {p}
          </Button>
        ),
      )}
      <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page === pages}>
        <span className="sr-only sm:not-sr-only">Next</span> →
      </Button>
    </nav>
  )
}

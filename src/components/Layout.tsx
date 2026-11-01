import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
              <span className="grid size-7 place-items-center rounded-md bg-accent font-jp-serif text-sm text-white">鉄</span>
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
              className={cn(
                'rounded-lg border px-2 py-1 font-jp text-xs transition',
                prefs.furigana
                  ? 'border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-200'
                  : 'border-transparent text-stone-400 line-through',
              )}
            >
              ふりがな
            </button>
          </div>
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12', width)}>{children}</main>
    </div>
  )
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[40vh] place-items-center text-center text-stone-500">{children}</div>
}

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline'
}) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-stone-900 text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white',
        variant === 'outline' && 'border border-stone-300 hover:border-stone-900 dark:border-stone-700 dark:hover:border-stone-300',
        variant === 'ghost' && 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100',
        className,
      )}
    />
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

import { useState } from 'react'
import { MAX_REVIEWS_PRESETS, NEW_PER_DAY_PRESETS, usePrefs } from '../lib/prefs'
import { addNewToday, addReviewsToday, deckStats, today } from '../lib/srs'
import { Button, NumberField } from './Layout'

/**
 * Spaced-repetition settings and custom study for one section (or the word
 * list). Limits are counted per section per study day (which starts at 4 a.m.)
 * and shared by all its decks; changing a limit never clears today's counts.
 *
 *   onChange  something about today changed (extra cards added): refresh
 *   onAhead   start a review-ahead session for cards due within `days`
 */
export function StudyOptions({ ids, deck, onChange, onAhead, compact }: {
  ids: string[]
  deck: string
  onChange?: () => void
  onAhead: (days: number) => void
  /** End-of-session screens: custom study only, no limit settings. */
  compact?: boolean
}) {
  const { limits, setLimits } = usePrefs()
  const [, bump] = useState(0)
  const t = today(deck, limits)
  const [aheadDays, setAheadDays] = useState(3)
  const stats = deckStats(ids, deck, limits, Date.now(), aheadDays)
  const changed = () => { bump((n) => n + 1); onChange?.() }

  return (
    <div className="space-y-6 text-left">
      {!compact && (
        <section>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">Daily limits</h3>
          <div className="space-y-3">
            <NumberField
              label="New cards a day"
              hint="Per section"
              value={limits.newPerDay}
              onChange={(n) => setLimits({ newPerDay: n })}
              presets={NEW_PER_DAY_PRESETS}
            />
            <NumberField
              label="Reviews a day"
              hint="Due cards past this wait for tomorrow"
              value={limits.maxReviews}
              onChange={(n) => setLimits({ maxReviews: n })}
              presets={MAX_REVIEWS_PRESETS}
              zeroLabel="No limit"
            />
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Today so far: {t.introduced} new, {t.reviewed} review{t.reviewed === 1 ? '' : 's'}. The day starts over at 4 a.m.;
            changing a limit doesn't reset these counts.
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">Custom study</h3>
        <div className="space-y-3">
          <CustomRow
            label="More new cards today"
            hint={`${stats.unseen} not started yet`}
            initial={Math.min(10, Math.max(1, stats.unseen))}
            disabled={stats.unseen === 0}
            action="Add"
            onRun={(n) => { addNewToday(deck, n); changed() }}
          />
          {limits.maxReviews > 0 && (
            <CustomRow
              label="More reviews today"
              hint={stats.dueTotal > stats.due ? `${stats.dueTotal - stats.due} due cards over the limit` : 'None over the limit'}
              initial={Math.max(10, stats.dueTotal - stats.due)}
              disabled={stats.dueTotal <= stats.due}
              action="Add"
              onRun={(n) => { addReviewsToday(deck, n); changed() }}
            />
          )}
          <CustomRow
            label="Review ahead"
            hint={`${stats.ahead} card${stats.ahead === 1 ? '' : 's'} due in the next ${aheadDays} day${aheadDays === 1 ? '' : 's'}`}
            initial={aheadDays}
            unit="days"
            onValue={setAheadDays}
            disabled={stats.ahead === 0}
            action="Study"
            onRun={onAhead}
          />
        </div>
      </section>
    </div>
  )
}

/** "Label  [ n ]  [Action]": one custom-study option. */
function CustomRow({ label, hint, initial, unit, disabled, action, onRun, onValue }: {
  label: string
  hint: string
  initial: number
  unit?: string
  disabled?: boolean
  action: string
  onRun: (n: number) => void
  onValue?: (n: number) => void
}) {
  const [value, setValue] = useState(String(initial))
  const n = Math.floor(Number(value))
  const valid = Number.isFinite(n) && n >= 1 && n <= 9999
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="w-40 text-stone-600 dark:text-stone-300">
        {label}
        <span className="block text-xs text-stone-400">{hint}</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        aria-label={label}
        onChange={(e) => {
          setValue(e.target.value)
          const v = Math.floor(Number(e.target.value))
          if (v >= 1) onValue?.(v)
        }}
        className="h-9 w-24 rounded-xl border border-stone-300 bg-white px-3 tabular-nums outline-none focus:border-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:focus:border-stone-300"
      />
      {unit && <span className="text-stone-400">{unit}</span>}
      <Button variant="secondary" size="sm" disabled={disabled || !valid} onClick={() => onRun(n)}>{action}</Button>
    </div>
  )
}

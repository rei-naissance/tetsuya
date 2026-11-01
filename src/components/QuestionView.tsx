import { useState } from 'react'
import type { Question } from '../lib/types'
import { SECTION_META } from '../lib/types'
import { cn } from '../lib/cn'
import { JP } from './JP'

const asset = (path: string) => (/^(https?:)?\//.test(path) ? path : import.meta.env.BASE_URL + path)

/**
 * Presents one multiple-choice question.
 * `selected` is the chosen index (or null); `reveal` switches on right/wrong
 * styling, the explanation and any listening transcript.
 */
export function QuestionView({ q, selected, reveal, onSelect, showSection }: {
  q: Question
  selected: number | null
  reveal: boolean
  onSelect: (i: number) => void
  showSection?: boolean
}) {
  return (
    <div className="space-y-6">
      {showSection && (
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          {SECTION_META[q.section].label} <span className="font-jp normal-case">· {SECTION_META[q.section].jp}</span>
        </p>
      )}

      {q.passage && (
        <JP
          as="div"
          text={q.passage}
          className="max-h-[45vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-[1.05rem] leading-[2.2] dark:border-stone-800 dark:bg-stone-900"
        />
      )}

      {(q.audio || q.transcript) && <Listening key={q.id} q={q} reveal={reveal} />}

      {q.image && <img src={asset(q.image)} alt="" className="mx-auto max-h-64 rounded-xl" />}

      <JP as="p" text={q.prompt} className="text-base leading-[2.1] text-stone-600 dark:text-stone-300" />

      {q.target && (
        <JP as="p" text={q.target} className="text-[1.6rem] leading-[2.2] tracking-wide sm:text-[1.85rem]" />
      )}

      <ol className="grid gap-2.5">
        {q.choices.map((choice, i) => {
          const isAnswer = i === q.answer
          const isPicked = i === selected
          return (
            <li key={i}>
              <button
                onClick={() => !reveal && onSelect(i)}
                disabled={reveal}
                className={cn(
                  'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition',
                  !reveal && !isPicked && 'border-stone-200 bg-white hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600',
                  !reveal && isPicked && 'border-stone-900 bg-white ring-1 ring-stone-900 dark:border-stone-100 dark:bg-stone-900 dark:ring-stone-100',
                  reveal && isAnswer && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                  reveal && isPicked && !isAnswer && 'border-rose-400 bg-rose-50 dark:bg-rose-950/40',
                  reveal && !isAnswer && !isPicked && 'border-stone-200 opacity-50 dark:border-stone-800',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border text-xs tabular-nums',
                    reveal && isAnswer ? 'border-emerald-500 bg-emerald-500 text-white'
                    : reveal && isPicked ? 'border-rose-400 bg-rose-400 text-white'
                    : isPicked ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                    : 'border-stone-300 text-stone-400 dark:border-stone-700',
                  )}
                >
                  {reveal && isAnswer ? '✓' : reveal && isPicked ? '✕' : i + 1}
                </span>
                <JP text={choice} className="text-lg leading-relaxed" />
              </button>
            </li>
          )
        })}
      </ol>

      {reveal && q.explanation && (
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-600 dark:bg-stone-900 dark:text-stone-300">
          <JP text={q.explanation} />
        </div>
      )}
    </div>
  )
}

function Listening({ q, reveal }: { q: Question; reveal: boolean }) {
  const [audioFailed, setAudioFailed] = useState(false)
  const hasAudio = !!q.audio && !audioFailed
  // Without audio the transcript is the only way to answer, so show it up front.
  const showTranscript = !!q.transcript && (reveal || !hasAudio)
  return (
    <div className="space-y-3">
      {hasAudio ? (
        <audio controls preload="metadata" src={asset(q.audio!)} onError={() => setAudioFailed(true)} className="w-full" />
      ) : (
        <p className="text-xs text-stone-400">
          {q.audio ? 'Audio file not found — showing the script instead.' : 'No audio for this item — read the script.'}
        </p>
      )}
      {showTranscript && (
        <JP
          as="div"
          text={q.transcript!}
          className="rounded-2xl border border-dashed border-stone-300 p-4 text-[0.98rem] leading-[2] text-stone-700 dark:border-stone-700 dark:text-stone-300"
        />
      )}
    </div>
  )
}

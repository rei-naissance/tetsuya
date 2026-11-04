import { useEffect, useRef, useState } from 'react'
import type { Question } from '../lib/types'
import { KINDS, SECTION_META } from '../lib/types'
import { cn } from '../lib/cn'
import { activeGap } from '../lib/gaps'
import { EN, Furi, JP, type GapOptions } from './JP'

const asset = (path: string) => (/^(https?:)?\//.test(path) ? path : import.meta.env.BASE_URL + path)

/**
 * Presents one multiple-choice question.
 * `selected` is the chosen index (or null); `reveal` switches on right/wrong
 * styling, the explanation and any listening transcript.
 */
export function QuestionView({ q, selected, reveal, onSelect, showSection, autoPlay }: {
  q: Question
  selected: number | null
  reveal: boolean
  onSelect: (i: number) => void
  showSection?: boolean
  /** Start the listening audio as soon as the question appears. */
  autoPlay?: boolean
}) {
  const numbered = q.choices.every((c, i) => c === String(i + 1))
  const kind = KINDS[q.section].find((k) => k.id === q.kind)
  // The gap this question asks about, highlighted everywhere it appears;
  // once answered it shows the right answer (in English in the translation).
  const active = activeGap(q.prompt, q.target)
  const gapsJa: GapOptions = { active, fill: reveal ? q.choices[q.answer] : undefined }
  const gapsEn: GapOptions = { active, fill: reveal ? q.en?.choices?.[q.answer] ?? q.choices[q.answer] : undefined }
  return (
    <div className="space-y-6">
      {showSection && (
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          {SECTION_META[q.section].label}
          {kind && <> · {kind.label}</>}
          <Furi text={kind?.jp ?? SECTION_META[q.section].jp} className="ml-1.5 normal-case" />
        </p>
      )}

      {q.passage && (
        <JP
          as="div"
          text={q.passage}
          gaps={gapsJa}
          className="max-h-[45vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 text-[1.05rem] leading-[2.2] dark:border-stone-800 dark:bg-stone-900"
        />
      )}
      {reveal && q.en?.passage && (
        <details className="group -mt-3 text-sm text-stone-500">
          <summary className="cursor-pointer select-none hover:text-stone-900 dark:hover:text-stone-100">English translation of the passage</summary>
          <EN text={q.en.passage} gaps={gapsEn} className="mt-2 leading-relaxed" />
        </details>
      )}

      {(q.audio || q.transcript) && <Listening key={q.id} q={q} reveal={reveal} autoPlay={autoPlay} />}

      {q.image && (
        // White backing: the source pictures are line drawings on transparent/white.
        <img src={asset(q.image)} alt="Answer choices 1–4" className="mx-auto max-h-80 w-auto rounded-xl bg-white p-2" />
      )}

      <div>
        <JP as="p" text={q.prompt} gaps={{ active }} className="text-base leading-[2.1] text-stone-600 dark:text-stone-300" />
        {reveal && q.en?.prompt && <EN text={q.en.prompt} gaps={{ active }} className="text-sm text-stone-500" />}
      </div>

      {q.target && (
        <JP as="p" text={q.target} gaps={gapsJa} className="text-[1.6rem] leading-[2.2] tracking-wide sm:text-[1.85rem]" />
      )}

      {numbered ? (
        <NumberedChoices q={q} selected={selected} reveal={reveal} onSelect={onSelect} />
      ) : (
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
                  <span className="min-w-0">
                    <JP text={choice} className="text-lg leading-relaxed" />
                    {reveal && q.en?.choices?.[i] && <span className="block text-sm text-stone-500">{q.en.choices[i]}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {reveal && (q.explanation || q.en?.sentence) && (
        <div className="rounded-xl bg-stone-100 px-4 py-3 text-base leading-loose text-stone-700 dark:bg-stone-900 dark:text-stone-300">
          {q.explanation && <JP text={q.explanation} />}
          {q.en?.sentence && <EN text={q.en.sentence} className="text-sm leading-relaxed text-stone-500" />}
        </div>
      )}

      {reveal && q.glossary && q.glossary.length > 0 && (
        // Long lists (reading passages) start closed so the next button stays in view.
        <details open={q.glossary.length <= 8} className="text-sm">
          <summary className="cursor-pointer select-none text-xs font-medium uppercase tracking-widest text-stone-400 hover:text-stone-600">
            Words ({q.glossary.length})
          </summary>
          <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            {q.glossary.map((g) => (
              <div key={g.word} className="contents">
                <dt lang="ja" className="font-jp">
                  {g.word}
                  {g.reading && <span className="ml-1.5 text-xs text-stone-400">{g.reading}</span>}
                </dt>
                <dd className="mb-1 text-stone-500 sm:mb-0">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  )
}

/** Choices that are just "1–4", pointing into the picture or the audio. */
function NumberedChoices({ q, selected, reveal, onSelect }: {
  q: Question
  selected: number | null
  reveal: boolean
  onSelect: (i: number) => void
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${q.choices.length}, minmax(0, 1fr))` }}>
      {q.choices.map((choice, i) => {
        const isAnswer = i === q.answer
        const isPicked = i === selected
        return (
          <button
            key={i}
            onClick={() => !reveal && onSelect(i)}
            disabled={reveal}
            aria-label={`Choice ${choice}`}
            className={cn(
              'rounded-xl border py-4 text-xl font-medium tabular-nums transition',
              !reveal && !isPicked && 'border-stone-200 bg-white hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600',
              !reveal && isPicked && 'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900',
              reveal && isAnswer && 'border-emerald-500 bg-emerald-500 text-white',
              reveal && isPicked && !isAnswer && 'border-rose-400 bg-rose-400 text-white',
              reveal && !isAnswer && !isPicked && 'border-stone-200 opacity-50 dark:border-stone-800',
            )}
          >
            {choice}
          </button>
        )
      })}
    </div>
  )
}

function Listening({ q, reveal, autoPlay }: { q: Question; reveal: boolean; autoPlay?: boolean }) {
  const [audioFailed, setAudioFailed] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  // play() rather than the autoplay attribute, so a browser that blocks it
  // just leaves the controls there instead of logging an error.
  useEffect(() => {
    if (autoPlay) audio.current?.play().catch(() => {})
  }, [autoPlay])
  const hasAudio = !!q.audio && !audioFailed
  // Without audio the transcript is the only way to answer, so show it up front.
  const showTranscript = !!q.transcript && (reveal || !hasAudio)
  return (
    <div className="space-y-3">
      {hasAudio ? (
        <audio ref={audio} controls preload="auto" src={asset(q.audio!)} onError={() => setAudioFailed(true)} className="w-full" />
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

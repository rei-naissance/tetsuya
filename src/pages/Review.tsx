import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Layout, ProgressBar } from '../components/Layout'
import { QuestionView } from '../components/QuestionView'
import { shuffleChoices } from '../lib/random'
import { buildQueue, getCard, loadCards, markIntroduced, newCard, previewInterval, saveReview, type Grade } from '../lib/srs'
import type { Level, Question, Section } from '../lib/types'
import { SECTION_META } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { cn } from '../lib/cn'
import { deckId } from './ModeSelect'

const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: 'again', label: 'Again', tone: 'text-rose-600 dark:text-rose-400' },
  { grade: 'hard', label: 'Hard', tone: 'text-amber-600 dark:text-amber-400' },
  { grade: 'good', label: 'Good', tone: 'text-emerald-600 dark:text-emerald-400' },
  { grade: 'easy', label: 'Easy', tone: 'text-sky-600 dark:text-sky-400' },
]

/** Anki-style review session for kanji / vocabulary. */
export function Review({ level, section, pool }: { level: Level; section: Section; pool: Question[] }) {
  const navigate = useNavigate()
  const deck = deckId(level, section)
  const byId = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool])

  const [queue, setQueue] = useState(() => buildQueue(pool.map((q) => q.id), deck))
  const [initialSize] = useState(queue.length)
  const [turn, setTurn] = useState(0) // bumps every card, so a repeated card gets freshly shuffled choices
  const [selected, setSelected] = useState<number | null>(null)
  const [tally, setTally] = useState({ reviewed: 0, correct: 0 })

  const currentId = queue[0]
  const q = useMemo(() => (currentId ? shuffleChoices(byId.get(currentId)!) : null), [currentId, turn, byId])
  const reveal = selected !== null
  const wasCorrect = q !== null && selected === q.answer
  const card = currentId ? getCard(currentId) ?? newCard() : null
  const isNew = currentId ? !getCard(currentId) : false

  const choose = (i: number) => {
    if (reveal || !q) return
    setSelected(i)
    setTally((t) => ({ reviewed: t.reviewed + 1, correct: t.correct + (i === q.answer ? 1 : 0) }))
  }

  const grade = (g: Grade) => {
    if (!currentId || !reveal) return
    if (!getCard(currentId)) markIntroduced(deck)
    saveReview(currentId, g)
    // "Again" cards are re-queued at the end of this session (Anki's relearning step).
    setQueue(([head, ...rest]) => (g === 'again' ? [...rest, head] : rest))
    setSelected(null)
    setTurn((t) => t + 1)
  }

  useKeys((e) => {
    if (!q) return
    const n = Number(e.key)
    if (!reveal) {
      if (n >= 1 && n <= q.choices.length) choose(n - 1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); grade(wasCorrect ? 'good' : 'again') }
    else if (wasCorrect && n >= 1 && n <= 4) grade(GRADES[n - 1].grade)
  })

  const back = { to: `/${level.toLowerCase()}`, label: level }
  const title = <span>{SECTION_META[section].label} <span className="font-jp text-stone-400">{SECTION_META[section].jp}</span></span>

  if (!q || !card) {
    return (
      <Layout back={back} title={title}>
        <div className="py-12 text-center">
          <p className="font-jp text-5xl">{tally.reviewed ? 'お疲れさま' : '完了'}</p>
          <p className="mt-6 text-lg font-medium">{tally.reviewed ? 'Session complete' : 'All caught up'}</p>
          <p className="mt-1 text-stone-500">
            {tally.reviewed
              ? `${tally.reviewed} reviews · ${Math.round((tally.correct / tally.reviewed) * 100)}% first-try accuracy`
              : 'Nothing is due and today’s new cards are done.'}
          </p>
          <p className="mt-1 text-sm text-stone-400">{nextDueText(pool.map((p) => p.id))}</p>
          <div className="mt-10 flex justify-center">
            <Button variant="outline" onClick={() => navigate(back.to)}>Back to {level}</Button>
          </div>
        </div>
      </Layout>
    )
  }

  const done = initialSize - queue.length
  return (
    <Layout back={back} title={title} right={<span className="text-xs tabular-nums text-stone-400">{queue.length} left</span>}>
      <ProgressBar value={Math.max(0, done)} max={initialSize} />
      <div className="mt-8">
        {isNew && <p className="mb-4 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent dark:bg-accent/15">New</p>}
        <QuestionView key={`${q.id}-${turn}`} q={q} selected={selected} reveal={reveal} onSelect={choose} />
      </div>

      <div className="mt-8 min-h-20">
        {!reveal && <p className="text-sm text-stone-400">Press 1–4 to answer</p>}
        {reveal && !wasCorrect && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-rose-500">Not quite — this card will come back shortly.</p>
            <Button onClick={() => grade('again')}>Continue <span aria-hidden>→</span></Button>
          </div>
        )}
        {reveal && wasCorrect && (
          <>
            <p className="mb-3 text-sm text-stone-500">How well did you know it?</p>
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map(({ grade: g, label, tone }, i) => (
                <button
                  key={g}
                  onClick={() => grade(g)}
                  className={cn(
                    'flex flex-col items-center rounded-xl border border-stone-200 bg-white py-3 transition hover:border-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-400',
                    g === 'good' && 'ring-1 ring-stone-300 dark:ring-stone-700',
                  )}
                >
                  <span className={cn('text-sm font-medium', tone)}>{label}</span>
                  <span className="mt-0.5 text-xs tabular-nums text-stone-400">{previewInterval(card, g)}</span>
                  <span className="sr-only">(key {i + 1})</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-stone-400">Keys 1–4 · Enter = Good</p>
          </>
        )}
      </div>
    </Layout>
  )
}

function nextDueText(ids: string[]): string {
  const cards = loadCards()
  const next = Math.min(...ids.map((id) => cards[id]?.due ?? Infinity))
  if (!Number.isFinite(next)) return ''
  const hours = (next - Date.now()) / 3_600_000
  if (hours < 1) return 'Next review in under an hour.'
  if (hours < 24) return `Next review in about ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}.`
  const days = Math.round(hours / 24)
  return `Next review in ${days} day${days === 1 ? '' : 's'}.`
}

import { useMemo, useState, type ReactNode } from 'react'
import { Furi } from '../components/JP'
import { useNavigate } from 'react-router-dom'
import { Actions, Button, buttonClass, Layout, ProgressBar, TextButton } from '../components/Layout'
import { StudyOptions } from '../components/StudyOptions'
import { QuestionView } from '../components/QuestionView'
import { usePrefs } from '../lib/prefs'
import { shuffleChoices } from '../lib/random'
import { deckId, loadCards, previewInterval, type CardState, type Grade } from '../lib/srs'
import type { Level, Question, Section } from '../lib/types'
import { ALL_KINDS, KINDS, SECTION_META } from '../lib/types'
import { useKeys } from '../lib/useKeys'
import { useSrsSession } from '../lib/useSrsSession'
import { cn } from '../lib/cn'

/** Header title for a session: "Grammar · Sentence order 文の組み立て". */
export function kindTitle(section: Section, kind: string, mistakes = false) {
  const meta = KINDS[section].find((k) => k.id === kind)
  return (
    <span>
      {SECTION_META[section].label}
      {kind !== ALL_KINDS && meta && <> · {meta.label}</>}
      {mistakes && ' · mistakes'}
      <Furi text={meta && kind !== ALL_KINDS ? meta.jp : SECTION_META[section].jp} className="ml-1.5 text-stone-400" />
    </span>
  )
}

// Just the two grades most Anki users stick to; the scheduler still knows Hard and Easy.
const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: 'again', label: 'Again', tone: 'text-rose-600 dark:text-rose-400' },
  { grade: 'good', label: 'Good', tone: 'text-emerald-700 dark:text-emerald-400' },
]

/**
 * Anki-style review session for kanji / vocabulary (one deck per question
 * type). With `aheadDays` it reviews cards due soon, early.
 */
export function Review({ level, section, kind, pool, aheadDays }: { level: Level; section: Section; kind: string; pool: Question[]; aheadDays?: number }) {
  const [round, setRound] = useState(0) // bumped by custom study to start a fresh session
  return <ReviewSession key={round} level={level} section={section} kind={kind} pool={pool} aheadDays={aheadDays} onRestart={() => setRound((r) => r + 1)} />
}

function ReviewSession({ level, section, kind, pool, aheadDays, onRestart }: {
  level: Level
  section: Section
  kind: string
  pool: Question[]
  aheadDays?: number
  onRestart: () => void
}) {
  const navigate = useNavigate()
  const { limits } = usePrefs()
  const deck = deckId(level, section, kind)
  const byId = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool])
  const ids = useMemo(() => pool.map((q) => q.id), [pool])
  const s = useSrsSession(ids, deck, limits, { aheadDays })
  const [turn, setTurn] = useState(0) // bumps every card, so a repeated card gets freshly shuffled choices
  const [selected, setSelected] = useState<number | null>(null)
  const [initial] = useState(s.counts.fresh + s.counts.learning + s.counts.review)

  const q = useMemo(() => (s.current ? shuffleChoices(byId.get(s.current)!) : null), [s.current, turn, byId])
  const reveal = selected !== null
  const wasCorrect = q !== null && selected === q.answer

  const choose = (i: number) => {
    if (reveal || !q) return
    setSelected(i)
  }
  const grade = (g: Grade) => {
    if (!reveal) return
    s.grade(g, wasCorrect)
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
    else if (wasCorrect && n >= 1 && n <= GRADES.length) grade(GRADES[n - 1].grade)
  })

  const sectionUrl = `/${level.toLowerCase()}/study/${section}`
  const back = { to: sectionUrl, label: 'Types' }
  const title = <>{kindTitle(section, kind)}{aheadDays ? <span className="text-stone-400"> · ahead</span> : null}</>

  if (!q || !s.card) {
    return (
      <Layout back={back} title={title}>
        <SessionDone tally={s.tally} ids={ids}>
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            <StudyOptions compact ids={ids} deck={deck} onChange={onRestart} onAhead={(d) => navigate(`${sectionUrl}/${kind}?ahead=${d}`)} />
          </div>
          <Actions align="center" className="mt-8">
            <Button variant="secondary" onClick={() => navigate(back.to)}>All types</Button>
          </Actions>
        </SessionDone>
      </Layout>
    )
  }

  const left = s.counts.fresh + s.counts.learning + s.counts.review
  return (
    <Layout back={back} title={title} right={<SessionCounts counts={s.counts} />}>
      <ProgressBar value={Math.max(0, initial - left)} max={Math.max(initial, left)} />
      <div className="mt-8">
        {s.isNew && <p className="mb-4 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent dark:bg-accent/10">New</p>}
        <QuestionView key={`${q.id}-${turn}`} q={q} selected={selected} reveal={reveal} onSelect={choose} showSection={kind === ALL_KINDS} autoPlay />
      </div>

      <div className="mt-8 min-h-20">
        {!reveal && (
          <Actions align="between">
            <p className="text-sm text-stone-400">Press 1–4 to answer</p>
            {s.isNew && <TextButton onClick={() => s.knowIt()}>I already know this</TextButton>}
          </Actions>
        )}
        {reveal && !wasCorrect && (
          <Actions align="between">
            <p className="text-sm text-rose-600">Not quite: back in {previewInterval(s.card, 'again')}.</p>
            <Button onClick={() => grade('again')}>Continue <span aria-hidden>→</span></Button>
          </Actions>
        )}
        {reveal && wasCorrect && <GradeButtons card={s.card} onGrade={grade} />}
      </div>
    </Layout>
  )
}

/** Again / Good, each with the wait it would give. */
export function GradeButtons({ card, onGrade }: { card: CardState; onGrade: (g: Grade) => void }) {
  return (
    <>
      <p className="mb-3 text-sm text-stone-500">Did you know it?</p>
      <div className="grid grid-cols-2 gap-2">
        {GRADES.map(({ grade: g, label, tone }, i) => (
          <button key={g} onClick={() => onGrade(g)} className={buttonClass(g === 'good' ? 'primary' : 'secondary', 'tile')}>
            <span className={cn(g !== 'good' && tone)}>{label}</span>
            <span className="text-xs font-normal tabular-nums opacity-60">{previewInterval(card, g)}</span>
            <span className="sr-only">(key {i + 1})</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">1 = Again · 2 or Space = Good</p>
    </>
  )
}

/** Anki's three counts: new (blue), learning (red), due reviews (green). */
export function SessionCounts({ counts }: { counts: { fresh: number; learning: number; review: number } }) {
  return (
    <span className="flex gap-2 text-xs tabular-nums" aria-label={`${counts.fresh} new, ${counts.learning} learning, ${counts.review} to review`}>
      <span className="text-sky-700 dark:text-sky-400" title="New">{counts.fresh}</span>
      <span className="text-rose-700 dark:text-rose-400" title="Learning">{counts.learning}</span>
      <span className="text-emerald-700 dark:text-emerald-400" title="To review">{counts.review}</span>
    </span>
  )
}

export function SessionDone({ tally, ids, children }: { tally: { reviewed: number; correct: number }; ids: string[]; children?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <Furi as="p" text={tally.reviewed ? 'お疲れさま' : '完了'} className="text-5xl" />
      <p className="mt-6 text-lg font-medium">{tally.reviewed ? 'Session complete' : 'All caught up'}</p>
      <p className="mt-1 text-stone-500">
        {tally.reviewed
          ? `${tally.reviewed} answers · ${Math.round((tally.correct / tally.reviewed) * 100)}% right`
          : 'Nothing is due and today’s new cards are done.'}
      </p>
      <p className="mt-1 text-sm text-stone-400">{nextDueText(ids)}</p>
      {children}
    </div>
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

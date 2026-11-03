import { useLayoutEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Centered, Layout } from './components/Layout'
import { byKind, bySection } from './lib/data'
import { PrefsProvider } from './lib/prefs'
import type { Level, Section } from './lib/types'
import { ALL_KINDS, KINDS, LEVELS, SECTIONS, SRS_SECTIONS } from './lib/types'
import { useQuestions } from './lib/useQuestions'
import { useWords } from './lib/words'
import { useGrammar, useParticles } from './lib/learn'
import { Hero } from './pages/Hero'
import { LevelSelect } from './pages/LevelSelect'
import { MockTest } from './pages/MockTest'
import { ModeSelect } from './pages/ModeSelect'
import { Practice } from './pages/Practice'
import { Review } from './pages/Review'
import { SectionPage } from './pages/SectionPage'
import { GrammarDetail, GrammarList, grammarBase } from './pages/Grammar'
import { ParticleDetail, ParticleList, contrastsFor, particlesBase } from './pages/Particles'
import { WordCards } from './pages/WordCards'
import { WordDetail } from './pages/WordDetail'
import { WordList } from './pages/WordList'

// HashRouter keeps the app deployable to any static host with zero server config.
export default function App() {
  return (
    <PrefsProvider>
      <HashRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/levels" element={<LevelSelect />} />
          <Route path="/:level" element={<WithLevel render={(level) => <ModeSelect level={level} />} />} />
          <Route path="/:level/study/:section" element={<WithLevel render={(level) => <SectionRoute level={level} />} />} />
          <Route path="/:level/study/:section/:kind" element={<WithLevel render={(level) => <Study level={level} />} />} />
          <Route path="/:level/learn/vocab" element={<WithLevel render={(level) => <Words level={level} />} />} />
          <Route path="/:level/learn/vocab/cards" element={<WithLevel render={(level) => <Words level={level} cards />} />} />
          <Route path="/:level/learn/vocab/:id" element={<WithLevel render={(level) => <Words level={level} />} />} />
          <Route path="/:level/learn/grammar" element={<WithLevel render={(level) => <Grammar level={level} />} />} />
          <Route path="/:level/learn/grammar/:id" element={<WithLevel render={(level) => <Grammar level={level} />} />} />
          <Route path="/:level/learn/grammar/:id/drill" element={<WithLevel render={(level) => <Grammar level={level} drill />} />} />
          <Route path="/:level/learn/particles" element={<WithLevel render={(level) => <Particles level={level} />} />} />
          <Route path="/:level/learn/particles/:id" element={<WithLevel render={(level) => <Particles level={level} />} />} />
          <Route path="/:level/learn/particles/:id/drill" element={<WithLevel render={(level) => <Particles level={level} drill />} />} />
          <Route path="/:level/mock" element={<WithLevel render={(level) => <Mock level={level} />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </PrefsProvider>
  )
}

/** New pages start at the top (the browser would keep the previous page's scroll). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/** ?ahead=N: a review-ahead session over cards due in the next N days. */
const aheadParam = (params: URLSearchParams) => Math.max(0, Math.floor(Number(params.get('ahead')))) || undefined

/** Validates the :level URL segment (n4 / n3). */
function WithLevel({ render }: { render: (level: Level) => JSX.Element }) {
  const level = useParams().level?.toUpperCase() as Level
  if (!LEVELS.includes(level)) return <Navigate to="/levels" replace />
  // Keyed so switching levels resets all page state.
  return <div key={level}>{render(level)}</div>
}

/** Question-type picker for one section. */
function SectionRoute({ level }: { level: Level }) {
  const section = useParams().section as Section
  const data = useQuestions(level)
  if (!SECTIONS.includes(section)) return <Navigate to={`/${level.toLowerCase()}`} replace />
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />
  if (!bySection(data.questions, section).length) return <Navigate to={`/${level.toLowerCase()}`} replace />
  return <SectionPage level={level} section={section} questions={data.questions} />
}

/**
 * A study session for one question type (or "all"). ?mode=mistakes replays
 * wrong answers; ?ahead=N reviews SRS cards due in the next N days.
 */
function Study({ level }: { level: Level }) {
  const { section, kind = ALL_KINDS } = useParams() as { section: Section; kind?: string }
  const [params] = useSearchParams()
  const data = useQuestions(level)
  const sectionUrl = `/${level.toLowerCase()}/study/${section}`
  if (!SECTIONS.includes(section)) return <Navigate to={`/${level.toLowerCase()}`} replace />
  if (kind !== ALL_KINDS && !KINDS[section].some((k) => k.id === kind)) return <Navigate to={sectionUrl} replace />
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />

  const pool = byKind(data.questions, section, kind)
  if (!pool.length) return <Navigate to={sectionUrl} replace />
  // Keyed so switching type or mode starts a fresh session.
  return SRS_SECTIONS.includes(section)
    ? <Review key={`${kind}-${params.get('ahead')}`} level={level} section={section} kind={kind} pool={pool} aheadDays={aheadParam(params)} />
    : <Practice key={`${kind}-${params.get('mode')}`} level={level} section={section} kind={kind} pool={pool} mode={params.get('mode') === 'mistakes' ? 'mistakes' : 'next'} />
}

/** Vocabulary list, one word (:id) or flashcards. */
function Words({ level, cards }: { level: Level; cards?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const data = useWords(level)
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />
  if (cards) return <WordCards key={params.get('ahead')} level={level} words={data.words} aheadDays={aheadParam(params)} />
  if (!id) return <WordList level={level} words={data.words} />
  const word = data.words.find((w) => w.id === id)
  if (!word) return <Navigate to={`/${level.toLowerCase()}/learn/vocab`} replace />
  return <WordDetail key={id} level={level} words={data.words} word={word} />
}

/** Grammar patterns, one pattern (:id), or a drill (:id = a pattern or "all"). */
function Grammar({ level, drill }: { level: Level; drill?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const data = useGrammar(level)
  const base = grammarBase(level)
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />
  const { patterns } = data.data
  if (!id) return <GrammarList level={level} patterns={patterns} />
  const pattern = patterns.find((p) => p.id === id)
  if (!drill) return pattern ? <GrammarDetail key={id} level={level} patterns={patterns} pattern={pattern} /> : <Navigate to={base} replace />
  const pool = id === 'all' ? patterns.flatMap((p) => p.drills) : pattern?.drills
  if (!pool?.length) return <Navigate to={base} replace />
  const mode = params.get('mode') === 'mistakes' ? 'mistakes' : 'next'
  return (
    <Practice
      key={`${id}-${mode}`}
      level={level}
      section="grammar"
      kind="pattern"
      pool={pool}
      mode={mode}
      back={{ to: pattern ? `${base}/${id}` : base, label: pattern ? 'Pattern' : 'Patterns' }}
      title={<span className="font-jp">{pattern ? pattern.pattern : 'All grammar patterns'}</span>}
    />
  )
}

/** Particle contrasts, one contrast (:id), or a drill (:id = a contrast, "all" or "bank"). */
function Particles({ level, drill }: { level: Level; drill?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const data = useParticles()
  const bank = useQuestions(level)
  const base = particlesBase(level)
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />
  if (bank.status === 'loading') return <Loading level={level} />
  const bankIds = new Set(data.data.bank[level] ?? [])
  const bankPool = bank.status === 'ready' ? bank.questions.filter((q) => bankIds.has(q.id)) : []
  if (!id) return <ParticleList level={level} data={data.data} bankCount={bankPool.length} />

  const contrasts = contrastsFor(level, data.data.contrasts)
  const contrast = contrasts.find((c) => c.id === id)
  if (!drill) return contrast ? <ParticleDetail level={level} contrast={contrast} /> : <Navigate to={base} replace />
  const pool = id === 'all' ? contrasts.flatMap((c) => c.drills) : id === 'bank' ? bankPool : contrast?.drills
  if (!pool?.length) return <Navigate to={base} replace />
  const mode = params.get('mode') === 'mistakes' ? 'mistakes' : 'next'
  const title = id === 'all' ? 'All particle drills' : id === 'bank' ? 'Particle questions' : contrast!.title
  return (
    <Practice
      key={`${id}-${mode}`}
      level={level}
      section="grammar"
      kind="particle"
      pool={pool}
      mode={mode}
      back={{ to: contrast ? `${base}/${id}` : base, label: contrast ? 'Explanation' : 'Particles' }}
      title={<span className="font-jp">{title}</span>}
    />
  )
}

function Mock({ level }: { level: Level }) {
  const data = useQuestions(level)
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />
  return <MockTest level={level} questions={data.questions} />
}

function Loading({ level, error }: { level: Level; error?: string }) {
  return (
    <Layout back={{ to: `/${level.toLowerCase()}`, label: level }}>
      <Centered>{error ?? 'Loading questions…'}</Centered>
    </Layout>
  )
}

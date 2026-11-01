import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Centered, Layout } from './components/Layout'
import { bySection } from './lib/data'
import { PrefsProvider } from './lib/prefs'
import type { Level, Section } from './lib/types'
import { LEVELS, SECTIONS, SRS_SECTIONS } from './lib/types'
import { useQuestions } from './lib/useQuestions'
import { Hero } from './pages/Hero'
import { LevelSelect } from './pages/LevelSelect'
import { MockTest } from './pages/MockTest'
import { ModeSelect } from './pages/ModeSelect'
import { Practice } from './pages/Practice'
import { Review } from './pages/Review'

// HashRouter keeps the app deployable to any static host with zero server config.
export default function App() {
  return (
    <PrefsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/levels" element={<LevelSelect />} />
          <Route path="/:level" element={<WithLevel render={(level) => <ModeSelect level={level} />} />} />
          <Route path="/:level/study/:section" element={<WithLevel render={(level) => <Study level={level} />} />} />
          <Route path="/:level/mock" element={<WithLevel render={(level) => <Mock level={level} />} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </PrefsProvider>
  )
}

/** Validates the :level URL segment (n4 / n3). */
function WithLevel({ render }: { render: (level: Level) => JSX.Element }) {
  const level = useParams().level?.toUpperCase() as Level
  if (!LEVELS.includes(level)) return <Navigate to="/levels" replace />
  // Keyed so switching levels resets all page state.
  return <div key={level}>{render(level)}</div>
}

function Study({ level }: { level: Level }) {
  const section = useParams().section as Section
  const data = useQuestions(level)
  if (!SECTIONS.includes(section)) return <Navigate to={`/${level.toLowerCase()}`} replace />
  if (data.status !== 'ready') return <Loading level={level} error={data.status === 'error' ? data.error : undefined} />

  const pool = bySection(data.questions, section)
  if (!pool.length) return <Navigate to={`/${level.toLowerCase()}`} replace />
  return SRS_SECTIONS.includes(section)
    ? <Review level={level} section={section} pool={pool} />
    : <Practice level={level} section={section} pool={pool} />
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

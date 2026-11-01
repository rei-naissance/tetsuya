import { useEffect, useState } from 'react'
import { loadQuestions } from './data'
import type { Level, Question } from './types'

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; questions: Question[] }

export function useQuestions(level: Level): State {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    loadQuestions(level).then(
      (questions) => alive && setState({ status: 'ready', questions }),
      (err: Error) => alive && setState({ status: 'error', error: err.message }),
    )
    return () => { alive = false }
  }, [level])
  return state
}

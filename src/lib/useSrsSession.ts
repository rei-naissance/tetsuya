import { useState } from 'react'
import {
  LEARN_AHEAD, buildQueue, getCard, isLearning, learningCards, loadCards, markIntroduced, markKnown, markReviewed,
  newCard, saveCard, saveReview, type CardState, type Grade, type Limits, type QueueOptions,
} from './srs'

/**
 * One study session over a deck, Anki-style: cards in learning steps come
 * back when their step is due (or early, when nothing else is left), between
 * the day's reviews and new cards. The session ends when every card in it
 * has graduated for today. With `aheadDays` it's a review-ahead session:
 * only the graduated cards due soon, nothing else.
 */
export function useSrsSession(ids: string[], deck: string, limits: Limits, opts: QueueOptions = {}) {
  const [queue, setQueue] = useState(() => buildQueue(ids, deck, limits, opts))
  const [learning, setLearning] = useState(() => (opts.aheadDays ? [] : learningCards(ids)))
  const [current, setCurrent] = useState(() => pickNext(queue, learning))
  const [tally, setTally] = useState({ reviewed: 0, correct: 0 })

  const card: CardState | undefined = current ? getCard(current) ?? newCard() : undefined
  const isNew = current ? !getCard(current) : false
  const cards = loadCards()
  const counts = {
    fresh: queue.filter((id) => !cards[id]).length,
    learning: learning.length,
    review: queue.filter((id) => cards[id]).length,
  }

  const advance = (id: string, next: CardState) => {
    const q = queue.filter((x) => x !== id)
    const l = learning.filter((x) => x !== id)
    if (isLearning(next)) {
      const all = loadCards()
      l.push(id)
      l.sort((a, b) => all[a].due - all[b].due)
    }
    setQueue(q)
    setLearning(l)
    setCurrent(pickNext(q, l))
  }

  /** Grades the current card; `correct` feeds the session's accuracy. */
  const grade = (g: Grade, correct = g !== 'again') => {
    if (!current) return
    const before = getCard(current)
    if (!before) markIntroduced(deck)
    else if (!isLearning(before)) markReviewed(deck)
    setTally((t) => ({ reviewed: t.reviewed + 1, correct: t.correct + (correct ? 1 : 0) }))
    advance(current, saveReview(current, g))
  }

  /** A new card the learner already knows: skip learning, come back in a month. */
  const knowIt = () => {
    if (!current || !isNew) return
    markIntroduced(deck)
    setTally((t) => ({ reviewed: t.reviewed + 1, correct: t.correct + 1 }))
    advance(current, saveCard(current, markKnown()))
  }

  return { current, card, isNew, counts, grade, knowIt, tally, done: !current }
}

/**
 * A learning card that's due, else the queue, else a learning card due soon.
 * When several learning cards are due at once, any of them: missed cards
 * otherwise come back in exactly the order they were missed.
 */
function pickNext(queue: string[], learning: string[], now = Date.now()): string | undefined {
  const cards = loadCards()
  const dueLearning = learning.filter((id) => cards[id].due <= now)
  if (dueLearning.length) return dueLearning[Math.floor(Math.random() * dueLearning.length)]
  if (queue.length) return queue[0]
  const soon = learning[0]
  // Steps are at most 10 minutes, so this always picks one up: the session
  // doesn't end while a card is still being learned.
  return soon && cards[soon].due - now <= LEARN_AHEAD ? soon : undefined
}

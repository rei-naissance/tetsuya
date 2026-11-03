import { describe, expect, it } from 'vitest'
import { MIN_EASE, isLearning, newCard, schedule, type CardState } from './srs'

const DAY = 86_400_000
const MIN = 60_000
const t0 = Date.UTC(2026, 0, 1)

const graduated = (interval: number, ease = 2.5): CardState =>
  ({ ease, interval, reps: 3, lapses: 0, due: t0, last: t0 - interval * DAY })

describe('schedule (SM-2 with learning steps)', () => {
  it('takes a new card through 1 min and 10 min steps, then 1 day', () => {
    let c = schedule(newCard(t0), 'good', t0)
    expect(isLearning(c)).toBe(true)
    expect(c.due - t0).toBe(10 * MIN)
    c = schedule(c, 'good', t0)
    expect(isLearning(c)).toBe(false)
    expect(c.interval).toBe(1)
    c = schedule(c, 'good', t0)
    expect(c.interval).toBe(Math.max(2, Math.round(1 * 2.5)))
    expect(c.due).toBe(t0 + c.interval * DAY)
  })

  it('"again" in learning goes back to the first step', () => {
    const c = schedule(schedule(newCard(t0), 'good', t0), 'again', t0)
    expect(c.step).toBe(0)
    expect(c.due - t0).toBe(1 * MIN)
  })

  it('"easy" on a new card graduates straight to 4 days', () => {
    const c = schedule(newCard(t0), 'easy', t0)
    expect(isLearning(c)).toBe(false)
    expect(c.interval).toBe(4)
  })

  it('a lapse counts, lowers ease and relearns for 10 minutes', () => {
    const c = schedule(graduated(20), 'again', t0)
    expect(c).toMatchObject({ lapses: 1, ease: 2.3, relearn: true, step: 0 })
    expect(c.due - t0).toBe(10 * MIN)
    const back = schedule(c, 'good', t0)
    expect(isLearning(back)).toBe(false)
    expect(back.interval).toBe(4) // 20 days × 0.2
  })

  it('never lets ease fall below the floor', () => {
    let c = graduated(10)
    for (let i = 0; i < 20; i++) c = schedule(schedule(c, 'again', t0), 'good', t0)
    expect(c.ease).toBe(MIN_EASE)
  })

  it('"good" wins ease back after a lapse, but not past the start', () => {
    expect(schedule(graduated(5, 2.3), 'good', t0).ease).toBe(2.35)
    expect(schedule(graduated(5, 2.48), 'good', t0).ease).toBe(2.5)
    expect(schedule(graduated(5, 2.8), 'good', t0).ease).toBe(2.8)
  })

  it('"easy" outpaces "good", which outpaces "hard"', () => {
    const [h, g, e] = (['hard', 'good', 'easy'] as const).map((gr) => schedule(graduated(3), gr, t0).interval)
    expect(h).toBeLessThan(g)
    expect(g).toBeLessThan(e)
  })

  it('"hard" always moves the interval forward', () => {
    expect(schedule(graduated(2, MIN_EASE), 'hard', t0).interval).toBeGreaterThan(2)
  })

  it('treats cards saved before learning steps as graduated', () => {
    const old = { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: t0, last: t0 - MIN }
    expect(schedule(old, 'good', t0).interval).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { MIN_EASE, newCard, schedule } from './srs'

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)

describe('schedule (simplified SM-2)', () => {
  it('graduates a new card through 1d → 3d → interval × ease', () => {
    let c = schedule(newCard(t0), 'good', t0)
    expect(c.interval).toBe(1)
    c = schedule(c, 'good', t0)
    expect(c.interval).toBe(3)
    c = schedule(c, 'good', t0)
    expect(c.interval).toBe(Math.round(3 * 2.5))
    expect(c.due).toBe(t0 + c.interval * DAY)
  })

  it('"again" resets reps, counts a lapse and lowers ease', () => {
    let c = schedule(schedule(newCard(t0), 'good', t0), 'good', t0)
    c = schedule(c, 'again', t0)
    expect(c).toMatchObject({ reps: 0, interval: 0, lapses: 1, ease: 2.3 })
    expect(c.due - t0).toBe(10 * 60 * 1000)
  })

  it('never lets ease fall below the floor', () => {
    let c = newCard(t0)
    for (let i = 0; i < 20; i++) c = schedule(c, 'again', t0)
    expect(c.ease).toBe(MIN_EASE)
  })

  it('"easy" outpaces "good", which outpaces "hard"', () => {
    const base = schedule(schedule(newCard(t0), 'good', t0), 'good', t0)
    const [h, g, e] = (['hard', 'good', 'easy'] as const).map((gr) => schedule(base, gr, t0).interval)
    expect(h).toBeLessThan(g)
    expect(g).toBeLessThan(e)
  })

  it('"hard" always moves the interval forward', () => {
    const c = { ...newCard(t0), reps: 5, interval: 2, ease: MIN_EASE }
    expect(schedule(c, 'hard', t0).interval).toBeGreaterThan(2)
  })
})

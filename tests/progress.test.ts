import { describe, it, expect } from 'vitest'
import { ExerciseType, Rng } from '../src/core/exercises'
import {
  sessionReset,
  sessionRecord,
  sessionDone,
  sessionPercent,
  sessionAdaptLevel,
  ADAPT_UP_STREAK,
  ADAPT_DOWN_STREAK,
  SESSION_LENGTH,
  scoresReset,
  scoresRecord,
  scoresPick,
  SCORE_MAX,
} from '../src/core/progress'

describe('session', () => {
  it('tracks asked/correct/streak/bestStreak/missStreak', () => {
    const s = sessionReset()
    sessionRecord(s, true)
    sessionRecord(s, true)
    sessionRecord(s, false)
    sessionRecord(s, true)
    expect(s.asked).toBe(4)
    expect(s.correct).toBe(3)
    expect(s.streak).toBe(1) // reset by the miss, then one more hit
    expect(s.bestStreak).toBe(2)
    expect(s.missStreak).toBe(0)
  })

  it('is done once SESSION_LENGTH questions were asked', () => {
    const s = sessionReset()
    for (let i = 0; i < SESSION_LENGTH - 1; i++) sessionRecord(s, true)
    expect(sessionDone(s)).toBe(false)
    sessionRecord(s, true)
    expect(sessionDone(s)).toBe(true)
  })

  it('computes a rounded percentage', () => {
    const s = sessionReset()
    sessionRecord(s, true)
    sessionRecord(s, true)
    sessionRecord(s, false)
    expect(sessionPercent(s)).toBe(67) // 2/3 rounded
  })

  it('percent is 0 before anything is asked', () => {
    expect(sessionPercent(sessionReset())).toBe(0)
  })
})

describe('adaptive difficulty', () => {
  it('climbs one level every ADAPT_UP_STREAK further hits, clamped to maxLevel', () => {
    const s = sessionReset()
    let level = 0
    for (let i = 0; i < ADAPT_UP_STREAK; i++) {
      sessionRecord(s, true)
      level = sessionAdaptLevel(s, level, 2)
    }
    expect(level).toBe(1)
  })

  it('drops one level every ADAPT_DOWN_STREAK further misses, clamped to 0', () => {
    const s = sessionReset()
    let level = 1
    for (let i = 0; i < ADAPT_DOWN_STREAK; i++) {
      sessionRecord(s, false)
      level = sessionAdaptLevel(s, level, 2)
    }
    expect(level).toBe(0)
  })

  it('never exceeds maxLevel or drops below 0', () => {
    const s = sessionReset()
    let level = 2
    for (let i = 0; i < ADAPT_UP_STREAK * 3; i++) {
      sessionRecord(s, true)
      level = sessionAdaptLevel(s, level, 2)
    }
    expect(level).toBe(2)
  })
})

describe('spaced repetition scores', () => {
  it('starts every (type, index) at SCORE_MAX / 2', () => {
    const scores = scoresReset()
    expect(scores[ExerciseType.Scale][0]).toBe(SCORE_MAX / 2)
  })

  it('a hit raises the score by 1, capped at SCORE_MAX', () => {
    const scores = scoresReset()
    for (let i = 0; i < 20; i++) scoresRecord(scores, ExerciseType.Degree, 0, true)
    expect(scores[ExerciseType.Degree][0]).toBe(SCORE_MAX)
  })

  it('a miss drops the score by 2, floored at 0', () => {
    const scores = scoresReset()
    for (let i = 0; i < 20; i++) scoresRecord(scores, ExerciseType.Degree, 0, false)
    expect(scores[ExerciseType.Degree][0]).toBe(0)
  })

  it('picks the lowest-scoring index most of the time', () => {
    const scores = scoresReset()
    scoresRecord(scores, ExerciseType.Scale, 3, false) // drags index 3 down
    const rng = new Rng(99)
    const picks = Array.from({ length: 500 }, () => scoresPick(scores, ExerciseType.Scale, 7, rng))
    const hitRate = picks.filter((i) => i === 3).length / picks.length
    // ~60% weighted pick of the single lowest index + a 1/7 share of the 40%
    // uniform draw: comfortably more than an even 1/7 share alone.
    expect(hitRate).toBeGreaterThan(1 / 7 + 0.1)
  })
})

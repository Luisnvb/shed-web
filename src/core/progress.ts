/* SPDX-License-Identifier: GPL-3.0-only */
/**
 * Session statistics, adaptive difficulty and spaced repetition, ported 1:1
 * from fm1_open's app/shed/progress.c (originally GPL-3.0-only WITH
 * GPL-3.0-linking-exception -- see LICENSE.md). RAM/memory only -- nothing here persists on
 * its own; a caller decides whether/how to save it (e.g. localStorage).
 */

import { ExerciseType, Rng } from './exercises'

export const SESSION_LENGTH = 20

export interface Session {
  asked: number
  correct: number
  streak: number
  bestStreak: number
  missStreak: number
}

export function sessionReset(): Session {
  return { asked: 0, correct: 0, streak: 0, bestStreak: 0, missStreak: 0 }
}

export function sessionRecord(s: Session, correct: boolean): void {
  s.asked++
  if (correct) {
    s.correct++
    s.streak++
    s.missStreak = 0
    if (s.streak > s.bestStreak) s.bestStreak = s.streak
  } else {
    s.streak = 0
    s.missStreak++
  }
}

export function sessionDone(s: Session): boolean {
  return s.asked >= SESSION_LENGTH
}

export function sessionPercent(s: Session): number {
  if (!s.asked) return 0
  return Math.floor((s.correct * 100 + s.asked / 2) / s.asked)
}

/** Adaptive difficulty: given the session's current streak/missStreak (as
 * they stand right after sessionRecord()), suggests the next difficulty
 * level. Climbs by one every ADAPT_UP_STREAK further correct answers in a
 * row (clamped to maxLevel), drops by one every ADAPT_DOWN_STREAK further
 * misses in a row (clamped to 0); otherwise returns `level` unchanged. */
export const ADAPT_UP_STREAK = 5
export const ADAPT_DOWN_STREAK = 3

export function sessionAdaptLevel(s: Session, level: number, maxLevel: number): number {
  if (s.streak && s.streak % ADAPT_UP_STREAK === 0 && level < maxLevel) return level + 1
  if (s.missStreak && s.missStreak % ADAPT_DOWN_STREAK === 0 && level > 0) return level - 1
  return level
}

/** Spaced repetition: one score per (exercise type, pool index), for the
 * four exercises with a bounded, named pool of answers (degree, chord
 * quality, tension, scale -- see exercises.ts). Scores reset with the
 * session; deliberately not persisted by default (RAM-only, like the
 * original device MVP). */
export const SCORE_POOL_MAX = 16 // the largest pool is #7's 16 scales
export const SCORE_MAX = 8

export type Scores = number[][] // [ExerciseType][poolIndex]

export function scoresReset(): Scores {
  const scores: Scores = []
  for (let type = 0; type < ExerciseType.Count; type++) {
    scores.push(new Array(SCORE_POOL_MAX).fill(SCORE_MAX / 2))
  }
  return scores
}

/** correct raises the (type, poolIndex) score by one (capped); a miss drops
 * it by two (floored at zero), so misses resurface faster than streaks of
 * hits bury them. */
export function scoresRecord(scores: Scores, type: ExerciseType, poolIndex: number, correct: boolean): void {
  if (type >= ExerciseType.Count || poolIndex >= SCORE_POOL_MAX) return
  const v = scores[type][poolIndex]
  scores[type][poolIndex] = correct ? Math.min(v + 1, SCORE_MAX) : Math.max(v - 2, 0)
}

/** Picks a pool index in [0, poolSize): most of the time (60%) the lowest
 * (most overdue) score, picked at random among ties; the rest of the time a
 * plain uniform draw, so the session doesn't narrow to a single weak item
 * and everything still gets reviewed. */
export function scoresPick(scores: Scores, type: ExerciseType, poolSize: number, rng: Rng): number {
  if (!poolSize || type >= ExerciseType.Count) return 0
  if (poolSize > SCORE_POOL_MAX) poolSize = SCORE_POOL_MAX
  if (rng.below(100) >= 60) return rng.below(poolSize) // 40% of the time: plain uniform, for variety

  let minValue = SCORE_MAX + 1
  for (let i = 0; i < poolSize; i++) {
    if (scores[type][i] < minValue) minValue = scores[type][i]
  }
  const candidates: number[] = []
  for (let i = 0; i < poolSize; i++) {
    if (scores[type][i] === minValue) candidates.push(i)
  }
  return candidates[rng.below(candidates.length)]
}

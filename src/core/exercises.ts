/* SPDX-License-Identifier: GPL-3.0-only */
/**
 * Question generator and answer evaluator, ported 1:1 from fm1_open's
 * app/shed/exercises.c (originally GPL-3.0-only WITH
 * GPL-3.0-linking-exception -- see LICENSE.md).
 *
 * All nine exercises are implemented. Four have a bounded, meaningful
 * "pool" of distinct answers (degree, chord quality, tension, scale/mode)
 * and so can drive spaced repetition (progress.ts) by picking *which* pool
 * index to ask next; the other five (intervals, arpeggio, bass movement,
 * melodic dictation) generate from a wide/continuous space and always draw
 * uniformly from the RNG.
 */

import { ChordType, Context, ScaleType, pitchClass, chord } from './theory'

// ---------------------------------------------------------------------------
// RNG: deterministic xorshift32, so question generation is reproducible in
// tests. Not for anything security-sensitive.

export class Rng {
  private state: number

  constructor(seed: number) {
    // xorshift32 can't recover from a zero state.
    this.state = (seed >>> 0) || 1
  }

  next(): number {
    let x = this.state
    x ^= (x << 13) & 0xffffffff
    x ^= x >>> 17
    x ^= (x << 5) & 0xffffffff
    this.state = x >>> 0
    return this.state
  }

  /** Uniform-ish value in [0, bound). bound must be > 0. */
  below(bound: number): number {
    return bound > 0 ? this.next() % bound : 0
  }
}

export enum KeyMode {
  Fixed = 0,
  Fourths,
  Random,
}

/** Returns the next tonic (pitch class 0..11) given the previous one. */
export function nextKey(previousKey: number, mode: KeyMode, rng: Rng): number {
  switch (mode) {
    case KeyMode.Fourths:
      return pitchClass(previousKey + 5)
    case KeyMode.Random:
      return rng.below(12)
    case KeyMode.Fixed:
    default:
      return pitchClass(previousKey)
  }
}

export enum ExerciseType {
  Degree = 0, // #1 functional degree
  ChordQuality, // #4 chord quality
  IntervalMelodic, // #2 melodic interval
  IntervalHarmonic, // #3 harmonic interval
  Tension, // #5 tension over a dominant
  Arpeggio, // #6 arpeggio
  Scale, // #7 scale/mode
  BassMovement, // #8 bass movement
  MelodicDictation, // #9 melodic dictation
  Count,
}

/** Tensions offered over a dominant 7th (#5), as semitones above the root
 * (left un-reduced like theory.ts's chord intervals: 13 = b9, 20 = b13...). */
export enum Tension {
  Nine = 0,
  FlatNine,
  SharpNine,
  SharpEleven,
  Thirteen,
  FlatThirteen,
  Count,
}

const TENSION_SEMITONES: Record<Tension, number> = {
  [Tension.Nine]: 14,
  [Tension.FlatNine]: 13,
  [Tension.SharpNine]: 15,
  [Tension.SharpEleven]: 18,
  [Tension.Thirteen]: 21,
  [Tension.FlatThirteen]: 20,
  [Tension.Count]: 0,
}

export function tensionSemitones(t: Tension): number {
  return t in TENSION_SEMITONES && t !== Tension.Count ? TENSION_SEMITONES[t] : 0
}

/** The reference note #2/#3 build their interval from: middle C's octave,
 * on the key's tonic (60 + pitch class). */
export function intervalReferenceNote(key: number): number {
  return 60 + pitchClass(key)
}

export const SEQUENCE_MAX = 8 // #9's phrase can be up to 8 notes

export interface Question {
  type: ExerciseType
  key: number // tonic pitch class 0..11
  degree: number // EX_DEGREE: semitones above the tonic, 0..11 (-1 unused)
  chord: ChordType // EX_CHORD_QUALITY, EX_ARPEGGIO, EX_TENSION (always Dom7)
  chordRoot: number // pitch class root (-1 unused)
  interval: number // EX_INTERVAL_*: signed semitones from the reference note
  tension: Tension
  scale: ScaleType
  sequence: number[] // pitch classes in order
  sequenceChord: number[] // EX_BASS_MOVEMENT: chord quality voiced over sequence[i]
}

// ---------------------------------------------------------------------------
// Difficulty pools

const DIATONIC_DEGREES = [0, 2, 4, 5, 7, 9, 11]

// #1 functional degree: diatonic degrees first, then the five chromatic ones.
const DEGREE_ORDER = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]
const DEGREE_LEVEL_POOL = [7, 12]

// Chord qualities ordered simplest -> richest for #4's difficulty bands.
const CHORD_DIFFICULTY_ORDER: ChordType[] = [
  ChordType.Maj7,
  ChordType.Min7,
  ChordType.Dom7,
  ChordType.Min7Flat5,
  ChordType.Dim7,
  ChordType.Min6,
  ChordType.MinMaj7,
  ChordType.Dom7Sus4,
  ChordType.SixNine,
  ChordType.Maj7Sharp11,
  ChordType.Dom7Flat9,
  ChordType.Dom7Sharp11,
  ChordType.Dom7Alt,
]
const CHORD_LEVEL_POOL = [6, 9, ChordType.Count]

// #5 tension over a dominant: natural 9/13 first, altered ones last.
const TENSION_DIFFICULTY_ORDER: Tension[] = [
  Tension.Nine,
  Tension.Thirteen,
  Tension.FlatNine,
  Tension.FlatThirteen,
  Tension.SharpNine,
  Tension.SharpEleven,
]
const TENSION_LEVEL_POOL = [2, 4, Tension.Count]

// #7 scale/mode: modes of the major scale, then of melodic minor, then the
// symmetric/specialty scales.
const SCALE_DIFFICULTY_ORDER: ScaleType[] = [
  ScaleType.Ionian,
  ScaleType.Dorian,
  ScaleType.Phrygian,
  ScaleType.Lydian,
  ScaleType.Mixolydian,
  ScaleType.Aeolian,
  ScaleType.Locrian,
  ScaleType.MelodicMinor,
  ScaleType.LydianDominant,
  ScaleType.LocrianNat2,
  ScaleType.Altered,
  ScaleType.PhrygianDominant,
  ScaleType.DimWholeHalf,
  ScaleType.DimHalfWhole,
  ScaleType.WholeTone,
  ScaleType.BebopDominant,
]
const SCALE_LEVEL_POOL = [7, 12, ScaleType.Count]

// #8 bass movement: short named progressions, root offsets in semitones from
// the key. "ii-V-I -> turnarounds -> blues, rhythm changes".
interface ProgressionStep {
  chord: ChordType
  offset: number
}
interface Progression {
  steps: ProgressionStep[]
}

const PROG_II_V_I: ProgressionStep[] = [
  { chord: ChordType.Min7, offset: 2 },
  { chord: ChordType.Dom7, offset: 7 },
  { chord: ChordType.Maj7, offset: 0 },
]
const PROG_TURNAROUND_VI: ProgressionStep[] = [
  { chord: ChordType.Maj7, offset: 0 },
  { chord: ChordType.Min7, offset: 9 },
  { chord: ChordType.Min7, offset: 2 },
  { chord: ChordType.Dom7, offset: 7 },
]
const PROG_TURNAROUND_III: ProgressionStep[] = [
  { chord: ChordType.Min7, offset: 4 },
  { chord: ChordType.Dom7, offset: 9 },
  { chord: ChordType.Min7, offset: 2 },
  { chord: ChordType.Dom7, offset: 7 },
]
const PROG_BLUES_TURN: ProgressionStep[] = [
  { chord: ChordType.Dom7, offset: 0 },
  { chord: ChordType.Dom7, offset: 5 },
  { chord: ChordType.Dom7, offset: 0 },
  { chord: ChordType.Dom7, offset: 7 },
]
const PROG_RHYTHM_CHANGES: ProgressionStep[] = [
  { chord: ChordType.Maj7, offset: 0 },
  { chord: ChordType.Dom7, offset: 9 },
  { chord: ChordType.Min7, offset: 2 },
  { chord: ChordType.Dom7, offset: 7 },
]
const PROGRESSION_LEVEL_POOL: Progression[][] = [
  [{ steps: PROG_II_V_I }],
  [{ steps: PROG_TURNAROUND_VI }, { steps: PROG_TURNAROUND_III }],
  [{ steps: PROG_BLUES_TURN }, { steps: PROG_RHYTHM_CHANGES }],
]

function poolSize(bands: number[], level: number): number {
  if (level >= bands.length) level = bands.length - 1
  return bands[level]
}
function poolClamp(size: number, index: number): number {
  if (index >= size) index = size ? size - 1 : 0
  return index
}

export function degreePoolSize(level: number): number {
  return poolSize(DEGREE_LEVEL_POOL, level)
}
export function degreePoolAt(level: number, index: number): number {
  return DEGREE_ORDER[poolClamp(degreePoolSize(level), index)]
}

export function chordPoolSize(level: number): number {
  return poolSize(CHORD_LEVEL_POOL, level)
}
export function chordPoolAt(level: number, index: number): ChordType {
  return CHORD_DIFFICULTY_ORDER[poolClamp(chordPoolSize(level), index)]
}

export function tensionPoolSize(level: number): number {
  return poolSize(TENSION_LEVEL_POOL, level)
}
export function tensionPoolAt(level: number, index: number): Tension {
  return TENSION_DIFFICULTY_ORDER[poolClamp(tensionPoolSize(level), index)]
}

export function scalePoolSize(level: number): number {
  return poolSize(SCALE_LEVEL_POOL, level)
}
export function scalePoolAt(level: number, index: number): ScaleType {
  return SCALE_DIFFICULTY_ORDER[poolClamp(scalePoolSize(level), index)]
}

// ---------------------------------------------------------------------------
// Question generation

function clearQuestion(type: ExerciseType, key: number): Question {
  return {
    type,
    key,
    degree: -1,
    chord: ChordType.Count,
    chordRoot: -1,
    interval: 0,
    tension: Tension.Count,
    scale: ScaleType.Count,
    sequence: [],
    sequenceChord: [],
  }
}

function generateInterval(level: number, harmonic: boolean, rng: Rng): number {
  const span = level >= 2 ? 24 : 12
  const magnitude = 1 + rng.below(span)
  let sign = 1
  if (!harmonic && level >= 1 && rng.below(2)) sign = -1
  return sign * magnitude
}

function generateArpeggio(q: Question, level: number, rng: Rng): void {
  q.chord = chordPoolAt(level, rng.below(chordPoolSize(level)))
  q.chordRoot = q.key
  const c = chord(q.chord)
  if (!c) return
  const start = level === 0 ? 0 : rng.below(c.intervals.length)
  const count = c.intervals.length
  q.sequence = []
  for (let i = 0; i < count; i++) {
    q.sequence.push(pitchClass(q.chordRoot + c.intervals[(start + i) % count]))
  }
}

function generateBassMovement(q: Question, level: number, rng: Rng): void {
  const band = level >= 2 ? 2 : level
  const options = PROGRESSION_LEVEL_POOL[band]
  const p = options[rng.below(options.length)]
  q.sequence = p.steps.map((s) => pitchClass(q.key + s.offset))
  q.sequenceChord = p.steps.map((s) => s.chord)
}

function generatePhrase(q: Question, level: number, rng: Rng): void {
  const minLen = [3, 4, 5]
  const maxLen = [4, 6, 8]
  const chromaticPct = [0, 20, 45]
  const band = level >= 2 ? 2 : level
  let len = minLen[band] + rng.below(maxLen[band] - minLen[band] + 1)
  if (len > SEQUENCE_MAX) len = SEQUENCE_MAX
  q.sequence = []
  for (let i = 0; i < len; i++) {
    const degree =
      chromaticPct[band] && rng.below(100) < chromaticPct[band]
        ? rng.below(12)
        : DIATONIC_DEGREES[rng.below(7)]
    q.sequence.push(pitchClass(q.key + degree))
  }
}

function generate(
  type: ExerciseType,
  key: number,
  level: number,
  poolIndex: number,
  rng: Rng,
  indexed: boolean,
): Question | null {
  key = pitchClass(key)
  const q = clearQuestion(type, key)
  switch (type) {
    case ExerciseType.Degree: {
      const count = degreePoolSize(level)
      q.degree = degreePoolAt(level, indexed ? poolClamp(count, poolIndex) : rng.below(count))
      return q
    }
    case ExerciseType.ChordQuality: {
      const count = chordPoolSize(level)
      q.chord = chordPoolAt(level, indexed ? poolClamp(count, poolIndex) : rng.below(count))
      q.chordRoot = pitchClass(key + DIATONIC_DEGREES[rng.below(7)])
      return q
    }
    case ExerciseType.IntervalMelodic:
      q.interval = generateInterval(level, false, rng)
      return q
    case ExerciseType.IntervalHarmonic:
      q.interval = generateInterval(level, true, rng)
      return q
    case ExerciseType.Tension: {
      const count = tensionPoolSize(level)
      q.chord = ChordType.Dom7
      q.chordRoot = key
      q.tension = tensionPoolAt(level, indexed ? poolClamp(count, poolIndex) : rng.below(count))
      return q
    }
    case ExerciseType.Arpeggio:
      generateArpeggio(q, level, rng)
      return q
    case ExerciseType.Scale: {
      const count = scalePoolSize(level)
      q.scale = scalePoolAt(level, indexed ? poolClamp(count, poolIndex) : rng.below(count))
      return q
    }
    case ExerciseType.BassMovement:
      generateBassMovement(q, level, rng)
      return q
    case ExerciseType.MelodicDictation:
      generatePhrase(q, level, rng)
      return q
    default:
      return null
  }
}

export function questionGenerate(type: ExerciseType, key: number, level: number, rng: Rng): Question | null {
  return generate(type, key, level, 0, rng, false)
}

/** Same, but for a pooled type (Degree, ChordQuality, Tension, Scale) asks
 * specifically for `poolIndex` instead of drawing it from `rng` -- `rng` is
 * still used for any other randomness the question needs (e.g. a chord's
 * root). For a non-pooled type this is identical to questionGenerate() and
 * `poolIndex` is ignored. */
export function questionGenerateAt(
  type: ExerciseType,
  key: number,
  level: number,
  poolIndex: number,
  rng: Rng,
): Question | null {
  return generate(type, key, level, poolIndex, rng, true)
}

// ---------------------------------------------------------------------------
// Answer evaluation

export function checkNote(q: Question, playedNote: number): boolean | null {
  if (q.type !== ExerciseType.Degree) return null
  return pitchClass(playedNote) === pitchClass(q.key + q.degree)
}

export function checkChord(q: Question, answer: ChordType): boolean | null {
  if (q.type !== ExerciseType.ChordQuality) return null
  return answer === q.chord
}

/** Unlike checkNote, this compares the *exact* note (60 + key's pitch class
 * + interval), not just its pitch class: telling a 9th from a 2nd needs the
 * octave. */
export function checkIntervalNote(q: Question, playedNote: number): boolean | null {
  if (q.type !== ExerciseType.IntervalMelodic && q.type !== ExerciseType.IntervalHarmonic) return null
  return playedNote === intervalReferenceNote(q.key) + q.interval
}

export function checkTension(q: Question, answer: Tension): boolean | null {
  if (q.type !== ExerciseType.Tension) return null
  return answer === q.tension
}

export function checkScale(q: Question, answer: ScaleType): boolean | null {
  if (q.type !== ExerciseType.Scale) return null
  return answer === q.scale
}

/** Sequence answers (#6, #8, #9): compares `playedNote`'s pitch class
 * against q.sequence[progress]; on a match returns the advanced progress,
 * otherwise returns the unchanged progress. correct is null if `q` isn't a
 * sequence question or progress is already past the end. */
export function checkSequenceNote(
  q: Question,
  progress: number,
  playedNote: number,
): { correct: boolean | null; progress: number } {
  if (
    q.type !== ExerciseType.Arpeggio &&
    q.type !== ExerciseType.BassMovement &&
    q.type !== ExerciseType.MelodicDictation
  ) {
    return { correct: null, progress }
  }
  if (progress >= q.sequence.length) return { correct: null, progress }
  if (pitchClass(playedNote) !== q.sequence[progress]) return { correct: false, progress }
  return { correct: true, progress: progress + 1 }
}

export function sequenceDone(q: Question, progress: number): boolean {
  return progress >= q.sequence.length
}

// ---------------------------------------------------------------------------
// Vamp mode: a looping progression the device comps/walks while the user
// improvises.

export interface VampStep {
  chord: ChordType
  context: Context
  offset: number // semitones from the vamp's key
  durationMs: number
}
export interface Vamp {
  name: string
  steps: VampStep[]
}

const VAMP_MODAL_DM7: VampStep[] = [{ chord: ChordType.Min7, context: Context.II, offset: 0, durationMs: 2400 }]
const VAMP_DM7_G7: VampStep[] = [
  { chord: ChordType.Min7, context: Context.II, offset: 0, durationMs: 1600 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 5, durationMs: 1600 },
]
const VAMP_II_V_I_MINOR: VampStep[] = [
  { chord: ChordType.Min7Flat5, context: Context.None, offset: 2, durationMs: 1100 },
  { chord: ChordType.Dom7Alt, context: Context.None, offset: 7, durationMs: 1100 },
  { chord: ChordType.Min6, context: Context.None, offset: 0, durationMs: 1100 },
]
const VAMP_TURNAROUND: VampStep[] = [
  // Cmaj7-A7-Dm7-G7: I-VI7-ii-V
  { chord: ChordType.Maj7, context: Context.I, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 9, durationMs: 900 },
  { chord: ChordType.Min7, context: Context.II, offset: 2, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 7, durationMs: 900 },
]
const VAMP_BLUES_F: VampStep[] = [
  // 12-bar jazz blues, one comp per bar
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 5, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 5, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 5, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Min7, context: Context.II, offset: 2, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 7, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 0, durationMs: 900 },
  { chord: ChordType.Dom7, context: Context.VMajor, offset: 7, durationMs: 900 },
]

export const VAMPS: Vamp[] = [
  { name: 'Modal Dm7', steps: VAMP_MODAL_DM7 },
  { name: 'Dm7 - G7', steps: VAMP_DM7_G7 },
  { name: 'Minor ii-V-I', steps: VAMP_II_V_I_MINOR },
  { name: 'Cmaj7-A7-Dm7-G7', steps: VAMP_TURNAROUND },
  { name: 'Blues in F', steps: VAMP_BLUES_F },
]

export function vamp(index: number): Vamp | null {
  return index >= 0 && index < VAMPS.length ? VAMPS[index] : null
}

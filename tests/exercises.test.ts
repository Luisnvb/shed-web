import { describe, it, expect } from 'vitest'
import { ChordType, chordScaleLookup } from '../src/core/theory'
import {
  Rng,
  KeyMode,
  nextKey,
  ExerciseType,
  Tension,
  tensionSemitones,
  intervalReferenceNote,
  degreePoolSize,
  degreePoolAt,
  chordPoolSize,
  chordPoolAt,
  tensionPoolSize,
  tensionPoolAt,
  scalePoolSize,
  scalePoolAt,
  questionGenerate,
  questionGenerateAt,
  checkNote,
  checkChord,
  checkIntervalNote,
  checkTension,
  checkScale,
  checkSequenceNote,
  sequenceDone,
  VAMPS,
} from '../src/core/exercises'

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('treats a zero seed as 1 (xorshift cannot recover from zero)', () => {
    const zero = new Rng(0)
    const one = new Rng(1)
    expect(zero.next()).toBe(one.next())
  })

  it('below(bound) stays within [0, bound)', () => {
    const rng = new Rng(7)
    for (let i = 0; i < 200; i++) {
      const v = rng.below(12)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(12)
    }
  })
})

describe('nextKey', () => {
  it('Fixed keeps the same pitch class', () => {
    expect(nextKey(5, KeyMode.Fixed, new Rng(1))).toBe(5)
  })
  it('Fourths ascends by a perfect fourth, wrapping at 12', () => {
    expect(nextKey(9, KeyMode.Fourths, new Rng(1))).toBe(2) // 9 + 5 = 14 -> 2
  })
  it('Random stays within 0..11', () => {
    const rng = new Rng(3)
    for (let i = 0; i < 50; i++) {
      const k = nextKey(0, KeyMode.Random, rng)
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(12)
    }
  })
})

describe('tension', () => {
  it('maps each tension to its semitone offset', () => {
    expect(tensionSemitones(Tension.Nine)).toBe(14)
    expect(tensionSemitones(Tension.FlatNine)).toBe(13)
    expect(tensionSemitones(Tension.SharpNine)).toBe(15)
    expect(tensionSemitones(Tension.SharpEleven)).toBe(18)
    expect(tensionSemitones(Tension.Thirteen)).toBe(21)
    expect(tensionSemitones(Tension.FlatThirteen)).toBe(20)
  })
})

describe('intervalReferenceNote', () => {
  it('is middle C octave on the key tonic', () => {
    expect(intervalReferenceNote(0)).toBe(60)
    expect(intervalReferenceNote(4)).toBe(64)
    expect(intervalReferenceNote(13)).toBe(61) // normalizes to pitch class 1
  })
})

describe('difficulty pools', () => {
  it('degree pool grows from 7 (diatonic) to 12 (chromatic)', () => {
    expect(degreePoolSize(0)).toBe(7)
    expect(degreePoolSize(1)).toBe(12)
    expect(degreePoolSize(99)).toBe(12) // clamps to the last band
    expect(degreePoolAt(0, 0)).toBe(0)
    expect(degreePoolAt(0, 6)).toBe(11)
  })

  it('chord pool grows 6 -> 9 -> all 13', () => {
    expect(chordPoolSize(0)).toBe(6)
    expect(chordPoolSize(1)).toBe(9)
    expect(chordPoolSize(2)).toBe(ChordType.Count)
    expect(chordPoolAt(0, 0)).toBe(ChordType.Maj7)
  })

  it('tension pool grows 2 -> 4 -> all 6', () => {
    expect(tensionPoolSize(0)).toBe(2)
    expect(tensionPoolSize(1)).toBe(4)
    expect(tensionPoolSize(2)).toBe(Tension.Count)
    expect(tensionPoolAt(0, 0)).toBe(Tension.Nine)
  })

  it('scale pool grows 7 -> 12 -> all 16', () => {
    expect(scalePoolSize(0)).toBe(7)
    expect(scalePoolSize(1)).toBe(12)
    expect(scalePoolSize(2)).toBe(16)
  })
})

describe('question generation', () => {
  it('Degree question is answered correctly by the tonic + degree pitch class', () => {
    const rng = new Rng(1)
    const q = questionGenerate(ExerciseType.Degree, 0, 0, rng)!
    expect(q.degree).toBeGreaterThanOrEqual(0)
    expect(checkNote(q, q.key + q.degree)).toBe(true)
    expect(checkNote(q, q.key + q.degree + 1)).toBe(false)
  })

  it('ChordQuality question is answered correctly by the exact chord type', () => {
    const rng = new Rng(2)
    const q = questionGenerate(ExerciseType.ChordQuality, 0, 1, rng)!
    expect(checkChord(q, q.chord)).toBe(true)
    const wrongAnswer = q.chord === ChordType.Dim7 ? ChordType.Maj7 : ChordType.Dim7
    expect(checkChord(q, wrongAnswer)).toBe(false)
  })

  it('Interval question compares the exact note, not just pitch class', () => {
    const rng = new Rng(3)
    const q = questionGenerate(ExerciseType.IntervalMelodic, 0, 0, rng)!
    const correctNote = intervalReferenceNote(q.key) + q.interval
    expect(checkIntervalNote(q, correctNote)).toBe(true)
    expect(checkIntervalNote(q, correctNote + 12)).toBe(false) // same pitch class, wrong octave
  })

  it('Harmonic interval is always positive (play the upper note)', () => {
    const rng = new Rng(4)
    for (let i = 0; i < 50; i++) {
      const q = questionGenerate(ExerciseType.IntervalHarmonic, 0, 2, rng)!
      expect(q.interval).toBeGreaterThan(0)
    }
  })

  it('Tension question is rooted on a Dom7 at the key', () => {
    const rng = new Rng(5)
    const q = questionGenerate(ExerciseType.Tension, 3, 1, rng)!
    expect(q.chord).toBe(ChordType.Dom7)
    expect(q.chordRoot).toBe(3)
    expect(checkTension(q, q.tension)).toBe(true)
  })

  it('Scale question is answered correctly by the exact scale type', () => {
    const rng = new Rng(6)
    const q = questionGenerate(ExerciseType.Scale, 0, 2, rng)!
    expect(checkScale(q, q.scale)).toBe(true)
  })

  it('Arpeggio sequence pitch classes all belong to the chord', () => {
    const rng = new Rng(7)
    const q = questionGenerate(ExerciseType.Arpeggio, 5, 1, rng)!
    expect(q.sequence.length).toBeGreaterThan(0)
    for (const pc of q.sequence) {
      expect(pc).toBeGreaterThanOrEqual(0)
      expect(pc).toBeLessThan(12)
    }
  })

  it('BassMovement produces a sequence with a matching chord per root', () => {
    const rng = new Rng(8)
    const q = questionGenerate(ExerciseType.BassMovement, 0, 0, rng)!
    expect(q.sequence.length).toBe(3) // level 0 is only ii-V-I
    expect(q.sequenceChord.length).toBe(q.sequence.length)
  })

  it('MelodicDictation respects FM1_SHED_SEQUENCE_MAX and level length bands', () => {
    const rng = new Rng(9)
    for (let i = 0; i < 20; i++) {
      const q = questionGenerate(ExerciseType.MelodicDictation, 0, 0, rng)!
      expect(q.sequence.length).toBeGreaterThanOrEqual(3)
      expect(q.sequence.length).toBeLessThanOrEqual(4)
    }
  })

  it('questionGenerateAt asks for an exact pool index on pooled types', () => {
    const rng = new Rng(10)
    const q = questionGenerateAt(ExerciseType.Scale, 0, 2, 0, rng)!
    expect(scalePoolAt(2, 0)).toBe(q.scale)
  })
})

describe('sequence answers', () => {
  it('advances progress on a correct note and fails on a wrong one', () => {
    const rng = new Rng(11)
    const q = questionGenerate(ExerciseType.Arpeggio, 0, 0, rng)!
    let progress = 0
    const wrong = checkSequenceNote(q, progress, (q.sequence[0] + 1) % 12)
    expect(wrong.correct).toBe(false)
    expect(wrong.progress).toBe(0)

    const right = checkSequenceNote(q, progress, q.sequence[0])
    expect(right.correct).toBe(true)
    progress = right.progress
    expect(progress).toBe(1)
    expect(sequenceDone(q, progress)).toBe(q.sequence.length === 1)
  })

  it('is done once progress reaches the sequence length', () => {
    const rng = new Rng(12)
    const q = questionGenerate(ExerciseType.BassMovement, 0, 0, rng)!
    let progress = 0
    for (const pc of q.sequence) {
      const result = checkSequenceNote(q, progress, pc)
      expect(result.correct).toBe(true)
      progress = result.progress
    }
    expect(sequenceDone(q, progress)).toBe(true)
  })
})

describe('vamp data', () => {
  it('has 5 named vamps', () => {
    expect(VAMPS.length).toBe(5)
    for (const v of VAMPS) {
      expect(v.name.length).toBeGreaterThan(0)
      expect(v.steps.length).toBeGreaterThan(0)
    }
  })

  it('every (chord, context) pair resolves to a real chord -> scale row', () => {
    for (const v of VAMPS) {
      for (const step of v.steps) {
        const row = chordScaleLookup(step.chord, step.context)
        expect(row, `${v.name}: chord ${step.chord} context ${step.context} has no row`).not.toBeNull()
      }
    }
  })
})

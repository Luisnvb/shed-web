import { describe, it, expect } from 'vitest'
import {
  ChordType,
  ScaleType,
  Context,
  pitchClass,
  chord,
  scale,
  chordScaleLookup,
  chordPitchClasses,
  scalePitchClasses,
} from '../src/core/theory'

describe('pitchClass', () => {
  it('reduces any signed semitone offset to 0..11', () => {
    expect(pitchClass(0)).toBe(0)
    expect(pitchClass(11)).toBe(11)
    expect(pitchClass(12)).toBe(0)
    expect(pitchClass(25)).toBe(1)
    expect(pitchClass(-1)).toBe(11)
    expect(pitchClass(-12)).toBe(0)
    expect(pitchClass(-13)).toBe(11)
  })
})

const EXPECTED_CHORDS: Record<ChordType, { symbol: string; intervals: number[] }> = {
  [ChordType.Maj7]: { symbol: 'maj7', intervals: [0, 4, 7, 11] },
  [ChordType.SixNine]: { symbol: '6/9', intervals: [0, 4, 7, 9, 14] },
  [ChordType.Min7]: { symbol: 'm7', intervals: [0, 3, 7, 10] },
  [ChordType.Min6]: { symbol: 'm6', intervals: [0, 3, 7, 9] },
  [ChordType.MinMaj7]: { symbol: 'm(maj7)', intervals: [0, 3, 7, 11] },
  [ChordType.Dom7]: { symbol: '7', intervals: [0, 4, 7, 10] },
  [ChordType.Dom7Sus4]: { symbol: '7sus4', intervals: [0, 5, 7, 10] },
  [ChordType.Min7Flat5]: { symbol: 'm7♭5', intervals: [0, 3, 6, 10] },
  [ChordType.Dim7]: { symbol: 'dim7', intervals: [0, 3, 6, 9] },
  [ChordType.Maj7Sharp11]: { symbol: 'maj7♯11', intervals: [0, 4, 7, 11, 18] },
  [ChordType.Dom7Flat9]: { symbol: '7♭9', intervals: [0, 4, 7, 10, 13] },
  [ChordType.Dom7Sharp11]: { symbol: '7♯11', intervals: [0, 4, 7, 10, 18] },
  [ChordType.Dom7Alt]: { symbol: '7alt', intervals: [0, 4, 10, 13, 15, 20] },
  [ChordType.Count]: { symbol: '', intervals: [] },
}

describe('chords', () => {
  it('matches the spec for every chord type', () => {
    for (let t = 0; t < ChordType.Count; t++) {
      const c = chord(t)
      expect(c).not.toBeNull()
      expect(c!.symbol).toBe(EXPECTED_CHORDS[t as ChordType].symbol)
      expect(c!.intervals).toEqual(EXPECTED_CHORDS[t as ChordType].intervals)
    }
  })

  it('returns null out of range', () => {
    expect(chord(ChordType.Count)).toBeNull()
    expect(chord(999 as ChordType)).toBeNull()
  })
})

describe('scales', () => {
  it('has 16 scales, each with a name and intervals', () => {
    for (let t = 0; t < ScaleType.Count; t++) {
      const s = scale(t)
      expect(s).not.toBeNull()
      expect(s!.name.length).toBeGreaterThan(0)
      expect(s!.intervals.length).toBeGreaterThan(0)
    }
  })

  it('returns null out of range', () => {
    expect(scale(ScaleType.Count)).toBeNull()
  })
})

describe('chordScaleLookup', () => {
  it('finds the maj7 (I) row with its alt scale and avoid note', () => {
    const row = chordScaleLookup(ChordType.Maj7, Context.I)
    expect(row).not.toBeNull()
    expect(row!.scale).toBe(ScaleType.Ionian)
    expect(row!.altScale).toBe(ScaleType.Lydian)
    expect(row!.avoid).toEqual([5])
  })

  it('finds the dominant (V -> major) row with Bebop dominant as the alt', () => {
    const row = chordScaleLookup(ChordType.Dom7, Context.VMajor)
    expect(row).not.toBeNull()
    expect(row!.scale).toBe(ScaleType.Mixolydian)
    expect(row!.altScale).toBe(ScaleType.BebopDominant)
  })

  it('falls back to the Context.None row when a context-specific one is missing', () => {
    // m7b5 has no "context II" row, only its generic Locrian row.
    const row = chordScaleLookup(ChordType.Min7Flat5, Context.II)
    expect(row).not.toBeNull()
    expect(row!.scale).toBe(ScaleType.Locrian)
  })

  it('returns null for an unlisted context with no fallback row', () => {
    // m7 has no generic row, only I/II/III/VI-specific ones.
    expect(chordScaleLookup(ChordType.Min7, Context.VMajor)).toBeNull()
  })
})

describe('pitch class builders', () => {
  it('builds a maj7 rooted on C', () => {
    expect(chordPitchClasses(ChordType.Maj7, 0)).toEqual([0, 4, 7, 11])
  })

  it('wraps past the octave when rooted on Bb', () => {
    expect(chordPitchClasses(ChordType.Maj7, 10)).toEqual([10, 2, 5, 9])
  })

  it("reduces 6/9's 9th to pitch class 2 when rooted on C", () => {
    const pcs = chordPitchClasses(ChordType.SixNine, 0)
    expect(pcs[4]).toBe(2)
  })

  it('builds D Dorian', () => {
    expect(scalePitchClasses(ScaleType.Dorian, 2)).toEqual([2, 4, 5, 7, 9, 11, 0])
  })

  it('returns an empty array out of range', () => {
    expect(chordPitchClasses(999 as ChordType, 0)).toEqual([])
    expect(scalePitchClasses(999 as ScaleType, 0)).toEqual([])
  })
})

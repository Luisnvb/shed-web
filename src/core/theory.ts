/* SPDX-License-Identifier: GPL-3.0-only */
/**
 * Jazz theory core, ported 1:1 from fm1_open's app/shed/theory.c (originally
 * GPL-3.0-only WITH GPL-3.0-linking-exception -- see LICENSE.md). Pitch
 * classes are 0..11 with C = 0.
 * Chord and scale intervals are semitones from the root, left un-reduced
 * above the octave (e.g. 14 for a natural 9th) so a 9th can be told from a
 * 2nd; pitchClass() reduces them back to 0..11 when only pitch class matters.
 */

export enum ChordType {
  Maj7 = 0,
  SixNine,
  Min7,
  Min6,
  MinMaj7,
  Dom7,
  Dom7Sus4,
  Min7Flat5,
  Dim7,
  Maj7Sharp11,
  Dom7Flat9,
  Dom7Sharp11,
  Dom7Alt,
  Count,
}

export enum ScaleType {
  Ionian = 0,
  Dorian,
  Phrygian,
  Lydian,
  Mixolydian,
  Aeolian,
  Locrian,
  MelodicMinor,
  LydianDominant,
  LocrianNat2,
  Altered,
  DimWholeHalf,
  DimHalfWhole,
  WholeTone,
  BebopDominant,
  PhrygianDominant,
  Count,
}

/** Harmonic function, used only when a chord -> scale mapping depends on
 * context, not on chord quality alone (maj7 as I vs. IV; m7 as II, III or
 * VI; 7 resolving to a major or minor tonic). None means the chord quality
 * alone picks the row. */
export enum Context {
  None = 0,
  I,
  II,
  III,
  IV,
  VMajor,
  VMinor,
  VI,
}

export interface Chord {
  symbol: string
  intervals: number[]
}

export interface Scale {
  name: string
  intervals: number[]
}

export interface ChordScaleRow {
  chord: ChordType
  context: Context
  scale: ScaleType
  altScale: ScaleType | null
  avoid: number[]
}

export function pitchClass(note: number): number {
  // note % 12 can be -0 for a negative multiple of 12 (e.g. -12 % 12 === -0
  // in JS, unlike C) and -0 < 0 is false, so the obvious `pc < 0 ? pc + 12
  // : pc` would leak -0 out to callers; +12 normalizes every result,
  // including that one, back to a plain positive 0.
  return ((note % 12) + 12) % 12
}

const CHORDS: Record<ChordType, Chord> = {
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
  // Fifth omitted in favor of the altered tensions, as the original spec notes.
  [ChordType.Dom7Alt]: { symbol: '7alt', intervals: [0, 4, 10, 13, 15, 20] },
  [ChordType.Count]: { symbol: '', intervals: [] },
}

const SCALES: Record<ScaleType, Scale> = {
  [ScaleType.Ionian]: { name: 'Ionian', intervals: [0, 2, 4, 5, 7, 9, 11] },
  [ScaleType.Dorian]: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  [ScaleType.Phrygian]: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  [ScaleType.Lydian]: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  [ScaleType.Mixolydian]: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  [ScaleType.Aeolian]: { name: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
  [ScaleType.Locrian]: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
  [ScaleType.MelodicMinor]: { name: 'Melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  [ScaleType.LydianDominant]: { name: 'Lydian dominant', intervals: [0, 2, 4, 6, 7, 9, 10] },
  [ScaleType.LocrianNat2]: { name: 'Locrian ♮2', intervals: [0, 2, 3, 5, 6, 8, 10] },
  [ScaleType.Altered]: { name: 'Altered', intervals: [0, 1, 3, 4, 6, 8, 10] },
  [ScaleType.DimWholeHalf]: { name: 'Whole-half diminished', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  [ScaleType.DimHalfWhole]: { name: 'Half-whole diminished', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  [ScaleType.WholeTone]: { name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10] },
  [ScaleType.BebopDominant]: { name: 'Bebop dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11] },
  [ScaleType.PhrygianDominant]: { name: 'Phrygian dominant', intervals: [0, 1, 4, 5, 7, 8, 10] },
  [ScaleType.Count]: { name: '', intervals: [] },
}

const CHORD_SCALE_TABLE: ChordScaleRow[] = [
  // maj7 (I)
  { chord: ChordType.Maj7, context: Context.I, scale: ScaleType.Ionian, altScale: ScaleType.Lydian, avoid: [5] },
  // maj7 (IV)
  { chord: ChordType.Maj7, context: Context.IV, scale: ScaleType.Lydian, altScale: null, avoid: [] },
  // m7 (II)
  { chord: ChordType.Min7, context: Context.II, scale: ScaleType.Dorian, altScale: null, avoid: [] },
  // m7 (III): avoid b2, b6
  { chord: ChordType.Min7, context: Context.III, scale: ScaleType.Phrygian, altScale: null, avoid: [1, 8] },
  // m7 (VI): avoid b6
  { chord: ChordType.Min7, context: Context.VI, scale: ScaleType.Aeolian, altScale: null, avoid: [8] },
  // 7 (V -> major): avoid 4
  { chord: ChordType.Dom7, context: Context.VMajor, scale: ScaleType.Mixolydian, altScale: ScaleType.BebopDominant, avoid: [5] },
  // 7#11
  { chord: ChordType.Dom7Sharp11, context: Context.None, scale: ScaleType.LydianDominant, altScale: null, avoid: [] },
  // 7alt
  { chord: ChordType.Dom7Alt, context: Context.None, scale: ScaleType.Altered, altScale: null, avoid: [] },
  // 7b9 (V -> minor); alt = half-whole diminished
  { chord: ChordType.Dom7Flat9, context: Context.VMinor, scale: ScaleType.PhrygianDominant, altScale: ScaleType.DimHalfWhole, avoid: [] },
  // m7b5: avoid b2 (in Locrian)
  { chord: ChordType.Min7Flat5, context: Context.None, scale: ScaleType.Locrian, altScale: ScaleType.LocrianNat2, avoid: [1] },
  // dim7
  { chord: ChordType.Dim7, context: Context.None, scale: ScaleType.DimWholeHalf, altScale: null, avoid: [] },
  // m(maj7)
  { chord: ChordType.MinMaj7, context: Context.None, scale: ScaleType.MelodicMinor, altScale: null, avoid: [] },
  // m6
  { chord: ChordType.Min6, context: Context.None, scale: ScaleType.MelodicMinor, altScale: null, avoid: [] },
]

export function chord(type: ChordType): Chord | null {
  return type in CHORDS && type !== ChordType.Count ? CHORDS[type] : null
}

export function scale(type: ScaleType): Scale | null {
  return type in SCALES && type !== ScaleType.Count ? SCALES[type] : null
}

/** Finds the chord -> scale row for (type, context). Falls back to the
 * Context.None row for that chord type if a context-specific row doesn't
 * exist. Returns null if `type` has no row at all. */
export function chordScaleLookup(type: ChordType, context: Context): ChordScaleRow | null {
  let fallback: ChordScaleRow | null = null
  for (const row of CHORD_SCALE_TABLE) {
    if (row.chord !== type) continue
    if (row.context === context) return row
    if (row.context === Context.None) fallback = row
  }
  return fallback
}

export function chordPitchClasses(type: ChordType, root: number): number[] {
  const c = chord(type)
  if (!c) return []
  return c.intervals.map((iv) => pitchClass(root + iv))
}

export function scalePitchClasses(type: ScaleType, root: number): number[] {
  const s = scale(type)
  if (!s) return []
  return s.intervals.map((iv) => pitchClass(root + iv))
}

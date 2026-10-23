import { ChordType } from '../core/theory'

/** Semitone offsets (from the chord root) of a chord's "guide tones" -- the
 * 3rd and 7th (or the closest equivalent: the sus4 in place of a 3rd, a 6th
 * where there's no 7th) -- the two notes that most define a chord's quality
 * and the ones a bassist or comper leans on. Not part of fm1_open's own
 * data (the original device's LED "guide" view computed this directly from
 * each chord's tagged scale degrees); derived here from the same chord
 * table in theory.ts for Vamp mode's "Guide" view. */
export const GUIDE_TONES: Record<ChordType, [number, number]> = {
  [ChordType.Maj7]: [4, 11],
  [ChordType.SixNine]: [4, 9], // no 7th in a 6/9; 6th stands in
  [ChordType.Min7]: [3, 10],
  [ChordType.Min6]: [3, 9], // no 7th in a m6; 6th stands in
  [ChordType.MinMaj7]: [3, 11],
  [ChordType.Dom7]: [4, 10],
  [ChordType.Dom7Sus4]: [5, 10], // sus4 stands in for the 3rd
  [ChordType.Min7Flat5]: [3, 10],
  [ChordType.Dim7]: [3, 9], // bb7
  [ChordType.Maj7Sharp11]: [4, 11],
  [ChordType.Dom7Flat9]: [4, 10],
  [ChordType.Dom7Sharp11]: [4, 10],
  [ChordType.Dom7Alt]: [4, 10],
  [ChordType.Count]: [0, 0],
}

import { ChordType, ScaleType } from './theory'
import { ExerciseType, Tension } from './exercises'

export const PITCH_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export const CHORD_LABELS: Record<ChordType, string> = {
  [ChordType.Maj7]: 'maj7',
  [ChordType.SixNine]: '6/9',
  [ChordType.Min7]: 'm7',
  [ChordType.Min6]: 'm6',
  [ChordType.MinMaj7]: 'm(maj7)',
  [ChordType.Dom7]: '7',
  [ChordType.Dom7Sus4]: '7sus4',
  [ChordType.Min7Flat5]: 'm7♭5',
  [ChordType.Dim7]: 'dim7',
  [ChordType.Maj7Sharp11]: 'maj7♯11',
  [ChordType.Dom7Flat9]: '7♭9',
  [ChordType.Dom7Sharp11]: '7♯11',
  [ChordType.Dom7Alt]: '7alt',
  [ChordType.Count]: '',
}

export const TENSION_LABELS: Record<Tension, string> = {
  [Tension.Nine]: '9',
  [Tension.FlatNine]: '♭9',
  [Tension.SharpNine]: '♯9',
  [Tension.SharpEleven]: '♯11',
  [Tension.Thirteen]: '13',
  [Tension.FlatThirteen]: '♭13',
  [Tension.Count]: '',
}

export const SCALE_LABELS: Record<ScaleType, string> = {
  [ScaleType.Ionian]: 'Ionian',
  [ScaleType.Dorian]: 'Dorian',
  [ScaleType.Phrygian]: 'Phrygian',
  [ScaleType.Lydian]: 'Lydian',
  [ScaleType.Mixolydian]: 'Mixolydian',
  [ScaleType.Aeolian]: 'Aeolian',
  [ScaleType.Locrian]: 'Locrian',
  [ScaleType.MelodicMinor]: 'Melodic minor',
  [ScaleType.LydianDominant]: 'Lydian dominant',
  [ScaleType.LocrianNat2]: 'Locrian ♮2',
  [ScaleType.Altered]: 'Altered',
  [ScaleType.DimWholeHalf]: 'Whole-half dim.',
  [ScaleType.DimHalfWhole]: 'Half-whole dim.',
  [ScaleType.WholeTone]: 'Whole tone',
  [ScaleType.BebopDominant]: 'Bebop dominant',
  [ScaleType.PhrygianDominant]: 'Phrygian dominant',
  [ScaleType.Count]: '',
}

export const EXERCISE_NAMES: Record<ExerciseType, string> = {
  [ExerciseType.Degree]: 'Functional degree',
  [ExerciseType.ChordQuality]: 'Chord quality',
  [ExerciseType.IntervalMelodic]: 'Melodic interval',
  [ExerciseType.IntervalHarmonic]: 'Harmonic interval',
  [ExerciseType.Tension]: 'Dominant tension',
  [ExerciseType.Arpeggio]: 'Arpeggio',
  [ExerciseType.Scale]: 'Scale / mode',
  [ExerciseType.BassMovement]: 'Bass movement',
  [ExerciseType.MelodicDictation]: 'Melodic dictation',
  [ExerciseType.Count]: '',
}

export const EXERCISE_HINTS: Record<ExerciseType, string> = {
  [ExerciseType.Degree]: 'Listen, then play the matching key.',
  [ExerciseType.ChordQuality]: 'Listen, then pick the chord quality.',
  [ExerciseType.IntervalMelodic]: 'Listen to both notes, then play the second one.',
  [ExerciseType.IntervalHarmonic]: 'Listen to the interval, then play the upper note.',
  [ExerciseType.Tension]: 'Listen, then pick the tension.',
  [ExerciseType.Arpeggio]: 'Listen, then play the arpeggio back in order.',
  [ExerciseType.Scale]: 'Listen, then pick the scale/mode.',
  [ExerciseType.BassMovement]: 'Listen to the progression, then play the root notes in order.',
  [ExerciseType.MelodicDictation]: 'Listen, then play the phrase back.',
  [ExerciseType.Count]: '',
}

/**
 * Turns a generated Question into sound. Mirrors the *intent* of
 * fm1_open's app/shed/player.c (what plays for each exercise) using the
 * Web Audio synth instead of the DX7 engine.
 */

import { Synth, Voicing, PIANO_REGISTER } from '../audio/synth'
import { ChordType, scalePitchClasses } from '../core/theory'
import { ExerciseType, Question, tensionSemitones, intervalReferenceNote } from '../core/exercises'

const SEQ_NOTE_S = 0.4

export function playStimulus(synth: Synth, q: Question): void {
  const now = synth.now + 0.05
  switch (q.type) {
    case ExerciseType.Degree: {
      const end = synth.playCadence(q.key, now)
      synth.playNote(72 + q.degree, end + 0.15, 0.9)
      break
    }
    case ExerciseType.ChordQuality: {
      synth.playVoicedChord(q.chord, q.chordRoot, Voicing.A, now, 1.4)
      break
    }
    case ExerciseType.IntervalMelodic: {
      const ref = intervalReferenceNote(q.key)
      synth.playNote(ref, now, 0.6)
      synth.playNote(ref + q.interval, now + 0.7, 0.6)
      break
    }
    case ExerciseType.IntervalHarmonic: {
      const ref = intervalReferenceNote(q.key)
      synth.playNote(ref, now, 1.1)
      synth.playNote(ref + q.interval, now, 1.1)
      break
    }
    case ExerciseType.Tension: {
      synth.playVoicedChord(q.chord, q.chordRoot, Voicing.A, now, 1.5)
      synth.playNote(72 + tensionSemitones(q.tension), now + 0.1, 1.3, 0.7)
      break
    }
    case ExerciseType.Arpeggio: {
      synth.playSequence(q.sequence, PIANO_REGISTER, true, now, SEQ_NOTE_S)
      break
    }
    case ExerciseType.Scale: {
      const pcs = scalePitchClasses(q.scale, q.key)
      synth.playSequence(pcs, PIANO_REGISTER, true, now, 0.3)
      break
    }
    case ExerciseType.BassMovement: {
      let t = now
      for (let i = 0; i < q.sequence.length; i++) {
        const variant = i % 2 === 0 ? Voicing.A : Voicing.B
        t = synth.playVoicedChord(q.sequenceChord[i] as ChordType, q.sequence[i], variant, t, 0.8)
      }
      break
    }
    case ExerciseType.MelodicDictation: {
      synth.playSequence(q.sequence, PIANO_REGISTER, false, now, SEQ_NOTE_S)
      break
    }
  }
}

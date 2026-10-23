/**
 * A small Web Audio synth for Shed Web. Not a port of anything in
 * fm1_open's player.c (there's no DX7 engine in a browser) -- but the
 * voicing choices (rootless piano voicings A/B, piano/bass registers) are
 * carried over so a chord sounds the way the original device played it.
 */

import { ChordType, chord, pitchClass } from '../core/theory'

export const PIANO_REGISTER = 48 // same anchor as fm1_open's FM1_SHED_PIANO_REGISTER
export const BASS_REGISTER = 36 // FM1_SHED_BASS_REGISTER

export enum Voicing {
  A = 0,
  B,
}

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

/** Rootless voicing, ported from player.c's rootless_notes(): drops the
 * root, keeps the rest ascending (A), or moves the top note down an octave
 * to the bottom for tighter voice leading chord to chord (B). */
function rootlessNotes(type: ChordType, rootPc: number, variant: Voicing): number[] {
  const c = chord(type)
  if (!c || c.intervals.length < 2) return []
  const rel = c.intervals.slice(1) // drop the root
  if (variant === Voicing.B && rel.length > 1) {
    const top = rel[rel.length - 1]
    rel.unshift(top - 12)
    rel.pop()
  }
  const pc = pitchClass(rootPc)
  return rel.map((iv) => PIANO_REGISTER + pc + iv)
}

interface Voice {
  osc1: OscillatorNode
  osc2: OscillatorNode
  gain: GainNode
}

export class Synth {
  private ctx: AudioContext
  private master: GainNode
  private activeVoices = new Map<string, Voice>()

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.3
    this.master.connect(this.ctx.destination)
  }

  /** Browsers require a user gesture before audio can start; call this from
   * a click/keydown handler before the first sound. */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  get now(): number {
    return this.ctx.currentTime
  }

  /** One-shot note: a short pluck-like envelope (two detuned oscillators,
   * fast attack, exponential decay) -- piano-ish without needing samples. */
  playNote(midiNote: number, when: number, duration: number, velocity = 0.9): void {
    const freq = midiToFreq(midiNote)
    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc1.type = 'triangle'
    osc2.type = 'sine'
    osc1.frequency.value = freq
    osc2.frequency.value = freq
    osc2.detune.value = 6 // a touch of chorus
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(this.master)

    const attack = 0.012
    const peak = velocity
    const releaseStart = when + duration * 0.55
    const end = when + duration
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(peak, when + attack)
    gain.gain.setTargetAtTime(peak * 0.35, when + attack, duration * 0.3)
    gain.gain.setTargetAtTime(0.0001, releaseStart, duration * 0.25)

    osc1.start(when)
    osc2.start(when)
    osc1.stop(end + 0.05)
    osc2.stop(end + 0.05)
  }

  /** Sustained note for the virtual piano: starts on noteOn, stops on
   * noteOff, keyed so overlapping on/off pairs for the same note behave. */
  noteOn(midiNote: number, velocity = 0.9): void {
    const key = String(midiNote)
    this.noteOff(midiNote) // retrigger cleanly if already sounding
    const freq = midiToFreq(midiNote)
    const osc1 = this.ctx.createOscillator()
    const osc2 = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc1.type = 'triangle'
    osc2.type = 'sine'
    osc1.frequency.value = freq
    osc2.frequency.value = freq
    osc2.detune.value = 6
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(this.master)
    const when = this.now
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(velocity, when + 0.012)
    gain.gain.setTargetAtTime(velocity * 0.4, when + 0.012, 0.6)
    osc1.start(when)
    osc2.start(when)
    this.activeVoices.set(key, { osc1, osc2, gain })
  }

  noteOff(midiNote: number): void {
    const key = String(midiNote)
    const voice = this.activeVoices.get(key)
    if (!voice) return
    const when = this.now
    voice.gain.gain.cancelScheduledValues(when)
    voice.gain.gain.setTargetAtTime(0.0001, when, 0.08)
    voice.osc1.stop(when + 0.3)
    voice.osc2.stop(when + 0.3)
    this.activeVoices.delete(key)
  }

  /** Stops every currently-sounding note immediately (panic). */
  silence(): void {
    for (const key of Array.from(this.activeVoices.keys())) {
      this.noteOff(Number(key))
    }
  }

  playChord(notes: number[], when: number, duration: number, velocity = 0.75): void {
    for (const n of notes) this.playNote(n, when, duration, velocity)
  }

  /** Schedules `count` pitch classes as successive single notes, each
   * holding most of noteDuration. If `ascending`, each note is pushed up an
   * octave as needed to stay at or above the previous one (arpeggios);
   * otherwise every note uses the same octave as `baseNote` (phrases).
   * Returns the time the last note's slot ends. */
  playSequence(
    pitchClasses: number[],
    baseNote: number,
    ascending: boolean,
    when: number,
    noteDuration: number,
  ): number {
    let t = when
    let last = baseNote - 1
    for (const pc of pitchClasses) {
      let note = baseNote + pitchClass(pc)
      if (ascending) while (note <= last) note += 12
      this.playNote(note, t, noteDuration)
      last = note
      t += noteDuration
    }
    return t
  }

  /** One rootless-voiced chord (piano) + root (bass), same shape as
   * fm1_open's fm1_shed_player_chord(). */
  playVoicedChord(type: ChordType, root: number, variant: Voicing, when: number, duration: number): number {
    const notes = rootlessNotes(type, root, variant)
    this.playChord(notes, when, duration)
    this.playNote(BASS_REGISTER + pitchClass(root), when, duration, 0.85)
    return when + duration
  }

  /** ii-V-I cadence in `key`, same voicings as the original device's
   * stimulus for most exercises. Returns the time it finishes. */
  playCadence(key: number, when: number): number {
    const CHORD_S = 0.85
    let t = when
    t = this.playVoicedChord(ChordType.Min7, pitchClass(key + 2), Voicing.A, t, CHORD_S)
    t = this.playVoicedChord(ChordType.Dom7, pitchClass(key + 7), Voicing.B, t, CHORD_S)
    t = this.playVoicedChord(ChordType.Maj7, key, Voicing.A, t, CHORD_S)
    return t
  }
}

let shared: Synth | null = null
export function getSynth(): Synth {
  if (!shared) shared = new Synth()
  return shared
}

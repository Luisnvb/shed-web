/**
 * Loops a vamp (fm1_open's app/shed/player.c vamp sequencer, SHED_SPEC.md
 * section 6): schedules each step's chord via Synth.playVoicedChord(),
 * alternating rootless voicings A/B for smoother voice leading. Unlike the
 * original device (a fixed 48-event queue, so only ever the current +
 * next step were scheduled), the browser has no such constraint; this
 * keeps a small rolling lookahead window instead, which is simpler and
 * still never over-commits to an "infinite" loop.
 */

import { Synth, Voicing } from './synth'
import { Vamp } from '../core/exercises'
import { pitchClass } from '../core/theory'

const SCHEDULE_AHEAD_S = 1.0
const LOOKAHEAD_MS = 100

export class VampSequencer {
  private synth: Synth
  private vamp: Vamp | null = null
  private key = 0
  private loopStart = 0
  private nextStepTime = 0
  private schedulingIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(synth: Synth) {
    this.synth = synth
  }

  start(vamp: Vamp, key: number): void {
    this.stop()
    this.vamp = vamp
    this.key = pitchClass(key)
    this.loopStart = this.synth.now + 0.05
    this.nextStepTime = this.loopStart
    this.schedulingIndex = 0
    this.running = true
    this.tick()
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
    this.vamp = null
  }

  get isRunning(): boolean {
    return this.running
  }

  private tick(): void {
    if (!this.running || !this.vamp) return
    const vamp = this.vamp
    while (this.nextStepTime < this.synth.now + SCHEDULE_AHEAD_S) {
      const step = vamp.steps[this.schedulingIndex]
      const variant = this.schedulingIndex % 2 === 0 ? Voicing.A : Voicing.B
      this.synth.playVoicedChord(step.chord, pitchClass(this.key + step.offset), variant, this.nextStepTime, step.durationMs / 1000)
      this.nextStepTime += step.durationMs / 1000
      this.schedulingIndex = (this.schedulingIndex + 1) % vamp.steps.length
    }
  }

  /** which: 0 = the step currently sounding, 1 = the one coming up next.
   * Computed from elapsed wall-clock time against the loop's total
   * duration, not from the scheduling lookahead above (which may already
   * be a step or two ahead of what's actually audible right now). */
  currentStepIndex(which: 0 | 1): number {
    if (!this.vamp) return 0
    const vamp = this.vamp
    const total = vamp.steps.reduce((sum, s) => sum + s.durationMs, 0)
    let elapsed = ((this.synth.now - this.loopStart) * 1000) % total
    if (elapsed < 0) elapsed += total
    let acc = 0
    let idx = 0
    for (let i = 0; i < vamp.steps.length; i++) {
      acc += vamp.steps[i].durationMs
      idx = i
      if (elapsed < acc) break
    }
    return which === 0 ? idx : (idx + 1) % vamp.steps.length
  }
}

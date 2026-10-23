import { useEffect, useRef, useState } from 'react'
import {
  VAMPS,
  ExerciseType,
  Rng,
  Question,
  Tension,
  questionGenerate,
  tensionPoolSize,
  tensionPoolAt,
  scalePoolSize,
  scalePoolAt,
  checkTension,
  checkScale,
} from '../core/exercises'
import { ChordType, ScaleType, chordScaleLookup, scalePitchClasses, chordPitchClasses, pitchClass } from '../core/theory'
import { PITCH_NAMES, CHORD_LABELS, SCALE_LABELS, TENSION_LABELS } from '../core/labels'
import { getSynth } from '../audio/synth'
import { VampSequencer } from '../audio/vampSequencer'
import { GUIDE_TONES } from './guideTones'
import Piano from './Piano'
import ChoiceList from './ChoiceList'

enum View {
  Arpeggio = 0,
  Scale,
  Guide,
  None,
}
const VIEW_NAMES = ['Arpeggio', 'Scale', 'Guide (3rd & 7th)', 'None']

interface VampModeProps {
  onExit: () => void
}

export default function VampMode({ onExit }: VampModeProps) {
  const [vampIndex, setVampIndex] = useState(0)
  const [key, setKey] = useState(0)
  const [view, setView] = useState<View>(View.Arpeggio)
  const [running, setRunning] = useState(false)
  const [, tick] = useState(0)
  const [earQuestion, setEarQuestion] = useState<Question | null>(null)
  const [earCorrect, setEarCorrect] = useState<boolean | null>(null)

  const seqRef = useRef<VampSequencer | null>(null)
  const rngRef = useRef(new Rng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0))

  const vamp = VAMPS[vampIndex]

  useEffect(() => {
    seqRef.current = new VampSequencer(getSynth())
    return () => seqRef.current?.stop()
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [running])

  async function start() {
    await getSynth().resume()
    seqRef.current?.start(vamp, key)
    setRunning(true)
  }
  function stop() {
    seqRef.current?.stop()
    setRunning(false)
  }
  function changeVamp(delta: number) {
    const idx = (vampIndex + delta + VAMPS.length) % VAMPS.length
    setVampIndex(idx)
    setEarQuestion(null)
    if (running) seqRef.current?.start(VAMPS[idx], key)
  }
  function changeKey(delta: number) {
    const k = pitchClass(key + delta)
    setKey(k)
    if (running) seqRef.current?.start(vamp, k)
  }
  function exit() {
    stop()
    onExit()
  }

  const nowIdx = seqRef.current?.currentStepIndex(0) ?? 0
  const nextIdx = seqRef.current?.currentStepIndex(1) ?? (vamp.steps.length > 1 ? 1 : 0)
  const nowStep = vamp.steps[nowIdx]
  const nextStep = vamp.steps[nextIdx]
  const nowRoot = pitchClass(key + nowStep.offset)
  const nextRoot = pitchClass(key + nextStep.offset)
  const scaleRow = chordScaleLookup(nowStep.chord, nowStep.context)
  const suggestedScale = scaleRow?.scale ?? null

  function highlights(): { solid: number[]; blink: number[] } {
    const chordTones = chordPitchClasses(nowStep.chord, nowRoot)
    switch (view) {
      case View.Arpeggio: {
        if (suggestedScale === null) return { solid: chordTones, blink: [] }
        const scaleTones = scalePitchClasses(suggestedScale, nowRoot)
        return { solid: chordTones, blink: scaleTones.filter((pc) => !chordTones.includes(pc)) }
      }
      case View.Scale:
        return suggestedScale === null
          ? { solid: chordTones, blink: [] }
          : { solid: scalePitchClasses(suggestedScale, nowRoot), blink: [] }
      case View.Guide: {
        const [third, seventh] = GUIDE_TONES[nowStep.chord]
        return { solid: [pitchClass(nowRoot + third), pitchClass(nowRoot + seventh)], blink: [] }
      }
      case View.None:
      default:
        return { solid: [], blink: [] }
    }
  }
  const { solid, blink } = highlights()

  function startEarRound() {
    const rng = rngRef.current
    if (nowStep.chord === ChordType.Dom7) {
      setEarQuestion(questionGenerate(ExerciseType.Tension, nowRoot, 2, rng))
    } else if (suggestedScale !== null) {
      setEarQuestion({
        type: ExerciseType.Scale,
        key: nowRoot,
        degree: -1,
        chord: ChordType.Count,
        chordRoot: -1,
        interval: 0,
        tension: Tension.Count,
        scale: suggestedScale,
        sequence: [],
        sequenceChord: [],
      })
    }
    setEarCorrect(null)
  }

  function answerEar(value: number) {
    if (!earQuestion) return
    const correct =
      earQuestion.type === ExerciseType.Tension ? checkTension(earQuestion, value) : checkScale(earQuestion, value as ScaleType)
    setEarCorrect(!!correct)
  }

  const tensionOptions = Array.from({ length: tensionPoolSize(2) }, (_, i) => {
    const t = tensionPoolAt(2, i)
    return { value: t, label: TENSION_LABELS[t] }
  })
  const scaleOptions = Array.from({ length: scalePoolSize(2) }, (_, i) => {
    const s = scalePoolAt(2, i)
    return { value: s, label: SCALE_LABELS[s] }
  })

  return (
    <div className="vamp">
      <div className="vamp-row vamp-title">
        <button className="step-button" onClick={() => changeVamp(-1)}>
          &lsaquo;
        </button>
        <span>{vamp.name}</span>
        <button className="step-button" onClick={() => changeVamp(1)}>
          &rsaquo;
        </button>
      </div>

      <div className="vamp-row vamp-key">
        <span className="dim">key</span>
        <button className="step-button" onClick={() => changeKey(-1)}>
          &lsaquo;
        </button>
        <strong>{PITCH_NAMES[key]}</strong>
        <button className="step-button" onClick={() => changeKey(1)}>
          &rsaquo;
        </button>
      </div>

      <p className="vamp-now">
        Now {PITCH_NAMES[nowRoot]} {CHORD_LABELS[nowStep.chord]}
      </p>
      <p className="vamp-next dim">
        Next {PITCH_NAMES[nextRoot]} {CHORD_LABELS[nextStep.chord]}
      </p>
      {suggestedScale !== null && <p className="vamp-scale">Scale {SCALE_LABELS[suggestedScale]}</p>}

      <div className="vamp-view">
        {VIEW_NAMES.map((name, i) => (
          <button key={name} className={`view-button${i === view ? ' active' : ''}`} onClick={() => setView(i)}>
            {name}
          </button>
        ))}
      </div>

      {!running ? (
        <button className="next" onClick={start}>
          Start
        </button>
      ) : (
        <button className="next stop" onClick={stop}>
          Stop
        </button>
      )}

      <Piano lowNote={48} highNote={83} polyphonic highlightSolid={solid} highlightBlink={blink} />
      <p className="hint">Click keys to play along (click again to release).</p>

      <button className="replay" onClick={startEarRound}>
        Ear round
      </button>

      {earQuestion && (
        <div className="ear-overlay">
          <p>{earQuestion.type === ExerciseType.Tension ? 'What tension is it?' : 'What scale is it?'}</p>
          {earCorrect === null ? (
            <ChoiceList options={earQuestion.type === ExerciseType.Tension ? tensionOptions : scaleOptions} onChoose={answerEar} />
          ) : (
            <>
              <p className={earCorrect ? 'correct' : 'incorrect'}>{earCorrect ? 'Correct' : 'Incorrect'}</p>
              <p>
                It was{' '}
                {earQuestion.type === ExerciseType.Tension ? TENSION_LABELS[earQuestion.tension] : SCALE_LABELS[earQuestion.scale]}
              </p>
              <button className="next" onClick={() => setEarQuestion(null)}>
                Close
              </button>
            </>
          )}
        </div>
      )}

      <button className="link-button" onClick={exit}>
        Back to menu
      </button>
    </div>
  )
}

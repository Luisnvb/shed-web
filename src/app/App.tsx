import { useRef, useState } from 'react'
import {
  ExerciseType,
  Rng,
  KeyMode,
  nextKey,
  Question,
  questionGenerate,
  questionGenerateAt,
  degreePoolSize,
  chordPoolSize,
  chordPoolAt,
  tensionPoolSize,
  tensionPoolAt,
  scalePoolSize,
  scalePoolAt,
  checkNote,
  checkChord,
  checkIntervalNote,
  checkTension,
  checkScale,
  checkSequenceNote,
  sequenceDone,
} from '../core/exercises'
import { ChordType, ScaleType, pitchClass } from '../core/theory'
import {
  Session,
  Scores,
  sessionReset,
  sessionRecord,
  sessionDone,
  sessionPercent,
  sessionAdaptLevel,
  scoresReset,
  scoresRecord,
  scoresPick,
} from '../core/progress'
import { PITCH_NAMES, CHORD_LABELS, TENSION_LABELS, SCALE_LABELS, EXERCISE_NAMES, EXERCISE_HINTS } from '../core/labels'
import { getSynth } from '../audio/synth'
import { playStimulus } from './stimulus'
import Piano from './Piano'
import ChoiceList from './ChoiceList'
import VampMode from './Vamp'

type Screen = 'menu' | 'question' | 'feedback' | 'summary' | 'vamp'

const MAX_LEVEL = 2
const POOLED_TYPES = new Set([ExerciseType.Degree, ExerciseType.ChordQuality, ExerciseType.Tension, ExerciseType.Scale])

function poolSizeFor(type: ExerciseType, level: number): number {
  switch (type) {
    case ExerciseType.Degree:
      return degreePoolSize(level)
    case ExerciseType.ChordQuality:
      return chordPoolSize(level)
    case ExerciseType.Tension:
      return tensionPoolSize(level)
    case ExerciseType.Scale:
      return scalePoolSize(level)
    default:
      return 0
  }
}

function answerLabel(q: Question): string {
  switch (q.type) {
    case ExerciseType.Degree:
      return PITCH_NAMES[pitchClass(q.key + q.degree)]
    case ExerciseType.ChordQuality:
      return CHORD_LABELS[q.chord]
    case ExerciseType.IntervalMelodic:
    case ExerciseType.IntervalHarmonic:
      return `${q.interval > 0 ? '+' : ''}${q.interval} semitones`
    case ExerciseType.Tension:
      return TENSION_LABELS[q.tension]
    case ExerciseType.Scale:
      return SCALE_LABELS[q.scale]
    case ExerciseType.Arpeggio:
    case ExerciseType.BassMovement:
    case ExerciseType.MelodicDictation:
      return q.sequence.map((pc) => PITCH_NAMES[pc]).join(' - ')
    default:
      return ''
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [exerciseType, setExerciseType] = useState<ExerciseType>(ExerciseType.Degree)
  const [level, setLevel] = useState(0)
  const [key, setKey] = useState(0)
  const [session, setSession] = useState<Session>(sessionReset())
  const [question, setQuestion] = useState<Question | null>(null)
  const [sequenceProgress, setSequenceProgress] = useState(0)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [reachedLabel, setReachedLabel] = useState<string | null>(null)

  const rngRef = useRef<Rng>(new Rng(1))
  const scoresRef = useRef<Scores>(scoresReset())
  const poolIndexRef = useRef(0)

  function generateQuestion(type: ExerciseType, k: number, lvl: number): Question {
    if (POOLED_TYPES.has(type)) {
      const size = poolSizeFor(type, lvl)
      const idx = scoresPick(scoresRef.current, type, size, rngRef.current)
      poolIndexRef.current = idx
      return questionGenerateAt(type, k, lvl, idx, rngRef.current)!
    }
    return questionGenerate(type, k, lvl, rngRef.current)!
  }

  async function startExercise(type: ExerciseType) {
    await getSynth().resume()
    rngRef.current = new Rng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
    scoresRef.current = scoresReset()
    const s = sessionReset()
    const k = nextKey(0, KeyMode.Random, rngRef.current)
    setSession(s)
    setExerciseType(type)
    setLevel(0)
    setKey(k)
    const q = generateQuestion(type, k, 0)
    setQuestion(q)
    setSequenceProgress(0)
    setReachedLabel(null)
    setScreen('question')
    playStimulus(getSynth(), q)
  }

  function replayStimulus() {
    if (question) playStimulus(getSynth(), question)
  }

  function finishAnswer(correct: boolean, reached?: string) {
    const s = { ...session }
    sessionRecord(s, correct)
    if (question && POOLED_TYPES.has(question.type)) {
      scoresRecord(scoresRef.current, question.type, poolIndexRef.current, correct)
    }
    setLevel((lvl) => sessionAdaptLevel(s, lvl, MAX_LEVEL))
    setSession(s)
    setLastCorrect(correct)
    setReachedLabel(reached ?? null)
    getSynth().silence()
    setScreen('feedback')
  }

  function handlePianoNote(note: number) {
    if (!question || screen !== 'question') return
    if (question.type === ExerciseType.Degree) {
      finishAnswer(!!checkNote(question, note))
      return
    }
    if (question.type === ExerciseType.IntervalMelodic || question.type === ExerciseType.IntervalHarmonic) {
      finishAnswer(!!checkIntervalNote(question, note))
      return
    }
    // Sequence types: Arpeggio, BassMovement, MelodicDictation.
    const result = checkSequenceNote(question, sequenceProgress, note)
    if (result.correct === false) {
      finishAnswer(false, `${sequenceProgress}/${question.sequence.length}`)
      return
    }
    if (result.correct === true) {
      if (sequenceDone(question, result.progress)) {
        finishAnswer(true)
      } else {
        setSequenceProgress(result.progress)
      }
    }
  }

  function handleChoice(value: number) {
    if (!question) return
    switch (question.type) {
      case ExerciseType.ChordQuality:
        finishAnswer(!!checkChord(question, value as ChordType))
        break
      case ExerciseType.Tension:
        finishAnswer(!!checkTension(question, value))
        break
      case ExerciseType.Scale:
        finishAnswer(!!checkScale(question, value as ScaleType))
        break
    }
  }

  function nextQuestion() {
    if (sessionDone(session)) {
      setScreen('summary')
      return
    }
    const k = nextKey(key, KeyMode.Random, rngRef.current)
    setKey(k)
    const q = generateQuestion(exerciseType, k, level)
    setQuestion(q)
    setSequenceProgress(0)
    setScreen('question')
    playStimulus(getSynth(), q)
  }

  function backToMenu() {
    getSynth().silence()
    setScreen('menu')
    setQuestion(null)
  }

  function renderInput() {
    if (!question) return null
    switch (question.type) {
      case ExerciseType.Degree:
        return <Piano lowNote={60} highNote={83} onPlay={handlePianoNote} />
      case ExerciseType.IntervalMelodic:
      case ExerciseType.IntervalHarmonic:
        return <Piano lowNote={36} highNote={96} onPlay={handlePianoNote} />
      case ExerciseType.Arpeggio:
      case ExerciseType.MelodicDictation:
        return <Piano lowNote={48} highNote={83} onPlay={handlePianoNote} />
      case ExerciseType.BassMovement:
        return <Piano lowNote={36} highNote={59} onPlay={handlePianoNote} />
      case ExerciseType.ChordQuality: {
        const size = chordPoolSize(level)
        const options = Array.from({ length: size }, (_, i) => {
          const c = chordPoolAt(level, i)
          return { value: c, label: CHORD_LABELS[c] }
        })
        return <ChoiceList options={options} onChoose={handleChoice} />
      }
      case ExerciseType.Tension: {
        const size = tensionPoolSize(level)
        const options = Array.from({ length: size }, (_, i) => {
          const t = tensionPoolAt(level, i)
          return { value: t, label: TENSION_LABELS[t] }
        })
        return <ChoiceList options={options} onChoose={handleChoice} />
      }
      case ExerciseType.Scale: {
        const size = scalePoolSize(level)
        const options = Array.from({ length: size }, (_, i) => {
          const sc = scalePoolAt(level, i)
          return { value: sc, label: SCALE_LABELS[sc] }
        })
        return <ChoiceList options={options} onChoose={handleChoice} />
      }
      default:
        return null
    }
  }

  return (
    <div className="shed-app">
      <header className="shed-header">
        <h1>Shed</h1>
        <p className="subtitle">Jazz ear training</p>
      </header>

      {screen === 'menu' && (
        <div className="menu">
          {Array.from({ length: ExerciseType.Count }, (_, i) => i as ExerciseType).map((t) => (
            <button key={t} className="menu-item" onClick={() => startExercise(t)}>
              <span className="menu-item-name">{EXERCISE_NAMES[t]}</span>
              <span className="menu-item-hint">{EXERCISE_HINTS[t]}</span>
            </button>
          ))}
          <button className="menu-item" onClick={() => setScreen('vamp')}>
            <span className="menu-item-name">Vamp mode</span>
            <span className="menu-item-hint">Loop a progression and improvise over it.</span>
          </button>
        </div>
      )}

      {screen === 'vamp' && <VampMode onExit={() => setScreen('menu')} />}

      {screen === 'question' && question && (
        <div className="question">
          <div className="question-meta">
            <span>{EXERCISE_NAMES[question.type]}</span>
            <span>
              {session.asked + 1}/20 &middot; key {PITCH_NAMES[key]} &middot; level {level + 1}
            </span>
          </div>
          <p className="hint">{EXERCISE_HINTS[question.type]}</p>
          {(question.type === ExerciseType.Arpeggio ||
            question.type === ExerciseType.BassMovement ||
            question.type === ExerciseType.MelodicDictation) && (
            <p className="progress">
              {sequenceProgress}/{question.sequence.length}
            </p>
          )}
          <button className="replay" onClick={replayStimulus}>
            &#9658; Replay
          </button>
          {renderInput()}
          <button className="link-button" onClick={backToMenu}>
            Back to menu
          </button>
        </div>
      )}

      {screen === 'feedback' && question && (
        <div className="feedback">
          <h2 className={lastCorrect ? 'correct' : 'incorrect'}>{lastCorrect ? 'Correct' : 'Incorrect'}</h2>
          <p>It was {answerLabel(question)}</p>
          {reachedLabel && <p>Reached {reachedLabel}</p>}
          <p>Streak {session.streak}</p>
          <button className="next" onClick={nextQuestion}>
            Next
          </button>
          <button className="link-button" onClick={backToMenu}>
            Back to menu
          </button>
        </div>
      )}

      {screen === 'summary' && (
        <div className="summary">
          <h2>Session complete</h2>
          <p>
            Score {session.correct}/{session.asked} ({sessionPercent(session)}%)
          </p>
          <p>Best streak {session.bestStreak}</p>
          <button className="next" onClick={() => startExercise(exerciseType)}>
            New session
          </button>
          <button className="link-button" onClick={backToMenu}>
            Back to menu
          </button>
        </div>
      )}
    </div>
  )
}

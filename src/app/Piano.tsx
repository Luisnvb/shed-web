import { useEffect, useRef, useState } from 'react'
import { getSynth } from '../audio/synth'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

interface PianoProps {
  lowNote: number
  highNote: number
  /** Monophonic quiz mode (default): fires once, on release, with the
   * note that was played. */
  onPlay?: (note: number) => void
  /** Polyphonic free-play mode (Vamp mode): each key click toggles that
   * note on/off (rather than requiring the key to be held down), so
   * chords can be built up one click at a time with a single mouse. */
  polyphonic?: boolean
  /** pitch classes or absolute notes to highlight solid (e.g. the answer
   * so far, or Vamp mode's chord/scale tones). */
  highlightSolid?: number[]
  /** pitch classes or absolute notes to highlight with a slow blink
   * (Vamp mode's "the rest of the suggested scale" guidance). */
  highlightBlink?: number[]
}

export default function Piano({
  lowNote,
  highNote,
  onPlay,
  polyphonic = false,
  highlightSolid = [],
  highlightBlink = [],
}: PianoProps) {
  const held = useRef<Set<number>>(new Set())
  const [, rerender] = useState(0)
  const [blinkOn, setBlinkOn] = useState(true)

  useEffect(() => {
    if (highlightBlink.length === 0) return
    const id = setInterval(() => setBlinkOn((v) => !v), 450)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightBlink.length > 0])

  const whiteKeys: number[] = []
  for (let n = lowNote; n <= highNote; n++) {
    if (!BLACK.has(n % 12)) whiteKeys.push(n)
  }
  const whiteWidth = 36

  function noteOn(note: number) {
    held.current.add(note)
    const synth = getSynth()
    synth.resume().then(() => synth.noteOn(note))
    rerender((n) => n + 1)
  }
  function noteOff(note: number) {
    if (!held.current.has(note)) return
    held.current.delete(note)
    getSynth().noteOff(note)
    rerender((n) => n + 1)
  }

  function handlePress(note: number) {
    if (polyphonic) {
      if (held.current.has(note)) noteOff(note)
      else noteOn(note)
    } else {
      noteOn(note)
    }
  }
  function handleRelease(note: number) {
    if (polyphonic) return // toggle mode: release does nothing
    if (!held.current.has(note)) return
    noteOff(note)
    onPlay?.(note)
  }
  function releaseAllMono() {
    if (polyphonic) return
    for (const note of Array.from(held.current)) handleRelease(note)
  }

  function keyLabel(note: number): string {
    const name = NOTE_NAMES[note % 12]
    const octave = Math.floor(note / 12) - 1
    return name === 'C' ? `C${octave}` : ''
  }

  function keyState(note: number): string {
    const classes: string[] = []
    if (held.current.has(note)) classes.push('is-held')
    if (highlightSolid.includes(note) || highlightSolid.includes(note % 12)) classes.push('is-answer')
    else if (blinkOn && (highlightBlink.includes(note) || highlightBlink.includes(note % 12))) classes.push('is-answer')
    return classes.join(' ')
  }

  return (
    <div className="piano" onMouseLeave={releaseAllMono}>
      <div className="piano-white-row" style={{ width: whiteKeys.length * whiteWidth }}>
        {whiteKeys.map((note) => (
          <div
            key={note}
            className={`piano-key white ${keyState(note)}`}
            style={{ width: whiteWidth }}
            onMouseDown={() => handlePress(note)}
            onMouseUp={() => handleRelease(note)}
            onTouchStart={(e) => {
              e.preventDefault()
              handlePress(note)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              handleRelease(note)
            }}
          >
            <span className="piano-key-label">{keyLabel(note)}</span>
          </div>
        ))}
        {whiteKeys.map((note, i) => {
          const sharp = note + 1
          if (BLACK.has(sharp % 12) && sharp <= highNote) {
            return (
              <div
                key={sharp}
                className={`piano-key black ${keyState(sharp)}`}
                style={{ left: i * whiteWidth + whiteWidth * 0.68, width: whiteWidth * 0.64 }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handlePress(sharp)
                }}
                onMouseUp={(e) => {
                  e.stopPropagation()
                  handleRelease(sharp)
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePress(sharp)
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleRelease(sharp)
                }}
              />
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

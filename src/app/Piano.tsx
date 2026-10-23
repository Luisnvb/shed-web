import { useRef } from 'react'
import { getSynth } from '../audio/synth'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])

interface PianoProps {
  lowNote: number
  highNote: number
  onPlay: (note: number) => void
  highlight?: number[] // pitch classes or absolute notes to highlight (e.g. the answer so far)
}

export default function Piano({ lowNote, highNote, onPlay, highlight = [] }: PianoProps) {
  const heldNote = useRef<number | null>(null)

  const whiteKeys: number[] = []
  for (let n = lowNote; n <= highNote; n++) {
    if (!BLACK.has(n % 12)) whiteKeys.push(n)
  }
  const whiteWidth = 36

  function press(note: number) {
    heldNote.current = note
    const synth = getSynth()
    synth.resume().then(() => synth.noteOn(note))
  }
  function release() {
    if (heldNote.current === null) return
    getSynth().noteOff(heldNote.current)
    onPlay(heldNote.current)
    heldNote.current = null
  }

  function keyLabel(note: number): string {
    const name = NOTE_NAMES[note % 12]
    const octave = Math.floor(note / 12) - 1
    return name === 'C' ? `C${octave}` : ''
  }

  return (
    <div className="piano" onMouseLeave={() => heldNote.current !== null && release()}>
      <div className="piano-white-row" style={{ width: whiteKeys.length * whiteWidth }}>
        {whiteKeys.map((note) => (
          <div
            key={note}
            className={`piano-key white${highlight.includes(note) || highlight.includes(note % 12) ? ' is-answer' : ''}`}
            style={{ width: whiteWidth }}
            onMouseDown={() => press(note)}
            onMouseUp={release}
            onTouchStart={(e) => {
              e.preventDefault()
              press(note)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              release()
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
                className={`piano-key black${highlight.includes(sharp) || highlight.includes(sharp % 12) ? ' is-answer' : ''}`}
                style={{ left: i * whiteWidth + whiteWidth * 0.68, width: whiteWidth * 0.64 }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  press(sharp)
                }}
                onMouseUp={(e) => {
                  e.stopPropagation()
                  release()
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  press(sharp)
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  release()
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

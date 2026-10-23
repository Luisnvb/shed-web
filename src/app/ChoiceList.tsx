interface ChoiceListProps {
  options: { value: number; label: string }[]
  onChoose: (value: number) => void
  disabled?: boolean
}

export default function ChoiceList({ options, onChoose, disabled }: ChoiceListProps) {
  return (
    <div className="choice-grid">
      {options.map((opt) => (
        <button
          key={opt.value}
          className="choice-button"
          disabled={disabled}
          onClick={() => onChoose(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

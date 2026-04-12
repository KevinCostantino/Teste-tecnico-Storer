interface TimePickerInputProps {
  value: string
  onChange: (value: string) => void
}

export const TimePickerInput = ({ value, onChange }: TimePickerInputProps): JSX.Element => {
  return (
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        background: '#12151b',
        color: '#f7f9fc',
        border: '1px solid #2b3443',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    />
  )
}

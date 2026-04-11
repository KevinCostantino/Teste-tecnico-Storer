interface TimePickerInputProps {
  value: string
  onChange: (value: string) => void
}

export const TimePickerInput = ({ value, onChange }: TimePickerInputProps): JSX.Element => {
  return <input type="time" value={value} onChange={(event) => onChange(event.target.value)} />
}

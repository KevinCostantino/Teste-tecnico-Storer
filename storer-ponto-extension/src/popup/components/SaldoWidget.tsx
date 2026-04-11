import type { SaldoMes } from '../../types/ponto.types'

interface SaldoWidgetProps {
  saldo: SaldoMes | null
}

const formatMinutes = (minutes: number): string => {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

export const SaldoWidget = ({ saldo }: SaldoWidgetProps): JSX.Element => {
  if (!saldo) {
    return <section className="card">Saldo indisponivel</section>
  }

  const positive = saldo.saldoMinutos >= 0

  return (
    <section className="card">
      <h2>Saldo do mes</h2>
      <strong style={{ color: positive ? '#16653c' : '#a3332a' }}>{formatMinutes(saldo.saldoMinutos)}</strong>
    </section>
  )
}

import type { Batida } from '../../types/ponto.types'

interface BatidaItemProps {
  batida: Batida
}

export const BatidaItem = ({ batida }: BatidaItemProps): JSX.Element => {
  const time = new Date(batida.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li className="list-item">
      <span>{batida.tipo}</span>
      <strong>{time}</strong>
    </li>
  )
}

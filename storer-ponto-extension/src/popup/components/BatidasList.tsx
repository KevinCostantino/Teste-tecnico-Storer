import type { Batida } from '../../types/ponto.types'

interface BatidasListProps {
  batidas: Batida[]
  loading: boolean
  onRefresh: () => Promise<void>
}

const formatHour = (timestamp: string): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export const BatidasList = ({ batidas, loading, onRefresh }: BatidasListProps): JSX.Element => {
  if (loading) {
    return (
      <section className="card" aria-busy="true" aria-label="Carregando batidas">
        <div className="section-header">
          <h2>Batidas de hoje</h2>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skeleton-line" style={{ width: i === 2 ? '60%' : '100%' }} />
        ))}
      </section>
    )
  }

  if (!batidas.length) {
    return (
      <div className="card">
        <h2>Batidas de hoje</h2>
        <p>Nenhuma batida registrada hoje.</p>
        <button className="button-secondary" onClick={() => void onRefresh()}>
          Atualizar
        </button>
      </div>
    )
  }

  return (
    <section className="card">
      <div className="section-header">
        <h2>Batidas de hoje</h2>
        <button className="button-secondary" onClick={() => void onRefresh()}>
          Atualizar
        </button>
      </div>
      <ul className="list">
        {batidas.map((batida) => (
          <li className="list-item" key={batida.id}>
            <span>{batida.tipo}</span>
            <strong>{formatHour(batida.timestamp)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

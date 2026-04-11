interface BaterPontoButtonProps {
  loading: boolean
  onClick: () => Promise<void>
}

export const BaterPontoButton = ({ loading, onClick }: BaterPontoButtonProps): JSX.Element => {
  return (
    <button className="button-primary" disabled={loading} onClick={() => void onClick()}>
      {loading ? 'Registrando...' : 'Bater Ponto'}
    </button>
  )
}

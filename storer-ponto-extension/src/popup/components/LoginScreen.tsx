import { useState } from 'react'

interface LoginScreenProps {
  onLogin: () => Promise<void>
}

export const LoginScreen = ({ onLogin }: LoginScreenProps): JSX.Element => {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (): Promise<void> => {
    setSubmitting(true)
    setError(null)

    try {
      await onLogin()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel autenticar agora. Tente novamente.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>Storer Ponto</h1>
      <p>Entre com sua conta corporativa para registrar ponto.</p>
      <button className="button-primary" disabled={submitting} onClick={() => void handleLogin()}>
        {submitting ? 'Entrando...' : 'Entrar com conta Storer'}
      </button>
      {error ? <div className="toast">{error}</div> : null}
    </section>
  )
}

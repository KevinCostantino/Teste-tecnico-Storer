import { useMemo } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'
import { useAuth } from './hooks/useAuth'

export const App = (): JSX.Element => {
  const { loading, isAuthenticated, login } = useAuth()

  const content = useMemo(() => {
    if (loading) {
      return <div className="loading">Carregando sessao...</div>
    }

    if (!isAuthenticated) {
      return <LoginScreen onLogin={login} />
    }

    return <MainScreen />
  }, [isAuthenticated, loading, login])

  return <main className="popup-container">{content}</main>
}

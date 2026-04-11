import { useCallback, useEffect, useState } from 'react'
import { AuthService } from '../../services/AuthService'

interface UseAuthResult {
  loading: boolean
  isAuthenticated: boolean
  login: () => Promise<void>
}

export const useAuth = (): UseAuthResult => {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const loadAuthState = useCallback(async (): Promise<void> => {
    setLoading(true)
    const status = await AuthService.isAuthenticated()
    setIsAuthenticated(status)
    setLoading(false)
  }, [])

  const login = useCallback(async (): Promise<void> => {
    await AuthService.startLoginFlow()
    setIsAuthenticated(true)
  }, [])

  useEffect(() => {
    void loadAuthState()
  }, [loadAuthState])

  return {
    loading,
    isAuthenticated,
    login,
  }
}

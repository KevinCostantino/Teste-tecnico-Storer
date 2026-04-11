import { useCallback, useEffect, useState } from 'react'
import { AuthService } from '../../services/AuthService'
import { HttpRequestError } from '../../services/HttpClient'
import { PontoService } from '../../services/PontoService'
import { StorageService } from '../../services/StorageService'
import type { Batida, SaldoMes } from '../../types/ponto.types'
import { BatidasList } from './BatidasList'
import { BaterPontoButton } from './BaterPontoButton'
import { SaldoWidget } from './SaldoWidget'
import { ToastNotification } from './ToastNotification'
import { UserMenu } from './UserMenu'

export const MainScreen = (): JSX.Element => {
  const [loading, setLoading] = useState(false)
  const [batidas, setBatidas] = useState<Batida[]>([])
  const [batidasLoading, setBatidasLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [userName, setUserName] = useState('Colaborador')
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [saldo, setSaldo] = useState<SaldoMes | null>(null)

  const messageFromError = (error: unknown, fallback: string): string => {
    if (error instanceof HttpRequestError) {
      if (error.type === 'timeout') {
        return 'A operacao demorou demais. Tente novamente.'
      }

      if (error.type === 'network') {
        return 'Falha de conexao. Verifique sua internet e tente novamente.'
      }

      if (error.type === 'unauthorized') {
        return 'Sua sessao expirou. Faça login novamente.'
      }
    }

    return fallback
  }

  const loadUser = useCallback(async (): Promise<void> => {
    const tokens = await AuthService.getTokens()
    if (tokens?.userDisplayName) {
      setUserName(tokens.userDisplayName)
    }
  }, [])

  const loadBatidas = useCallback(async (forceRefresh = false): Promise<void> => {
    setBatidasLoading(true)

    try {
      const items = await PontoService.getBatidasDia(undefined, { forceRefresh })
      setBatidas(items.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)))
    } catch (error) {
      setToast(messageFromError(error, 'Nao foi possivel carregar batidas agora.'))
    } finally {
      setBatidasLoading(false)
    }
  }, [])

  const loadSaldo = useCallback(async (): Promise<void> => {
    try {
      const mesAno = new Date().toISOString().slice(0, 7) // "YYYY-MM"
      const result = await PontoService.getSaldo(mesAno)
      setSaldo(result)
    } catch {
      // Saldo indisponivel nao bloqueia o popup
    }
  }, [])

  const loadOfflineQueueCount = useCallback(async (): Promise<void> => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_OFFLINE_QUEUE_COUNT',
      })) as { count?: number; lastSyncAt?: number } | undefined

      setOfflineQueueCount(response?.count ?? 0)
      setLastSyncAt(response?.lastSyncAt ?? null)
    } catch {
      // Ignora erro quando o background ainda nao respondeu.
    }
  }, [])

  const handleBaterPonto = async (): Promise<void> => {
    setLoading(true)
    setRegisterError(null)

    let geolocation: { latitude: number; longitude: number } | undefined

    try {
      const config = await StorageService.getConfig()

      if (config.geolocalizacaoHabilitada && navigator.geolocation) {
        geolocation = await new Promise<{ latitude: number; longitude: number } | undefined>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(undefined), // Permissao negada ou indisponivel — registra sem localizacao
            { timeout: 5000 },
          )
        })
      }
    } catch {
      // Nao bloquear o registro por falha de config/geo
    }

    try {
      const response = await PontoService.registrarBatida(geolocation)

      if ('queued' in response && response.queued) {
        setToast('Sem conexao no momento. Batida salva na fila para sincronizacao automatica.')
        await loadOfflineQueueCount()
        return
      }

      setToast(`Ponto registrado! ${new Date(response.timestamp).toLocaleTimeString('pt-BR')} - ${response.tipo}`)
      await loadBatidas()
    } catch (error) {
      setRegisterError(messageFromError(error, 'Falha ao registrar. Verifique sua conexao.'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async (): Promise<void> => {
    await AuthService.logout()
    window.location.reload()
  }

  const handleForceSync = async (): Promise<void> => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return
    }

    setSyncing(true)

    try {
      const response = (await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' })) as
        | { count?: number; lastSyncAt?: number }
        | undefined

      setOfflineQueueCount(response?.count ?? 0)
      setLastSyncAt(response?.lastSyncAt ?? null)
      setToast('Sincronizacao concluida!')
    } catch {
      setToast('Nao foi possivel sincronizar agora.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    void loadUser()
    void loadBatidas()
    void loadOfflineQueueCount()
    void loadSaldo()
  }, [loadBatidas, loadOfflineQueueCount, loadSaldo, loadUser])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return
    }

    const handler = (message: unknown): void => {
      const payload = message as { count?: number; type?: string } | undefined

      if (payload?.type === 'OFFLINE_QUEUE_COUNT_CHANGED') {
        setOfflineQueueCount(payload.count ?? 0)
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => {
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <>
      <UserMenu userName={userName} onLogout={handleLogout} />
      <section className="card">
        <BaterPontoButton loading={loading} onClick={handleBaterPonto} />
      </section>
      {offlineQueueCount > 0 || lastSyncAt ? (
        <section className="card queue-card">
          {offlineQueueCount > 0 ? (
            <p>
              {offlineQueueCount === 1
                ? '1 batida pendente aguardando sincronizacao.'
                : `${offlineQueueCount} batidas pendentes aguardando sincronizacao.`}
            </p>
          ) : null}
          {lastSyncAt ? (
            <p className="queue-card__sync-time">
              Ultima sincronizacao: {new Date(lastSyncAt).toLocaleTimeString('pt-BR')}
            </p>
          ) : null}
          {offlineQueueCount > 0 ? (
            <button
              className="button-secondary"
              disabled={syncing}
              onClick={() => void handleForceSync()}
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
          ) : null}
        </section>
      ) : null}
      {registerError ? (
        <section className="card error-card">
          <p>{registerError}</p>
          <button className="button-secondary" onClick={() => void handleBaterPonto()}>
            Tentar novamente
          </button>
        </section>
      ) : null}
      <BatidasList batidas={batidas} loading={batidasLoading} onRefresh={() => loadBatidas(true)} />
      <SaldoWidget saldo={saldo} />
      {toast ? <ToastNotification message={toast} /> : null}
    </>
  )
}

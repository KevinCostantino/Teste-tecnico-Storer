import { HttpClient, HttpRequestError } from './HttpClient'
import type {
  Batida,
  RegistrarBatidaRequest,
  RegistrarBatidaResponse,
  RegistrarBatidaResult,
  SaldoMes,
} from '../types/ponto.types'

const client = new HttpClient()
const BATIDAS_CACHE_TTL_MS = 30_000

interface BatidasCacheEntry {
  data: Batida[]
  expiresAt: number
}

export class PontoService {
  private static batidasCache = new Map<string, BatidasCacheEntry>()

  private static async enqueueOfflineBatida(payload: RegistrarBatidaRequest): Promise<void> {
    await chrome.runtime.sendMessage({
      type: 'QUEUE_BATIDA',
      payload,
    })
  }

  static async registrarBatida(
    geolocation?: RegistrarBatidaRequest['geolocation'],
  ): Promise<RegistrarBatidaResult> {
    const payload: RegistrarBatidaRequest = {
      timestamp: new Date().toISOString(),
      geolocation,
    }

    if (!navigator.onLine) {
      await this.enqueueOfflineBatida(payload)
      return {
        queued: true,
        timestamp: payload.timestamp,
      }
    }

    try {
      const result = await client.request<RegistrarBatidaResponse>('POST', '/v1/ponto/batidas', payload)
      const today = new Date().toISOString().slice(0, 10)
      this.batidasCache.delete(today)
      return result
    } catch (error) {
      if (error instanceof HttpRequestError && error.type === 'network') {
        await this.enqueueOfflineBatida(payload)
        return {
          queued: true,
          timestamp: payload.timestamp,
        }
      }

      throw error
    }
  }

  static async getBatidasDia(data?: string, options?: { forceRefresh?: boolean }): Promise<Batida[]> {
    const today = data ?? new Date().toISOString().slice(0, 10)
    const forceRefresh = options?.forceRefresh ?? false
    const cached = this.batidasCache.get(today)

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.data
    }

    const dataFromApi = await client.request<Batida[]>('GET', `/v1/ponto/batidas?data=${today}`)
    this.batidasCache.set(today, {
      data: dataFromApi,
      expiresAt: Date.now() + BATIDAS_CACHE_TTL_MS,
    })

    return dataFromApi
  }

  static async getSaldo(mesAno: string): Promise<SaldoMes> {
    return client.request<SaldoMes>('GET', `/v1/ponto/saldo?mes=${mesAno}`)
  }
}

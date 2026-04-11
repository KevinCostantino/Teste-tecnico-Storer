import {
  API_RETRY_ATTEMPTS,
  API_RETRY_DELAYS_MS,
  API_TIMEOUT_MS,
  DEFAULT_API_BASE_URL,
} from '../constants/api.constants'
import { AuthService } from './AuthService'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HttpRequestErrorType = 'http' | 'network' | 'timeout' | 'unauthorized' | 'unknown'

interface HttpClientOptions {
  baseUrl?: string
}

export class HttpRequestError extends Error {
  readonly type: HttpRequestErrorType
  readonly status?: number

  constructor(type: HttpRequestErrorType, message: string, status?: number) {
    super(message)
    this.name = 'HttpRequestError'
    this.type = type
    this.status = status
  }
}

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const normalizeError = (error: unknown): HttpRequestError => {
  if (error instanceof HttpRequestError) {
    return error
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new HttpRequestError('timeout', 'A requisicao excedeu o tempo limite.')
  }

  if (error instanceof TypeError) {
    return new HttpRequestError('network', 'Falha de rede durante a requisicao.')
  }

  if (error instanceof Error) {
    return new HttpRequestError('unknown', error.message)
  }

  return new HttpRequestError('unknown', 'Erro desconhecido na requisicao.')
}

export class HttpClient {
  private static refreshInFlight: Promise<void> | null = null

  private readonly baseUrl: string

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL
  }

  private async waitForRefresh(): Promise<void> {
    if (!HttpClient.refreshInFlight) {
      HttpClient.refreshInFlight = (async () => {
        await AuthService.refreshTokens()
      })().finally(() => {
        HttpClient.refreshInFlight = null
      })
    }

    await HttpClient.refreshInFlight
  }

  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    let attempt = 0

    while (attempt <= API_RETRY_ATTEMPTS) {
      let timeout: ReturnType<typeof setTimeout> | null = null

      try {
        const tokens = await AuthService.getTokens()
        const controller = new AbortController()
        timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        if (timeout) {
          clearTimeout(timeout)
        }

        if (response.status === 401) {
          try {
            await this.waitForRefresh()
          } catch {
            throw new HttpRequestError('unauthorized', 'Sessao expirada. Faça login novamente.', 401)
          }

          attempt += 1
          continue
        }

        if (!response.ok) {
          throw new HttpRequestError('http', `Falha HTTP ${response.status}`, response.status)
        }

        if (response.status === 204) {
          return undefined as T
        }

        return (await response.json()) as T
      } catch (error) {
        const normalizedError = normalizeError(error)

        if (timeout) {
          clearTimeout(timeout)
        }

        if (attempt >= API_RETRY_ATTEMPTS) {
          throw normalizedError
        }

        await wait(API_RETRY_DELAYS_MS[attempt] ?? 4_000)
        attempt += 1
      }
    }

    throw new Error('Falha ao executar requisicao HTTP')
  }
}

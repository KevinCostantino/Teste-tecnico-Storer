import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpClient, HttpRequestError } from '../../src/services/HttpClient'

const { mockGetTokens, mockRefreshTokens } = vi.hoisted(() => ({
  mockGetTokens: vi.fn(),
  mockRefreshTokens: vi.fn(),
}))

vi.mock('../../src/services/AuthService', () => ({
  AuthService: {
    getTokens: mockGetTokens,
    refreshTokens: mockRefreshTokens,
  },
}))

vi.mock('../../src/constants/api.constants', () => ({
  API_RETRY_ATTEMPTS: 2,
  API_RETRY_DELAYS_MS: [1000, 2000],
  API_TIMEOUT_MS: 10000,
  DEFAULT_API_BASE_URL: 'https://ponto-api-test.storer.com.br',
}))

describe('HttpClient', () => {
  let httpClient: HttpClient

  beforeEach(() => {
    vi.restoreAllMocks()

    httpClient = new HttpClient({ baseUrl: 'https://ponto-api-test.storer.com.br' })

    mockGetTokens.mockResolvedValue({
      accessToken: 'token-test-123',
      refreshToken: 'refresh-test',
      idToken: 'id-token',
      expiresAt: Date.now() + 3600000,
      userId: 'user-1',
      userEmail: 'test@storer.com.br',
      userDisplayName: 'Test User',
    })
  })

  it('faz requisição com Authorization header automaticamente', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: '1', timestamp: '2026-04-11T08:00:00Z', tipo: 'ENTRADA' }),
    }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    await httpClient.request('GET', '/v1/ponto/batidas')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      Record<string, unknown> & { headers: Record<string, string> },
    ]
    expect(url).toContain('/v1/ponto/batidas')
    expect(options.headers).toHaveProperty('Authorization')
    expect(options.headers.Authorization).toBe('Bearer token-test-123')
  })

  it('envia JSON no body para POST', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: '2' }),
    }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    const body = { timestamp: '2026-04-11T08:30:00Z' }
    await httpClient.request('POST', '/v1/ponto/batidas', body)

    const [, options] = fetchMock.mock.calls[0] as [
      string,
      Record<string, unknown> & { method: string; body: string; headers: Record<string, string> },
    ]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(body))
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('faz retry automático até 2x com backoff exponencial', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    fetchMock.mockRejectedValueOnce(new Error('connection failed'))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    const result = await httpClient.request('GET', '/v1/ponto/batidas')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ success: true })
  })

  it('lança HttpRequestError em falha depois de 2 retries', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('persistent network error')
    })

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    await expect(httpClient.request('GET', '/v1/ponto/batidas')).rejects.toThrow(
      HttpRequestError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('lança HttpRequestError do tipo "http" em status 500', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    try {
      await httpClient.request('GET', '/v1/ponto/batidas')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpRequestError)
      expect((err as HttpRequestError).type).toBe('http')
    }
  })

  it('lança HttpRequestError do tipo "timeout" em AbortError', async () => {
    const errorAbort = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn(async () => {
      throw errorAbort
    })

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    try {
      await httpClient.request('GET', '/v1/ponto/batidas')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpRequestError)
      expect((err as HttpRequestError).type).toBe('timeout')
    }
  })

  it('tenta fazer refresh em 401 Unauthorized', async () => {
    let callCount = 0
    const fetchMock = vi.fn(async () => {
      callCount++
      if (callCount === 1) {
        return { ok: false, status: 401, statusText: 'Unauthorized' }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: '1' }),
      }
    })

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    mockRefreshTokens.mockResolvedValueOnce(undefined)

    const result = (await httpClient.request('GET', '/v1/ponto/batidas')) as Record<string, string>

    expect(result.id).toBe('1')
    expect(mockRefreshTokens).toHaveBeenCalled()
  })

  it('retorna undefined para status 204 No Content', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
    }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    const result = await httpClient.request('DELETE', '/v1/ponto/batidas/123')

    expect(result).toBeUndefined()
  })
})

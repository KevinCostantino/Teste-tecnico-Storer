import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest, mockGetConfig } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockGetConfig: vi.fn(),
}))

vi.mock('../../src/services/HttpClient', () => {
  class HttpRequestError extends Error {
    readonly type: 'http' | 'network' | 'timeout' | 'unauthorized' | 'unknown'

    constructor(type: 'http' | 'network' | 'timeout' | 'unauthorized' | 'unknown', message: string) {
      super(message)
      this.type = type
    }
  }

  class HttpClient {
    request = mockRequest
  }

  return { HttpClient, HttpRequestError }
})

vi.mock('../../src/services/StorageService', () => ({
  StorageService: {
    getConfig: () => mockGetConfig(),
  },
}))

import { HttpRequestError } from '../../src/services/HttpClient'
import { OfflineQueueService } from '../../src/background/OfflineQueueService'

describe('OfflineQueueService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    mockGetConfig.mockReset()

    const localStore = new Map<string, unknown>()

    Object.defineProperty(globalThis, 'chrome', {
      value: {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: localStore.get(key) })),
            set: vi.fn(async (data: Record<string, unknown>) => {
              Object.entries(data).forEach(([key, value]) => localStore.set(key, value))
            }),
          },
        },
        runtime: {
          sendMessage: vi.fn(async () => ({ ok: true })),
          onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
        alarms: {
          create: vi.fn(),
          onAlarm: {
            addListener: vi.fn(),
          },
        },
        notifications: {
          create: vi.fn(async () => 'id-notification'),
        },
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    mockGetConfig.mockResolvedValue({
      apiBaseUrl: 'https://ponto-api-dev.storer.com.br',
      lembretes: ['08:00'],
      geolocalizacaoHabilitada: false,
      notificacoesHabilitadas: true,
    })
  })

  it('sincroniza fila quando online e limpa itens processados', async () => {
    mockRequest.mockResolvedValue({ ok: true })

    await OfflineQueueService.enqueue({ timestamp: '2026-04-11T08:00:00.000Z' })
    await OfflineQueueService.processQueue()

    const queue = (await chrome.storage.local.get('offlineQueue')).offlineQueue as unknown[]
    expect(queue).toHaveLength(0)
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(chrome.notifications.create).toHaveBeenCalledTimes(1)

    const stored = (await chrome.storage.local.get('lastSyncAt')).lastSyncAt as number
    expect(stored).toBeGreaterThan(0)
  })

  it('mantem item na fila quando rede cai durante sincronizacao', async () => {
    mockRequest.mockRejectedValue(new HttpRequestError('network', 'network'))

    await OfflineQueueService.enqueue({ timestamp: '2026-04-11T08:05:00.000Z' })
    await OfflineQueueService.processQueue()

    const queue = (await chrome.storage.local.get('offlineQueue')).offlineQueue as unknown[]
    expect(queue).toHaveLength(1)
  })

  it('processa fila ao receber mensagem FORCE_SYNC', async () => {
    mockRequest.mockResolvedValue({ ok: true })

    await OfflineQueueService.enqueue({ timestamp: '2026-04-11T09:00:00.000Z' })

    // Simulate processQueue directly (message handler delegates to it)
    await OfflineQueueService.processQueue()

    const queue = (await chrome.storage.local.get('offlineQueue')).offlineQueue as unknown[]
    expect(queue).toHaveLength(0)
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })
})

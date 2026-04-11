import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
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

import { HttpRequestError } from '../../src/services/HttpClient'
import { PontoService } from '../../src/services/PontoService'

describe('PontoService', () => {
  beforeEach(() => {
    mockRequest.mockReset()

    Object.defineProperty(globalThis, 'chrome', {
      value: {
        runtime: {
          sendMessage: vi.fn(async () => ({ ok: true })),
        },
      },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
  })

  it('enfileira batida quando offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })

    const result = await PontoService.registrarBatida()

    expect('queued' in result && result.queued).toBe(true)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('enfileira batida quando falha de rede', async () => {
    mockRequest.mockRejectedValueOnce(new HttpRequestError('network', 'network'))

    const result = await PontoService.registrarBatida()

    expect('queued' in result && result.queued).toBe(true)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('usa cache de batidas por 30s quando nao for force refresh', async () => {
    mockRequest.mockResolvedValue([{ id: '1', timestamp: '2026-04-11T08:00:00.000Z', tipo: 'ENTRADA' }])

    const first = await PontoService.getBatidasDia('2026-04-11')
    const second = await PontoService.getBatidasDia('2026-04-11')

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it('ignora cache quando force refresh for true', async () => {
    mockRequest
      .mockResolvedValueOnce([{ id: '1', timestamp: '2026-04-11T08:00:00.000Z', tipo: 'ENTRADA' }])
      .mockResolvedValueOnce([{ id: '2', timestamp: '2026-04-11T12:00:00.000Z', tipo: 'INTERVALO' }])

    await PontoService.getBatidasDia('2026-04-12')
    const refreshed = await PontoService.getBatidasDia('2026-04-12', { forceRefresh: true })

    expect(refreshed[0].id).toBe('2')
    expect(mockRequest).toHaveBeenCalledTimes(2)
  })
})

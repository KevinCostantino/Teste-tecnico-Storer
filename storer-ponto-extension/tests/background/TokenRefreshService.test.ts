import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRefreshTokens, mockGetTokens, mockClearTokens } = vi.hoisted(() => ({
  mockRefreshTokens: vi.fn(),
  mockGetTokens: vi.fn(),
  mockClearTokens: vi.fn(),
}))

vi.mock('../../src/services/AuthService', () => ({
  AuthService: {
    refreshTokens: mockRefreshTokens,
    getTokens: mockGetTokens,
    clearTokens: mockClearTokens,
  },
}))

vi.mock('../../src/constants/auth.constants', () => ({
  TOKEN_REFRESH_BUFFER_MS: 60000,
  TOKEN_REFRESH_ALARM_NAME: 'TOKEN_REFRESH_CHECK',
  TOKEN_REFRESH_ALARM_PERIOD_MINUTES: 0.5,
  ZITADEL_DOMAIN: 'https://auth-dev.storer.com.br',
}))

import type { TokenSet } from '../../src/types/auth.types'
import { TokenRefreshService } from '../../src/background/TokenRefreshService'

describe('TokenRefreshService', () => {
  const mockTokenSet: TokenSet = {
    accessToken: 'access-123',
    refreshToken: 'refresh-123',
    idToken: 'id-123',
    expiresAt: Date.now() + 3600000,
    userId: 'user-1',
    userEmail: 'user@storer.com.br',
    userDisplayName: 'User Test',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    const alarmListeners: Array<(alarm: chrome.alarms.Alarm) => void> = []

    const chromeMock = {
      alarms: {
        create: vi.fn(),
        clear: vi.fn(),
        onAlarm: {
          addListener: vi.fn((listener) => {
            alarmListeners.push(listener)
          }),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: vi.fn(async () => undefined),
        onMessage: {
          addListener: vi.fn(),
        },
      },
    }

    Object.defineProperty(globalThis, 'chrome', {
      value: chromeMock,
      configurable: true,
      writable: true,
    })

    mockGetTokens.mockResolvedValue(mockTokenSet)
    mockRefreshTokens.mockResolvedValue(undefined)
    mockClearTokens.mockResolvedValue(undefined)
  })

  it('registra alarme ao chamar start()', () => {
    TokenRefreshService.start()

    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'TOKEN_REFRESH_CHECK',
      expect.objectContaining({
        periodInMinutes: 0.5,
      }),
    )
  })

  it('ao receber alarme TOKEN_REFRESH_CHECK, executa checkAndRefresh()', async () => {
    const checkSpy = vi.spyOn(TokenRefreshService, 'checkAndRefresh')
    TokenRefreshService.start()

    // Obtém o listener que foi registrado
    const alarmListener = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as (alarm: chrome.alarms.Alarm) => Promise<void>

    // Simula o disparo do alarme
    await alarmListener({ name: 'TOKEN_REFRESH_CHECK' } as chrome.alarms.Alarm)

    expect(checkSpy).toHaveBeenCalled()
  })

  it('checkAndRefresh() chama refreshTokens quando token expira em menos de 60s', async () => {
    mockGetTokens.mockResolvedValueOnce({
      ...mockTokenSet,
      expiresAt: Date.now() + 30000, // expira em 30s (dentro do buffer de 60s)
    })

    await TokenRefreshService.checkAndRefresh()

    expect(mockRefreshTokens).toHaveBeenCalled()
  })

  it('checkAndRefresh() não chama refreshTokens quando token tem > 60s de validade', async () => {
    mockGetTokens.mockResolvedValueOnce({
      ...mockTokenSet,
      expiresAt: Date.now() + 300000, // expira em 5 minutos (fora do buffer)
    })

    await TokenRefreshService.checkAndRefresh()

    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })

  it('checkAndRefresh() envia AUTH_EXPIRED ao popup quando refresh falha', async () => {
    const sendMessageSpy = vi.spyOn(chrome.runtime, 'sendMessage')

    mockGetTokens.mockResolvedValueOnce({
      ...mockTokenSet,
      expiresAt: Date.now() + 30000,
    })
    mockRefreshTokens.mockRejectedValueOnce(new Error('token expired'))

    await TokenRefreshService.checkAndRefresh()

    expect(mockClearTokens).toHaveBeenCalled()
    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: 'AUTH_EXPIRED',
    })
  })

  it('checkAndRefresh() retorna silenciosamente quando não há tokens', async () => {
    mockGetTokens.mockResolvedValueOnce(null)

    await TokenRefreshService.checkAndRefresh()

    expect(mockRefreshTokens).not.toHaveBeenCalled()
  })
})

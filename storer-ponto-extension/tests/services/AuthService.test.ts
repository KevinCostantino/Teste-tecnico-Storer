import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StorageService } from '../../src/services/StorageService'
import type { TokenSet } from '../../src/types/auth.types'

vi.mock('../../src/constants/auth.constants', () => ({
  LOGIN_TIMEOUT_MS: 300000,
  OIDC_AUTHORIZE_PATH: '/oauth/v2/authorize',
  OIDC_SCOPE: 'openid profile email offline_access',
  OIDC_REVOKE_PATH: '/oauth/v2/revoke',
  OIDC_TOKEN_PATH: '/oauth/v2/token',
  TOKEN_REFRESH_BUFFER_MS: 60000,
  TOKEN_REFRESH_ALARM_NAME: 'TOKEN_REFRESH_CHECK',
  TOKEN_REFRESH_ALARM_PERIOD_MINUTES: 0.5,
  ZITADEL_DOMAIN: 'https://auth-dev.storer.com.br',
  ZITADEL_CLIENT_ID: 'client-id-test',
}))

import { AuthService } from '../../src/services/AuthService'

const makeJwt = (claims: Record<string, string>): string => {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.sig`
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    const sessionStore = new Map<string, unknown>()

    const chromeMock = {
      identity: {
        getRedirectURL: vi.fn(() => 'https://redirect.example/callback'),
        launchWebAuthFlow: vi.fn(),
      },
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: sessionStore.get(key) })),
          set: vi.fn(async (data: Record<string, unknown>) => {
            Object.entries(data).forEach(([key, value]) => sessionStore.set(key, value))
          }),
          remove: vi.fn(async (key: string) => {
            sessionStore.delete(key)
          }),
        },
        local: {
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
        sync: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
        },
      },
      runtime: {
        sendMessage: vi.fn(async () => undefined),
      },
      alarms: {
        create: vi.fn(),
        onAlarm: {
          addListener: vi.fn(),
        },
      },
    }

    Object.defineProperty(globalThis, 'chrome', {
      value: chromeMock,
      configurable: true,
      writable: true,
    })
  })

  it('gera PKCE com challenge e state', async () => {
    const pkce = await AuthService.generatePKCE()

    expect(pkce.codeVerifier.length).toBeGreaterThan(30)
    expect(pkce.codeChallenge.length).toBeGreaterThan(30)
    expect(pkce.state.length).toBeGreaterThan(10)
    expect(pkce.redirectUri).toContain('callback')
  })

  it('troca code por token e salva claims do id_token', async () => {
    const idToken = makeJwt({
      sub: 'user-123',
      email: 'dev@storer.com.br',
      name: 'Dev Storer',
      picture: 'https://cdn.storer/avatar.png',
    })

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        id_token: idToken,
        expires_in: 900,
      }),
    }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    await chrome.storage.session.set({
      pkceState: {
        codeVerifier: 'verifier-123',
        codeChallenge: 'challenge-123',
        state: 'state-123',
        redirectUri: 'https://redirect.example/callback',
      },
    })

    const saveSpy = vi.spyOn(StorageService, 'saveTokenSet')

    const tokenSet = await AuthService.handleCallback(
      'https://redirect.example/callback?code=code-123&state=state-123',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(tokenSet.userId).toBe('user-123')
    expect(tokenSet.userEmail).toBe('dev@storer.com.br')
    expect(tokenSet.userDisplayName).toBe('Dev Storer')
    expect(tokenSet.userAvatarUrl).toBe('https://cdn.storer/avatar.png')
  })

  it('faz logout com revogacao e limpa tokens locais', async () => {
    const fakeTokenSet: TokenSet = {
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'id',
      expiresAt: Date.now() + 1000,
      userId: 'u1',
      userEmail: 'u1@storer.com.br',
      userDisplayName: 'User One',
    }

    vi.spyOn(AuthService, 'getTokens').mockResolvedValue(fakeTokenSet)

    const clearSpy = vi.spyOn(AuthService, 'clearTokens').mockResolvedValue()
    const fetchMock = vi.fn(async () => ({ ok: true }))

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    })

    await AuthService.logout()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })

  it('retorna false quando token expirou', async () => {
    vi.spyOn(AuthService, 'getTokens').mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      idToken: 'i',
      expiresAt: Date.now() - 100,
      userId: 'u',
      userEmail: 'u@storer.com.br',
      userDisplayName: 'U',
    })

    const result = await AuthService.isAuthenticated()
    expect(result).toBe(false)
  })
})

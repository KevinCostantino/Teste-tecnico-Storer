import { beforeEach, describe, expect, it, vi } from 'vitest'

const localStore = new Map<string, unknown>()
const sessionStore = new Map<string, unknown>()
const syncStore = new Map<string, unknown>()

describe('StorageService', () => {
  beforeEach(() => {
    localStore.clear()
    sessionStore.clear()
    syncStore.clear()

    Object.defineProperty(globalThis, 'chrome', {
      value: {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: localStore.get(key) })),
            set: vi.fn(async (data: Record<string, unknown>) => {
              Object.entries(data).forEach(([k, v]) => localStore.set(k, v))
            }),
            remove: vi.fn(async (key: string) => localStore.delete(key)),
          },
          session: {
            get: vi.fn(async (key: string) => ({ [key]: sessionStore.get(key) })),
            set: vi.fn(async (data: Record<string, unknown>) => {
              Object.entries(data).forEach(([k, v]) => sessionStore.set(k, v))
            }),
            remove: vi.fn(async (key: string) => sessionStore.delete(key)),
          },
          sync: {
            get: vi.fn(async (key: string) => ({ [key]: syncStore.get(key) })),
            set: vi.fn(async (data: Record<string, unknown>) => {
              Object.entries(data).forEach(([k, v]) => syncStore.set(k, v))
            }),
          },
        },
      },
      configurable: true,
      writable: true,
    })
  })

  it('salva e recupera refresh token com criptografia AES-GCM', async () => {
    const { StorageService } = await import('../../src/services/StorageService')

    const tokenSet = {
      accessToken: 'access-abc',
      refreshToken: 'refresh-secret-xyz',
      idToken: 'id-token',
      expiresAt: Date.now() + 60_000,
      userId: 'u1',
      userEmail: 'user@storer.com.br',
      userDisplayName: 'Colaborador Teste',
    }

    await StorageService.saveTokenSet(tokenSet)

    // O valor persistido localmente deve ser criptografado (base64, nao o token raw)
    const rawLocal = localStore.get('refreshToken') as string
    expect(rawLocal).not.toBe('refresh-secret-xyz')
    expect(typeof rawLocal).toBe('string')

    // A recuperacao deve descriptografar corretamente
    const recovered = await StorageService.getRefreshToken()
    expect(recovered).toBe('refresh-secret-xyz')
  })
})

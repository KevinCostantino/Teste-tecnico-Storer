import type { TokenSet } from '../types/auth.types'
import type { ExtensionConfig } from '../types/config.types'
import { DEFAULT_API_BASE_URL } from '../constants/api.constants'
import { CryptoService } from './CryptoService'

const STORAGE_KEYS = {
  tokenSet: 'tokenSet',
  refreshToken: 'refreshToken',
  config: 'extensionConfig',
} as const

const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  lembretes: ['08:00', '12:00', '13:30', '18:00'],
  geolocalizacaoHabilitada: false,
  notificacoesHabilitadas: true,
}

export class StorageService {
  static async saveTokenSet(tokenSet: TokenSet): Promise<void> {
    await chrome.storage.session.set({ [STORAGE_KEYS.tokenSet]: tokenSet })
    const encryptedRefreshToken = await CryptoService.encrypt(tokenSet.refreshToken)
    await chrome.storage.local.set({ [STORAGE_KEYS.refreshToken]: encryptedRefreshToken })
  }

  static async getTokenSet(): Promise<TokenSet | null> {
    const result = await chrome.storage.session.get(STORAGE_KEYS.tokenSet)
    return (result[STORAGE_KEYS.tokenSet] as TokenSet | undefined) ?? null
  }

  static async getRefreshToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.refreshToken)
    const encrypted = result[STORAGE_KEYS.refreshToken] as string | undefined
    if (!encrypted) return null
    try {
      return await CryptoService.decrypt(encrypted)
    } catch {
      return null
    }
  }

  static async clearTokens(): Promise<void> {
    await chrome.storage.session.remove(STORAGE_KEYS.tokenSet)
    await chrome.storage.local.remove(STORAGE_KEYS.refreshToken)
  }

  static async getConfig(): Promise<ExtensionConfig> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.config)
    return (result[STORAGE_KEYS.config] as ExtensionConfig | undefined) ?? DEFAULT_CONFIG
  }

  static async saveConfig(config: ExtensionConfig): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.config]: config })
  }
}

import {
  LOGIN_TIMEOUT_MS,
  OIDC_AUTHORIZE_PATH,
  OIDC_SCOPE,
  OIDC_REVOKE_PATH,
  OIDC_TOKEN_PATH,
  ZITADEL_CLIENT_ID,
  ZITADEL_DOMAIN,
} from '../constants/auth.constants'
import type { PKCEState, TokenSet } from '../types/auth.types'
import { StorageService } from './StorageService'

const AUTH_STATE_KEY = 'pkceState'

interface TokenResponse {
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
}

interface IdTokenClaims {
  sub?: string
  email?: string
  name?: string
  preferred_username?: string
  picture?: string
}

const toBase64Url = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const randomString = (size = 32): string => {
  const values = new Uint8Array(size)
  crypto.getRandomValues(values)
  return Array.from(values, (item) => item.toString(16).padStart(2, '0')).join('')
}

const getZitadelBaseUrl = (): string => {
  if (!ZITADEL_DOMAIN) {
    throw new Error('OIDC nao configurado. Defina VITE_ZITADEL_DOMAIN e VITE_ZITADEL_CLIENT_ID.')
  }

  return ZITADEL_DOMAIN.startsWith('http') ? ZITADEL_DOMAIN : `https://${ZITADEL_DOMAIN}`
}

const decodeIdTokenClaims = (idToken: string): IdTokenClaims => {
  const parts = idToken.split('.')
  if (parts.length < 2) {
    return {}
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = atob(padded)
    return JSON.parse(payload) as IdTokenClaims
  } catch {
    return {}
  }
}

export class AuthService {
  static async generatePKCE(): Promise<PKCEState> {
    const codeVerifier = randomString(64)
    const data = new TextEncoder().encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)

    return {
      codeVerifier,
      codeChallenge: toBase64Url(digest),
      state: randomString(32),
      redirectUri: chrome.identity.getRedirectURL('callback'),
    }
  }

  static async startLoginFlow(): Promise<TokenSet> {
    if (import.meta.env.VITE_MOCK_AUTH === 'true') {
      const tokenSet: TokenSet = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        idToken: 'mock-id-token',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        userId: 'mock-user-001',
        userEmail: 'colaborador@storer.com.br',
        userDisplayName: 'Colaborador Demo',
      }
      await StorageService.saveTokenSet(tokenSet)
      return tokenSet
    }

    if (!ZITADEL_CLIENT_ID) {
      throw new Error('OIDC nao configurado. Defina VITE_ZITADEL_DOMAIN e VITE_ZITADEL_CLIENT_ID.')
    }

    const zitadelBaseUrl = getZitadelBaseUrl()
    const pkce = await this.generatePKCE()
    await chrome.storage.session.set({ [AUTH_STATE_KEY]: pkce })

    const authorizeUrl = new URL(`${zitadelBaseUrl}${OIDC_AUTHORIZE_PATH}`)
    authorizeUrl.searchParams.set('client_id', ZITADEL_CLIENT_ID)
    authorizeUrl.searchParams.set('redirect_uri', pkce.redirectUri)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', OIDC_SCOPE)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('code_challenge', pkce.codeChallenge)
    authorizeUrl.searchParams.set('state', pkce.state)

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      interactive: true,
      url: authorizeUrl.toString(),
      abortOnLoadForNonInteractive: false,
      timeoutMsForNonInteractive: LOGIN_TIMEOUT_MS,
    })

    if (!responseUrl) {
      throw new Error('Login nao retornou callback valido.')
    }

    return this.handleCallback(responseUrl)
  }

  static async handleCallback(callbackUrl: string): Promise<TokenSet> {
    const params = new URL(callbackUrl).searchParams
    const oauthError = params.get('error')
    const oauthErrorDescription = params.get('error_description')
    const code = params.get('code')
    const state = params.get('state')

    if (oauthError) {
      throw new Error(`Falha no login OIDC: ${oauthErrorDescription ?? oauthError}`)
    }

    const saved = await chrome.storage.session.get(AUTH_STATE_KEY)
    const pkce = saved[AUTH_STATE_KEY] as PKCEState | undefined

    if (!code || !state || !pkce || state !== pkce.state) {
      throw new Error('Falha de validacao no callback OIDC.')
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ZITADEL_CLIENT_ID,
      code,
      redirect_uri: pkce.redirectUri,
      code_verifier: pkce.codeVerifier,
    })

    const response = await fetch(`${getZitadelBaseUrl()}${OIDC_TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      throw new Error('Nao foi possivel trocar authorization code por token.')
    }

    const tokenResponse = (await response.json()) as TokenResponse
    const claims = decodeIdTokenClaims(tokenResponse.id_token)

    const tokenSet: TokenSet = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      userId: claims.sub ?? '',
      userEmail: claims.email ?? '',
      userDisplayName: claims.name ?? claims.preferred_username ?? 'Colaborador',
      userAvatarUrl: claims.picture,
    }

    await StorageService.saveTokenSet(tokenSet)
    await chrome.storage.session.remove(AUTH_STATE_KEY)

    return tokenSet
  }

  static async getTokens(): Promise<TokenSet | null> {
    return StorageService.getTokenSet()
  }

  static async refreshTokens(): Promise<TokenSet> {
    const current = await this.getTokens()
    // Fallback: session cleared (browser restart) — decrypt from local storage
    const refreshToken =
      current?.refreshToken ?? (await StorageService.getRefreshToken())

    if (!refreshToken) {
      throw new Error('Refresh token indisponivel para renovar sessao.')
    }

    if (refreshToken === 'mock-refresh-token') {
      const refreshed: TokenSet = { ...current!, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }
      await StorageService.saveTokenSet(refreshed)
      return refreshed
    }

    const response = await fetch(`${getZitadelBaseUrl()}${OIDC_TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: ZITADEL_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error('Falha ao renovar token da sessao.')
    }

    const tokenResponse = (await response.json()) as TokenResponse
    const claims = decodeIdTokenClaims(tokenResponse.id_token)

    const refreshed: TokenSet = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      userId: claims.sub ?? current.userId,
      userEmail: claims.email ?? current.userEmail,
      userDisplayName:
        claims.name ?? claims.preferred_username ?? current.userDisplayName ?? 'Colaborador',
      userAvatarUrl: claims.picture ?? current.userAvatarUrl,
    }

    await StorageService.saveTokenSet(refreshed)
    return refreshed
  }

  static async clearTokens(): Promise<void> {
    await StorageService.clearTokens()
  }

  static async logout(): Promise<void> {
    const tokenSet = await this.getTokens()

    if (tokenSet?.refreshToken && ZITADEL_CLIENT_ID && ZITADEL_DOMAIN) {
      try {
        await fetch(`${getZitadelBaseUrl()}${OIDC_REVOKE_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: tokenSet.refreshToken,
            client_id: ZITADEL_CLIENT_ID,
          }),
        })
      } catch {
        // Logout local continua mesmo com erro de rede na revogacao.
      }
    }

    await this.clearTokens()
  }

  static async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens()
    return Boolean(tokens && tokens.expiresAt > Date.now())
  }
}

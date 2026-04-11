export interface TokenSet {
  accessToken: string
  refreshToken: string
  idToken: string
  expiresAt: number
  userId: string
  userEmail: string
  userDisplayName: string
  userAvatarUrl?: string
}

export interface PKCEState {
  codeVerifier: string
  codeChallenge: string
  state: string
  redirectUri: string
}

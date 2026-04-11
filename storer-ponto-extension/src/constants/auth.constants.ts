export const OIDC_SCOPE = 'openid profile email offline_access'
export const TOKEN_REFRESH_BUFFER_MS = 60_000
export const TOKEN_REFRESH_ALARM_NAME = 'TOKEN_REFRESH_CHECK'
export const TOKEN_REFRESH_ALARM_PERIOD_MINUTES = 0.5
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
export const OIDC_AUTHORIZE_PATH = '/oauth/v2/authorize'
export const OIDC_TOKEN_PATH = '/oauth/v2/token'
export const OIDC_REVOKE_PATH = '/oauth/v2/revoke'

export const ZITADEL_DOMAIN = import.meta.env.VITE_ZITADEL_DOMAIN ?? ''
export const ZITADEL_CLIENT_ID = import.meta.env.VITE_ZITADEL_CLIENT_ID ?? ''

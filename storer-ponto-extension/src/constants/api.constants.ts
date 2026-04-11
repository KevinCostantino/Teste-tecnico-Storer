export const API_TIMEOUT_MS = 10_000
export const API_RETRY_ATTEMPTS = 3
export const API_RETRY_DELAYS_MS = [1_000, 2_000, 4_000]
export const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://ponto-api-dev.storer.com.br'

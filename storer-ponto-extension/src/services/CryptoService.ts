/**
 * AES-GCM encryption/decryption for sensitive values stored in chrome.storage.local.
 * The key is derived from a device-scoped constant using PBKDF2 so it never leaves
 * the browser. WebCrypto is available in both popup and service worker contexts.
 */

const SALT = new Uint8Array([
  0x53, 0x74, 0x6f, 0x72, 0x65, 0x72, 0x50, 0x6f, 0x6e, 0x74, 0x6f, 0x45, 0x78, 0x74,
])
const ITERATIONS = 100_000
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt']

async function deriveKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode('storer-ponto-aes-gcm-v1')
  const baseKey = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    KEY_USAGE,
  )
}

export class CryptoService {
  static async encrypt(plaintext: string): Promise<string> {
    const key = await deriveKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

    // Serialize as base64: [12-byte iv][ciphertext]
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.byteLength)

    return btoa(String.fromCharCode(...combined))
  }

  static async decrypt(encoded: string): Promise<string> {
    const key = await deriveKey()
    const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plaintext)
  }
}

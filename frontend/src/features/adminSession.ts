export const ADMIN_SESSION_EXPIRED_EVENT = 'astro-admin-session-expired'

const TOKEN_KEY = 'astro-content-admin-token'
const EXPIRES_AT_KEY = 'astro-content-admin-expires-at'

export interface StoredAdminSession {
  token: string
  expiresAt: string | null
  expired: boolean
}

export function loadAdminSession(): StoredAdminSession {
  const token = sessionStorage.getItem(TOKEN_KEY) || ''
  const expiresAt = sessionStorage.getItem(EXPIRES_AT_KEY) || tokenExpiry(token)
  if (!token) return { token: '', expiresAt: null, expired: false }

  if (expiresAt && sessionExpiryDelay(expiresAt) <= 0) {
    clearAdminSession()
    return { token: '', expiresAt: null, expired: true }
  }
  if (expiresAt && !sessionStorage.getItem(EXPIRES_AT_KEY)) sessionStorage.setItem(EXPIRES_AT_KEY, expiresAt)
  return { token, expiresAt, expired: false }
}

export function saveAdminSession(accessToken: string, expiresAt: string): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken)
  sessionStorage.setItem(EXPIRES_AT_KEY, expiresAt)
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(EXPIRES_AT_KEY)
}

export function invalidateAdminSession(reason: 'expired' | 'unauthorized'): void {
  const hadSession = Boolean(sessionStorage.getItem(TOKEN_KEY))
  clearAdminSession()
  if (hadSession) {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT, { detail: { reason } }))
  }
}

export function scheduleAdminSessionExpiry(expiresAt: string | null, callback: () => void): number | undefined {
  if (!expiresAt) return undefined
  const delay = sessionExpiryDelay(expiresAt)
  if (delay <= 0) {
    queueMicrotask(callback)
    return undefined
  }
  return window.setTimeout(callback, Math.min(delay, 2_147_483_647))
}

function sessionExpiryDelay(expiresAt: string): number {
  const timestamp = Date.parse(expiresAt)
  return Number.isFinite(timestamp) ? timestamp - Date.now() : 0
}

function tokenExpiry(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { exp?: unknown }
    return typeof claims.exp === 'number' ? new Date(claims.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}

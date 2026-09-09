/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  clearAdminSession,
  invalidateAdminSession,
  loadAdminSession,
  saveAdminSession,
  scheduleAdminSessionExpiry,
} from './adminSession'

afterEach(() => {
  clearAdminSession()
  vi.useRealTimers()
})

describe('admin session', () => {
  it('restores a valid session and removes an expired session', () => {
    saveAdminSession('valid-token', new Date(Date.now() + 60_000).toISOString())
    expect(loadAdminSession()).toMatchObject({ token: 'valid-token', expired: false })

    saveAdminSession('expired-token', new Date(Date.now() - 1).toISOString())
    expect(loadAdminSession()).toEqual({ token: '', expiresAt: null, expired: true })
    expect(sessionStorage.getItem('astro-content-admin-token')).toBeNull()
  })

  it('derives expiry from an older JWT-only session', () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    sessionStorage.setItem('astro-content-admin-token', `header.${payload}.signature`)

    expect(loadAdminSession().expiresAt).toBeTruthy()
    expect(sessionStorage.getItem('astro-content-admin-expires-at')).toBeTruthy()
  })

  it('invalidates a stored session and notifies the active admin page', () => {
    saveAdminSession('token', new Date(Date.now() + 60_000).toISOString())
    const listener = vi.fn()
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, listener, { once: true })

    invalidateAdminSession('unauthorized')

    expect(listener).toHaveBeenCalledOnce()
    expect(loadAdminSession().token).toBe('')
  })

  it('runs the expiry callback at the server-provided expiry time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T00:00:00Z'))
    const callback = vi.fn()

    scheduleAdminSessionExpiry('2026-08-13T00:00:05Z', callback)
    vi.advanceTimersByTime(4_999)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledOnce()
  })
})

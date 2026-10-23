/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from './useTheme'

const initScript = readFileSync(resolve('public/theme-init.js'), 'utf8')
let scopes: EffectScope[] = []

function mockSystemPreference(light: boolean) {
  const events = new EventTarget()
  const media = {
    matches: light,
    media: '(prefers-color-scheme: light)',
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  return {
    media,
    change(nextLight: boolean) {
      media.matches = nextLight
      const event = new Event('change')
      Object.defineProperty(event, 'matches', { value: nextLight })
      events.dispatchEvent(event)
    },
  }
}

function startTheme() {
  const scope = effectScope()
  scopes.push(scope)
  return { ...scope.run(useTheme)!, stop: () => scope.stop() }
}

function expectDocumentTheme(theme: 'dark' | 'light') {
  expect(document.documentElement.dataset.theme).toBe(theme)
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))
    .toBe(theme === 'light' ? '#f5f6fa' : '#090e1b')
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.head.innerHTML = '<meta name="theme-color" content="#090e1b">'
})

afterEach(() => {
  scopes.forEach(scope => scope.stop())
  scopes = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe.each(['startup script', 'Vue composable'])('%s initialization', (implementation) => {
  function initialize() {
    if (implementation === 'startup script') window.eval(initScript)
    else startTheme()
  }

  it.each([true, false])('uses the system preference with no saved selection (light = %s)', (light) => {
    mockSystemPreference(light)
    initialize()
    expectDocumentTheme(light ? 'light' : 'dark')
    expect(localStorage.getItem('astro-theme')).toBeNull()
  })

  it.each(['dark', 'light'] as const)('restores an explicit %s selection over the system preference', (theme) => {
    mockSystemPreference(theme !== 'light')
    localStorage.setItem('astro-theme', theme)
    initialize()
    expectDocumentTheme(theme)
  })

  it('ignores unrecognized stored values', () => {
    mockSystemPreference(true)
    localStorage.setItem('astro-theme', 'sepia')
    initialize()
    expectDocumentTheme('light')
  })

  it('falls back to dark when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    initialize()
    expectDocumentTheme('dark')
  })

  it('still starts when access to localStorage is blocked', () => {
    mockSystemPreference(true)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(initialize).not.toThrow()
    expectDocumentTheme('light')
  })
})

describe('theme switching', () => {
  it('toggles both ways, persists the selection, and updates browser chrome', () => {
    mockSystemPreference(false)
    const { theme, toggleTheme } = startTheme()
    toggleTheme()
    expect(theme.value).toBe('light')
    expect(localStorage.getItem('astro-theme')).toBe('light')
    expectDocumentTheme('light')
    toggleTheme()
    expect(theme.value).toBe('dark')
    expect(localStorage.getItem('astro-theme')).toBe('dark')
    expectDocumentTheme('dark')
  })

  it('retains a manual choice in memory when persisting is blocked', () => {
    const system = mockSystemPreference(false)
    const { theme, toggleTheme } = startTheme()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(toggleTheme).not.toThrow()
    system.change(false)
    expect(theme.value).toBe('light')
    expectDocumentTheme('light')
  })

  it('follows system changes until the user makes an explicit choice', () => {
    const system = mockSystemPreference(false)
    const { theme, toggleTheme } = startTheme()
    system.change(true)
    expect(theme.value).toBe('light')
    expectDocumentTheme('light')
    toggleTheme()
    system.change(true)
    expect(theme.value).toBe('dark')
    expectDocumentTheme('dark')
  })

  it('synchronizes selection from another tab and resumes system preference after removal', () => {
    const system = mockSystemPreference(false)
    const { theme } = startTheme()
    window.dispatchEvent(new StorageEvent('storage', { key: 'astro-theme', newValue: 'light', storageArea: localStorage }))
    expect(theme.value).toBe('light')
    expectDocumentTheme('light')
    system.change(false)
    expect(theme.value).toBe('light')
    window.dispatchEvent(new StorageEvent('storage', { key: 'astro-theme', newValue: null, storageArea: localStorage }))
    expect(theme.value).toBe('dark')
    system.change(true)
    expect(theme.value).toBe('light')
  })

  it('ignores unrelated storage events', () => {
    mockSystemPreference(false)
    const { theme } = startTheme()
    window.dispatchEvent(new StorageEvent('storage', { key: 'astro-theme', newValue: 'light', storageArea: sessionStorage }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: 'light', storageArea: localStorage }))
    expect(theme.value).toBe('dark')
  })

  it('removes listeners when the owning scope unmounts', () => {
    const system = mockSystemPreference(false)
    const { theme, stop } = startTheme()
    stop()
    system.change(true)
    window.dispatchEvent(new StorageEvent('storage', { key: 'astro-theme', newValue: 'light', storageArea: localStorage }))
    expect(theme.value).toBe('dark')
    expect(system.media.removeEventListener).toHaveBeenCalledOnce()
  })
})

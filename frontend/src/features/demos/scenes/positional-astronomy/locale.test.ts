import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import zh from './zh.json'
import en from './en.json'

function messagePaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => messagePaths(item, prefix ? `${prefix}.${key}` : key))
}

describe('astronomy teaching text', () => {
  for (const [locale, messages] of Object.entries({ zh, en })) {
    it(`compiles every ${locale} explanation without treating absolute values as plurals`, () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } })
        for (const path of messagePaths(messages)) i18n.global.t(path, { lat: 40, height: 40, lst: 4, ra: 6, dec: 20, deg: 90, az: 135, alt: 35, years: 13000, result: '', lonName: '', latName: '', lon: 0 })
        expect(errors).not.toHaveBeenCalled()
        expect(i18n.global.t('labels.poleAltitude')).toContain('∣')
      } finally { errors.mockRestore() }
    })
  }
})

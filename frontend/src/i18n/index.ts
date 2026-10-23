import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN/common.json'
import en from '../locales/en/common.json'
import positionalZh from '../features/demos/scenes/positional-astronomy/zh.json'
import positionalEn from '../features/demos/scenes/positional-astronomy/en.json'
import solarWindZh from '../features/demos/scenes/solar-wind/zh.json'
import solarWindEn from '../features/demos/scenes/solar-wind/en.json'

const savedLocale = typeof window === 'undefined'
  ? 'zh-CN'
  : localStorage.getItem('astro-locale') || 'zh-CN'

export default createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { ...zhCN, demos: { ...zhCN.demos, items: { ...zhCN.demos.items, positionalAstronomy: positionalZh, solarWind: solarWindZh } } },
    en: { ...en, demos: { ...en.demos, items: { ...en.demos.items, positionalAstronomy: positionalEn, solarWind: solarWindEn } } }
  }
})

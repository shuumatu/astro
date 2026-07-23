import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN/common.json'
import en from '../locales/en/common.json'

const savedLocale = typeof window === 'undefined'
  ? 'zh-CN'
  : localStorage.getItem('astro-locale') || 'zh-CN'

export default createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en
  }
})

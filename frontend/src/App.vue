<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { BookOpen, Compass, Moon, Orbit, ScanLine, Sun } from 'lucide-vue-next'
import { useTheme } from './composables/useTheme'

const { t, locale } = useI18n()
const route = useRoute()
const { theme, toggleTheme } = useTheme()
const isSkyMapRoute = computed(() => route.path === '/sky-map')
const isDemoRoute = computed(() => route.path.startsWith('/demos/'))
const locales = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'English' }
]
const navigation = [
  { to: '/catalog', key: 'catalog', icon: BookOpen },
  { to: '/explore', key: 'explore', icon: Compass },
  { to: '/demos', key: 'demos', icon: Orbit },
  { to: '/sky-map', key: 'skyMap', icon: ScanLine }
]

watch(locale, value => { document.documentElement.lang = value }, { immediate: true })

function switchLocale(localeCode: string) {
  locale.value = localeCode
  localStorage.setItem('astro-locale', localeCode)
}
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('theme.skip') }}</a>
  <header class="site-header">
    <RouterLink class="brand" to="/" :aria-label="t('theme.home')">
      <svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <ellipse cx="20" cy="20" rx="18" ry="10" transform="rotate(-38 20 20)" stroke="currentColor" stroke-width=".8" />
        <path d="M15 9l1.9 5.1L22 16l-5.1 1.9L15 23l-1.9-5.1L8 16l5.1-1.9L15 9Z" class="brand-star-gold" />
        <path d="m27 22 1.3 3.7L32 27l-3.7 1.3L27 32l-1.3-3.7L22 27l3.7-1.3L27 22Z" class="brand-star-blue" />
      </svg>
      <span class="brand-wordmark">Astro <span>Learning</span><small>{{ t('theme.brandNote') }}</small></span>
    </RouterLink>
    <nav class="nav-links" :aria-label="t('theme.navigation')">
      <RouterLink
        v-for="item in navigation"
        :key="item.key"
        :to="item.to"
        :class="{ 'nav-current': route.path === item.to || route.path.startsWith(`${item.to}/`) }"
        :aria-current="route.path === item.to ? 'page' : route.path.startsWith(`${item.to}/`) ? 'location' : undefined"
      >
        <component :is="item.icon" :size="16" :stroke-width="1.6" aria-hidden="true" />
        {{ t(`nav.${item.key}`) }}
      </RouterLink>
    </nav>
    <div class="header-actions">
      <button
        class="theme-toggle"
        type="button"
        :aria-label="t(theme === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark')"
        :title="t(theme === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark')"
        @click="toggleTheme"
      >
        <Moon v-if="theme === 'dark'" :size="17" :stroke-width="1.7" aria-hidden="true" />
        <Sun v-else :size="18" :stroke-width="1.7" aria-hidden="true" />
      </button>
      <div class="locale-switcher" role="group" :aria-label="t('theme.language')">
        <button
          v-for="option in locales"
          :key="option.code"
          type="button"
          :class="{ active: locale === option.code }"
          :aria-pressed="locale === option.code"
          :lang="option.code"
          :aria-label="option.label"
          @click="switchLocale(option.code)"
        >{{ option.code === 'en' ? 'EN' : option.label }}</button>
      </div>
    </div>
  </header>
  <main id="main-content" tabindex="-1" class="page-shell" :class="{ 'sky-map-shell': isSkyMapRoute, 'demo-shell': isDemoRoute }">
    <RouterView />
  </main>
  <footer v-if="!isSkyMapRoute && !isDemoRoute" class="site-footer">
    <span class="footer-signature"><i aria-hidden="true"></i> {{ t('theme.footer') }}</span>
    <span>ASTRO LEARNING <span class="footer-divider">/</span> {{ t('theme.footerNote') }}</span>
  </footer>
</template>

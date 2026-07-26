<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const { t, locale } = useI18n()
const route = useRoute()
const isSkyMapRoute = computed(() => route.path === '/sky-map')
const locales = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'English' }
]

function switchLocale(localeCode: string) {
  locale.value = localeCode
  localStorage.setItem('astro-locale', localeCode)
  document.documentElement.lang = localeCode
}
</script>

<template>
  <header class="site-header">
    <RouterLink class="brand" to="/">Astro Learning</RouterLink>
    <nav class="nav-links" aria-label="Primary navigation">
      <RouterLink to="/catalog">{{ t('nav.catalog') }}</RouterLink>
      <RouterLink to="/missions">{{ t('nav.missions') }}</RouterLink>
      <RouterLink to="/sky-map">{{ t('nav.skyMap') }}</RouterLink>
    </nav>
    <div class="locale-switcher" aria-label="Language">
      <button
        v-for="option in locales"
        :key="option.code"
        type="button"
        :class="{ active: locale === option.code }"
        @click="switchLocale(option.code)"
      >{{ option.label }}</button>
    </div>
  </header>
  <main class="page-shell" :class="{ 'sky-map-shell': isSkyMapRoute }">
    <RouterView />
  </main>
</template>

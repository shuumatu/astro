<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
</script>

<template>
  <section class="hero">
    <p class="eyebrow">{{ t('home.eyebrow') }}</p>
    <h1>{{ t('home.title') }}</h1>
    <p class="hero-copy">{{ t('home.description') }}</p>
    <div class="hero-actions">
      <RouterLink class="button primary" to="/demos">{{ t('home.start') }}</RouterLink>
      <RouterLink class="button secondary" to="/catalog">{{ t('home.catalog') }}</RouterLink>
    </div>
  </section>
</template>

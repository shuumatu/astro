<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <section class="placeholder">
    <h1>{{ t('nav.catalog') }}</h1>
    <p>{{ t('placeholder.catalog') }}</p>
  </section>
</template>

<script setup lang="ts">
import { ArrowLeft, ExternalLink } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { loadCatalogEntry } from '../features/catalog/api'
import CatalogMediaGallery from '../features/catalog/CatalogMediaGallery.vue'
import { renderRestrictedMarkdown } from '../features/catalog/markdown'
import type { CatalogEntry, CatalogObjectType } from '../features/catalog/types'

const route = useRoute()
const { t, locale } = useI18n()
const entry = ref<CatalogEntry | null>(null)
const loading = ref(false)
const failed = ref(false)
const mediaGallery = ref<InstanceType<typeof CatalogMediaGallery> | null>(null)

const objectType = computed(() => route.params.objectType as CatalogObjectType)
const objectKey = computed(() => route.params.objectKey as string)
const renderedBody = computed(() => entry.value ? renderRestrictedMarkdown(entry.value.bodyMarkdown) : '')

watch([objectType, objectKey, locale], load, { immediate: true })

async function load(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    entry.value = await loadCatalogEntry(objectType.value, objectKey.value, locale.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function openMediaReference(event: MouseEvent): void {
  const reference = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#catalog-media-"]')
  if (!reference) return
  event.preventDefault()
  const number = Number(reference.hash.slice('#catalog-media-'.length))
  if (Number.isInteger(number)) mediaGallery.value?.open(number - 1)
}
</script>

<template>
  <article class="catalog-detail">
    <RouterLink class="back-link" to="/catalog"><ArrowLeft :size="16" aria-hidden="true" />{{ t('catalog.back') }}</RouterLink>
    <div v-if="loading" class="detail-state" role="status">{{ t('catalog.loading') }}</div>
    <div v-else-if="failed" class="detail-state error" role="alert">{{ t('catalog.loadFailed') }}</div>
    <div v-else-if="!entry" class="detail-state">{{ t('catalog.preparing') }}</div>
    <template v-else>
      <header class="detail-header">
        <span>{{ t(`catalog.types.${entry.objectType}`) }} · {{ entry.objectKey }}</span>
        <h1>{{ entry.title }}</h1>
        <p>{{ entry.summary }}</p>
      </header>
      <div class="detail-layout">
        <div class="detail-body" v-html="renderedBody" @click="openMediaReference"></div>
        <aside>
          <CatalogMediaGallery ref="mediaGallery" :media="entry.media" />
          <section v-if="entry.knowledgePoints.length">
            <h2>{{ t('catalog.keyFacts') }}</h2>
            <ul><li v-for="point in entry.knowledgePoints" :key="point">{{ point }}</li></ul>
          </section>
          <section v-if="entry.sources.length">
            <h2>{{ t('catalog.sources') }}</h2>
            <a v-for="source in entry.sources" :key="source.url" :href="source.url" target="_blank" rel="noreferrer">
              {{ source.title }}<ExternalLink :size="13" aria-hidden="true" />
            </a>
          </section>
        </aside>
      </div>
    </template>
  </article>
</template>

<style scoped>
.catalog-detail { max-width: 1080px; padding: 28px 0 64px; }
.back-link { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 26px; color: #85aaa9; font-size: 13px; }
.detail-header { max-width: 760px; }
.detail-header span { color: #72c9bd; font-size: 12px; }
.detail-header h1 { margin: 9px 0 12px; font-size: 44px; letter-spacing: 0; }
.detail-header p { margin: 0; color: #a7bac1; font-size: 18px; line-height: 1.65; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, .85fr); gap: 48px; margin-top: 32px; }
.detail-body { color: #bdcacc; font-size: 16px; line-height: 1.85; }
.detail-body :deep(h2), .detail-body :deep(h3) { color: #edf4f3; }
.detail-body :deep(a) { color: #7bd0c5; text-decoration: underline; }
.detail-body :deep(a[href^="#catalog-media-"]) { display: inline-flex; align-items: center; min-height: 20px; border: 1px solid #3e625f; border-radius: 3px; padding: 0 4px; color: #8ad8cd; background: #102421; font-size: .78em; font-weight: 700; text-decoration: none; }
.detail-layout aside { border-left: 1px solid #263d45; padding-left: 24px; }
.detail-layout aside .media-gallery + section { margin-top: 28px; }
.detail-layout aside section + section { margin-top: 28px; }
.detail-layout aside h2 { margin: 0 0 12px; color: #82999c; font-size: 12px; text-transform: uppercase; }
.detail-layout aside ul { display: grid; gap: 10px; margin: 0; padding-left: 18px; color: #c4d2d1; font-size: 13px; line-height: 1.55; }
.detail-layout aside a { display: flex; align-items: center; gap: 6px; margin: 9px 0; color: #78c9bf; font-size: 13px; }
.detail-state { display: grid; place-items: center; min-height: 360px; color: #879aa5; }
.detail-state.error { color: #d89e88; }
@media (max-width: 720px) {
  .detail-header h1 { font-size: 34px; }
  .detail-layout { grid-template-columns: 1fr; gap: 28px; }
  .detail-layout aside { border-top: 1px solid #263d45; border-left: 0; padding: 24px 0 0; }
}
</style>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { loadCatalogPage } from '../features/catalog/api'
import type { CatalogObjectType, CatalogPage } from '../features/catalog/types'

const { t, locale } = useI18n()
const page = ref<CatalogPage | null>(null)
const selectedType = ref<CatalogObjectType | ''>('')
const queryInput = ref('')
const activeQuery = ref('')
const loading = ref(false)
const failed = ref(false)

const typeOptions: Array<CatalogObjectType | ''> = ['', 'solar-system-body', 'star', 'culture-figure', 'featured-pattern']

onMounted(load)
watch([locale, selectedType], load)

async function load(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    page.value = await loadCatalogPage(locale.value, selectedType.value, activeQuery.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

function search(): void {
  activeQuery.value = queryInput.value.trim()
  void load()
}
</script>

<template>
  <section class="catalog-page">
    <header class="catalog-heading">
      <div>
        <p>{{ t('catalog.kicker') }}</p>
        <h1>{{ t('catalog.title') }}</h1>
      </div>
      <span v-if="page" class="entry-count">{{ t('catalog.entryCount', { count: page.totalElements }) }}</span>
    </header>

    <form class="catalog-toolbar" role="search" @submit.prevent="search">
      <div class="catalog-search">
        <Search :size="17" aria-hidden="true" />
        <input v-model="queryInput" type="search" :placeholder="t('catalog.searchPlaceholder')" :aria-label="t('catalog.search')">
      </div>
      <button type="submit">{{ t('catalog.search') }}</button>
      <div class="type-filter" role="group" :aria-label="t('catalog.filterType')">
        <button
          v-for="type in typeOptions"
          :key="type || 'all'"
          type="button"
          :class="{ active: selectedType === type }"
          @click="selectedType = type"
        >{{ type ? t(`catalog.types.${type}`) : t('catalog.allTypes') }}</button>
      </div>
    </form>

    <div v-if="loading" class="catalog-state" role="status">{{ t('catalog.loading') }}</div>
    <div v-else-if="failed" class="catalog-state error" role="alert">
      <span>{{ t('catalog.loadFailed') }}</span>
      <button type="button" @click="load">{{ t('catalog.retry') }}</button>
    </div>
    <div v-else-if="page?.items.length" class="catalog-grid">
      <RouterLink
        v-for="entry in page.items"
        :key="entry.id"
        class="catalog-card"
        :to="{ name: 'catalog-detail', params: { objectType: entry.objectType, objectKey: entry.objectKey } }"
      >
        <img v-if="entry.primaryMediaUrl" :src="entry.primaryMediaUrl" alt="">
        <div class="catalog-card-copy">
          <span>{{ t(`catalog.types.${entry.objectType}`) }} · {{ entry.objectKey }}</span>
          <h2>{{ entry.title }}</h2>
          <p>{{ entry.summary }}</p>
        </div>
      </RouterLink>
    </div>
    <div v-else class="catalog-state">{{ t('catalog.noResults') }}</div>
  </section>
</template>

<style scoped>
.catalog-page { padding: 40px 0 64px; }
.catalog-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--color-border); }
.catalog-heading p { margin: 0 0 5px; color: var(--color-blue); font-size: 12px; font-weight: 600; }
.catalog-heading h1 { margin: 0; font-size: clamp(30px, 3.2vw, 40px); line-height: 1.1; letter-spacing: -.035em; }
.entry-count { color: var(--color-text-muted); font-size: 13px; }
.catalog-toolbar { display: flex; align-items: center; gap: 10px; padding: 22px 0; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.catalog-search { display: flex; align-items: center; gap: 8px; width: min(360px, 100%); min-height: 44px; padding: 0 13px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-subtle); border-radius: 10px; }
.catalog-search input { flex: 1; min-width: 0; border: 0; outline: 0; color: var(--color-text); background: transparent; }
.catalog-toolbar > button { min-height: 44px; border: 1px solid var(--color-border); border-radius: 10px; padding: 0 14px; color: var(--color-on-accent); background: var(--color-blue); cursor: pointer; font-weight: 650; border-color: var(--color-blue); }
.type-filter { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.type-filter button { min-height: 38px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 12px; color: var(--color-text-muted); background: transparent; cursor: pointer; }
.type-filter button.active { border-color: var(--color-blue); color: var(--color-text); background: var(--color-surface-raised); }
.catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 18px; margin-top: 24px; background: transparent; }
.catalog-card { min-height: 190px; background: var(--color-surface); transition: background .18s ease, border-color .18s ease; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); }
.catalog-card:hover { background: var(--color-surface-raised); border-color: color-mix(in srgb, var(--color-blue) 55%, var(--color-border)); }
.catalog-card img { display: block; width: 100%; aspect-ratio: 16 / 8; object-fit: cover; }
.catalog-card-copy { padding: 21px; }
.catalog-card-copy span { color: var(--color-blue); font-size: 11px; }
.catalog-card-copy h2 { margin: 7px 0 8px; font-size: 20px; }
.catalog-card-copy p { margin: 0; color: var(--color-text-muted); font-size: 13px; line-height: 1.75; }
.catalog-state { display: grid; place-items: center; gap: 12px; min-height: 280px; color: var(--color-text-muted); }
.catalog-state.error { color: var(--color-danger); }
.catalog-state button { border: 1px solid var(--color-border); border-radius: 9px; padding: 7px 12px; color: var(--color-text); background: transparent; cursor: pointer; }
@media (max-width: 760px) {
  .catalog-toolbar { align-items: stretch; flex-wrap: wrap; }
  .catalog-search { flex: 1; }
  .type-filter { width: 100%; margin-left: 0; overflow-x: auto; }
  .type-filter button { flex: 0 0 auto; }
}
.catalog-search:focus-within { border-color: var(--color-blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-blue) 12%, transparent); }
.catalog-search input::placeholder { color: var(--color-text-subtle); }
.type-filter button:hover { color: var(--color-text); border-color: var(--color-blue); }
@media (max-width: 760px) {
  .catalog-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .type-filter { flex-wrap: nowrap; padding: 2px 0 4px; }
}
</style>

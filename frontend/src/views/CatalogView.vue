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

const typeOptions: Array<CatalogObjectType | ''> = ['', 'solar-system-body', 'star', 'culture-figure']

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
.catalog-page { padding: 30px 0 56px; }
.catalog-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid #223648; }
.catalog-heading p { margin: 0 0 5px; color: #72c9bd; font-size: 12px; font-weight: 600; }
.catalog-heading h1 { margin: 0; font-size: 34px; line-height: 1.1; }
.entry-count { color: #8298ae; font-size: 13px; }
.catalog-toolbar { display: flex; align-items: center; gap: 8px; padding: 16px 0; border-bottom: 1px solid #1d3040; }
.catalog-search { display: flex; align-items: center; gap: 8px; width: min(360px, 100%); min-height: 38px; padding: 0 10px; border: 1px solid #30485a; background: #0a1722; color: #718b9d; }
.catalog-search input { flex: 1; min-width: 0; border: 0; outline: 0; color: #e8eff4; background: transparent; }
.catalog-toolbar > button { min-height: 38px; border: 1px solid #437169; border-radius: 4px; padding: 0 14px; color: #061411; background: #78cfc2; cursor: pointer; }
.type-filter { display: flex; gap: 4px; margin-left: auto; }
.type-filter button { min-height: 34px; border: 1px solid #2a4354; border-radius: 4px; padding: 0 10px; color: #94a8b6; background: transparent; cursor: pointer; }
.type-filter button.active { border-color: #609d96; color: #d9f1ed; background: #14302f; }
.catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; margin-top: 18px; background: #243846; }
.catalog-card { min-height: 190px; background: #0a1620; transition: background .15s ease; }
.catalog-card:hover { background: #10232d; }
.catalog-card img { display: block; width: 100%; aspect-ratio: 16 / 8; object-fit: cover; }
.catalog-card-copy { padding: 16px; }
.catalog-card-copy span { color: #6f9195; font-size: 11px; }
.catalog-card-copy h2 { margin: 7px 0 8px; font-size: 20px; }
.catalog-card-copy p { margin: 0; color: #91a6b1; font-size: 13px; line-height: 1.6; }
.catalog-state { display: grid; place-items: center; gap: 12px; min-height: 280px; color: #8298a7; }
.catalog-state.error { color: #d69a84; }
.catalog-state button { border: 1px solid #48656e; border-radius: 4px; padding: 7px 12px; color: #c7d8d8; background: transparent; cursor: pointer; }
@media (max-width: 760px) {
  .catalog-toolbar { align-items: stretch; flex-wrap: wrap; }
  .catalog-search { flex: 1; }
  .type-filter { width: 100%; margin-left: 0; overflow-x: auto; }
  .type-filter button { flex: 0 0 auto; }
}
</style>

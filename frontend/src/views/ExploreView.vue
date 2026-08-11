<script setup lang="ts">
import { ArrowLeft, ArrowRight, BookOpen, Search } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { loadExploreCategories, loadExplorePage } from '../features/explore/api'
import type { ExploreCategory, ExploreCategoryDefinition, ExplorePage } from '../features/explore/types'

const { t, locale } = useI18n()
const page = ref<ExplorePage | null>(null)
const selectedCategory = ref<ExploreCategory | ''>('')
const queryInput = ref('')
const activeQuery = ref('')
const pageNumber = ref(0)
const loading = ref(false)
const failed = ref(false)
const categories = ref<ExploreCategoryDefinition[]>([])

onMounted(load)
watch([locale, selectedCategory], () => { pageNumber.value = 0; void load() })

async function load(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const [articles, definitions] = await Promise.all([
      loadExplorePage(locale.value, selectedCategory.value, activeQuery.value, pageNumber.value),
      loadExploreCategories(locale.value),
    ])
    page.value = articles
    categories.value = definitions
  }
  catch { failed.value = true }
  finally { loading.value = false }
}

function search(): void { activeQuery.value = queryInput.value.trim(); pageNumber.value = 0; void load() }
function changePage(offset: number): void { pageNumber.value += offset; void load(); window.scrollTo({ top: 0, behavior: 'smooth' }) }
function imageFailed(event: Event): void { (event.target as HTMLImageElement).closest('.explore-card-media')?.classList.add('failed') }
function categoryName(code: string): string { return categories.value.find(item => item.code === code)?.name || code }
</script>

<template>
  <section class="explore-page">
    <header class="explore-heading">
      <div>
        <p>{{ t('explore.kicker') }}</p>
        <h1>{{ t('explore.title') }}</h1>
        <span>{{ t('explore.description') }}</span>
      </div>
      <strong v-if="page">{{ t('explore.articleCount', { count: page.totalElements }) }}</strong>
    </header>

    <form class="explore-toolbar" role="search" @submit.prevent="search">
      <label class="explore-search">
        <Search :size="18" aria-hidden="true" />
        <input v-model="queryInput" type="search" :placeholder="t('explore.searchPlaceholder')" :aria-label="t('explore.search')">
      </label>
      <button type="submit">{{ t('explore.search') }}</button>
    </form>

    <div class="category-filter" role="group" :aria-label="t('explore.filterCategory')">
      <button type="button" :class="{ active: !selectedCategory }" @click="selectedCategory = ''">{{ t('explore.allCategories') }}</button>
      <button v-for="category in categories.filter(item => item.enabled)" :key="category.id" type="button"
        :class="{ active: selectedCategory === category.code }" @click="selectedCategory = category.code">
        {{ category.name }}
      </button>
    </div>

    <div v-if="loading" class="explore-state" role="status">{{ t('explore.loading') }}</div>
    <div v-else-if="failed" class="explore-state error" role="alert">
      <span>{{ t('explore.loadFailed') }}</span><button type="button" @click="load">{{ t('explore.retry') }}</button>
    </div>
    <div v-else-if="page?.items.length" class="explore-grid">
      <RouterLink v-for="article in page.items" :key="article.id" class="explore-card"
        :to="{ name: 'explore-detail', params: { slug: article.slug } }">
        <div class="explore-card-media" :class="{ empty: !article.coverImageUrl }">
          <img v-if="article.coverImageUrl" :src="article.coverImageUrl" :alt="article.coverImageAlt || ''"
            loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="imageFailed">
          <BookOpen :size="28" aria-hidden="true" />
        </div>
        <div class="explore-card-copy">
          <div class="article-meta">
            <span>{{ categoryName(article.category) }}</span>
            <span>{{ t(`explore.difficulties.${article.difficulty}`) }}</span>
            <span>{{ t('explore.minutes', { count: article.estimatedMinutes }) }}</span>
          </div>
          <h2>{{ article.title }}</h2>
          <p>{{ article.summary }}</p>
        </div>
      </RouterLink>
    </div>
    <div v-else class="explore-state"><BookOpen :size="30" /><span>{{ t('explore.noResults') }}</span></div>

    <nav v-if="page && page.totalPages > 1" class="pagination" :aria-label="t('explore.pagination')">
      <button type="button" :disabled="pageNumber === 0" :title="t('explore.previous')" @click="changePage(-1)"><ArrowLeft :size="18" /></button>
      <span>{{ pageNumber + 1 }} / {{ page.totalPages }}</span>
      <button type="button" :disabled="pageNumber + 1 >= page.totalPages" :title="t('explore.next')" @click="changePage(1)"><ArrowRight :size="18" /></button>
    </nav>
  </section>
</template>

<style scoped>
.explore-page { padding: 30px 0 64px; }
.explore-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid #263746; }
.explore-heading p { margin: 0 0 6px; color: #e1a85f; font-size: 12px; font-weight: 700; }
.explore-heading h1 { margin: 0 0 10px; font-size: 36px; line-height: 1.1; }
.explore-heading div > span { color: #9fb0ba; font-size: 15px; }
.explore-heading strong { color: #849aa7; font-size: 13px; font-weight: 500; }
.explore-toolbar { display: flex; gap: 8px; padding: 18px 0 12px; }
.explore-search { display: flex; align-items: center; gap: 9px; width: min(460px, 100%); min-height: 40px; border: 1px solid #304858; padding: 0 12px; color: #78909c; background: #091720; }
.explore-search input { flex: 1; min-width: 0; border: 0; outline: 0; color: #eff5f3; background: transparent; }
.explore-toolbar > button { min-height: 40px; border: 1px solid #b27a38; border-radius: 4px; padding: 0 16px; color: #16110a; background: #dfa75f; cursor: pointer; }
.category-filter { display: flex; gap: 5px; padding-bottom: 17px; overflow-x: auto; border-bottom: 1px solid #1c303d; scrollbar-width: none; }
.category-filter::-webkit-scrollbar { display: none; }
.category-filter button { flex: 0 0 auto; min-height: 34px; border: 1px solid #2d4351; border-radius: 4px; padding: 0 11px; color: #94a7b0; background: transparent; cursor: pointer; }
.category-filter button.active { border-color: #9a7548; color: #f0d8b9; background: #2a2117; }
.explore-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1px; margin-top: 20px; background: #243744; }
.explore-card { min-height: 310px; background: #091620; transition: background .15s ease; }
.explore-card:hover { background: #10222b; }
.explore-card-media { display: grid; place-items: center; position: relative; aspect-ratio: 16 / 9; overflow: hidden; color: #546f7a; background: #10222b; }
.explore-card-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.explore-card-media > svg { display: none; }
.explore-card-media.empty > svg, .explore-card-media.failed > svg { display: block; }
.explore-card-media.failed img { display: none; }
.explore-card-copy { padding: 17px; }
.article-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; color: #8b9da5; font-size: 11px; }
.article-meta span:first-child { color: #d8a35e; }
.explore-card h2 { margin: 9px 0 8px; font-size: 20px; line-height: 1.35; }
.explore-card p { display: -webkit-box; margin: 0; overflow: hidden; color: #9badb5; font-size: 13px; line-height: 1.6; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.explore-state { display: grid; place-items: center; gap: 12px; min-height: 300px; color: #8298a4; }
.explore-state.error { color: #dda489; }
.explore-state button, .pagination button { border: 1px solid #405d68; border-radius: 4px; padding: 7px 12px; color: #c9d7d7; background: transparent; cursor: pointer; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; padding-top: 24px; color: #91a6ae; font-size: 13px; }
.pagination button { display: grid; place-items: center; width: 38px; height: 34px; padding: 0; }
.pagination button:disabled { opacity: .35; cursor: default; }
@media (max-width: 680px) {
  .explore-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .explore-heading h1 { font-size: 32px; }
  .explore-toolbar { align-items: stretch; }
  .explore-search { flex: 1; }
  .explore-grid { grid-template-columns: 1fr; }
}
</style>

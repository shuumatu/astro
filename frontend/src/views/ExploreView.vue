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
.explore-page { padding: 40px 0 72px; }
.explore-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--color-border); }
.explore-heading p { margin: 0 0 6px; color: var(--color-gold); font-size: 12px; font-weight: 700; }
.explore-heading h1 { margin: 0 0 10px; font-size: clamp(30px, 3.2vw, 40px); line-height: 1.1; letter-spacing: -.035em; }
.explore-heading div > span { color: var(--color-text-muted); font-size: 15px; }
.explore-heading strong { color: var(--color-text-muted); font-size: 13px; font-weight: 500; }
.explore-toolbar { display: flex; gap: 10px; padding: 22px 0 14px; }
.explore-search { display: flex; align-items: center; gap: 9px; width: min(460px, 100%); min-height: 44px; border: 1px solid var(--color-border); padding: 0 12px; color: var(--color-text-subtle); background: var(--color-surface); border-radius: 10px; }
.explore-search input { flex: 1; min-width: 0; border: 0; outline: 0; color: var(--color-text); background: transparent; }
.explore-toolbar > button { min-height: 44px; border: 1px solid var(--color-blue); border-radius: 10px; padding: 0 16px; color: var(--color-on-accent); background: var(--color-blue); cursor: pointer; font-weight: 650; }
.category-filter { display: flex; gap: 7px; padding-bottom: 20px; overflow-x: auto; border-bottom: 1px solid var(--color-border); scrollbar-width: none; }
.category-filter::-webkit-scrollbar { display: none; }
.category-filter button { flex: 0 0 auto; min-height: 38px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 13px; color: var(--color-text-muted); background: transparent; cursor: pointer; }
.category-filter button.active { border-color: var(--color-blue); color: var(--color-text); background: var(--color-surface-raised); }
.explore-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 20px; margin-top: 24px; background: transparent; }
.explore-card { min-height: 310px; background: var(--color-surface); transition: background .18s ease, border-color .18s ease; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-card); }
.explore-card:hover { background: var(--color-surface-raised); border-color: color-mix(in srgb, var(--color-blue) 55%, var(--color-border)); }
.explore-card-media { display: grid; place-items: center; position: relative; aspect-ratio: 16 / 9; overflow: hidden; color: var(--color-text-subtle); background: var(--color-surface-raised); }
.explore-card-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.explore-card-media > svg { display: none; }
.explore-card-media.empty > svg, .explore-card-media.failed > svg { display: block; }
.explore-card-media.failed img { display: none; }
.explore-card-copy { padding: 21px; }
.article-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; color: var(--color-text-muted); font-size: 11px; }
.article-meta span:first-child { color: var(--color-gold); }
.explore-card h2 { margin: 9px 0 8px; font-size: 20px; line-height: 1.35; }
.explore-card p { display: -webkit-box; margin: 0; overflow: hidden; color: var(--color-text-muted); font-size: 13px; line-height: 1.75; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.explore-state { display: grid; place-items: center; gap: 12px; min-height: 300px; color: var(--color-text-muted); }
.explore-state.error { color: var(--color-danger); }
.explore-state button, .pagination button { border: 1px solid var(--color-border); border-radius: 9px; padding: 7px 12px; color: var(--color-text); background: transparent; cursor: pointer; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; padding-top: 24px; color: var(--color-text-muted); font-size: 13px; }
.pagination button { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; }
.pagination button:disabled { opacity: .35; cursor: default; }
@media (max-width: 680px) {
  .explore-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .explore-heading h1 { font-size: 32px; }
  .explore-toolbar { align-items: stretch; }
  .explore-search { flex: 1; }
  .explore-grid { grid-template-columns: 1fr; }
}
.explore-search:focus-within { border-color: var(--color-blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-blue) 12%, transparent); }
.explore-search input::placeholder { color: var(--color-text-subtle); }
.category-filter button:hover { color: var(--color-text); border-color: var(--color-blue); }
</style>

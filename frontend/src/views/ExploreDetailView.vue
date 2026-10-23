<script setup lang="ts">
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { loadExploreArticle, loadExploreCategories } from '../features/explore/api'
import { handleExploreImageError, renderExploreMarkdown } from '../features/explore/markdown'
import type { ExploreArticle, ExploreCategoryDefinition } from '../features/explore/types'

const route = useRoute()
const { t, locale } = useI18n()
const article = ref<ExploreArticle | null>(null)
const loading = ref(false)
const failed = ref(false)
const coverFailed = ref(false)
const categories = ref<ExploreCategoryDefinition[]>([])
const slug = computed(() => route.params.slug as string)
const rendered = computed(() => article.value ? renderExploreMarkdown(article.value.bodyMarkdown, article.value.imageCredits) : { html: '', headings: [] })
const coverCredit = computed(() => article.value?.imageCredits.find(item => item.imageUrl === article.value?.coverImageUrl) || null)

watch([slug, locale], load, { immediate: true })
onBeforeUnmount(() => resetMetadata())

async function load(): Promise<void> {
  loading.value = true; failed.value = false; coverFailed.value = false
  try {
    const [loadedArticle, definitions] = await Promise.all([
      loadExploreArticle(slug.value, locale.value), loadExploreCategories(locale.value),
    ])
    article.value = loadedArticle
    categories.value = definitions
    updateMetadata()
  }
  catch { failed.value = true; article.value = null }
  finally { loading.value = false }
}

function updateMetadata(): void {
  if (!article.value) return
  document.title = `${article.value.title} | Astro Learning`
  setMeta('description', article.value.summary)
  setMeta('og:title', article.value.title, true)
  setMeta('og:description', article.value.summary, true)
  setMeta('og:image', article.value.coverImageUrl || '', true)
}
function resetMetadata(): void { document.title = 'Astro Learning' }
function setMeta(name: string, content: string, property = false): void {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) { element = document.createElement('meta'); element.setAttribute(property ? 'property' : 'name', name); document.head.append(element) }
  element.content = content
}
function formatDate(value: string): string { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value)) }
function categoryName(code: string): string { return categories.value.find(item => item.code === code)?.name || code }
</script>

<template>
  <article class="explore-detail">
    <RouterLink class="back-link" to="/explore"><ArrowLeft :size="16" />{{ t('explore.back') }}</RouterLink>
    <div v-if="loading" class="detail-state" role="status">{{ t('explore.loading') }}</div>
    <div v-else-if="failed" class="detail-state error" role="alert">{{ t('explore.loadFailed') }}</div>
    <div v-else-if="!article" class="detail-state"><BookOpen :size="30" />{{ t('explore.notFound') }}</div>
    <template v-else>
      <header class="article-header">
        <span class="category">{{ categoryName(article.category) }}</span>
        <h1>{{ article.title }}</h1>
        <p>{{ article.summary }}</p>
        <div class="article-meta">
          <span>{{ t('explore.minutes', { count: article.estimatedMinutes }) }}</span>
          <span>{{ t('explore.updated', { date: formatDate(article.updatedAt) }) }}</span>
        </div>
      </header>

      <figure v-if="article.coverImageUrl" class="cover-image" :class="{ failed: coverFailed }">
        <img v-if="!coverFailed" :src="article.coverImageUrl" :alt="article.coverImageAlt || ''" decoding="async"
          referrerpolicy="no-referrer" @error="coverFailed = true">
        <div v-else class="cover-fallback">{{ article.coverImageAlt || t('explore.imageUnavailable') }}</div>
        <figcaption v-if="article.coverImageCaption || coverCredit">
          {{ article.coverImageCaption }}
          <a v-if="coverCredit" :href="coverCredit.sourcePageUrl" target="_blank" rel="noopener noreferrer">
            {{ coverCredit.attribution || coverCredit.author || t('explore.imageSource') }}<ExternalLink :size="12" />
          </a>
        </figcaption>
      </figure>

      <details v-if="rendered.headings.length" class="mobile-toc">
        <summary>{{ t('explore.contents') }}</summary>
        <a v-for="heading in rendered.headings" :key="heading.id" :class="`level-${heading.level}`" :href="`#${heading.id}`">{{ heading.text }}</a>
      </details>

      <div class="article-layout">
        <main>
          <div class="article-body" v-html="rendered.html" @error.capture="handleExploreImageError"></div>
          <section v-if="article.sources.length" class="article-sources">
            <h2>{{ t('explore.sources') }}</h2>
            <a v-for="source in article.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">
              <span><strong>{{ source.title }}</strong><small v-if="source.author">{{ source.author }}</small></span><ExternalLink :size="15" />
            </a>
          </section>
        </main>
        <aside v-if="rendered.headings.length" class="desktop-toc">
          <strong>{{ t('explore.contents') }}</strong>
          <a v-for="heading in rendered.headings" :key="heading.id" :class="`level-${heading.level}`" :href="`#${heading.id}`">{{ heading.text }}</a>
        </aside>
      </div>

      <section v-if="article.relatedArticles.length" class="related-section">
        <h2>{{ t('explore.related') }}</h2>
        <div>
          <RouterLink v-for="related in article.relatedArticles" :key="related.id" :to="{ name: 'explore-detail', params: { slug: related.slug } }">
            <span>{{ categoryName(related.category) }}</span><strong>{{ related.title }}</strong><small>{{ related.summary }}</small>
          </RouterLink>
        </div>
      </section>
    </template>
  </article>
</template>

<style scoped>
.explore-detail { max-width: 1120px; padding: 36px 0 72px; }
.back-link { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 28px; color: var(--color-blue); font-size: 13px; }
.article-header { max-width: 760px; }
.category { color: var(--color-gold); font-size: 12px; font-weight: 700; }
.article-header h1 { margin: 9px 0 13px; font-size: clamp(34px, 4vw, 48px); line-height: 1.16; letter-spacing: -.035em; overflow-wrap: anywhere; }
.article-header > p { margin: 0; color: var(--color-text-muted); font-size: 18px; line-height: 1.65; }
.article-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; color: var(--color-text-muted); font-size: 12px; }
.cover-image { max-width: 920px; margin: 30px 0 0; }
.cover-image img { display: block; width: 100%; max-height: 68vh; border-radius: var(--radius-card); object-fit: cover; background: var(--color-surface-raised); }
.cover-fallback { display: grid; min-height: 260px; place-items: center; border: 1px dashed var(--color-border); border-radius: var(--radius-card); padding: 18px; color: var(--color-text-muted); background: var(--color-surface); text-align: center; }
.cover-image figcaption { display: flex; flex-wrap: wrap; gap: 6px 12px; padding-top: 8px; color: var(--color-text-subtle); font-size: 12px; }
.cover-image a { display: inline-flex; align-items: center; gap: 4px; color: var(--color-gold); }
.article-layout { display: grid; grid-template-columns: minmax(0, 720px) 220px; gap: 64px; margin-top: 38px; }
.article-body { color: var(--color-text-muted); font-size: 17px; line-height: 1.8; min-width: 0; }
.article-body :deep(h2), .article-body :deep(h3) { scroll-margin-top: 24px; color: var(--color-text); line-height: 1.3; }
.article-body :deep(h2) { margin: 42px 0 15px; font-size: 27px; }
.article-body :deep(h3) { margin: 30px 0 12px; font-size: 20px; }
.article-body :deep(p) { margin: 0 0 18px; }
.article-body :deep(a) { color: var(--color-blue); text-decoration: underline; text-underline-offset: 3px; }
.article-body :deep(blockquote) { margin: 24px 0; border-left: 3px solid color-mix(in srgb, var(--color-gold) 48%, var(--color-border)); padding: 16px 20px; color: var(--color-text-muted); background: var(--color-surface); border-radius: 0 12px 12px 0; }
.article-body :deep(pre) { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; background: var(--color-bg); }
.article-body :deep(table) { width: 100%; border-collapse: collapse; font-size: 14px; }
.article-body :deep(.explore-table-scroll) { max-width: 100%; overflow-x: auto; }
.article-body :deep(th), .article-body :deep(td) { border: 1px solid var(--color-border); padding: 9px 11px; text-align: left; }
.article-body :deep(.explore-figure) { margin: 28px 0; }
.article-body :deep(.explore-figure img) { display: block; width: 100%; max-height: 72vh; border-radius: 12px; object-fit: contain; background: var(--color-surface); }
.article-body :deep(.explore-figure figcaption) { padding-top: 8px; color: var(--color-text-subtle); font-size: 12px; line-height: 1.55; }
.article-body :deep(.explore-figure.is-failed figcaption) { display: none; }
.article-body :deep(.explore-image-fallback) { display: grid; min-height: 160px; place-items: center; gap: 8px; border: 1px dashed var(--color-border); padding: 18px; color: var(--color-text-muted); background: var(--color-surface); text-align: center; }
.article-body :deep(.explore-image-fallback[hidden]) { display: none; }
.desktop-toc { position: sticky; top: 96px; align-self: start; border-left: 1px solid var(--color-border); padding-left: 18px; }
.desktop-toc strong { display: block; margin-bottom: 11px; color: var(--color-text); font-size: 12px; }
.desktop-toc a, .mobile-toc a { display: block; margin: 8px 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
.desktop-toc a.level-3, .mobile-toc a.level-3 { padding-left: 12px; }
.mobile-toc { display: none; }
.article-sources { margin-top: 48px; border-top: 1px solid var(--color-border); padding-top: 24px; }
.article-sources h2, .related-section h2 { margin: 0 0 16px; font-size: 18px; }
.article-sources a { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 8px 0; border-bottom: 1px solid var(--color-border); padding: 9px 0; color: var(--color-blue); font-size: 13px; }
.article-sources span { display: grid; gap: 3px; }.article-sources small { color: var(--color-text-muted); }
.related-section { margin-top: 62px; border-top: 1px solid var(--color-border); padding-top: 24px; }
.related-section > div { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; background: transparent; }
.related-section a { display: grid; gap: 8px; min-height: 150px; padding: 21px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); }
.related-section span { color: var(--color-gold); font-size: 11px; }.related-section strong { font-size: 17px; }
.related-section small { color: var(--color-text-muted); font-size: 12px; line-height: 1.5; }
.detail-state { display: grid; min-height: 420px; place-items: center; color: var(--color-text-muted); }.detail-state.error { color: var(--color-danger); }
@media (max-width: 860px) {
  .article-layout { grid-template-columns: 1fr; margin-top: 24px; }
  .desktop-toc { display: none; }
  .mobile-toc { display: block; max-width: 720px; margin-top: 28px; border: 1px solid var(--color-border); border-radius: 4px; padding: 12px 14px; color: var(--color-text); }
  .mobile-toc summary { cursor: pointer; font-size: 13px; }
  .related-section > div { grid-template-columns: 1fr; }
}
@media (max-width: 560px) { .article-header h1 { font-size: 34px; }.article-header > p { font-size: 16px; }.article-body { font-size: 16px; } }
.desktop-toc a:hover, .mobile-toc a:hover { color: var(--color-blue); }
.related-section a:hover { border-color: var(--color-blue); background: var(--color-surface-raised); }
</style>

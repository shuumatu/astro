<script setup lang="ts">
import { Archive, BookOpen, Download, Eye, FilePlus2, FolderCog, History, ImagePlus, LogOut, Plus, RotateCcw, Save, Search, Send, Undo2, Upload, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave } from 'vue-router'
import { ADMIN_SESSION_EXPIRED_EVENT, clearAdminSession, invalidateAdminSession, loadAdminSession, saveAdminSession, scheduleAdminSessionExpiry } from '../features/adminSession'
import { loginAdmin } from '../features/catalog/api'
import {
  createExploreArticle, createExploreCategory, exportExploreMarkdown, importExploreMarkdown,
  loadAdminExplore, loadAdminExploreCategories, loadExplorePreview, loadExploreRevisions, publishExplore,
  restoreExploreRevision, saveExploreDraft, setExploreArchived, unpublishExplore, updateExploreCategory, updateExploreMetadata,
} from '../features/explore/api'
import { emptyExploreDraft, insertMarkdownImage, reconcileImageCredits } from '../features/explore/draft'
import ExploreMarkdownEditor from '../features/explore/ExploreMarkdownEditor.vue'
import { handleExploreImageError, renderExploreMarkdown } from '../features/explore/markdown'
import type {
  AdminExploreCategory, AdminExplorePage, AdminExploreSummary, ExploreArticle, ExploreCategory, ExploreDraft, ExploreRevisionSummary,
} from '../features/explore/types'

const locales = ['zh-CN', 'en'] as const
const { t, locale } = useI18n()

const storedSession = loadAdminSession()
const token = ref(storedSession.token)
const sessionExpiresAt = ref(storedSession.expiresAt)
const sessionExpired = ref(storedSession.expired)
const reauthenticating = ref(false)
const username = ref('admin')
const password = ref('')
const loginPending = ref(false)
const loginError = ref(false)
const page = ref<AdminExplorePage | null>(null)
const categories = ref<AdminExploreCategory[]>([])
const selectedId = ref('')
const activeLocale = ref<(typeof locales)[number]>('zh-CN')
const query = ref('')
const filterCategory = ref<ExploreCategory | ''>('')
const filterStatus = ref('')
const listLoading = ref(false)
const editorLoading = ref(false)
const failed = ref(false)
const editorMode = ref<'edit' | 'preview'>('edit')
const bodyEditor = ref<InstanceType<typeof ExploreMarkdownEditor> | null>(null)
const markdownInput = ref<HTMLInputElement | null>(null)
const draft = reactive<ExploreDraft>(emptyExploreDraft())
const tagText = ref('')
const baseline = ref('')
const revisions = ref<ExploreRevisionSummary[]>([])
const saving = ref(false)
const publishing = ref(false)
const feedback = reactive({ message: '', error: false })
const createForm = reactive<{ title: string, slug: string, category: ExploreCategory }>({ title: '', slug: '', category: '' })
const slugEdited = ref(false)
const createPending = ref(false)
const showImageForm = ref(false)
const imageForm = reactive({ url: '', alt: '', caption: '', sourcePageUrl: '', author: '', license: '', attribution: '' })
const showCategoryManager = ref(false)
const categorySaving = ref(false)
const categoryForm = reactive({ id: '', code: '', sortOrder: 10, enabled: true, zhName: '', zhDescription: '', enName: '', enDescription: '' })
let sessionExpiryTimer: number | undefined

const entries = computed(() => page.value?.items || [])
const selected = computed(() => entries.value.find(item => item.id === selectedId.value) || null)
const translation = computed(() => selected.value?.translations.find(item => item.locale === activeLocale.value) || null)
const hasPublished = computed(() => Boolean(translation.value?.publishedRevision))
const hasDraft = computed(() => Boolean(translation.value?.draftRevision))
const preview = computed(() => renderExploreMarkdown(draft.bodyMarkdown, draft.imageCredits))
const dirty = computed(() => fingerprint() !== baseline.value)

onMounted(() => {
  window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
  scheduleSessionExpiry()
  if (token.value) void initialize()
})
watch([filterCategory, filterStatus], () => void refresh(false))
watch(activeLocale, () => { if (confirmDiscard()) void loadSelection() })
watch(() => draft.bodyMarkdown, () => reconcileImageCredits(draft))
watch(() => draft.coverImageUrl, () => reconcileImageCredits(draft))
watch(() => createForm.title, value => {
  if (!slugEdited.value) createForm.slug = slugifyTitle(value)
})
watch(dirty, value => value ? window.addEventListener('beforeunload', preventUnload) : window.removeEventListener('beforeunload', preventUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', preventUnload)
  window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
  clearSessionExpiryTimer()
})
onBeforeRouteLeave(() => confirmDiscard())

function preventUnload(event: BeforeUnloadEvent): void { event.preventDefault(); event.returnValue = true }
function fingerprint(): string { return JSON.stringify({ draft, tags: tagText.value, category: selected.value?.category }) }
function confirmDiscard(): boolean { return !dirty.value || window.confirm(t('adminExplore.discardChanges')) }
function setDraft(value: ExploreDraft): void {
  Object.assign(draft, value)
  draft.tags = [...value.tags]; draft.sources = value.sources.map(item => ({ ...item })); draft.imageCredits = value.imageCredits.map(item => ({ ...item }))
  tagText.value = value.tags.join(', ')
  nextTick(() => { baseline.value = fingerprint() })
}
function showFeedback(message: string, error = false): void { feedback.message = message; feedback.error = error }
function categoryName(code: string): string {
  const category = categories.value.find(item => item.code === code)
  const translation = category?.translations.find(item => item.locale === activeLocale.value)
    || category?.translations.find(item => item.locale === 'en')
  return translation?.name || code
}
function selectableCategories(current = ''): AdminExploreCategory[] {
  return categories.value.filter(item => item.enabled || item.code === current)
}

async function initialize(): Promise<void> {
  await Promise.all([refresh(true), refreshCategories()])
}

async function refreshCategories(): Promise<void> {
  categories.value = await loadAdminExploreCategories(token.value)
  if (!createForm.category || !categories.value.some(item => item.code === createForm.category && item.enabled)) {
    createForm.category = categories.value.find(item => item.enabled)?.code || ''
  }
}

async function login(): Promise<void> {
  loginPending.value = true; loginError.value = false
  try {
    const session = await loginAdmin(username.value, password.value)
    token.value = session.accessToken; sessionExpiresAt.value = session.expiresAt
    saveAdminSession(session.accessToken, session.expiresAt); scheduleSessionExpiry()
    password.value = ''; sessionExpired.value = false
    if (reauthenticating.value) reauthenticating.value = false
    else await initialize()
  }
  catch { loginError.value = true }
  finally { loginPending.value = false }
}
function logout(): void {
  if (!confirmDiscard()) return
  clearAdminSession(); clearSessionExpiryTimer(); token.value = ''; sessionExpiresAt.value = null
  sessionExpired.value = false; reauthenticating.value = false; page.value = null; selectedId.value = ''
}

function handleSessionExpired(): void {
  reauthenticating.value = page.value !== null
  token.value = ''; sessionExpiresAt.value = null; sessionExpired.value = true
  clearSessionExpiryTimer()
}

function scheduleSessionExpiry(): void {
  clearSessionExpiryTimer()
  sessionExpiryTimer = scheduleAdminSessionExpiry(sessionExpiresAt.value, () => invalidateAdminSession('expired'))
}

function clearSessionExpiryTimer(): void {
  if (sessionExpiryTimer) window.clearTimeout(sessionExpiryTimer)
  sessionExpiryTimer = undefined
}

async function refresh(loadSelected: boolean): Promise<void> {
  listLoading.value = true; failed.value = false
  try {
    page.value = await loadAdminExplore(token.value, { category: filterCategory.value, status: filterStatus.value, query: query.value.trim() })
    if (!entries.value.some(item => item.id === selectedId.value)) selectedId.value = entries.value[0]?.id || ''
    if (loadSelected && selectedId.value) await loadSelection()
  } catch { failed.value = true }
  finally { listLoading.value = false }
}

async function selectEntry(entry: AdminExploreSummary): Promise<void> {
  if (entry.id === selectedId.value || !confirmDiscard()) return
  selectedId.value = entry.id; await loadSelection()
}

async function loadSelection(): Promise<void> {
  if (!selectedId.value) { setDraft(emptyExploreDraft()); revisions.value = []; return }
  editorLoading.value = true; feedback.message = ''
  try {
    const [article, history] = await Promise.all([
      loadExplorePreview(token.value, selectedId.value, activeLocale.value),
      loadExploreRevisions(token.value, selectedId.value, activeLocale.value),
    ])
    setDraft(article ? draftFromArticle(article) : emptyExploreDraft())
    revisions.value = history
  } catch { showFeedback(t('adminExplore.loadFailed'), true) }
  finally { editorLoading.value = false }
}

async function createArticle(): Promise<void> {
  createPending.value = true
  try {
    const created = await createExploreArticle(token.value, {
      title: createForm.title.trim(), slug: createForm.slug.trim(), category: createForm.category, locale: activeLocale.value,
    })
    createForm.title = ''; createForm.slug = ''; slugEdited.value = false
    await refresh(false); selectedId.value = created.id; await loadSelection(); showFeedback(t('adminExplore.created'))
  } catch { showFeedback(t('adminExplore.createFailed'), true) }
  finally { createPending.value = false }
}

async function save(): Promise<boolean> {
  if (!selected.value) return false
  saving.value = true
  try {
    draft.tags = tagText.value.split(/[,，]/).map(item => item.trim()).filter(Boolean).slice(0, 12)
    reconcileImageCredits(draft)
    await updateExploreMetadata(token.value, selected.value.id, { category: selected.value.category })
    const saved = await saveExploreDraft(token.value, selected.value.id, activeLocale.value, cleanDraft())
    setDraft(draftFromArticle(saved)); await refresh(false); await loadHistory(); showFeedback(t('adminExplore.saved')); return true
  } catch { showFeedback(t('adminExplore.saveFailed'), true); return false }
  finally { saving.value = false }
}

function slugifyTitle(value: string): string {
  return value.normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

async function publish(): Promise<void> {
  if (!selected.value) return
  publishing.value = true
  try {
    if (dirty.value && !(await save())) return
    const article = await publishExplore(token.value, selected.value.id, activeLocale.value)
    setDraft(draftFromArticle(article)); await refresh(false); await loadHistory(); showFeedback(t('adminExplore.published'))
  } catch { showFeedback(t('adminExplore.publishFailed'), true) }
  finally { publishing.value = false }
}

async function unpublish(): Promise<void> {
  if (!selected.value || !window.confirm(t('adminExplore.unpublishConfirm'))) return
  try { await unpublishExplore(token.value, selected.value.id, activeLocale.value); await refresh(false); await loadHistory(); showFeedback(t('adminExplore.unpublished')) }
  catch { showFeedback(t('adminExplore.actionFailed'), true) }
}

async function toggleArchive(): Promise<void> {
  if (!selected.value) return
  try { await setExploreArchived(token.value, selected.value.id, !selected.value.archived); await refresh(true); showFeedback(t('adminExplore.archived')) }
  catch { showFeedback(t('adminExplore.actionFailed'), true) }
}

async function loadHistory(): Promise<void> { if (selected.value) revisions.value = await loadExploreRevisions(token.value, selected.value.id, activeLocale.value) }
async function restoreRevision(revision: ExploreRevisionSummary): Promise<void> {
  if (!selected.value || !confirmDiscard()) return
  try { const article = await restoreExploreRevision(token.value, selected.value.id, activeLocale.value, revision.id); setDraft(draftFromArticle(article)); await refresh(false); await loadHistory(); showFeedback(t('adminExplore.revisionRestored')) }
  catch { showFeedback(t('adminExplore.actionFailed'), true) }
}

function editCategory(category?: AdminExploreCategory): void {
  const zh = category?.translations.find(item => item.locale === 'zh-CN')
  const en = category?.translations.find(item => item.locale === 'en')
  Object.assign(categoryForm, {
    id: category?.id || '', code: category?.code || '', sortOrder: category?.sortOrder ?? ((categories.value.at(-1)?.sortOrder || 0) + 10),
    enabled: category?.enabled ?? true, zhName: zh?.name || '', zhDescription: zh?.description || '',
    enName: en?.name || '', enDescription: en?.description || '',
  })
}

async function saveCategory(): Promise<void> {
  categorySaving.value = true
  const translations = [
    { locale: 'zh-CN', name: categoryForm.zhName.trim(), description: categoryForm.zhDescription.trim() || null },
    { locale: 'en', name: categoryForm.enName.trim(), description: categoryForm.enDescription.trim() || null },
  ]
  try {
    if (categoryForm.id) await updateExploreCategory(token.value, categoryForm.id, { sortOrder: categoryForm.sortOrder, enabled: categoryForm.enabled, translations })
    else await createExploreCategory(token.value, { code: categoryForm.code.trim().toUpperCase(), sortOrder: categoryForm.sortOrder, translations })
    await refreshCategories(); editCategory(); showFeedback(t('adminExplore.categorySaved'))
  } catch { showFeedback(t('adminExplore.categorySaveFailed'), true) }
  finally { categorySaving.value = false }
}

async function downloadMarkdown(): Promise<void> {
  if (!selected.value) return
  try {
    const file = await exportExploreMarkdown(token.value, selected.value.id, activeLocale.value)
    const url = URL.createObjectURL(file.content)
    const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click()
    URL.revokeObjectURL(url)
  } catch { showFeedback(t('adminExplore.markdownExportFailed'), true) }
}

async function importMarkdownFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !selected.value || !confirmDiscard()) return
  try {
    const article = await importExploreMarkdown(token.value, selected.value.id, activeLocale.value, await file.text())
    setDraft(draftFromArticle(article)); await refresh(false); await loadHistory(); showFeedback(t('adminExplore.markdownImported'))
  } catch { showFeedback(t('adminExplore.markdownImportFailed'), true) }
}

function addSource(): void { draft.sources.push({ title: '', url: '', author: null, license: null, attribution: null }) }
function openImageForm(): void { Object.assign(imageForm, { url: '', alt: '', caption: '', sourcePageUrl: '', author: '', license: '', attribution: '' }); showImageForm.value = true }
async function insertImage(): Promise<void> {
  if (!/^https:\/\//i.test(imageForm.url) || !imageForm.alt.trim()) { showFeedback(t('adminExplore.imageInvalid'), true); return }
  const markdown = insertMarkdownImage('', 0, imageForm).markdown.trim()
  if (bodyEditor.value) bodyEditor.value.insertMarkdown(`\n\n${markdown}\n\n`)
  else draft.bodyMarkdown = `${draft.bodyMarkdown}\n\n${markdown}`.trim()
  reconcileImageCredits(draft)
  const credit = draft.imageCredits.find(item => item.imageUrl === imageForm.url.trim())
  if (credit) Object.assign(credit, { sourcePageUrl: imageForm.sourcePageUrl.trim(), author: imageForm.author || null, license: imageForm.license || null, attribution: imageForm.attribution || null })
  showImageForm.value = false
  await nextTick()
}
function cleanDraft(): ExploreDraft {
  return {
    ...JSON.parse(JSON.stringify(draft)) as ExploreDraft,
    coverImageUrl: draft.coverImageUrl?.trim() || null,
    coverImageAlt: draft.coverImageAlt?.trim() || null,
    coverImageCaption: draft.coverImageCaption?.trim() || null,
    sources: draft.sources.filter(item => item.title.trim() || item.url.trim()).map(item => ({
      ...item, author: item.author?.trim() || null, license: item.license?.trim() || null, attribution: item.attribution?.trim() || null,
    })),
    imageCredits: draft.imageCredits.map(item => ({
      ...item, sourcePageUrl: item.sourcePageUrl?.trim() || '', author: item.author?.trim() || null,
      license: item.license?.trim() || null, attribution: item.attribution?.trim() || null,
    })),
  }
}
function draftFromArticle(article: ExploreArticle): ExploreDraft {
  return { title: article.title, summary: article.summary, bodyMarkdown: article.bodyMarkdown, tags: [...article.tags], estimatedMinutes: article.estimatedMinutes,
    coverImageUrl: article.coverImageUrl, coverImageAlt: article.coverImageAlt, coverImageCaption: article.coverImageCaption,
    sources: article.sources.map(item => ({ ...item })), imageCredits: article.imageCredits.map(item => ({ ...item })) }
}
</script>

<template>
  <section class="explore-admin">
    <form v-if="!token" class="login-panel" @submit.prevent="login">
      <BookOpen :size="28" /><h1>{{ t('adminExplore.title') }}</h1>
      <label><span>{{ t('adminCatalog.username') }}</span><input v-model="username" autocomplete="username"></label>
      <label><span>{{ t('adminCatalog.password') }}</span><input v-model="password" type="password" autocomplete="current-password"></label>
      <button :disabled="loginPending" type="submit">{{ t('adminCatalog.login') }}</button>
      <p v-if="sessionExpired" role="alert">{{ t('adminCatalog.sessionExpired') }}</p>
      <p v-if="loginError" role="alert">{{ t('adminCatalog.loginFailed') }}</p>
    </form>

    <template v-else>
      <header class="admin-header">
        <div><p>{{ t('adminExplore.kicker') }}</p><h1>{{ t('adminExplore.title') }}</h1></div>
        <div class="header-actions">
          <button type="button" class="icon-button" :title="t('adminExplore.manageCategories')" @click="showCategoryManager = true; editCategory()"><FolderCog :size="18" /></button>
          <button type="button" class="icon-button" :title="t('adminCatalog.logout')" @click="logout"><LogOut :size="18" /></button>
        </div>
      </header>

      <div class="admin-layout">
        <aside class="article-list">
          <form class="create-form" @submit.prevent="createArticle">
            <label><span>{{ t('adminExplore.newArticleTitle') }}</span><input v-model="createForm.title" required maxlength="160" :placeholder="t('adminExplore.newArticleTitlePlaceholder')"></label>
            <label><span>{{ t('adminExplore.slug') }}</span><input v-model="createForm.slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="meteor-showers" @input="slugEdited = true"></label>
            <small>{{ t('adminExplore.slugHint') }}</small>
            <label><span>{{ t('adminExplore.category') }}</span><select v-model="createForm.category" required><option v-for="item in selectableCategories()" :key="item.id" :value="item.code">{{ categoryName(item.code) }}</option></select></label>
            <button type="submit" :disabled="createPending"><FilePlus2 :size="16" />{{ t('adminExplore.create') }}</button>
          </form>
          <form class="list-search" @submit.prevent="refresh(false)"><Search :size="16" /><input v-model="query" :placeholder="t('adminExplore.search')"></form>
          <div class="list-filters">
            <select v-model="filterCategory"><option value="">{{ t('explore.allCategories') }}</option><option v-for="item in categories" :key="item.id" :value="item.code">{{ categoryName(item.code) }}</option></select>
            <select v-model="filterStatus"><option value="">{{ t('adminExplore.allStatuses') }}</option><option value="DRAFT">{{ t('adminExplore.draft') }}</option><option value="PUBLISHED">{{ t('adminExplore.public') }}</option><option value="ARCHIVED">{{ t('adminExplore.archivedStatus') }}</option></select>
          </div>
          <div v-if="listLoading" class="list-state">{{ t('explore.loading') }}</div>
          <button v-for="entry in entries" v-else :key="entry.id" type="button" class="article-row" :class="{ active: selectedId === entry.id }" @click="selectEntry(entry)">
            <span>{{ categoryName(entry.category) }}<small v-if="entry.archived">{{ t('adminExplore.archivedStatus') }}</small></span>
            <strong>{{ entry.translations.find(item => item.locale === activeLocale)?.title || entry.slug }}</strong><code>{{ entry.slug }}</code>
          </button>
          <div v-if="failed" class="list-state error">{{ t('adminExplore.loadFailed') }}</div>
        </aside>

        <section v-if="selected" class="editor-panel">
          <header class="editor-toolbar">
            <div class="locale-tabs"><button v-for="item in locales" :key="item" type="button" :class="{ active: activeLocale === item }" @click="activeLocale = item">{{ item }}</button></div>
            <div class="mode-tabs"><button type="button" :class="{ active: editorMode === 'edit' }" @click="editorMode = 'edit'"><FilePlus2 :size="15" />{{ t('adminExplore.edit') }}</button><button type="button" :class="{ active: editorMode === 'preview' }" @click="editorMode = 'preview'"><Eye :size="15" />{{ t('adminExplore.preview') }}</button></div>
            <span v-if="dirty" class="dirty">{{ t('adminExplore.unsaved') }}</span>
            <input ref="markdownInput" class="hidden-file" type="file" accept=".md,text/markdown,text/plain" @change="importMarkdownFile">
            <button type="button" class="icon-command" :title="t('adminExplore.importMarkdown')" @click="markdownInput?.click()"><Upload :size="16" /></button>
            <button type="button" class="icon-command" :title="t('adminExplore.exportMarkdown')" @click="downloadMarkdown"><Download :size="16" /></button>
            <button type="button" class="command" :disabled="saving" @click="save"><Save :size="16" />{{ t('adminExplore.save') }}</button>
            <button type="button" class="command primary" :disabled="publishing" @click="publish"><Send :size="16" />{{ t('adminExplore.publish') }}</button>
          </header>

          <div v-if="editorLoading" class="editor-state">{{ t('explore.loading') }}</div>
          <form v-else-if="editorMode === 'edit'" class="editor-form" @submit.prevent="save">
            <div class="metadata-row"><label><span>{{ t('adminExplore.category') }}</span><select v-model="selected.category"><option v-for="item in selectableCategories(selected.category)" :key="item.id" :value="item.code">{{ categoryName(item.code) }}</option></select></label>
              <label><span>{{ t('adminExplore.minutes') }}</span><input v-model.number="draft.estimatedMinutes" type="number" min="1" max="60"></label></div>
            <label><span>{{ t('adminExplore.articleTitle') }}</span><input v-model="draft.title" maxlength="160"></label>
            <label><span>{{ t('adminExplore.summary') }}</span><textarea v-model="draft.summary" rows="3" maxlength="600"></textarea></label>
            <label><span>{{ t('adminExplore.tags') }}</span><input v-model="tagText" :placeholder="t('adminExplore.tagsHint')"></label>
            <div class="body-label"><span>{{ t('adminExplore.body') }}</span><button type="button" @click="openImageForm"><ImagePlus :size="15" />{{ t('adminExplore.insertImage') }}</button></div>
            <ExploreMarkdownEditor
              :key="locale"
              ref="bodyEditor"
              v-model="draft.bodyMarkdown"
              :interface-language="locale"
              :placeholder="t('adminExplore.bodyPlaceholder')"
            />

            <section class="form-section"><header><h2>{{ t('adminExplore.cover') }}</h2></header>
              <input v-model="draft.coverImageUrl" type="url" placeholder="https://"><input v-model="draft.coverImageAlt" :placeholder="t('adminExplore.altText')"><input v-model="draft.coverImageCaption" :placeholder="t('adminExplore.caption')"></section>
            <section class="form-section"><header><h2>{{ t('adminExplore.sources') }}</h2><button type="button" @click="addSource"><Plus :size="15" /></button></header>
              <div v-for="(source, index) in draft.sources" :key="index" class="repeat-row"><input v-model="source.title" :placeholder="t('adminExplore.sourceTitle')"><input v-model="source.url" type="url" placeholder="https://"><input v-model="source.author" :placeholder="t('adminExplore.author')"><button type="button" @click="draft.sources.splice(index, 1)"><X :size="15" /></button></div></section>
            <section class="form-section"><header><h2>{{ t('adminExplore.imageCredits') }}</h2></header>
              <div v-for="credit in draft.imageCredits" :key="credit.imageUrl" class="credit-row"><code>{{ credit.imageUrl }}</code><input v-model="credit.sourcePageUrl" type="url" :placeholder="t('adminExplore.sourcePage')"><input v-model="credit.author" :placeholder="t('adminExplore.author')"><input v-model="credit.license" :placeholder="t('adminExplore.license')"><input v-model="credit.attribution" :placeholder="t('adminExplore.attribution')"></div>
              <p v-if="!draft.imageCredits.length">{{ t('adminExplore.noImages') }}</p></section>
          </form>

          <article v-else class="article-preview">
            <span>{{ categoryName(selected.category) }}</span><h1>{{ draft.title || t('adminExplore.untitled') }}</h1><p>{{ draft.summary }}</p>
            <img v-if="draft.coverImageUrl" class="preview-cover" :src="draft.coverImageUrl" :alt="draft.coverImageAlt || ''" referrerpolicy="no-referrer">
            <div class="preview-body" v-html="preview.html" @error.capture="handleExploreImageError"></div>
          </article>

          <footer class="editor-footer">
            <div class="publication-actions"><button v-if="hasPublished" type="button" @click="unpublish"><Undo2 :size="15" />{{ t('adminExplore.unpublish') }}</button><button type="button" @click="toggleArchive"><Archive :size="15" />{{ selected.archived ? t('adminExplore.restore') : t('adminExplore.archive') }}</button></div>
            <section class="history"><h2><History :size="16" />{{ t('adminExplore.history') }}</h2><button v-for="item in revisions" :key="item.id" type="button" :disabled="item.status === 'DRAFT'" @click="restoreRevision(item)"><span>v{{ item.revision }} · {{ t(`adminExplore.status.${item.status}`) }}</span><RotateCcw :size="14" /></button></section>
          </footer>
          <p v-if="feedback.message" :class="['feedback', { error: feedback.error }]" role="status">{{ feedback.message }}</p>
        </section>
        <div v-else class="empty-editor">{{ t('adminExplore.selectArticle') }}</div>
      </div>
    </template>

    <div v-if="showImageForm" class="dialog-backdrop" @click.self="showImageForm = false">
      <form class="image-dialog" @submit.prevent="insertImage"><header><h2>{{ t('adminExplore.insertImage') }}</h2><button type="button" @click="showImageForm = false"><X :size="18" /></button></header>
        <label><span>URL</span><input v-model="imageForm.url" required type="url" placeholder="https://"></label><label><span>{{ t('adminExplore.altText') }}</span><input v-model="imageForm.alt" required></label><label><span>{{ t('adminExplore.caption') }}</span><input v-model="imageForm.caption"></label><label><span>{{ t('adminExplore.sourcePage') }}</span><input v-model="imageForm.sourcePageUrl" type="url" placeholder="https://"></label>
        <div class="metadata-row"><label><span>{{ t('adminExplore.author') }}</span><input v-model="imageForm.author"></label><label><span>{{ t('adminExplore.license') }}</span><input v-model="imageForm.license"></label></div><label><span>{{ t('adminExplore.attribution') }}</span><input v-model="imageForm.attribution"></label>
        <button type="submit" class="primary"><ImagePlus :size="16" />{{ t('adminExplore.insert') }}</button></form>
    </div>

    <div v-if="showCategoryManager" class="dialog-backdrop" @click.self="showCategoryManager = false">
      <section class="category-dialog">
        <header><h2>{{ t('adminExplore.manageCategories') }}</h2><button type="button" @click="showCategoryManager = false"><X :size="18" /></button></header>
        <div class="category-manager">
          <nav>
            <button type="button" class="new-category" @click="editCategory()"><Plus :size="15" />{{ t('adminExplore.newCategory') }}</button>
            <button v-for="item in categories" :key="item.id" type="button" :class="{ active: categoryForm.id === item.id }" @click="editCategory(item)">
              <strong>{{ categoryName(item.code) }}</strong><code>{{ item.code }}</code><small>{{ item.enabled ? t('adminExplore.enabled') : t('adminExplore.disabled') }}</small>
            </button>
          </nav>
          <form @submit.prevent="saveCategory">
            <label><span>{{ t('adminExplore.categoryCode') }}</span><input v-model="categoryForm.code" required pattern="[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*" :disabled="Boolean(categoryForm.id)"></label>
            <div class="category-options"><label><span>{{ t('adminExplore.sortOrder') }}</span><input v-model.number="categoryForm.sortOrder" type="number" min="0" max="100000"></label>
              <label class="enabled-toggle"><input v-model="categoryForm.enabled" type="checkbox" :disabled="!categoryForm.id"><span>{{ t('adminExplore.enabled') }}</span></label></div>
            <fieldset><legend>简体中文</legend><input v-model="categoryForm.zhName" required maxlength="120" :placeholder="t('adminExplore.categoryName')"><textarea v-model="categoryForm.zhDescription" rows="2" maxlength="500" :placeholder="t('adminExplore.categoryDescription')"></textarea></fieldset>
            <fieldset><legend>English</legend><input v-model="categoryForm.enName" required maxlength="120" :placeholder="t('adminExplore.categoryName')"><textarea v-model="categoryForm.enDescription" rows="2" maxlength="500" :placeholder="t('adminExplore.categoryDescription')"></textarea></fieldset>
            <button class="primary" type="submit" :disabled="categorySaving"><Save :size="16" />{{ t('adminExplore.saveCategory') }}</button>
          </form>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.explore-admin { padding: 24px 0 60px; }.admin-header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 18px; }.admin-header p { margin: 0; color: #d9a15b; font-size: 12px; }.admin-header h1 { margin: 5px 0 0; font-size: 30px; }
.icon-button, button { cursor: pointer; }.header-actions { display: flex; gap: 7px; }.icon-button { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid #304753; border-radius: 4px; color: #aabcc1; background: transparent; }
.login-panel { display: grid; gap: 14px; width: min(390px, 100%); margin: 80px auto; border: 1px solid #2a414c; padding: 28px; background: #0a1821; }.login-panel h1 { margin: 0; font-size: 24px; }.login-panel label, .editor-form label, .image-dialog label { display: grid; gap: 6px; color: #90a4ab; font-size: 12px; }.login-panel input, .editor-form input, .editor-form textarea, .editor-form select, .image-dialog input, .list-search input, .list-filters select, .create-form input, .create-form select { min-width: 0; border: 1px solid #314954; border-radius: 3px; padding: 9px 10px; color: #e8efed; background: #08151c; }.login-panel > button { min-height: 40px; border: 0; border-radius: 4px; color: #15100a; background: #dfa75f; }
.admin-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 720px; border: 1px solid #253b45; background: #0a1720; }.article-list { border-right: 1px solid #253b45; background: #08141b; }.create-form { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid #253b45; }.create-form label { display: grid; gap: 5px; color: #8fa2a8; font-size: 11px; }.create-form small { color: #6f858d; font-size: 10px; line-height: 1.45; }.create-form button, .body-label button, .form-section header button, .command, .publication-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border: 1px solid #45616a; border-radius: 4px; color: #c4d2d2; background: transparent; }.list-search { display: flex; align-items: center; gap: 7px; margin: 12px; border: 1px solid #304752; padding: 0 9px; color: #71878e; }.list-search input { flex: 1; border: 0; }.list-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 12px 12px; }.article-row { display: grid; width: 100%; gap: 5px; border: 0; border-top: 1px solid #1d3039; padding: 12px; color: #dbe4e2; background: transparent; text-align: left; }.article-row:hover, .article-row.active { background: #11242c; }.article-row span { display: flex; justify-content: space-between; color: #bf8e52; font-size: 10px; }.article-row small { color: #d6927b; }.article-row code { color: #738991; font-size: 10px; }.list-state { padding: 24px; color: #82969d; text-align: center; }.list-state.error { color: #dc9a80; }
.editor-panel { min-width: 0; }.editor-toolbar { display: flex; align-items: center; gap: 7px; min-height: 54px; border-bottom: 1px solid #253b45; padding: 8px 12px; }.locale-tabs, .mode-tabs { display: flex; }.locale-tabs button, .mode-tabs button { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; border: 1px solid #304751; padding: 0 9px; color: #899da4; background: transparent; }.locale-tabs button.active, .mode-tabs button.active { color: #e9efed; background: #1a3037; }.mode-tabs { margin-left: 8px; }.dirty { margin-left: auto; color: #d6a05d; font-size: 11px; }.hidden-file { display: none; }.icon-command { display: grid; flex: 0 0 34px; width: 34px; height: 34px; place-items: center; border: 1px solid #45616a; border-radius: 4px; color: #c4d2d2; background: transparent; }.command.primary, .image-dialog .primary, .category-dialog .primary { border-color: #b17b3b; color: #171108; background: #dda55e; }.editor-form { display: grid; gap: 14px; padding: 18px; }.metadata-row { grid-template-columns: minmax(0, 1fr) 160px; }.body-label { display: flex; align-items: center; justify-content: space-between; color: #90a4ab; font-size: 12px; }.body-label button { padding: 0 10px; }.body-editor { min-height: 390px; resize: vertical; font-family: ui-monospace, monospace; line-height: 1.6; }.form-section { display: grid; gap: 8px; border-top: 1px solid #253b45; padding-top: 16px; }.form-section header { display: flex; align-items: center; justify-content: space-between; }.form-section h2 { margin: 0; font-size: 14px; }.form-section header button { width: 32px; }.repeat-row { display: grid; grid-template-columns: 1fr 1.4fr 1fr 34px; gap: 6px; }.repeat-row button { border: 1px solid #3c5158; color: #b7c6c6; background: transparent; }.credit-row { display: grid; grid-template-columns: 1.3fr 1.3fr .8fr .7fr 1fr; gap: 6px; }.credit-row code { overflow: hidden; padding: 9px; color: #82989e; background: #0b1a21; text-overflow: ellipsis; white-space: nowrap; }
.editor-toolbar > .hidden-file + .icon-command { margin-left: auto; }
.article-preview { max-width: 760px; padding: 30px 32px 50px; }.article-preview > span { color: #d9a15b; font-size: 12px; }.article-preview h1 { margin: 8px 0 12px; font-size: 38px; }.article-preview > p { color: #a4b5b8; line-height: 1.65; }.preview-cover { width: 100%; max-height: 420px; margin-top: 20px; border-radius: 5px; object-fit: cover; }.preview-body { margin-top: 28px; color: #c1cdcc; font-size: 16px; line-height: 1.8; }.preview-body :deep(img) { width: 100%; max-height: 70vh; object-fit: contain; }.preview-body :deep(.explore-image-fallback[hidden]) { display: none; }
.preview-body :deep(.explore-figure.is-failed figcaption) { display: none; }
.editor-footer { display: grid; grid-template-columns: auto minmax(260px, 420px); gap: 24px; border-top: 1px solid #253b45; padding: 16px 18px; }.publication-actions { display: flex; gap: 7px; }.publication-actions button { padding: 0 10px; }.history h2 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 13px; }.history button { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; border-top: 1px solid #273b43; padding: 7px; color: #91a6aa; background: transparent; }.feedback { margin: 0; padding: 10px 18px; color: #82c9bb; }.feedback.error { color: #dfa086; }.empty-editor, .editor-state { display: grid; min-height: 500px; place-items: center; color: #81969d; }
.dialog-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 20px; background: rgb(3 9 13 / 78%); }.image-dialog { display: grid; gap: 12px; width: min(620px, 100%); border: 1px solid #3b535b; border-radius: 6px; padding: 20px; background: #0c1a21; }.image-dialog header { display: flex; align-items: center; justify-content: space-between; }.image-dialog h2 { margin: 0; font-size: 18px; }.image-dialog header button { border: 0; color: #aebebe; background: transparent; }.image-dialog .primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; border-radius: 4px; }
.category-dialog { width: min(860px, 100%); max-height: min(720px, 90vh); overflow: auto; border: 1px solid #3b535b; border-radius: 6px; padding: 20px; background: #0c1a21; }.category-dialog > header { display: flex; align-items: center; justify-content: space-between; }.category-dialog h2 { margin: 0; font-size: 18px; }.category-dialog header button { border: 0; color: #aebebe; background: transparent; }.category-manager { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 18px; margin-top: 18px; }.category-manager nav { border-right: 1px solid #29404a; padding-right: 12px; }.category-manager nav button { display: grid; width: 100%; gap: 3px; border: 0; border-bottom: 1px solid #263a43; padding: 10px; color: #c8d3d1; background: transparent; text-align: left; }.category-manager nav button.active { background: #152932; }.category-manager nav .new-category { display: flex; align-items: center; gap: 6px; color: #e0ab68; }.category-manager nav code, .category-manager nav small { color: #778d95; font-size: 10px; }.category-manager form { display: grid; gap: 12px; }.category-manager label { display: grid; gap: 5px; color: #91a5ab; font-size: 12px; }.category-manager input, .category-manager textarea { min-width: 0; border: 1px solid #314954; border-radius: 3px; padding: 9px 10px; color: #e8efed; background: #08151c; }.category-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.category-options .enabled-toggle { display: flex; align-items: center; gap: 8px; }.category-manager fieldset { display: grid; gap: 7px; border: 1px solid #29404a; padding: 12px; }.category-manager legend { color: #bac8c7; font-size: 12px; }.category-manager .primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; border-radius: 4px; }
@media (max-width: 960px) { .admin-layout { grid-template-columns: 240px minmax(0, 1fr); }.credit-row { grid-template-columns: 1fr; }.editor-toolbar { flex-wrap: wrap; }.dirty { margin-left: 0; }.metadata-row { grid-template-columns: 1fr; } }
@media (max-width: 700px) { .admin-layout { grid-template-columns: 1fr; }.article-list { max-height: 420px; overflow-y: auto; border-right: 0; border-bottom: 1px solid #253b45; }.repeat-row { grid-template-columns: 1fr; }.editor-footer { grid-template-columns: 1fr; }.editor-form { padding: 14px; }.category-manager { grid-template-columns: 1fr; }.category-manager nav { max-height: 220px; overflow-y: auto; border-right: 0; border-bottom: 1px solid #29404a; padding: 0 0 12px; } }
</style>

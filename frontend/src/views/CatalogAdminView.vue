<script setup lang="ts">
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FileText,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave } from 'vue-router'
import {
  createAdminCatalogEntry,
  deleteAdminCatalogEntry,
  deleteCatalogMedia,
  findUnreferencedCatalogMedia,
  loadAdminCatalog,
  loadAdminTranslation,
  loginAdmin,
  saveAdminTranslation,
  setAdminTranslationPublished,
  uploadCatalogMedia,
} from '../features/catalog/api'
import {
  ADMIN_CONTENT_LOCALES,
  catalogMediaUrl,
  cloneTranslationDraft,
  draftFingerprint,
  emptyTranslationDraft,
  entryTitleForLocale,
  isPublishableDraft,
  isValidObjectKey,
  mediaDraftPayload,
  normalizeObjectKey,
  objectKeyExample,
} from '../features/catalog/adminCatalog'
import { renderRestrictedMarkdown } from '../features/catalog/markdown'
import SkyTargetSearch from '../features/sky-map/SkyTargetSearch.vue'
import type { SkySearchSuggestion } from '../features/sky-map/types'
import type {
  AdminCatalogPage,
  AdminCatalogSummary,
  CatalogEntry,
  CatalogObjectType,
  TranslationDraft,
} from '../features/catalog/types'

const TOKEN_KEY = 'astro-content-admin-token'
const PAGE_SIZE = 50
const { t, locale } = useI18n()

const token = ref(sessionStorage.getItem(TOKEN_KEY) || '')
const username = ref('admin')
const password = ref('')
const loginPending = ref(false)
const loginError = ref(false)

const page = ref<AdminCatalogPage | null>(null)
const selectedEntryId = ref('')
const activeLocale = ref<(typeof ADMIN_CONTENT_LOCALES)[number]>('zh-CN')
const queryInput = ref('')
const activeQuery = ref('')
const filterType = ref<CatalogObjectType | ''>('')
const currentPage = ref(0)
const listLoading = ref(false)
const editorLoading = ref(false)
const failed = ref(false)

const createType = ref<CatalogObjectType>('star')
const createKey = ref('')
const createPending = ref(false)
const createError = ref('')
const targetQuery = ref('')

const draft = reactive<TranslationDraft>(emptyTranslationDraft())
const baselineFingerprint = ref(draftFingerprint(draft))
const translationStatus = ref<CatalogEntry['status']>('DRAFT')
const editorMode = ref<'edit' | 'preview'>('edit')
const saving = ref(false)
const uploadPending = ref(false)
const uploadFile = ref<File | null>(null)
const uploadAlt = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)
const uploadPreviewUrl = ref('')
const uploadError = ref('')
const publishAttempted = ref(false)
const feedback = reactive({ message: '', error: false })
const pendingMediaCleanup = ref<string[]>([])

let listSequence = 0
let translationSequence = 0
let feedbackTimer: number | undefined

const entries = computed(() => page.value?.items ?? [])
const selectedEntry = computed(() => entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null)
const isDirty = computed(() => draftFingerprint(draft) !== baselineFingerprint.value)
const publishable = computed(() => isPublishableDraft(draft))
const renderedPreview = computed(() => renderRestrictedMarkdown(draft.bodyMarkdown))
const normalizedCreateKey = computed(() => normalizeObjectKey(createType.value, createKey.value))
const createKeyValid = computed(() => isValidObjectKey(createType.value, normalizedCreateKey.value))
const createKeyPlaceholder = computed(() => objectKeyExample(createType.value))
const uploadFileLabel = computed(() => {
  if (!uploadFile.value) return t('adminCatalog.noImageSelected')
  return `${uploadFile.value.name} · ${formatFileSize(uploadFile.value.size)}`
})
const generatedUploadAlt = computed(() => {
  const title = draft.title.trim() || selectedEntry.value?.objectKey || ''
  const filename = uploadFile.value ? filenameWithoutExtension(uploadFile.value.name) : ''
  return title || filename || t('adminCatalog.image')
})
const canUpload = computed(() => Boolean(uploadFile.value && !uploadError.value && !uploadPending.value))

onMounted(() => {
  if (token.value) void refreshEntries({ loadSelection: true })
})

watch(isDirty, (dirty) => {
  if (dirty) window.addEventListener('beforeunload', preventUnsavedUnload)
  else window.removeEventListener('beforeunload', preventUnsavedUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', preventUnsavedUnload)
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  revokeUploadPreview()
})
onBeforeRouteLeave(() => confirmDiscard())

function preventUnsavedUnload(event: BeforeUnloadEvent): void {
  event.preventDefault()
  event.returnValue = true
}

async function login(): Promise<void> {
  loginPending.value = true
  loginError.value = false
  try {
    const session = await loginAdmin(username.value, password.value)
    token.value = session.accessToken
    sessionStorage.setItem(TOKEN_KEY, session.accessToken)
    password.value = ''
    await refreshEntries({ loadSelection: true })
  } catch {
    loginError.value = true
  } finally {
    loginPending.value = false
  }
}

function logout(): void {
  if (!confirmDiscard()) return
  token.value = ''
  page.value = null
  selectedEntryId.value = ''
  setDraft(emptyTranslationDraft())
  sessionStorage.removeItem(TOKEN_KEY)
}

async function refreshEntries(options: { selectId?: string; loadSelection?: boolean } = {}): Promise<void> {
  const sequence = ++listSequence
  listLoading.value = true
  failed.value = false
  try {
    const result = await loadAdminCatalog(token.value, {
      objectType: filterType.value,
      query: activeQuery.value,
      page: currentPage.value,
      size: PAGE_SIZE,
    })
    if (sequence !== listSequence) return
    page.value = result
    const preferredId = options.selectId ?? selectedEntryId.value
    const nextId = result.items.some((entry) => entry.id === preferredId)
      ? preferredId
      : result.items[0]?.id ?? ''
    const selectionChanged = nextId !== selectedEntryId.value
    selectedEntryId.value = nextId
    if ((selectionChanged || options.loadSelection) && nextId) await loadTranslation()
    if (!nextId) setDraft(emptyTranslationDraft())
  } catch {
    if (sequence === listSequence) failed.value = true
  } finally {
    if (sequence === listSequence) listLoading.value = false
  }
}

async function loadTranslation(): Promise<void> {
  const entryId = selectedEntryId.value
  const contentLocale = activeLocale.value
  if (!entryId) return
  const sequence = ++translationSequence
  editorLoading.value = true
  clearFeedback()
  try {
    const entry = await loadAdminTranslation(token.value, entryId, contentLocale)
    if (sequence !== translationSequence || entryId !== selectedEntryId.value || contentLocale !== activeLocale.value) return
    setDraft(entry ? draftFromEntry(entry) : emptyTranslationDraft())
    translationStatus.value = entry?.status ?? 'DRAFT'
    publishAttempted.value = false
  } catch {
    if (sequence === translationSequence) setFeedback(t('adminCatalog.translationLoadFailed'), true)
  } finally {
    if (sequence === translationSequence) editorLoading.value = false
  }
}

async function selectEntry(entryId: string): Promise<void> {
  if (entryId === selectedEntryId.value || !confirmDiscard()) return
  selectedEntryId.value = entryId
  editorMode.value = 'edit'
  await loadTranslation()
}

async function selectLocale(nextLocale: string): Promise<void> {
  if (nextLocale === activeLocale.value || !ADMIN_CONTENT_LOCALES.includes(nextLocale as typeof activeLocale.value)) return
  if (!confirmDiscard()) return
  activeLocale.value = nextLocale as typeof activeLocale.value
  editorMode.value = 'edit'
  await loadTranslation()
}

async function searchEntries(): Promise<void> {
  if (!confirmDiscard()) return
  activeQuery.value = queryInput.value.trim()
  currentPage.value = 0
  await refreshEntries({ loadSelection: true })
}

async function changeFilterType(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  if (!confirmDiscard()) {
    select.value = filterType.value
    return
  }
  filterType.value = select.value as CatalogObjectType | ''
  currentPage.value = 0
  await refreshEntries({ loadSelection: true })
}

async function changePage(nextPage: number): Promise<void> {
  if (!page.value || nextPage < 0 || nextPage >= page.value.totalPages || !confirmDiscard()) return
  currentPage.value = nextPage
  await refreshEntries({ loadSelection: true })
}

async function createEntry(): Promise<void> {
  const objectKey = normalizedCreateKey.value
  createError.value = ''
  if (!createKeyValid.value) {
    createError.value = t('adminCatalog.invalidObjectKey', { example: createKeyPlaceholder.value })
    return
  }
  if (!confirmDiscard()) return
  createPending.value = true
  try {
    const created = await createAdminCatalogEntry(token.value, createType.value, objectKey)
    createKey.value = ''
    activeQuery.value = ''
    queryInput.value = ''
    filterType.value = ''
    currentPage.value = 0
    await refreshEntries({ selectId: created.id, loadSelection: true })
    setFeedback(t('adminCatalog.created'))
  } catch {
    createError.value = t('adminCatalog.createFailed')
  } finally {
    createPending.value = false
  }
}

async function save(): Promise<boolean> {
  if (!selectedEntryId.value || (!isDirty.value && pendingMediaCleanup.value.length === 0)) return true
  const mediaCleanupCandidates = [...pendingMediaCleanup.value]
  if (!isDirty.value) {
    saving.value = true
    try {
      const cleanupComplete = await cleanupRemovedMedia(mediaCleanupCandidates)
      setFeedback(cleanupComplete ? t('adminCatalog.mediaCleanupRetried') : t('adminCatalog.mediaCleanupFailed'), !cleanupComplete)
      return cleanupComplete
    } finally {
      saving.value = false
    }
  }
  saving.value = true
  clearFeedback()
  try {
    const saved = await saveAdminTranslation(token.value, selectedEntryId.value, activeLocale.value, cleanDraft())
    setDraft(draftFromEntry(saved))
    translationStatus.value = saved.status
    const cleanupComplete = await cleanupRemovedMedia(mediaCleanupCandidates)
    setFeedback(cleanupComplete ? t('adminCatalog.saved') : t('adminCatalog.mediaCleanupFailed'), !cleanupComplete)
    await refreshEntries({ selectId: selectedEntryId.value })
    return true
  } catch {
    setFeedback(t('adminCatalog.saveFailed'), true)
    return false
  } finally {
    saving.value = false
  }
}

async function togglePublished(): Promise<void> {
  if (!selectedEntryId.value) return
  const publishing = translationStatus.value !== 'PUBLISHED'
  if (publishing) {
    publishAttempted.value = true
    if (!publishable.value) {
      editorMode.value = 'edit'
      setFeedback(t('adminCatalog.publishMissingFields'), true)
      return
    }
    if (!(await save())) return
  } else if (!window.confirm(t('adminCatalog.unpublishConfirm'))) {
    return
  }

  saving.value = true
  clearFeedback()
  try {
    const result = await setAdminTranslationPublished(
      token.value,
      selectedEntryId.value,
      activeLocale.value,
      publishing,
    )
    translationStatus.value = result.status
    baselineFingerprint.value = draftFingerprint(draft)
    setFeedback(result.status === 'PUBLISHED' ? t('adminCatalog.published') : t('adminCatalog.unpublished'))
    await refreshEntries({ selectId: selectedEntryId.value })
  } catch {
    setFeedback(t('adminCatalog.publishFailed'), true)
  } finally {
    saving.value = false
  }
}

async function deleteEntry(): Promise<void> {
  const entry = selectedEntry.value
  if (!entry || !window.confirm(t('adminCatalog.deleteConfirm', { key: entry.objectKey }))) return
  saving.value = true
  clearFeedback()
  try {
    const mediaIds = await deleteAdminCatalogEntry(token.value, entry.id)
    await deleteMediaObjects(mediaIds)
    selectedEntryId.value = ''
    setDraft(emptyTranslationDraft())
    await refreshEntries({ loadSelection: true })
    setFeedback(t('adminCatalog.deleted'))
  } catch {
    setFeedback(t('adminCatalog.deleteFailed'), true)
  } finally {
    saving.value = false
  }
}

function addKnowledgePoint(): void {
  if (draft.knowledgePoints.length < 20) draft.knowledgePoints.push('')
}

function addSource(): void {
  if (draft.sources.length >= 30) return
  draft.sources.push({ title: '', url: '', author: null, license: null, attribution: null })
}

function removeMedia(index: number): void {
  const media = draft.media[index]
  if (!media || !window.confirm(t('adminCatalog.removeImageConfirm'))) return
  draft.media.splice(index, 1)
  if (!draft.media.some((candidate) => candidate.mediaId === media.mediaId)
      && !pendingMediaCleanup.value.includes(media.mediaId)) {
    pendingMediaCleanup.value.push(media.mediaId)
  }
}

function chooseCatalogSuggestion(suggestion: SkySearchSuggestion): void {
  const type: CatalogObjectType = suggestion.targetType === 'solarSystemBody'
    ? 'solar-system-body'
    : suggestion.targetType === 'cultureFigure' ? 'culture-figure' : 'star'
  chooseCatalogTarget(type, suggestion.objectId)
}

function chooseCatalogTarget(type: CatalogObjectType, objectKey: string): void {
  createType.value = type
  createKey.value = objectKey
  createError.value = ''
  targetQuery.value = ''
}

async function cleanupRemovedMedia(mediaIds: string[]): Promise<boolean> {
  if (mediaIds.length === 0) return true
  try {
    const unreferenced = await findUnreferencedCatalogMedia(token.value, mediaIds)
    await deleteMediaObjects(unreferenced)
    pendingMediaCleanup.value = pendingMediaCleanup.value.filter((mediaId) => !mediaIds.includes(mediaId))
    return true
  } catch {
    pendingMediaCleanup.value = [...new Set(mediaIds)]
    return false
  }
}

async function deleteMediaObjects(mediaIds: string[]): Promise<void> {
  if (mediaIds.length === 0) return
  const results = await Promise.allSettled(mediaIds.map((mediaId) => deleteCatalogMedia(token.value, mediaId)))
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('One or more media objects could not be deleted')
  }
}

function moveMedia(index: number, offset: number): void {
  const target = index + offset
  if (target < 0 || target >= draft.media.length) return
  const [media] = draft.media.splice(index, 1)
  draft.media.splice(target, 0, media)
}

function selectUpload(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  setUploadFile(file)
  if (!uploadFile.value) input.value = ''
}

function dropUpload(event: DragEvent): void {
  setUploadFile(event.dataTransfer?.files?.[0] ?? null)
  if (uploadInput.value && !uploadFile.value) uploadInput.value.value = ''
}

async function upload(): Promise<void> {
  if (!uploadFile.value || uploadError.value) return
  uploadPending.value = true
  clearFeedback()
  const altText = uploadAlt.value.trim() || generatedUploadAlt.value
  try {
    const asset = await uploadCatalogMedia(token.value, uploadFile.value, { altText })
    draft.media.push({
      mediaId: asset.mediaId,
      url: asset.url,
      altText,
      caption: null,
      author: null,
      license: null,
      attribution: null,
    })
    resetUpload()
    if (uploadInput.value) uploadInput.value.value = ''
    setFeedback(t('adminCatalog.uploaded'))
  } catch {
    setFeedback(t('adminCatalog.uploadFailed'), true)
  } finally {
    uploadPending.value = false
  }
}

function setUploadFile(file: File | null): void {
  revokeUploadPreview()
  uploadFile.value = file
  uploadError.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    uploadError.value = t('adminCatalog.unsupportedImageType')
    uploadFile.value = null
    return
  }
  if (file.size === 0 || file.size > 8 * 1024 * 1024) {
    uploadError.value = t('adminCatalog.imageTooLarge')
    uploadFile.value = null
    return
  }
  uploadPreviewUrl.value = URL.createObjectURL(file)
  if (!uploadAlt.value.trim()) uploadAlt.value = generatedUploadAlt.value
}

function resetUpload(): void {
  revokeUploadPreview()
  uploadFile.value = null
  uploadAlt.value = ''
  uploadError.value = ''
}

function revokeUploadPreview(): void {
  if (!uploadPreviewUrl.value) return
  URL.revokeObjectURL(uploadPreviewUrl.value)
  uploadPreviewUrl.value = ''
}

function filenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim()
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function setDraft(value: TranslationDraft): void {
  Object.assign(draft, cloneTranslationDraft(value))
  baselineFingerprint.value = draftFingerprint(draft)
  pendingMediaCleanup.value = []
}

function draftFromEntry(entry: CatalogEntry): TranslationDraft {
  return {
    title: entry.title,
    summary: entry.summary,
    bodyMarkdown: entry.bodyMarkdown,
    knowledgePoints: [...entry.knowledgePoints],
    imageCaption: entry.imageCaption,
    sources: entry.sources.map((source) => ({ ...source })),
    media: entry.media.map((media) => ({ ...media })),
  }
}

function cleanDraft(): TranslationDraft {
  return {
    ...cloneTranslationDraft(draft),
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    bodyMarkdown: draft.bodyMarkdown.trim(),
    knowledgePoints: draft.knowledgePoints.map((point) => point.trim()).filter(Boolean),
    sources: draft.sources
      .map((source) => ({ ...source, title: source.title.trim(), url: source.url.trim() }))
      .filter((source) => source.title && source.url),
    media: draft.media.map(mediaDraftPayload),
  }
}

function confirmDiscard(): boolean {
  return !isDirty.value || window.confirm(t('adminCatalog.discardChanges'))
}

function clearFeedback(): void {
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedbackTimer = undefined
  feedback.message = ''
  feedback.error = false
}

function setFeedback(message: string, error = false): void {
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedback.message = message
  feedback.error = error
  feedbackTimer = error ? undefined : window.setTimeout(clearFeedback, 4000)
}

function translationFor(entry: AdminCatalogSummary, contentLocale: string) {
  return entry.translations.find((translation) => translation.locale === contentLocale)
}
</script>

<template>
  <section v-if="!token" class="admin-login">
    <form @submit.prevent="login">
      <p>{{ t('adminCatalog.privateArea') }}</p>
      <h1>{{ t('adminCatalog.loginTitle') }}</h1>
      <label><span>{{ t('adminCatalog.username') }}</span><input v-model="username" autocomplete="username" required></label>
      <label><span>{{ t('adminCatalog.password') }}</span><input v-model="password" type="password" autocomplete="current-password" required></label>
      <button type="submit" :disabled="loginPending">{{ t('adminCatalog.login') }}</button>
      <span v-if="loginError" class="form-error" role="alert">{{ t('adminCatalog.loginFailed') }}</span>
    </form>
  </section>

  <section v-else class="admin-page">
    <header class="admin-heading">
      <div><p>{{ t('adminCatalog.privateArea') }}</p><h1>{{ t('adminCatalog.title') }}</h1></div>
      <button type="button" class="secondary-button" @click="logout"><LogOut :size="16" aria-hidden="true" />{{ t('adminCatalog.logout') }}</button>
    </header>

    <div class="admin-workspace">
      <aside class="entry-sidebar">
        <form class="entry-search" role="search" @submit.prevent="searchEntries">
          <input v-model="queryInput" type="search" maxlength="120" :placeholder="t('adminCatalog.searchEntries')" :aria-label="t('adminCatalog.searchEntries')">
          <select :value="filterType" :aria-label="t('adminCatalog.filterType')" @change="changeFilterType">
            <option value="">{{ t('catalog.allTypes') }}</option>
            <option value="star">{{ t('catalog.types.star') }}</option>
            <option value="solar-system-body">{{ t('catalog.types.solar-system-body') }}</option>
            <option value="culture-figure">{{ t('catalog.types.culture-figure') }}</option>
            <option value="featured-pattern">{{ t('catalog.types.featured-pattern') }}</option>
          </select>
          <button type="submit" class="icon-button" :disabled="listLoading" :title="t('adminCatalog.searchEntries')" :aria-label="t('adminCatalog.searchEntries')"><Search :size="16" /></button>
        </form>

        <form class="create-entry" @submit.prevent="createEntry">
          <div class="target-picker">
            <label>{{ t('adminCatalog.findSkyObject') }}</label>
            <SkyTargetSearch
              v-model="targetQuery"
              culture-id="western-iau"
              :interface-language="locale"
              :placeholder="t('adminCatalog.findSkyObjectHint')"
              :input-aria-label="t('adminCatalog.findSkyObject')"
              @select="chooseCatalogSuggestion"
            />
          </div>
          <div class="create-row">
            <select v-model="createType" :aria-label="t('adminCatalog.objectType')" @change="createError = ''">
              <option value="star">{{ t('catalog.types.star') }}</option>
              <option value="solar-system-body">{{ t('catalog.types.solar-system-body') }}</option>
              <option value="culture-figure">{{ t('catalog.types.culture-figure') }}</option>
              <option value="featured-pattern">{{ t('catalog.types.featured-pattern') }}</option>
            </select>
            <input v-model="createKey" :placeholder="createKeyPlaceholder" :aria-invalid="Boolean(createError)" required @input="createError = ''">
            <button type="submit" class="icon-button" :disabled="createPending" :title="t('adminCatalog.create')" :aria-label="t('adminCatalog.create')"><Plus :size="17" /></button>
          </div>
          <small v-if="createError" class="field-error" role="alert">{{ createError }}</small>
        </form>

        <div class="entry-list" :aria-busy="listLoading">
          <div v-if="failed" class="sidebar-state">
            <span>{{ t('adminCatalog.loadFailed') }}</span>
            <button type="button" class="text-button" @click="refreshEntries({ loadSelection: true })">{{ t('catalog.retry') }}</button>
          </div>
          <div v-else-if="!listLoading && entries.length === 0" class="sidebar-state">{{ t('adminCatalog.noEntries') }}</div>
          <button
            v-for="entry in entries"
            :key="entry.id"
            type="button"
            class="entry-row"
            :class="{ active: selectedEntryId === entry.id }"
            @click="selectEntry(entry.id)"
          >
            <span class="entry-title">{{ entryTitleForLocale(entry, activeLocale) }}</span>
            <code>{{ entry.objectKey }}</code>
            <span class="entry-meta">
              <span>{{ t(`catalog.types.${entry.objectType}`) }}</span>
              <span
                v-for="contentLocale in ADMIN_CONTENT_LOCALES"
                :key="contentLocale"
                :class="['locale-state', translationFor(entry, contentLocale)?.status.toLowerCase()]"
              >{{ contentLocale === 'zh-CN' ? '中' : 'EN' }}</span>
            </span>
          </button>
        </div>

        <footer v-if="page && page.totalPages > 1" class="entry-pagination">
          <button type="button" :disabled="currentPage === 0" :aria-label="t('adminCatalog.previousPage')" @click="changePage(currentPage - 1)"><ChevronLeft :size="16" /></button>
          <span>{{ currentPage + 1 }} / {{ page.totalPages }}</span>
          <button type="button" :disabled="currentPage + 1 >= page.totalPages" :aria-label="t('adminCatalog.nextPage')" @click="changePage(currentPage + 1)"><ChevronRight :size="16" /></button>
        </footer>
      </aside>

      <section v-if="selectedEntry" class="content-editor" :aria-busy="editorLoading">
        <header class="editor-toolbar">
          <div class="entry-identity">
            <span>{{ t(`catalog.types.${selectedEntry.objectType}`) }}</span>
            <strong>{{ selectedEntry.objectKey }}</strong>
          </div>
          <div class="toolbar-status">
            <span v-if="isDirty" class="status-badge changed">{{ t('adminCatalog.unsaved') }}</span>
            <span :class="['status-badge', translationStatus.toLowerCase()]">{{ t(`adminCatalog.status.${translationStatus}`) }}</span>
          </div>
          <button type="button" class="danger-icon" :aria-label="t('adminCatalog.delete')" :title="t('adminCatalog.delete')" :disabled="saving" @click="deleteEntry"><Trash2 :size="16" /></button>
          <button type="button" class="secondary-button" :disabled="saving || editorLoading || (!isDirty && pendingMediaCleanup.length === 0)" @click="save"><Save :size="16" />{{ t('adminCatalog.saveDraft') }}</button>
          <button type="button" class="primary-button" :disabled="saving || editorLoading" @click="togglePublished">
            {{ translationStatus === 'PUBLISHED' ? t('adminCatalog.takeOffline') : t('adminCatalog.publishNow') }}
          </button>
        </header>

        <div class="editor-subnav">
          <div class="locale-tabs" role="tablist" :aria-label="t('adminCatalog.locale')">
            <button
              v-for="contentLocale in ADMIN_CONTENT_LOCALES"
              :id="`locale-tab-${contentLocale}`"
              :key="contentLocale"
              type="button"
              role="tab"
              :aria-selected="activeLocale === contentLocale"
              :class="{ active: activeLocale === contentLocale }"
              @click="selectLocale(contentLocale)"
            >
              {{ contentLocale === 'zh-CN' ? t('adminCatalog.chinese') : 'English' }}
              <span :class="['locale-dot', translationFor(selectedEntry, contentLocale)?.status.toLowerCase()]" aria-hidden="true"></span>
            </button>
          </div>
          <div class="mode-tabs" role="tablist" :aria-label="t('adminCatalog.editorMode')">
            <button type="button" role="tab" :aria-selected="editorMode === 'edit'" :class="{ active: editorMode === 'edit' }" @click="editorMode = 'edit'"><FileText :size="15" />{{ t('adminCatalog.edit') }}</button>
            <button type="button" role="tab" :aria-selected="editorMode === 'preview'" :class="{ active: editorMode === 'preview' }" @click="editorMode = 'preview'"><Eye :size="15" />{{ t('adminCatalog.preview') }}</button>
          </div>
        </div>

        <div v-if="editorLoading" class="editor-state">{{ t('catalog.loading') }}</div>
        <form v-else-if="editorMode === 'edit'" class="editor-fields" @submit.prevent="save">
          <label>
            <span>{{ t('adminCatalog.entryTitle') }} <small>{{ draft.title.length }}/160</small></span>
            <input v-model="draft.title" maxlength="160" :aria-invalid="publishAttempted && !draft.title.trim()">
            <small v-if="publishAttempted && !draft.title.trim()" class="field-error">{{ t('adminCatalog.requiredForPublish') }}</small>
          </label>
          <label>
            <span>{{ t('adminCatalog.summary') }} <small>{{ draft.summary.length }}/600</small></span>
            <textarea v-model="draft.summary" rows="3" maxlength="600" :aria-invalid="publishAttempted && !draft.summary.trim()"></textarea>
            <small v-if="publishAttempted && !draft.summary.trim()" class="field-error">{{ t('adminCatalog.requiredForPublish') }}</small>
          </label>
          <label>
            <span>{{ t('adminCatalog.body') }}</span>
            <textarea v-model="draft.bodyMarkdown" class="body-editor" rows="15" maxlength="50000" :aria-invalid="publishAttempted && !draft.bodyMarkdown.trim()"></textarea>
            <small v-if="publishAttempted && !draft.bodyMarkdown.trim()" class="field-error">{{ t('adminCatalog.requiredForPublish') }}</small>
          </label>

          <section class="collection-editor">
            <header><h2>{{ t('adminCatalog.knowledgePoints') }}</h2><button type="button" class="icon-button" :disabled="draft.knowledgePoints.length >= 20" :aria-label="t('adminCatalog.addKnowledgePoint')" :title="t('adminCatalog.addKnowledgePoint')" @click="addKnowledgePoint"><Plus :size="16" /></button></header>
            <div v-for="(_point, index) in draft.knowledgePoints" :key="index" class="knowledge-row">
              <input v-model="draft.knowledgePoints[index]" maxlength="500" :aria-label="`${t('adminCatalog.knowledgePoints')} ${index + 1}`">
              <button type="button" class="row-command" :aria-label="t('adminCatalog.remove')" @click="draft.knowledgePoints.splice(index, 1)"><X :size="15" /></button>
            </div>
            <p v-if="draft.knowledgePoints.length === 0" class="empty-collection">{{ t('adminCatalog.none') }}</p>
          </section>

          <section class="collection-editor">
            <header><h2>{{ t('adminCatalog.sourcesOptional') }}</h2><button type="button" class="icon-button" :disabled="draft.sources.length >= 30" :aria-label="t('adminCatalog.addSource')" :title="t('adminCatalog.addSource')" @click="addSource"><Plus :size="16" /></button></header>
            <div v-for="(source, index) in draft.sources" :key="index" class="source-row">
              <input v-model="source.title" maxlength="240" :placeholder="t('adminCatalog.sourceTitle')" :aria-label="t('adminCatalog.sourceTitle')">
              <input v-model="source.url" type="url" maxlength="1000" placeholder="https://" :aria-label="t('adminCatalog.sourceUrl')">
              <input v-model="source.author" maxlength="240" :placeholder="t('adminCatalog.sourceAuthor')" :aria-label="t('adminCatalog.sourceAuthor')">
              <input v-model="source.license" maxlength="160" :placeholder="t('adminCatalog.sourceLicense')" :aria-label="t('adminCatalog.sourceLicense')">
              <button type="button" class="row-command" :aria-label="t('adminCatalog.remove')" @click="draft.sources.splice(index, 1)"><X :size="15" /></button>
            </div>
            <p v-if="draft.sources.length === 0" class="empty-collection">{{ t('adminCatalog.none') }}</p>
          </section>

          <section class="collection-editor media-editor">
            <header><h2>{{ t('adminCatalog.media') }}</h2></header>
            <div v-for="(media, index) in draft.media" :key="media.mediaId" class="media-row">
              <img :src="catalogMediaUrl(media)" :alt="media.altText">
              <div>
                <code>{{ media.mediaId }}</code>
                <input v-model="media.altText" maxlength="500" :placeholder="t('adminCatalog.altText')" :aria-label="t('adminCatalog.altText')">
                <input v-model="media.caption" maxlength="500" :placeholder="t('adminCatalog.imageCaption')" :aria-label="t('adminCatalog.imageCaption')">
              </div>
              <div class="media-actions">
                <button type="button" :disabled="index === 0" :aria-label="t('adminCatalog.moveUp')" @click="moveMedia(index, -1)"><ChevronUp :size="15" /></button>
                <button type="button" :disabled="index + 1 === draft.media.length" :aria-label="t('adminCatalog.moveDown')" @click="moveMedia(index, 1)"><ChevronDown :size="15" /></button>
                <button type="button" :aria-label="t('adminCatalog.removeImage')" :title="t('adminCatalog.removeImage')" @click="removeMedia(index)"><Trash2 :size="15" /></button>
              </div>
            </div>
            <div class="upload-panel" @dragover.prevent @drop.prevent="dropUpload">
              <label class="upload-picker">
                <input ref="uploadInput" type="file" accept="image/jpeg,image/png,image/webp" :aria-label="t('adminCatalog.image')" @change="selectUpload">
                <span>{{ t('adminCatalog.chooseImage') }}</span>
              </label>
              <div class="upload-preview" :class="{ empty: !uploadPreviewUrl }">
                <img v-if="uploadPreviewUrl" :src="uploadPreviewUrl" :alt="uploadAlt || generatedUploadAlt">
                <span v-else>{{ t('adminCatalog.noPreview') }}</span>
              </div>
              <div class="upload-fields">
                <strong>{{ uploadFileLabel }}</strong>
                <input v-model="uploadAlt" maxlength="500" :placeholder="t('adminCatalog.altTextOptional')" :aria-label="t('adminCatalog.altText')">
                <small v-if="uploadError" class="field-error" role="alert">{{ uploadError }}</small>
                <small v-else>{{ t('adminCatalog.uploadHint') }}</small>
              </div>
              <button type="button" class="secondary-button" :disabled="!canUpload" @click="upload">
                <Upload :size="16" />{{ uploadPending ? t('adminCatalog.uploading') : t('adminCatalog.upload') }}
              </button>
            </div>
          </section>
        </form>

        <article v-else class="content-preview" role="tabpanel">
          <header>
            <span>{{ t(`catalog.types.${selectedEntry.objectType}`) }}</span>
            <h2>{{ draft.title || t('adminCatalog.untitled') }}</h2>
            <p>{{ draft.summary || t('adminCatalog.noSummary') }}</p>
          </header>
          <img v-if="draft.media[0]" :src="catalogMediaUrl(draft.media[0])" :alt="draft.media[0].altText">
          <div v-if="draft.bodyMarkdown.trim()" class="markdown-preview" v-html="renderedPreview"></div>
          <p v-else class="empty-preview">{{ t('adminCatalog.noBody') }}</p>
          <ul v-if="draft.knowledgePoints.some(point => point.trim())">
            <li v-for="point in draft.knowledgePoints.filter(point => point.trim())" :key="point">{{ point }}</li>
          </ul>
        </article>

        <p v-if="feedback.message" :class="['editor-feedback', { error: feedback.error }]" :role="feedback.error ? 'alert' : 'status'" aria-live="polite">{{ feedback.message }}</p>
      </section>
      <div v-else class="empty-editor">{{ t('adminCatalog.selectEntry') }}</div>
    </div>
  </section>
</template>

<style scoped>
.admin-login { display: grid; place-items: center; min-height: calc(100vh - 68px); }
.admin-login form { width: min(360px, 100%); border: 1px solid #2c4353; padding: 28px; background: #0a1621; }
.admin-login p, .admin-heading p { margin: 0 0 5px; color: #72c9bd; font-size: 12px; }
.admin-login h1 { margin: 0 0 24px; font-size: 28px; }
.admin-login label, .editor-fields > label { display: grid; gap: 7px; margin-bottom: 14px; color: #8fa3af; font-size: 12px; }
.admin-login input, .editor-fields input, .editor-fields textarea, select, .create-entry input, .entry-search input { border: 1px solid #2f4858; border-radius: 3px; padding: 9px 10px; outline: none; color: #e4ecef; background: #08131c; }
input:focus, textarea:focus, select:focus { border-color: #6bb7ad; }
input[aria-invalid="true"], textarea[aria-invalid="true"] { border-color: #bd6f62; }
.admin-login button { width: 100%; min-height: 40px; border: 0; border-radius: 3px; color: #071510; background: #78cfc2; cursor: pointer; }
.form-error, .field-error { color: #e2a08b; font-size: 11px; }
.admin-page { padding: 16px 0 32px; }
.admin-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 12px; }
.admin-heading h1 { margin: 0; font-size: 27px; }
.admin-workspace { display: grid; grid-template-columns: 330px minmax(0, 1fr); height: calc(100dvh - 150px); min-height: 640px; border: 1px solid #263c4b; background: #09141d; }
.entry-sidebar { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid #263c4b; background: #08131c; }
.entry-search { display: grid; grid-template-columns: minmax(0, 1fr) 104px 34px; gap: 6px; padding: 10px; border-bottom: 1px solid #263c4b; }
.entry-search input { min-width: 0; }
.entry-search select { min-width: 0; }
.entry-search .icon-button { width: 34px; height: 100%; }
.target-picker { position: relative; display: grid; gap: 5px; padding: 10px 10px 0; color: #8fa3af; font-size: 11px; }
.target-search-field { position: relative; }
.target-search-field input { width: 100%; padding-right: 30px; }
.target-search-field svg { position: absolute; top: 50%; right: 9px; color: #6fbbb0; pointer-events: none; transform: translateY(-50%); }
.target-picker-results { position: absolute; z-index: 12; top: calc(100% - 2px); right: 10px; left: 10px; overflow: hidden; margin: 0; border: 1px solid #466b67; border-radius: 3px; padding: 3px; list-style: none; background: #0b1821; box-shadow: 0 12px 28px rgb(0 0 0 / 45%); }
.target-picker-results button { display: grid; gap: 2px; width: 100%; border: 0; border-radius: 2px; padding: 7px 8px; color: #dbe8e7; background: transparent; text-align: left; cursor: pointer; }
.target-picker-results button:hover { background: #17302f; }
.target-picker-results small { color: #77bdb2; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; }
.target-picker-note { color: #83a7a1; }
.create-entry { padding: 10px; border-bottom: 1px solid #263c4b; }
.create-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) 34px; gap: 5px; }
.create-row select, .create-row input { min-width: 0; padding: 7px; font-size: 11px; }
.create-entry .field-error { display: block; margin-top: 6px; }
.icon-button, .row-command, .danger-icon, .media-actions button, .entry-pagination button { display: grid; place-items: center; border: 1px solid #456b67; border-radius: 3px; color: #97d9cf; background: #11302e; cursor: pointer; }
.entry-list { flex: 1; min-height: 0; overflow-y: auto; scrollbar-color: #455860 #08131c; scrollbar-width: thin; }
.entry-row { display: grid; width: 100%; gap: 5px; padding: 11px 12px; border: 0; border-bottom: 1px solid #1d303d; text-align: left; color: #c5d2d8; background: transparent; cursor: pointer; }
.entry-row:hover, .entry-row.active { background: #10262d; }
.entry-row.active { box-shadow: inset 3px 0 #72c9bd; }
.entry-title { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.entry-row code { overflow: hidden; color: #6f8994; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.entry-meta { display: flex; align-items: center; gap: 5px; color: #68808b; font-size: 10px; }
.locale-state { min-width: 23px; border: 1px solid #354b55; border-radius: 2px; padding: 1px 3px; text-align: center; }
.locale-state.published { border-color: #47766f; color: #83ccc1; }
.locale-state.draft { border-color: #6f6442; color: #c5b778; }
.entry-pagination { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 44px; border-top: 1px solid #263c4b; color: #718995; font-size: 11px; }
.entry-pagination button { width: 28px; height: 28px; }
.content-editor { position: relative; display: grid; grid-template-rows: auto auto minmax(0, 1fr); min-width: 0; min-height: 0; }
.editor-toolbar { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 8px 14px; border-bottom: 1px solid #263c4b; }
.entry-identity { display: grid; min-width: 0; margin-right: auto; }
.entry-identity span { color: #6e8992; font-size: 10px; }
.entry-identity strong { overflow: hidden; color: #d7e2e5; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.toolbar-status { display: flex; gap: 5px; }
.status-badge { border: 1px solid #58644f; border-radius: 3px; padding: 3px 6px; color: #b6ba8c; font-size: 9px; }
.status-badge.published { border-color: #47766f; color: #84d1c5; }
.status-badge.changed { border-color: #755e3d; color: #e2bd70; }
.secondary-button, .primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border-radius: 3px; padding: 0 10px; cursor: pointer; }
.secondary-button { border: 1px solid #395663; color: #b6c7cc; background: transparent; }
.primary-button { border: 1px solid #6bb5aa; color: #071510; background: #76cbbf; }
.danger-icon { width: 34px; height: 34px; border-color: #6b3f42; color: #d99491; background: transparent; }
button:disabled { cursor: default; opacity: .45; }
.editor-subnav { display: flex; align-items: center; justify-content: space-between; min-height: 43px; padding: 0 14px; border-bottom: 1px solid #263c4b; background: #0b1720; }
.locale-tabs, .mode-tabs { display: flex; height: 100%; }
.locale-tabs button, .mode-tabs button { display: inline-flex; align-items: center; gap: 6px; min-height: 42px; border: 0; border-bottom: 2px solid transparent; padding: 0 12px; color: #7f949e; background: transparent; cursor: pointer; }
.locale-tabs button.active, .mode-tabs button.active { border-bottom-color: #72c9bd; color: #dce7e7; }
.locale-dot { width: 6px; height: 6px; border-radius: 50%; background: #45545b; }
.locale-dot.published { background: #6bc4aa; }
.locale-dot.draft { background: #c5a55e; }
.editor-fields, .content-preview { min-height: 0; overflow-y: auto; padding: 18px; scrollbar-color: #455860 #09141d; scrollbar-width: thin; }
.editor-fields > label > span { display: flex; justify-content: space-between; }
.editor-fields > label > span small { color: #5e737d; font-weight: 400; }
.editor-fields input, .editor-fields textarea { width: 100%; resize: vertical; font-family: inherit; line-height: 1.5; }
.body-editor { min-height: 280px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; }
.collection-editor { margin-top: 20px; border-top: 1px solid #263c4b; padding-top: 14px; }
.collection-editor > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.collection-editor h2 { margin: 0; color: #aebdc2; font-size: 13px; }
.collection-editor .icon-button { width: 30px; height: 30px; }
.knowledge-row { display: grid; grid-template-columns: minmax(0, 1fr) 32px; gap: 6px; margin-bottom: 6px; }
.source-row { display: grid; grid-template-columns: 1fr 1.4fr .8fr .7fr 32px; gap: 6px; margin-bottom: 6px; }
.row-command { width: 32px; min-height: 34px; border-color: #4f3c41; color: #cb8988; background: transparent; }
.empty-collection { margin: 8px 0; color: #5f7680; font-size: 11px; }
.media-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 32px; gap: 10px; margin-bottom: 8px; padding: 8px; border: 1px solid #203542; background: #0b1821; }
.media-row img { width: 92px; height: 70px; object-fit: cover; }
.media-row > div:nth-child(2) { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-width: 0; }
.media-row code { grid-column: 1 / -1; overflow: hidden; color: #75bdb5; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.media-actions { display: grid; gap: 4px; }
.media-actions button { width: 28px; height: 24px; border-color: #394d56; color: #9badb3; background: transparent; }
.upload-panel { display: grid; grid-template-columns: 110px 110px minmax(0, 1fr) auto; gap: 10px; align-items: stretch; border: 1px dashed #2e4b57; padding: 10px; background: #07131b; }
.upload-picker { display: grid; place-items: center; min-height: 86px; border: 1px solid #395663; border-radius: 3px; color: #b6c7cc; background: #0b1821; cursor: pointer; }
.upload-picker input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.upload-preview { display: grid; place-items: center; width: 110px; min-height: 86px; border: 1px solid #263c4b; color: #5f7680; background: #09141d; font-size: 11px; }
.upload-preview img { width: 100%; height: 100%; max-height: 106px; object-fit: cover; }
.upload-fields { display: grid; min-width: 0; gap: 6px; align-content: center; }
.upload-fields strong { overflow: hidden; color: #c5d2d8; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.upload-fields small { color: #6e858e; font-size: 11px; }
.upload-fields input { min-width: 0; }
.upload-panel .secondary-button { align-self: center; min-width: 82px; }
.content-preview { max-width: 880px; width: 100%; margin: 0 auto; color: #b9c9cc; }
.content-preview > header { padding-bottom: 18px; border-bottom: 1px solid #263c4b; }
.content-preview > header span { color: #72c9bd; font-size: 11px; }
.content-preview h2 { margin: 5px 0 10px; color: #edf4f4; font-size: 28px; }
.content-preview > header p { margin: 0; color: #9aadb2; line-height: 1.6; }
.content-preview > img { display: block; max-width: 100%; max-height: 360px; margin: 18px 0; object-fit: contain; }
.markdown-preview { margin-top: 20px; line-height: 1.75; }
.markdown-preview :deep(h2), .markdown-preview :deep(h3) { color: #e1eaea; }
.markdown-preview :deep(a) { color: #78cfc2; }
.empty-preview { margin-top: 32px; color: #647b84; text-align: center; }
.editor-feedback { position: absolute; right: 16px; bottom: 14px; z-index: 3; max-width: min(420px, calc(100% - 32px)); margin: 0; border: 1px solid #3d665f; padding: 9px 12px; color: #9edbd2; background: #102824; box-shadow: 0 8px 24px rgb(0 0 0 / 35%); font-size: 12px; }
.editor-feedback.error { border-color: #754948; color: #e6aaa0; background: #2a1718; }
.editor-state, .sidebar-state, .empty-editor { display: grid; place-items: center; gap: 8px; min-height: 180px; color: #778d98; font-size: 12px; }
.text-button { border: 0; color: #7bcac0; background: transparent; cursor: pointer; }
@media (max-width: 980px) {
  .admin-workspace { grid-template-columns: 280px minmax(0, 1fr); }
  .source-row { grid-template-columns: 1fr 1fr 32px; }
  .source-row input:nth-child(3), .source-row input:nth-child(4) { grid-column: span 1; }
}
@media (max-width: 760px) {
  .admin-workspace { display: block; height: auto; min-height: 0; }
  .entry-sidebar { max-height: 430px; border-right: 0; border-bottom: 1px solid #263c4b; }
  .content-editor { min-height: 720px; }
  .editor-toolbar, .editor-subnav { align-items: stretch; flex-wrap: wrap; }
  .entry-identity { width: 100%; }
  .editor-subnav { padding-top: 4px; }
  .source-row, .upload-panel, .media-row { grid-template-columns: 1fr; }
  .source-row .row-command { width: 100%; }
  .media-row img { width: 100%; height: 150px; }
  .media-actions { grid-template-columns: repeat(3, 32px); }
  .upload-preview { width: 100%; min-height: 150px; }
}
</style>

<script setup lang="ts">
import { LogOut, Plus, Save, Upload } from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createAdminCatalogEntry,
  loadAdminCatalog,
  loadAdminTranslation,
  loginAdmin,
  saveAdminTranslation,
  setAdminTranslationPublished,
  uploadCatalogMedia,
} from '../features/catalog/api'
import type {
  AdminCatalogSummary,
  CatalogEntry,
  CatalogObjectType,
  TranslationDraft,
} from '../features/catalog/types'

const TOKEN_KEY = 'astro-content-admin-token'
const { t } = useI18n()
const token = ref(sessionStorage.getItem(TOKEN_KEY) || '')
const username = ref('admin')
const password = ref('')
const loginPending = ref(false)
const loginError = ref(false)
const entries = ref<AdminCatalogSummary[]>([])
const selectedEntryId = ref('')
const activeLocale = ref('zh-CN')
const loading = ref(false)
const saving = ref(false)
const notice = ref('')
const failed = ref(false)
const createType = ref<CatalogObjectType>('star')
const createKey = ref('')
const sourcesText = ref('')
const knowledgeText = ref('')
const uploadFile = ref<File | null>(null)
const uploadAlt = ref('')
const draft = reactive<TranslationDraft>(emptyDraft())
const translationStatus = ref<CatalogEntry['status']>('DRAFT')

const selectedEntry = computed(() => entries.value.find(entry => entry.id === selectedEntryId.value) ?? null)

onMounted(() => {
  if (token.value) void refreshEntries()
})
watch([selectedEntryId, activeLocale], () => {
  if (selectedEntryId.value && token.value) void loadTranslation()
})

async function login(): Promise<void> {
  loginPending.value = true
  loginError.value = false
  try {
    const session = await loginAdmin(username.value, password.value)
    token.value = session.accessToken
    sessionStorage.setItem(TOKEN_KEY, session.accessToken)
    password.value = ''
    await refreshEntries()
  } catch {
    loginError.value = true
  } finally {
    loginPending.value = false
  }
}

function logout(): void {
  token.value = ''
  entries.value = []
  selectedEntryId.value = ''
  sessionStorage.removeItem(TOKEN_KEY)
}

async function refreshEntries(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    const page = await loadAdminCatalog(token.value)
    entries.value = page.items
    if (!selectedEntryId.value && entries.value[0]) selectedEntryId.value = entries.value[0].id
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function loadTranslation(): Promise<void> {
  loading.value = true
  notice.value = ''
  try {
    const entry = await loadAdminTranslation(token.value, selectedEntryId.value, activeLocale.value)
    if (!entry) {
      setDraft(emptyDraft())
      translationStatus.value = 'DRAFT'
      return
    }
    setDraft({
      title: entry.title,
      summary: entry.summary,
      bodyMarkdown: entry.bodyMarkdown,
      knowledgePoints: entry.knowledgePoints,
      imageCaption: entry.imageCaption,
      sources: entry.sources,
      media: entry.media.map(({ url: _url, ...media }) => media),
    })
    translationStatus.value = entry.status
  } finally {
    loading.value = false
  }
}

async function createEntry(): Promise<void> {
  if (!createKey.value.trim()) return
  const created = await createAdminCatalogEntry(token.value, createType.value, createKey.value.trim())
  createKey.value = ''
  await refreshEntries()
  selectedEntryId.value = created.id
}

async function save(): Promise<void> {
  if (!selectedEntryId.value) return
  saving.value = true
  notice.value = ''
  try {
    const saved = await saveAdminTranslation(token.value, selectedEntryId.value, activeLocale.value, {
      ...draft,
      knowledgePoints: splitLines(knowledgeText.value),
      sources: parseSources(sourcesText.value),
    })
    translationStatus.value = saved.status
    notice.value = t('adminCatalog.saved')
    await refreshEntries()
  } catch {
    notice.value = t('adminCatalog.saveFailed')
  } finally {
    saving.value = false
  }
}

async function togglePublished(): Promise<void> {
  if (!selectedEntryId.value) return
  saving.value = true
  notice.value = ''
  try {
    const result = await setAdminTranslationPublished(
      token.value,
      selectedEntryId.value,
      activeLocale.value,
      translationStatus.value !== 'PUBLISHED',
    )
    translationStatus.value = result.status
    notice.value = result.status === 'PUBLISHED' ? t('adminCatalog.published') : t('adminCatalog.unpublished')
    await refreshEntries()
  } catch {
    notice.value = t('adminCatalog.publishFailed')
  } finally {
    saving.value = false
  }
}

function selectUpload(event: Event): void {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function upload(): Promise<void> {
  if (!uploadFile.value || !uploadAlt.value.trim()) return
  saving.value = true
  try {
    const asset = await uploadCatalogMedia(token.value, uploadFile.value, { altText: uploadAlt.value.trim() })
    draft.media.push({
      mediaId: asset.mediaId,
      altText: uploadAlt.value.trim(),
      caption: null,
      author: null,
      license: null,
      attribution: null,
    })
    uploadFile.value = null
    uploadAlt.value = ''
    notice.value = t('adminCatalog.uploaded')
  } catch {
    notice.value = t('adminCatalog.uploadFailed')
  } finally {
    saving.value = false
  }
}

function setDraft(value: TranslationDraft): void {
  Object.assign(draft, value)
  knowledgeText.value = value.knowledgePoints.join('\n')
  sourcesText.value = value.sources.map(source => `${source.title}|${source.url}`).join('\n')
}

function emptyDraft(): TranslationDraft {
  return {
    title: '', summary: '', bodyMarkdown: '', knowledgePoints: [], imageCaption: null,
    sources: [], media: [],
  }
}

function splitLines(value: string): string[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean)
}

function parseSources(value: string): TranslationDraft['sources'] {
  return splitLines(value).flatMap(line => {
    const separator = line.indexOf('|')
    if (separator < 1) return []
    const title = line.slice(0, separator).trim()
    const url = line.slice(separator + 1).trim()
    if (!title || !/^https?:\/\//.test(url)) return []
    return [{ title, url, author: null, license: null, attribution: null }]
  })
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
        <form class="create-entry" @submit.prevent="createEntry">
          <select v-model="createType" :aria-label="t('adminCatalog.objectType')">
            <option value="star">{{ t('catalog.types.star') }}</option>
            <option value="solar-system-body">{{ t('catalog.types.solar-system-body') }}</option>
            <option value="culture-figure">{{ t('catalog.types.culture-figure') }}</option>
          </select>
          <input v-model="createKey" :placeholder="t('adminCatalog.objectKey')" required>
          <button type="submit" class="icon-button" :title="t('adminCatalog.create')" :aria-label="t('adminCatalog.create')"><Plus :size="17" /></button>
        </form>
        <div v-if="failed" class="sidebar-state">{{ t('adminCatalog.loadFailed') }}</div>
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          class="entry-row"
          :class="{ active: selectedEntryId === entry.id }"
          @click="selectedEntryId = entry.id"
        >
          <span>{{ entry.objectKey }}</span>
          <small>{{ entry.translations.map(item => `${item.locale}:${item.status === 'PUBLISHED' ? 'P' : 'D'}`).join(' · ') || '—' }}</small>
        </button>
      </aside>

      <form v-if="selectedEntry" class="content-editor" @submit.prevent="save">
        <header class="editor-toolbar">
          <div>
            <strong>{{ selectedEntry.objectKey }}</strong>
            <span :class="['status-badge', translationStatus.toLowerCase()]">{{ t(`adminCatalog.status.${translationStatus}`) }}</span>
          </div>
          <select v-model="activeLocale" :aria-label="t('adminCatalog.locale')">
            <option value="zh-CN">中文</option><option value="en">English</option>
          </select>
          <button type="submit" class="secondary-button" :disabled="saving"><Save :size="16" />{{ t('adminCatalog.save') }}</button>
          <button type="button" class="primary-button" :disabled="saving" @click="togglePublished">
            {{ translationStatus === 'PUBLISHED' ? t('adminCatalog.unpublish') : t('adminCatalog.publish') }}
          </button>
        </header>

        <div class="editor-fields" :aria-busy="loading">
          <label><span>{{ t('adminCatalog.entryTitle') }}</span><input v-model="draft.title" maxlength="160"></label>
          <label><span>{{ t('adminCatalog.summary') }}</span><textarea v-model="draft.summary" rows="3" maxlength="600"></textarea></label>
          <label><span>{{ t('adminCatalog.body') }}</span><textarea v-model="draft.bodyMarkdown" class="body-editor" rows="14"></textarea></label>
          <div class="split-fields">
            <label><span>{{ t('adminCatalog.knowledgePoints') }}</span><textarea v-model="knowledgeText" rows="7"></textarea></label>
            <label><span>{{ t('adminCatalog.sourcesOptional') }}</span><textarea v-model="sourcesText" rows="7"></textarea></label>
          </div>
          <section class="media-editor">
            <span>{{ t('adminCatalog.media') }}</span>
            <div v-for="media in draft.media" :key="media.mediaId" class="media-row">
              <code>{{ media.mediaId }}</code><span>{{ media.altText }}</span>
            </div>
            <div class="upload-row">
              <input type="file" accept="image/jpeg,image/png,image/webp" :aria-label="t('adminCatalog.image')" @change="selectUpload">
              <input v-model="uploadAlt" :placeholder="t('adminCatalog.altText')">
              <button type="button" class="secondary-button" :disabled="!uploadFile || !uploadAlt || saving" @click="upload">
                <Upload :size="16" />{{ t('adminCatalog.upload') }}
              </button>
            </div>
          </section>
          <p v-if="notice" class="editor-notice" role="status">{{ notice }}</p>
        </div>
      </form>
      <div v-else class="empty-editor">{{ t('adminCatalog.selectEntry') }}</div>
    </div>
  </section>
</template>

<style scoped>
.admin-login { display: grid; place-items: center; min-height: calc(100vh - 68px); }
.admin-login form { width: min(360px, 100%); border: 1px solid #2c4353; padding: 28px; background: #0a1621; }
.admin-login p, .admin-heading p { margin: 0 0 5px; color: #72c9bd; font-size: 12px; }
.admin-login h1 { margin: 0 0 24px; font-size: 28px; }
.admin-login label, .editor-fields label { display: grid; gap: 7px; margin-bottom: 14px; color: #8fa3af; font-size: 12px; }
.admin-login input, .editor-fields input, .editor-fields textarea, select, .create-entry input { border: 1px solid #2f4858; border-radius: 3px; padding: 9px 10px; outline: none; color: #e4ecef; background: #08131c; }
.admin-login input:focus, .editor-fields input:focus, .editor-fields textarea:focus { border-color: #6bb7ad; }
.admin-login button { width: 100%; min-height: 40px; border: 0; border-radius: 3px; color: #071510; background: #78cfc2; cursor: pointer; }
.form-error { display: block; margin-top: 10px; color: #df9b83; font-size: 12px; }
.admin-page { padding: 24px 0 48px; }
.admin-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.admin-heading h1 { margin: 0; font-size: 30px; }
.admin-workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 680px; border: 1px solid #263c4b; background: #09141d; }
.entry-sidebar { border-right: 1px solid #263c4b; overflow-y: auto; }
.create-entry { display: grid; grid-template-columns: 82px 1fr 34px; gap: 5px; padding: 10px; border-bottom: 1px solid #263c4b; }
.create-entry select, .create-entry input { min-width: 0; padding: 7px; font-size: 11px; }
.icon-button { display: grid; place-items: center; border: 1px solid #456b67; border-radius: 3px; color: #97d9cf; background: #11302e; cursor: pointer; }
.entry-row { display: grid; width: 100%; gap: 5px; padding: 12px; border: 0; border-bottom: 1px solid #1d303d; text-align: left; color: #c5d2d8; background: transparent; cursor: pointer; }
.entry-row:hover, .entry-row.active { background: #10262d; }
.entry-row.active { box-shadow: inset 3px 0 #72c9bd; }
.entry-row span { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.entry-row small { color: #66808d; font-size: 10px; }
.content-editor { min-width: 0; }
.editor-toolbar { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 9px 14px; border-bottom: 1px solid #263c4b; }
.editor-toolbar > div { display: flex; align-items: center; gap: 10px; margin-right: auto; min-width: 0; }
.editor-toolbar strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-toolbar select { min-width: 100px; }
.status-badge { border: 1px solid #58644f; border-radius: 3px; padding: 2px 5px; color: #b6ba8c; font-size: 9px; }
.status-badge.published { border-color: #47766f; color: #84d1c5; }
.secondary-button, .primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border-radius: 3px; padding: 0 10px; cursor: pointer; }
.secondary-button { border: 1px solid #395663; color: #b6c7cc; background: transparent; }
.primary-button { border: 1px solid #6bb5aa; color: #071510; background: #76cbbf; }
.editor-fields { padding: 18px; }
.editor-fields input, .editor-fields textarea { width: 100%; resize: vertical; font-family: inherit; line-height: 1.5; }
.body-editor { min-height: 260px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; }
.split-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.media-editor { display: grid; gap: 8px; padding-top: 8px; color: #8fa3af; font-size: 12px; }
.media-row { display: grid; grid-template-columns: 280px 1fr; gap: 10px; padding: 7px 9px; background: #0d1c26; }
.media-row code { overflow: hidden; color: #75bdb5; text-overflow: ellipsis; }
.upload-row { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto; gap: 8px; }
.upload-row input { min-width: 0; }
.editor-notice { color: #7fc7bd; font-size: 12px; }
.sidebar-state, .empty-editor { display: grid; place-items: center; min-height: 180px; color: #778d98; font-size: 12px; }
@media (max-width: 850px) {
  .admin-workspace { grid-template-columns: 1fr; }
  .entry-sidebar { max-height: 260px; border-right: 0; border-bottom: 1px solid #263c4b; }
  .editor-toolbar { flex-wrap: wrap; }
  .split-fields, .upload-row { grid-template-columns: 1fr; }
}
</style>

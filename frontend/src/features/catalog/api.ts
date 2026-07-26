import { HttpError, request, requestRaw } from '../../api/http'
import type {
  AdminCatalogPage,
  AdminCatalogSummary,
  CatalogEntry,
  CatalogObjectType,
  CatalogPage,
  TranslationDraft,
} from './types'

export async function loadCatalogEntry(
  objectType: CatalogObjectType,
  objectKey: string,
  locale: string,
): Promise<CatalogEntry | null> {
  try {
    return await request<CatalogEntry>(
      `/content/catalog-entries/${objectType}/${encodeURIComponent(objectKey)}?locale=${encodeURIComponent(locale)}`,
    )
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null
    throw error
  }
}

export function loadCatalogPage(
  locale: string,
  objectType: CatalogObjectType | '',
  query: string,
  page = 0,
  size = 20,
): Promise<CatalogPage> {
  const parameters = new URLSearchParams({ locale, query, page: String(page), size: String(size) })
  if (objectType) parameters.set('objectType', objectType)
  return request<CatalogPage>(`/content/catalog-entries?${parameters}`)
}

export interface AdminSession {
  accessToken: string
  tokenType: string
  expiresAt: string
  roles: string[]
}

export function loginAdmin(username: string, password: string): Promise<AdminSession> {
  return request<AdminSession>('/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function loadAdminCatalog(
  token: string,
  options: { objectType?: CatalogObjectType | ''; query?: string; page?: number; size?: number } = {},
): Promise<AdminCatalogPage> {
  const parameters = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? 50),
    query: options.query?.trim() ?? '',
  })
  if (options.objectType) parameters.set('objectType', options.objectType)
  return adminRequest<AdminCatalogPage>(`/content/admin/catalog-entries?${parameters}`, token)
}

export function createAdminCatalogEntry(
  token: string,
  objectType: CatalogObjectType,
  objectKey: string,
): Promise<AdminCatalogSummary> {
  return adminRequest<AdminCatalogSummary>('/content/admin/catalog-entries', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectType, objectKey }),
  })
}

export async function deleteAdminCatalogEntry(token: string, entryId: string): Promise<void> {
  await requestRaw(`/content/admin/catalog-entries/${entryId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function loadAdminTranslation(
  token: string,
  entryId: string,
  locale: string,
): Promise<CatalogEntry | null> {
  try {
    return await adminRequest<CatalogEntry>(
      `/content/admin/catalog-entries/${entryId}/translations/${encodeURIComponent(locale)}/preview`,
      token,
    )
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null
    throw error
  }
}

export function saveAdminTranslation(
  token: string,
  entryId: string,
  locale: string,
  draft: TranslationDraft,
): Promise<CatalogEntry> {
  return adminRequest<CatalogEntry>(
    `/content/admin/catalog-entries/${entryId}/translations/${encodeURIComponent(locale)}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    },
  )
}

export function setAdminTranslationPublished(
  token: string,
  entryId: string,
  locale: string,
  published: boolean,
): Promise<CatalogEntry> {
  const action = published ? 'publish' : 'unpublish'
  return adminRequest<CatalogEntry>(
    `/content/admin/catalog-entries/${entryId}/translations/${encodeURIComponent(locale)}/${action}`,
    token,
    { method: 'POST' },
  )
}

export async function uploadCatalogMedia(
  token: string,
  file: File,
  metadata: { altText: string; author?: string; license?: string; attribution?: string },
): Promise<{ mediaId: string; url: string; contentType: string; size: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('metadata', new Blob([JSON.stringify({
    altText: metadata.altText,
    author: metadata.author || '',
    license: metadata.license || '',
    attribution: metadata.attribution || '',
  })], { type: 'application/json' }))
  const response = await requestRaw('/media/assets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  return response.json()
}

function adminRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  })
}

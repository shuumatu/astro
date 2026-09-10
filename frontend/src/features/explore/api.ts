import { HttpError, request, requestRaw } from '../../api/http'
import type {
  AdminExploreCategory,
  AdminExplorePage,
  AdminExploreSummary,
  ExploreArticle,
  ExploreCategory,
  ExploreCategoryDefinition,
  ExploreCategoryTranslation,
  ExploreDraft,
  ExplorePage,
  ExploreRevisionSummary,
} from './types'

export function loadExploreCategories(locale: string): Promise<ExploreCategoryDefinition[]> {
  return request<ExploreCategoryDefinition[]>(`/content/explore/categories?locale=${encodeURIComponent(locale)}`)
}

export function loadExplorePage(locale: string, category: ExploreCategory | '', query: string, page = 0, size = 20): Promise<ExplorePage> {
  const params = new URLSearchParams({ locale, query, page: String(page), size: String(size) })
  if (category) params.set('category', category)
  return request<ExplorePage>(`/content/explore/articles?${params}`)
}

export async function loadExploreArticle(slug: string, locale: string): Promise<ExploreArticle | null> {
  try {
    return await request<ExploreArticle>(`/content/explore/articles/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`)
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null
    throw error
  }
}

export function loadAdminExplore(token: string, options: { category?: ExploreCategory | '', status?: string, query?: string } = {}): Promise<AdminExplorePage> {
  const params = new URLSearchParams({ category: options.category || '', status: options.status || '', query: options.query || '' })
  return adminRequest<AdminExplorePage>(`/content/admin/explore/articles?${params}`, token)
}

export function createExploreArticle(token: string, payload: { slug: string, category: ExploreCategory, locale: string, title: string }): Promise<AdminExploreSummary> {
  return adminRequest<AdminExploreSummary>('/content/admin/explore/articles', token, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) })
}

export function updateExploreMetadata(token: string, id: string, payload: { slug: string, category: ExploreCategory }): Promise<AdminExploreSummary> {
  return adminRequest<AdminExploreSummary>(`/content/admin/explore/articles/${id}`, token, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) })
}

export function loadExplorePreview(token: string, id: string, locale: string): Promise<ExploreArticle | null> {
  return adminRequest<ExploreArticle>(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/preview`, token)
    .catch(error => error instanceof HttpError && error.status === 404 ? null : Promise.reject(error))
}

export function saveExploreDraft(token: string, id: string, locale: string, draft: ExploreDraft): Promise<ExploreArticle> {
  return adminRequest<ExploreArticle>(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}`, token,
    { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(draft) })
}

export function publishExplore(token: string, id: string, locale: string): Promise<ExploreArticle> {
  return adminRequest<ExploreArticle>(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/publish`, token, { method: 'POST' })
}

export function unpublishExplore(token: string, id: string, locale: string): Promise<void> {
  return adminRequest(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/unpublish`, token, { method: 'POST' })
}

export function setExploreArchived(token: string, id: string, archived: boolean): Promise<AdminExploreSummary> {
  return adminRequest<AdminExploreSummary>(`/content/admin/explore/articles/${id}/${archived ? 'archive' : 'restore'}`, token, { method: 'POST' })
}

export function loadExploreRevisions(token: string, id: string, locale: string): Promise<ExploreRevisionSummary[]> {
  return adminRequest(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/revisions`, token)
}

export function restoreExploreRevision(token: string, id: string, locale: string, revisionId: string): Promise<ExploreArticle> {
  return adminRequest<ExploreArticle>(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/revisions/${revisionId}/restore`, token, { method: 'POST' })
}

export function loadAdminExploreCategories(token: string): Promise<AdminExploreCategory[]> {
  return adminRequest('/content/admin/explore/categories', token)
}

export function createExploreCategory(token: string, payload: {
  code: string, sortOrder: number, translations: ExploreCategoryTranslation[]
}): Promise<AdminExploreCategory> {
  return adminRequest('/content/admin/explore/categories', token,
    { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) })
}

export function updateExploreCategory(token: string, id: string, payload: {
  sortOrder: number, enabled: boolean, translations: ExploreCategoryTranslation[]
}): Promise<AdminExploreCategory> {
  return adminRequest(`/content/admin/explore/categories/${id}`, token,
    { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(payload) })
}

export async function exportExploreMarkdown(token: string, id: string, locale: string): Promise<{ content: Blob, filename: string }> {
  const response = await requestRaw(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/markdown`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/markdown' },
  })
  const disposition = response.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `explore-${locale}.md`
  return { content: await response.blob(), filename }
}

export function importExploreMarkdown(token: string, id: string, locale: string, markdown: string): Promise<ExploreArticle> {
  return adminRequest<ExploreArticle>(`/content/admin/explore/articles/${id}/translations/${encodeURIComponent(locale)}/markdown`, token,
    { method: 'POST', headers: { 'Content-Type': 'text/markdown;charset=UTF-8' }, body: markdown })
}

const jsonHeaders = { 'Content-Type': 'application/json' }
function adminRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } })
}

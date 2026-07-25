export type CatalogObjectType = 'star' | 'solar-system-body' | 'culture-figure'
export type PublicationStatus = 'DRAFT' | 'PUBLISHED'

export interface CatalogSource {
  title: string
  url: string
  author: string | null
  license: string | null
  attribution: string | null
}

export interface CatalogMedia {
  mediaId: string
  url: string
  altText: string
  caption: string | null
  author: string | null
  license: string | null
  attribution: string | null
}

export interface CatalogEntry {
  id: string
  objectType: CatalogObjectType
  objectKey: string
  requestedLocale: string
  contentLocale: string
  localeFallback: boolean
  status: PublicationStatus
  title: string
  summary: string
  bodyMarkdown: string
  knowledgePoints: string[]
  imageCaption: string | null
  sources: CatalogSource[]
  media: CatalogMedia[]
  revision: number
  publishedAt: string | null
  updatedAt: string
}

export interface CatalogSummary {
  id: string
  objectType: CatalogObjectType
  objectKey: string
  contentLocale: string
  title: string
  summary: string
  primaryMediaUrl: string | null
  updatedAt: string
}

export interface CatalogPage {
  items: CatalogSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface AdminTranslationSummary {
  locale: string
  status: PublicationStatus
  title: string
  revision: number
}

export interface AdminCatalogSummary {
  id: string
  objectType: CatalogObjectType
  objectKey: string
  updatedAt: string
  translations: AdminTranslationSummary[]
}

export interface AdminCatalogPage {
  items: AdminCatalogSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface TranslationDraft {
  title: string
  summary: string
  bodyMarkdown: string
  knowledgePoints: string[]
  imageCaption: string | null
  sources: CatalogSource[]
  media: Omit<CatalogMedia, 'url'>[]
}

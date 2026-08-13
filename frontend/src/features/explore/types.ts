export type ExploreCategory = string
export type ExploreRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED'

export interface ExploreCategoryDefinition {
  id: string
  code: string
  name: string
  description: string | null
  sortOrder: number
  enabled: boolean
}

export interface ExploreCategoryTranslation {
  locale: string
  name: string
  description: string | null
}

export interface AdminExploreCategory {
  id: string
  code: string
  sortOrder: number
  enabled: boolean
  translations: ExploreCategoryTranslation[]
  updatedAt: string
}

export interface ExploreSource {
  title: string
  url: string
  author: string | null
  license: string | null
  attribution: string | null
}

export interface ExploreImageCredit {
  imageUrl: string
  sourcePageUrl: string
  author: string | null
  license: string | null
  attribution: string | null
}

export interface ExploreSummary {
  id: string
  slug: string
  category: ExploreCategory
  contentLocale: string
  title: string
  summary: string
  tags: string[]
  estimatedMinutes: number
  coverImageUrl: string | null
  coverImageAlt: string | null
  publishedAt: string | null
  updatedAt: string
}

export interface ExploreArticle extends ExploreSummary {
  requestedLocale: string
  localeFallback: boolean
  bodyMarkdown: string
  coverImageCaption: string | null
  sources: ExploreSource[]
  imageCredits: ExploreImageCredit[]
  revision: number
  status: ExploreRevisionStatus
  relatedArticles: ExploreSummary[]
}

export interface ExplorePage {
  items: ExploreSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface AdminExploreTranslation {
  locale: string
  draftRevision: number | null
  publishedRevision: number | null
  title: string
}

export interface AdminExploreSummary {
  id: string
  slug: string
  category: ExploreCategory
  archived: boolean
  updatedAt: string
  translations: AdminExploreTranslation[]
}

export interface AdminExplorePage {
  items: AdminExploreSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ExploreDraft {
  title: string
  summary: string
  bodyMarkdown: string
  tags: string[]
  estimatedMinutes: number
  coverImageUrl: string | null
  coverImageAlt: string | null
  coverImageCaption: string | null
  sources: ExploreSource[]
  imageCredits: ExploreImageCredit[]
}

export interface ExploreRevisionSummary {
  id: string
  revision: number
  status: ExploreRevisionStatus
  title: string
  updatedAt: string
  publishedAt: string | null
}

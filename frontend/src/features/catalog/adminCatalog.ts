import type {
  AdminCatalogSummary,
  CatalogObjectType,
  TranslationDraft,
} from './types'

export const ADMIN_CONTENT_LOCALES = ['zh-CN', 'en'] as const

const OBJECT_KEY_PATTERNS: Record<CatalogObjectType, RegExp> = {
  star: /^HIP:[1-9][0-9]*$/,
  'solar-system-body': /^solar-system:[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'culture-figure': /^culture:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'featured-pattern': /^featured-pattern:[a-z0-9]+(?:-[a-z0-9]+)*$/,
}

const OBJECT_KEY_EXAMPLES: Record<CatalogObjectType, string> = {
  star: 'HIP:91262',
  'solar-system-body': 'solar-system:moon',
  'culture-figure': 'culture:western-iau:constellation-lyr',
  'featured-pattern': 'featured-pattern:summer-triangle',
}

export function emptyTranslationDraft(): TranslationDraft {
  return {
    title: '',
    summary: '',
    bodyMarkdown: '',
    knowledgePoints: [],
    imageCaption: null,
    sources: [],
    media: [],
  }
}

export function cloneTranslationDraft(value: TranslationDraft): TranslationDraft {
  return JSON.parse(JSON.stringify(value)) as TranslationDraft
}

export function draftFingerprint(value: TranslationDraft): string {
  return JSON.stringify(value)
}

export function isPublishableDraft(value: TranslationDraft): boolean {
  return Boolean(value.title.trim() && value.summary.trim() && value.bodyMarkdown.trim())
}

export function objectKeyExample(type: CatalogObjectType): string {
  return OBJECT_KEY_EXAMPLES[type]
}

export function normalizeObjectKey(type: CatalogObjectType, input: string): string {
  const value = input.trim()
  if (type === 'star') {
    const hipId = value.match(/^(?:HIP:)?([1-9][0-9]*)$/i)?.[1]
    return hipId ? `HIP:${hipId}` : value
  }
  if (type === 'solar-system-body' && !value.includes(':')) {
    return `solar-system:${normalizeSlug(value)}`
  }
  if (type === 'featured-pattern' && !value.includes(':')) {
    return `featured-pattern:${normalizeSlug(value)}`
  }
  return value
}

export function isValidObjectKey(type: CatalogObjectType, value: string): boolean {
  return OBJECT_KEY_PATTERNS[type].test(value)
}

export function entryTitleForLocale(entry: AdminCatalogSummary, locale: string): string {
  return entry.translations.find((translation) => translation.locale === locale)?.title
    || entry.translations.find((translation) => translation.locale === 'en')?.title
    || entry.translations[0]?.title
    || entry.objectKey
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

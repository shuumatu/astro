import { marked, type Tokens } from 'marked'
import type { ExploreArticle, ExploreDraft, ExploreImageCredit } from './types'

export function emptyExploreDraft(): ExploreDraft {
  return { title: '', summary: '', bodyMarkdown: '', tags: [], estimatedMinutes: 5,
    coverImageUrl: null, coverImageAlt: null, coverImageCaption: null, sources: [], imageCredits: [] }
}

export function draftFromArticle(article: ExploreArticle): ExploreDraft {
  return {
    title: article.title, summary: article.summary, bodyMarkdown: article.bodyMarkdown,
    tags: [...article.tags], estimatedMinutes: article.estimatedMinutes,
    coverImageUrl: article.coverImageUrl, coverImageAlt: article.coverImageAlt,
    coverImageCaption: article.coverImageCaption,
    sources: article.sources.map(item => ({ ...item })), imageCredits: article.imageCredits.map(item => ({ ...item })),
  }
}

export function extractMarkdownImages(markdown: string): Array<{ imageUrl: string, alt: string, caption: string | null }> {
  const results: Array<{ imageUrl: string, alt: string, caption: string | null }> = []
  const tokens = marked.lexer(markdown, { gfm: true })
  marked.walkTokens(tokens, token => {
    if (token.type !== 'image') return
    const image = token as Tokens.Image
    if (isHttpsUrl(image.href)) results.push({ imageUrl: image.href, alt: image.text, caption: image.title || null })
  })
  return results
}

export function reconcileImageCredits(draft: ExploreDraft): void {
  const urls = new Set(extractMarkdownImages(draft.bodyMarkdown).map(item => item.imageUrl))
  if (draft.coverImageUrl) urls.add(draft.coverImageUrl)
  const existing = new Map(draft.imageCredits.map(item => [item.imageUrl, item]))
  draft.imageCredits = [...urls].map(url => existing.get(url) || emptyImageCredit(url))
}

export function emptyImageCredit(imageUrl: string): ExploreImageCredit {
  return { imageUrl, sourcePageUrl: '', author: null, license: null, attribution: null }
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function insertMarkdownImage(markdown: string, position: number, image: { url: string, alt: string, caption: string }): { markdown: string, caret: number } {
  const safePosition = Math.max(0, Math.min(markdown.length, position))
  const title = image.caption.trim() ? ` "${image.caption.trim().replaceAll('"', '\\"')}"` : ''
  const insertion = `![${image.alt.trim()}](${image.url.trim()}${title})`
  const prefix = safePosition > 0 && !markdown.slice(0, safePosition).endsWith('\n') ? '\n\n' : ''
  const suffix = safePosition < markdown.length && !markdown.slice(safePosition).startsWith('\n') ? '\n\n' : ''
  const value = `${prefix}${insertion}${suffix}`
  return { markdown: markdown.slice(0, safePosition) + value + markdown.slice(safePosition), caret: safePosition + value.length }
}

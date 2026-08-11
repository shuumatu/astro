import DOMPurify from 'dompurify'
import { marked, Renderer, type Tokens } from 'marked'
import type { ExploreImageCredit } from './types'

export interface ExploreHeading { id: string, level: 2 | 3, text: string }
export interface RenderedExploreMarkdown { html: string, headings: ExploreHeading[] }

export function renderExploreMarkdown(markdown: string, credits: ExploreImageCredit[] = []): RenderedExploreMarkdown {
  const headings: ExploreHeading[] = []
  const slugCounts = new Map<string, number>()
  const creditMap = new Map(credits.map(item => [item.imageUrl, item]))
  const renderer = new Renderer()

  renderer.heading = function ({ tokens, depth, text }: Tokens.Heading): string {
    if (depth !== 2 && depth !== 3) return `<p>${this.parser.parseInline(tokens)}</p>`
    const label = tokenText(tokens) || plainText(text)
    const base = headingSlug(label)
    const count = (slugCounts.get(base) || 0) + 1
    slugCounts.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`
    headings.push({ id, level: depth, text: label })
    return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>`
  }

  renderer.image = function ({ href, title, text }: Tokens.Image): string {
    if (!isHttpsUrl(href)) return `<span class="explore-image-invalid">${escapeHtml(text || href)}</span>`
    const credit = creditMap.get(href)
    const creditText = credit?.attribution || credit?.author || ''
    const sourceLink = credit?.sourcePageUrl
      ? `<a href="${escapeHtml(credit.sourcePageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(creditText || 'Image source')}</a>`
      : ''
    const caption = [title ? escapeHtml(title) : '', sourceLink]
      .filter(Boolean)
      .join('<span aria-hidden="true"> / </span>')
    return `<figure class="explore-figure"><img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="explore-image-fallback" hidden>${escapeHtml(text || 'Image unavailable')}${sourceLink}</div>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
  }

  renderer.link = function ({ href, title, tokens }: Tokens.Link): string {
    const safeHref = safeLink(href)
    if (!safeHref) return this.parser.parseInline(tokens)
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
    const external = /^https?:\/\//i.test(safeHref) ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${escapeHtml(safeHref)}"${titleAttribute}${external}>${this.parser.parseInline(tokens)}</a>`
  }

  const renderTable = renderer.table
  renderer.table = function (token: Tokens.Table): string {
    return `<div class="explore-table-scroll">${renderTable.call(this, token)}</div>`
  }

  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false, renderer })
  const html = DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'h2', 'h3', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'div', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'id', 'class', 'src', 'alt', 'loading', 'decoding', 'referrerpolicy', 'hidden', 'aria-hidden'],
    ALLOW_DATA_ATTR: false,
  })
  return { html, headings }
}

export function handleExploreImageError(event: Event): void {
  const image = event.target as HTMLImageElement
  if (image.tagName !== 'IMG') return
  const figure = image.closest<HTMLElement>('.explore-figure')
  if (!figure) return
  image.hidden = true
  figure.classList.add('is-failed')
  const fallback = figure.querySelector<HTMLElement>('.explore-image-fallback')
  if (fallback) fallback.hidden = false
}

function headingSlug(value: string): string {
  const slug = plainText(value).toLowerCase().trim().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '')
  return slug || 'section'
}

function plainText(value: string): string { return value.replace(/[*_`~\[\]]/g, '').trim() }

function tokenText(tokens: Tokens.Heading['tokens']): string {
  return tokens.map(token => {
    if ('tokens' in token && Array.isArray(token.tokens)) return tokenText(token.tokens)
    return 'text' in token && typeof token.text === 'string' ? token.text : ''
  }).join('').trim()
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

function safeLink(value: string): string | null {
  if (value.startsWith('#') || value.startsWith('/')) return value
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

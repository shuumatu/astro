import DOMPurify from 'dompurify'
import { marked } from 'marked'

const ALLOWED_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'h2', 'h3', 'hr']

export function renderRestrictedMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  return DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}

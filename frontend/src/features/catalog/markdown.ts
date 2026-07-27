import DOMPurify from 'dompurify'
import { marked } from 'marked'

const ALLOWED_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'h2', 'h3', 'hr']

marked.use({
  extensions: [{
    name: 'mediaReference',
    level: 'inline',
    start(source) {
      return source.search(/\[[1-9][0-9]*\]/)
    },
    tokenizer(source) {
      const match = /^\[([1-9][0-9]*)\]/.exec(source)
      if (!match) return undefined
      return { type: 'mediaReference', raw: match[0], mediaNumber: Number(match[1]) }
    },
    renderer(token) {
      const number = (token as unknown as { mediaNumber: number }).mediaNumber
      return `<a href="#catalog-media-${number}">[${number}]</a>`
    },
  }],
})

export function renderRestrictedMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  return DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}

/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { handleExploreImageError, renderExploreMarkdown } from './markdown'

describe('explore Markdown renderer', () => {
  it('creates stable unique anchors for repeated H2 and H3 headings', () => {
    const rendered = renderExploreMarkdown('## Stellar **spectra**\n\n### Stellar spectra\n\n## Stellar spectra')

    expect(rendered.headings).toEqual([
      { id: 'stellar-spectra', level: 2, text: 'Stellar spectra' },
      { id: 'stellar-spectra-2', level: 3, text: 'Stellar spectra' },
      { id: 'stellar-spectra-3', level: 2, text: 'Stellar spectra' },
    ])
    expect(rendered.html).toContain('id="stellar-spectra-3"')
  })

  it('renders credited HTTPS images with a caption and privacy attributes', () => {
    const rendered = renderExploreMarkdown(
      '![Moon phases](https://images.example.com/moon.webp "Lunar cycle")',
      [{
        imageUrl: 'https://images.example.com/moon.webp',
        sourcePageUrl: 'https://science.example.com/moon',
        author: 'Observatory',
        license: 'CC BY',
        attribution: 'Example Observatory',
      }],
    )

    const root = htmlRoot(rendered.html)
    const image = root.querySelector('img')
    expect(root.querySelector('figure')).not.toBeNull()
    expect(image?.getAttribute('loading')).toBe('lazy')
    expect(image?.getAttribute('decoding')).toBe('async')
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(root.querySelector('figcaption')?.textContent).toContain('Lunar cycle')
    expect(root.querySelector('figcaption a')?.getAttribute('href')).toBe('https://science.example.com/moon')
  })

  it('rejects unsafe image URLs, removes raw scripts, and wraps wide tables', () => {
    const rendered = renderExploreMarkdown([
      '![HTTP](http://images.example.com/a.png)',
      '![Data](data:image/png;base64,abc)',
      '<script>alert(1)</script>',
      '| A | B |\n| - | - |\n| 1 | 2 |',
    ].join('\n\n'))

    expect(rendered.html).not.toContain('http://images.example.com')
    expect(rendered.html).not.toContain('data:image')
    expect(rendered.html).not.toContain('<script')
    expect(rendered.html).toContain('class="explore-table-scroll"')
  })

  it('shows the stable fallback after an external image fails', () => {
    const rendered = renderExploreMarkdown('![Unavailable image](https://images.example.com/missing.webp "Missing")')
    const root = htmlRoot(rendered.html)
    const image = root.querySelector('img') as HTMLImageElement
    const fallback = root.querySelector('.explore-image-fallback') as HTMLElement

    handleExploreImageError({ target: image } as unknown as Event)

    expect(image.hidden).toBe(true)
    expect(root.querySelector('figure')?.classList.contains('is-failed')).toBe(true)
    expect(fallback.hidden).toBe(false)
    expect(fallback.textContent).toContain('Unavailable image')
  })
})

function htmlRoot(html: string): HTMLDivElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

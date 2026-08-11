import { describe, expect, it } from 'vitest'
import { emptyExploreDraft, extractMarkdownImages, insertMarkdownImage, reconcileImageCredits } from './draft'

describe('explore draft helpers', () => {
  it('extracts HTTPS images through the Markdown parser', () => {
    expect(extractMarkdownImages([
      '![Moon](<https://images.example.com/moon_(large).webp> "Lunar cycle")',
      '![Unsafe](http://images.example.com/unsafe.webp)',
    ].join('\n\n'))).toEqual([
      { imageUrl: 'https://images.example.com/moon_(large).webp', alt: 'Moon', caption: 'Lunar cycle' },
    ])
  })

  it('reconciles pasted and cover images while preserving credits', () => {
    const draft = emptyExploreDraft()
    draft.bodyMarkdown = '![Moon](https://images.example.com/moon.webp)'
    draft.coverImageUrl = 'https://images.example.com/cover.webp'
    draft.imageCredits = [{
      imageUrl: 'https://images.example.com/moon.webp',
      sourcePageUrl: 'https://science.example.com/moon',
      author: 'Observatory',
      license: 'CC BY',
      attribution: null,
    }]

    reconcileImageCredits(draft)

    expect(draft.imageCredits).toHaveLength(2)
    expect(draft.imageCredits[0].sourcePageUrl).toBe('https://science.example.com/moon')
    expect(draft.imageCredits[1]).toMatchObject({ imageUrl: 'https://images.example.com/cover.webp', sourcePageUrl: '' })
  })

  it('inserts an image at the editor selection with a caption', () => {
    const result = insertMarkdownImage('Before after', 7, {
      url: 'https://images.example.com/star.webp',
      alt: 'A star',
      caption: 'Stellar spectrum',
    })

    expect(result.markdown).toBe('Before \n\n![A star](https://images.example.com/star.webp "Stellar spectrum")\n\nafter')
    expect(result.markdown.slice(result.caret)).toBe('after')
  })
})

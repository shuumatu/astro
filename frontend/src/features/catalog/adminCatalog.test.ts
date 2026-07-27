import { describe, expect, it } from 'vitest'
import {
  catalogMediaUrl,
  draftFingerprint,
  emptyTranslationDraft,
  isPublishableDraft,
  isValidObjectKey,
  insertImageReference,
  mediaDraftPayload,
  normalizeObjectKey,
} from './adminCatalog'

describe('catalog admin helpers', () => {
  it('normalizes shorthand keys without changing complete culture keys', () => {
    expect(normalizeObjectKey('star', '91262')).toBe('HIP:91262')
    expect(normalizeObjectKey('solar-system-body', 'Moon')).toBe('solar-system:moon')
    expect(normalizeObjectKey('featured-pattern', 'Summer Triangle')).toBe('featured-pattern:summer-triangle')
    expect(normalizeObjectKey('culture-figure', 'culture:western-iau:constellation-lyr'))
      .toBe('culture:western-iau:constellation-lyr')
  })

  it('validates keys against their selected object type', () => {
    expect(isValidObjectKey('star', 'HIP:91262')).toBe(true)
    expect(isValidObjectKey('featured-pattern', 'featured-pattern:summer-triangle')).toBe(true)
    expect(isValidObjectKey('featured-pattern', 'HIP:91262')).toBe(false)
  })

  it('detects publishable and changed drafts', () => {
    const draft = emptyTranslationDraft()
    const baseline = draftFingerprint(draft)
    expect(isPublishableDraft(draft)).toBe(false)
    draft.title = 'Vega'
    expect(isPublishableDraft(draft)).toBe(true)
    expect(draftFingerprint(draft)).not.toBe(baseline)
  })

  it('uses API media URLs while keeping URLs out of saved content', () => {
    const media = {
      mediaId: '12345678-1234-1234-1234-123456789012.webp',
      url: 'https://media.example.com/12345678-1234-1234-1234-123456789012.webp',
      altText: '  Vega  ',
      caption: null,
      author: null,
      license: null,
      attribution: null,
    }

    expect(catalogMediaUrl(media)).toBe(media.url)
    expect(mediaDraftPayload(media)).toEqual({
      mediaId: media.mediaId,
      altText: 'Vega',
      caption: null,
      author: null,
      license: null,
      attribution: null,
    })
    expect(Object.hasOwn(mediaDraftPayload(media), 'url')).toBe(false)
    expect(catalogMediaUrl({ ...media, url: undefined })).toBe(`/api/media/assets/${media.mediaId}`)
  })

  it('inserts a numbered image reference at the editor selection', () => {
    expect(insertImageReference('See image here.', 4, 9, 2)).toEqual({
      markdown: 'See [2] here.',
      caret: 7,
    })
    expect(insertImageReference('Overview', 8, 8, 1)).toEqual({
      markdown: 'Overview [1]',
      caret: 12,
    })
  })
})

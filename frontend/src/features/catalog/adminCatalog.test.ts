import { describe, expect, it } from 'vitest'
import {
  draftFingerprint,
  emptyTranslationDraft,
  isPublishableDraft,
  isValidObjectKey,
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
    draft.summary = 'A bright star.'
    draft.bodyMarkdown = '## Overview'
    expect(isPublishableDraft(draft)).toBe(true)
    expect(draftFingerprint(draft)).not.toBe(baseline)
  })
})

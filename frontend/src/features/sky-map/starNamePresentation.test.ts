import { describe, expect, it } from 'vitest'
import { resolveStarNamePresentation } from './starNamePresentation'
import type { SkySearchIndex, SkySearchIndexEntry } from './types'

describe('resolveStarNamePresentation', () => {
  it('uses the localized cultural name and presents common and scientific aliases in order', () => {
    const index = searchIndex([
      entry('天狼星', 'zh-CN', 'alias', 'western-iau', true),
      entry('Sirius', 'en', 'official', 'western-iau', true),
      entry('α CMa', 'und', 'bayer', 'western-iau', true),
      entry('9 CMa', 'und', 'flamsteed', 'western-iau', false),
      entry('Alpha CMa', 'en', 'identifier', 'western-iau', false),
    ])

    expect(resolveStarNamePresentation(index, {
      objectId: 'HIP:32349',
      cultureId: 'western-iau',
      interfaceLanguage: 'zh-CN',
    })).toEqual({
      objectId: 'HIP:32349',
      primaryName: '天狼星',
      aliases: ['Sirius', 'α CMa', '9 CMa'],
    })
  })

  it('falls back from a Bayer designation to Flamsteed and HIP', () => {
    const bayer = searchIndex([
      entry('α Lyr', 'und', 'bayer', 'western-iau', true, 'HIP:91262'),
      entry('3 Lyr', 'und', 'flamsteed', 'western-iau', false, 'HIP:91262'),
    ])
    expect(resolveStarNamePresentation(bayer, {
      objectId: 'HIP:91262',
      cultureId: 'western-iau',
      interfaceLanguage: 'en',
    }).primaryName).toBe('α Lyr')

    expect(resolveStarNamePresentation(searchIndex([]), {
      objectId: 'HIP:42',
      cultureId: 'western-iau',
      interfaceLanguage: 'en',
    }).primaryName).toBe('HIP 42')
  })

  it('keeps scientific designations visible and excludes names from other sky cultures', () => {
    const index = searchIndex([
      entry('Vega', 'en', 'official', 'western-iau', true, 'HIP:91262'),
      entry('Weaving Girl I', 'en', 'translation', 'chinese-traditional', true, 'HIP:91262'),
      entry('Weaving Girl', 'en', 'alias', 'chinese-traditional', false, 'HIP:91262'),
      entry('α Lyr', 'und', 'bayer', 'western-iau', true, 'HIP:91262'),
      entry('3 Lyr', 'und', 'flamsteed', 'western-iau', false, 'HIP:91262'),
    ])

    expect(resolveStarNamePresentation(index, {
      objectId: 'HIP:91262',
      cultureId: 'western-iau',
      interfaceLanguage: 'en',
    })).toEqual({
      objectId: 'HIP:91262',
      primaryName: 'Vega',
      aliases: ['α Lyr', '3 Lyr'],
    })
  })
})

function searchIndex(entries: SkySearchIndexEntry[]): SkySearchIndex {
  return {
    schemaVersion: 1,
    id: 'sky-search-index',
    version: 'test',
    normalization: 'test',
    entries,
    collisions: [],
  }
}

function entry(
  term: string,
  language: string,
  nameType: SkySearchIndexEntry['nameType'],
  cultureId: string,
  preferred: boolean,
  objectId = 'HIP:32349',
): SkySearchIndexEntry {
  return {
    term,
    normalizedTerm: term.toLowerCase(),
    objectId,
    cultureId,
    language,
    nameType,
    preferred,
    labelPriority: 80,
    sourceId: 'test',
  }
}

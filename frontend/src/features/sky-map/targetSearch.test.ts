import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  normalizeSkyTargetSearchTerm,
  parseSkyTargetQuery,
  searchSkyNames,
} from './targetSearch'
import type { SkyCulturePack, SkySearchIndex, SolarSystemBodyId } from './types'

const CHINESE_NAMES: Record<SolarSystemBodyId, string> = {
  sun: '太阳',
  moon: '月球',
  mercury: '水星',
  venus: '金星',
  mars: '火星',
  jupiter: '木星',
  saturn: '土星',
  uranus: '天王星',
  neptune: '海王星',
}

describe('parseSkyTargetQuery', () => {
  it.each(['HIP 97675', 'hip:97675', '97675'])(
    'parses the HIP query %s',
    (query) => {
      expect(parse(query)).toEqual({ kind: 'star', hipId: 97675 })
    },
  )

  it('parses a localized Solar System body name', () => {
    expect(parse('火星')).toEqual({ kind: 'solarSystemBody', id: 'mars' })
  })

  it('parses stable body identifiers case-insensitively', () => {
    expect(parse('  NEPTUNE  ')).toEqual({ kind: 'solarSystemBody', id: 'neptune' })
  })

  it.each(['', 'HIP 0', 'not-a-target'])(
    'rejects the invalid query %s',
    (query) => {
      expect(parse(query)).toEqual({ kind: 'invalid' })
    },
  )

  it('normalizes Unicode width, case, punctuation, and whitespace', () => {
    expect(normalizeSkyTargetSearchTerm(' Ｖｅｇａ・A ')).toBe('vegaa')
  })
})

describe('searchSkyNames', () => {
  const resourceRoot = new URL(
    '../../../../backend/services/astronomy-service/src/main/resources/catalogs/sky-content/',
    import.meta.url,
  )
  const index = JSON.parse(gunzipSync(
    readFileSync(new URL('search-index.json.gz', resourceRoot)),
  ).toString('utf8')) as SkySearchIndex
  const availableIds = new Set(['HIP:32349', 'HIP:91262', 'HIP:95947'])

  it.each([
    ['织女星', 'chinese-traditional', 'HIP:91262'],
    ['辇道增七', 'chinese-traditional', 'HIP:95947'],
    ['Vega', 'chinese-traditional', 'HIP:91262'],
    ['α CMa', 'western-iau', 'HIP:32349'],
    ['Alpha CMa', 'western-iau', 'HIP:32349'],
  ])('resolves %s across cultures', (query, cultureId, expectedObjectId) => {
    const result = searchSkyNames(index, {
      query,
      cultureId,
      interfaceLanguage: 'zh-CN',
      limit: 8,
    }, availableIds)

    expect(result.suggestions[0]).toMatchObject({
      objectId: expectedObjectId,
      matchType: 'exact',
      availableInCatalog: true,
    })
  })

  it('returns an unavailable direct HIP target without silently discarding it', () => {
    const result = searchSkyNames(index, {
      query: 'HIP 120404',
      cultureId: 'western-iau',
      interfaceLanguage: 'en',
      limit: 8,
    }, availableIds)

    expect(result.suggestions).toEqual([expect.objectContaining({
      objectId: 'HIP:120404',
      matchType: 'exact',
      availableInCatalog: false,
    })])
  })

  it('returns each colliding object so the caller must present a choice', () => {
    const collisionIndex: SkySearchIndex = {
      schemaVersion: 1,
      id: 'sky-search-index',
      version: 'test',
      normalization: 'test',
      collisions: [{ normalizedTerm: 'same', objectIds: ['HIP:1', 'HIP:2'] }],
      entries: [
        searchEntry('Same', 'HIP:2', 'western-iau'),
        searchEntry('Same', 'HIP:1', 'chinese-traditional'),
      ],
    }
    const result = searchSkyNames(collisionIndex, {
      query: 'same',
      cultureId: 'chinese-traditional',
      interfaceLanguage: 'en',
      limit: 8,
    }, new Set(['HIP:1', 'HIP:2']))

    expect(result.suggestions.map((suggestion) => suggestion.objectId)).toEqual(['HIP:1', 'HIP:2'])
  })

  it('prioritizes a Solar System alias over a colliding star name', () => {
    const collisionIndex: SkySearchIndex = {
      schemaVersion: 1,
      id: 'sky-search-index',
      version: 'test',
      normalization: 'test',
      collisions: [],
      entries: [searchEntry('月', 'HIP:19038', 'chinese-traditional')],
    }
    const result = searchSkyNames(collisionIndex, {
      query: '月',
      cultureId: 'western-iau',
      interfaceLanguage: 'zh-CN',
      limit: 8,
      solarSystemBodies: [{ id: 'moon', names: ['月球', '月', '月亮'] }],
    }, new Set(['HIP:19038']))

    expect(result.suggestions[0]).toMatchObject({
      targetType: 'solarSystemBody',
      objectId: 'solar-system:moon',
      matchType: 'exact',
    })
  })

  it('searches constellation names from the active culture', () => {
    const culture = {
      id: 'western-iau',
      figures: [{
        id: 'constellation-ori',
        iauCode: 'Ori',
        names: [{ language: 'zh', value: '猎户座', type: 'translation', preferred: true, searchable: true, sourceId: 'test' }],
      }],
    } as SkyCulturePack
    const result = searchSkyNames({ schemaVersion: 1, id: 'sky-search-index', version: 'test', normalization: 'test', collisions: [], entries: [] }, {
      query: '猎户座',
      cultureId: 'western-iau',
      interfaceLanguage: 'zh-CN',
      limit: 8,
    }, new Set(), culture)

    expect(result.suggestions[0]).toMatchObject({
      targetType: 'cultureFigure',
      objectId: 'culture:western-iau:constellation-ori',
      matchType: 'exact',
    })
  })
})

function parse(query: string) {
  return parseSkyTargetQuery(query, (id) => CHINESE_NAMES[id])
}

function searchEntry(term: string, objectId: string, cultureId: string) {
  return {
    term,
    normalizedTerm: term.toLowerCase(),
    objectId,
    cultureId,
    language: 'en',
    nameType: 'alias' as const,
    preferred: true,
    labelPriority: 80,
    sourceId: 'test',
  }
}

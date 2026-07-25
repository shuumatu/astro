import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import {
  loadSkyContentAsset,
  loadSkyContentManifest,
  resolveSkyContentDownloadUrl,
  validateSkyContentManifest,
} from './skyContent'
import type {
  FeaturedPatternPack,
  SkyContentManifest,
  SkyCulturePack,
  SkySearchIndex,
} from './types'

const resourceRoot = new URL(
  '../../../../backend/services/astronomy-service/src/main/resources/catalogs/sky-content/',
  import.meta.url,
)
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', resourceRoot), 'utf8'),
) as SkyContentManifest

describe('sky-content resources', () => {
  it('resolves API-relative manifest and asset URLs from the worker location', () => {
    expect(resolveSkyContentDownloadUrl(
      '/api/astronomy/catalogs/sky-content/search-index/test-1',
      '/api/astronomy/catalogs/sky-content/manifest',
      'http://127.0.0.1:5173/assets/skyMap.worker.js',
    )).toBe('http://127.0.0.1:5173/api/astronomy/catalogs/sky-content/search-index/test-1')
  })

  it('accepts null cultureId values emitted by the Java manifest DTO', () => {
    const apiManifest = {
      ...manifest,
      assets: manifest.assets.map((asset) => asset.assetType === 'culture'
        ? asset
        : { ...asset, cultureId: null }),
    }

    expect(validateSkyContentManifest(apiManifest).assets[2].cultureId).toBeNull()
  })

  it('loads and validates the published manifest and decoded assets', async () => {
    const fetcher = publishedResourceFetch()
    const loadedManifest = await loadSkyContentManifest(
      'https://astro.test/api/astronomy/catalogs/sky-content/manifest',
      fetcher,
    )
    const assets = await Promise.all(loadedManifest.assets.map((asset) =>
      loadSkyContentAsset(
        loadedManifest,
        'https://astro.test/api/astronomy/catalogs/sky-content/manifest',
        asset.assetId,
        fetcher,
      ),
    ))

    const chinese = assets.find((asset) => asset.id === 'chinese-traditional') as SkyCulturePack
    const western = assets.find((asset) => asset.id === 'western-iau') as SkyCulturePack
    const searchIndex = assets.find((asset) => asset.id === 'sky-search-index') as SkySearchIndex
    const featuredPatterns = assets.find((asset) => asset.id === 'featured-patterns') as FeaturedPatternPack
    expect(loadedManifest.defaultCultureId).toBe('western-iau')
    expect(chinese.figures).toHaveLength(312)
    expect(western.regions).toHaveLength(88)
    expect(searchIndex.entries).toHaveLength(14_042)
    expect(featuredPatterns.patterns.map((pattern) => pattern.id)).toEqual([
      'summer-triangle',
      'winter-triangle',
    ])
  })

  it('rejects a decoded asset whose checksum differs from the manifest', async () => {
    const corruptedManifest: SkyContentManifest = {
      ...manifest,
      assets: manifest.assets.map((asset) => asset.assetId === 'featured-patterns'
        ? { ...asset, decodedSha256: '0'.repeat(64) }
        : asset),
    }

    await expect(loadSkyContentAsset(
      corruptedManifest,
      'https://astro.test/api/astronomy/catalogs/sky-content/manifest',
      'featured-patterns',
      publishedResourceFetch(),
    )).rejects.toMatchObject({ code: 'SKY_CONTENT_INTEGRITY_FAILED' })
  })
})

function publishedResourceFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/manifest')) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const descriptor = manifest.assets.find((asset) => url.includes(`/${asset.assetId}/`))
    if (!descriptor) return new Response(null, { status: 404 })
    const decoded = gunzipSync(readFileSync(new URL(`${descriptor.assetId}.json.gz`, resourceRoot)))
    const body = new Uint8Array(decoded.byteLength)
    body.set(decoded)
    return new Response(body.buffer, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch
}

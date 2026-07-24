import { describe, expect, it, vi } from 'vitest'
import { loadSkyCatalog, sha256Hex } from './catalog'
import type { CatalogManifest, SkyCatalog } from './types'

describe('loadSkyCatalog', () => {
  it('loads browser-decoded catalog bytes after integrity validation', async () => {
    const catalog = sampleCatalog()
    const bytes = new TextEncoder().encode(`${JSON.stringify(catalog)}\n`)
    const manifest = await sampleManifest(bytes)
    const fetcher = mockCatalogFetch(manifest, bytes)

    const loaded = await loadSkyCatalog('https://astro.test/manifest', fetcher)

    expect(loaded.manifest.version).toBe('test-1')
    expect(loaded.catalog.stars).toHaveLength(1)
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://astro.test/api/astronomy/catalogs/naked-eye/test-1',
      expect.anything(),
    )
  })

  it('rejects decoded bytes with a different checksum', async () => {
    const bytes = new TextEncoder().encode(`${JSON.stringify(sampleCatalog())}\n`)
    const manifest = { ...(await sampleManifest(bytes)), decodedSha256: '0'.repeat(64) }

    await expect(loadSkyCatalog('https://astro.test/manifest', mockCatalogFetch(manifest, bytes)))
      .rejects.toMatchObject({ code: 'CATALOG_INTEGRITY_FAILED' })
  })

  it('rejects a manifest count that disagrees with the decoded catalog', async () => {
    const bytes = new TextEncoder().encode(`${JSON.stringify(sampleCatalog())}\n`)
    const manifest = { ...(await sampleManifest(bytes)), starCount: 2 }

    await expect(loadSkyCatalog('https://astro.test/manifest', mockCatalogFetch(manifest, bytes)))
      .rejects.toMatchObject({ code: 'CATALOG_INVALID' })
  })
})

function mockCatalogFetch(manifest: CatalogManifest, bytes: Uint8Array): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/manifest')) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(new Uint8Array(bytes).buffer, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    })
  }) as unknown as typeof fetch
}

async function sampleManifest(bytes: Uint8Array): Promise<CatalogManifest> {
  return {
    schemaVersion: 1,
    catalogId: 'naked-eye',
    version: 'test-1',
    downloadUrl: 'https://astro.test/api/astronomy/catalogs/naked-eye/test-1',
    mediaType: 'application/json',
    contentEncoding: 'gzip',
    sha256: '1'.repeat(64),
    contentLength: 100,
    decodedSha256: await sha256Hex(bytes),
    decodedContentLength: bytes.byteLength,
    starCount: 1,
    constellationCount: 1,
    sources: [{ catalog: 'test', release: '1', url: 'https://astro.test', credit: 'test' }],
    publishedAt: '2026-07-23T00:00:00Z',
  }
}

function sampleCatalog(): SkyCatalog {
  return {
    schemaVersion: 1,
    catalogId: 'naked-eye',
    referenceFrame: 'ICRS',
    visualMagnitudeLimit: 6.5,
    stars: [{
      id: 'HIP:1',
      hipId: 1,
      gaiaDr3Id: null,
      tycho2Id: null,
      hdId: null,
      raDeg: 10,
      decDeg: 20,
      epochYear: 1991.25,
      pmRaMasPerYear: 1,
      pmDecMasPerYear: 2,
      parallaxMas: null,
      visualMagnitude: 1,
      colorIndex: 0.5,
      spectralType: 'G2V',
      astrometrySource: 'HIPPARCOS_2',
    }],
    constellations: [{
      id: 'Ori',
      rank: 1,
      labelPositions: [[80, 5]],
      lines: [[[80, 5], [85, 0]]],
    }],
  }
}

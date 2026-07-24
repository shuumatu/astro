import { loadSkyCatalog } from './catalog'
import { calculateSkyFrame } from './coordinates'
import { loadSkyContentAsset, loadSkyContentManifest } from './skyContent'
import { searchSkyNames } from './targetSearch'
import type {
  FeaturedPatternPack,
  SkyCulturePack,
  SkySearchIndex,
  SkyWorkerRequest,
  SkyWorkerResponse,
} from './types'
import { SkyMapError } from './types'

interface InitializedCatalogs {
  catalog: Awaited<ReturnType<typeof loadSkyCatalog>>
  catalogObjectIds: ReadonlySet<string>
  skyContentManifest: Awaited<ReturnType<typeof loadSkyContentManifest>>
  searchIndex: SkySearchIndex
  featuredPatterns: FeaturedPatternPack
}

let initializationPromise: Promise<InitializedCatalogs> | null = null
let skyContentManifestUrl = ''
const culturePromises = new Map<string, Promise<SkyCulturePack>>()

self.addEventListener('message', (event: MessageEvent<SkyWorkerRequest>) => {
  void handleRequest(event.data)
})

async function handleRequest(request: SkyWorkerRequest): Promise<void> {
  try {
    if (request.type === 'initialize') {
      skyContentManifestUrl = request.skyContentManifestUrl
      culturePromises.clear()
      const catalogPromise = loadSkyCatalog(request.manifestUrl)
      const manifestPromise = loadSkyContentManifest(request.skyContentManifestUrl)
      initializationPromise = initializeCatalogs(catalogPromise, manifestPromise, request.skyContentManifestUrl)
      const initialized = await initializationPromise
      post({
        type: 'ready',
        requestId: request.requestId,
        catalog: {
          version: initialized.catalog.manifest.version,
          starCount: initialized.catalog.manifest.starCount,
          decodedSha256: initialized.catalog.manifest.decodedSha256,
          skyContentVersion: initialized.skyContentManifest.version,
          defaultCultureId: initialized.skyContentManifest.defaultCultureId,
          cultureIds: [...initialized.skyContentManifest.cultureIds],
        },
      })
      return
    }

    if (initializationPromise === null) {
      throw new SkyMapError('CATALOG_NOT_READY', 'The sky catalog has not been initialized')
    }
    const initialized = await initializationPromise
    if (request.type === 'search') {
      post({
        type: 'search-results',
        requestId: request.requestId,
        result: searchSkyNames(initialized.searchIndex, request.parameters, initialized.catalogObjectIds),
      })
      return
    }
    const culture = await loadCulture(initialized, request.parameters.cultureId)
    const startedAt = performance.now()
    const frame = calculateSkyFrame(
      initialized.catalog.catalog,
      culture,
      initialized.featuredPatterns,
      request.parameters,
    )
    post({
      type: 'frame',
      requestId: request.requestId,
      frame,
      calculationDurationMs: performance.now() - startedAt,
    })
  } catch (error) {
    const workerError = error instanceof SkyMapError
      ? error
      : new SkyMapError('WORKER_FAILURE', error instanceof Error ? error.message : String(error))
    post({
      type: 'error',
      requestId: request.requestId,
      code: workerError.code,
      message: workerError.message,
    })
  }
}

async function initializeCatalogs(
  catalogPromise: ReturnType<typeof loadSkyCatalog>,
  manifestPromise: ReturnType<typeof loadSkyContentManifest>,
  manifestUrl: string,
): Promise<InitializedCatalogs> {
  const [catalog, skyContentManifest] = await Promise.all([catalogPromise, manifestPromise])
  const [searchIndex, featuredPatterns] = await Promise.all([
    loadSkyContentAsset(
      skyContentManifest,
      manifestUrl,
      skyContentManifest.searchIndexAssetId,
    ) as Promise<SkySearchIndex>,
    loadSkyContentAsset(
      skyContentManifest,
      manifestUrl,
      skyContentManifest.featuredPatternsAssetId,
    ) as Promise<FeaturedPatternPack>,
  ])
  return {
    catalog,
    catalogObjectIds: new Set(catalog.catalog.stars.map((star) => star.id)),
    skyContentManifest,
    searchIndex,
    featuredPatterns,
  }
}

function loadCulture(initialized: InitializedCatalogs, cultureId: string): Promise<SkyCulturePack> {
  const cached = culturePromises.get(cultureId)
  if (cached) return cached
  const descriptor = initialized.skyContentManifest.assets.find(
    (asset) => asset.assetType === 'culture' && asset.cultureId === cultureId,
  )
  if (!descriptor) {
    throw new SkyMapError('INVALID_PARAMETERS', `Unknown sky culture: ${cultureId}`)
  }
  const promise = loadSkyContentAsset(
    initialized.skyContentManifest,
    skyContentManifestUrl,
    descriptor.assetId,
  ) as Promise<SkyCulturePack>
  culturePromises.set(cultureId, promise)
  void promise.catch(() => culturePromises.delete(cultureId))
  return promise
}

function post(response: SkyWorkerResponse): void {
  self.postMessage(response)
}

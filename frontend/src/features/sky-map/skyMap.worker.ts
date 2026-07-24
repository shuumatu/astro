import { loadSkyCatalog } from './catalog'
import { calculateSkyFrame } from './coordinates'
import type { SkyWorkerRequest, SkyWorkerResponse } from './types'
import { SkyMapError } from './types'

let catalogPromise: ReturnType<typeof loadSkyCatalog> | null = null

self.addEventListener('message', (event: MessageEvent<SkyWorkerRequest>) => {
  void handleRequest(event.data)
})

async function handleRequest(request: SkyWorkerRequest): Promise<void> {
  try {
    if (request.type === 'initialize') {
      catalogPromise = loadSkyCatalog(request.manifestUrl)
      const { manifest } = await catalogPromise
      post({
        type: 'ready',
        requestId: request.requestId,
        catalog: {
          version: manifest.version,
          starCount: manifest.starCount,
          constellationCount: manifest.constellationCount,
          decodedSha256: manifest.decodedSha256,
        },
      })
      return
    }

    if (catalogPromise === null) {
      throw new SkyMapError('CATALOG_NOT_READY', 'The sky catalog has not been initialized')
    }
    const { catalog } = await catalogPromise
    const startedAt = performance.now()
    const frame = calculateSkyFrame(catalog, request.parameters)
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

function post(response: SkyWorkerResponse): void {
  self.postMessage(response)
}

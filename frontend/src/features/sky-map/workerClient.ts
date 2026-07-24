import type {
  CatalogSummary,
  SkyCalculationParameters,
  SkyFrame,
  SkyWorkerRequest,
  SkyWorkerResponse,
} from './types'
import { SkyMapError } from './types'

type PendingRequest = {
  resolve: (response: SkyWorkerResponse) => void
  reject: (error: Error) => void
}

type SkyWorkerRequestPayload =
  | Omit<Extract<SkyWorkerRequest, { type: 'initialize' }>, 'requestId'>
  | Omit<Extract<SkyWorkerRequest, { type: 'calculate' }>, 'requestId'>

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const defaultCatalogManifestUrl = `${apiBaseUrl}/astronomy/catalogs/naked-eye/manifest`
export const defaultSkyContentManifestUrl = `${apiBaseUrl}/astronomy/catalogs/sky-content/manifest`

export class SkyMapWorkerClient {
  private readonly worker: Worker
  private readonly pending = new Map<string, PendingRequest>()
  private sequence = 0

  constructor(worker = new Worker(new URL('./skyMap.worker.ts', import.meta.url), { type: 'module' })) {
    this.worker = worker
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', this.handleWorkerError)
  }

  async initialize(
    manifestUrl = defaultCatalogManifestUrl,
    skyContentManifestUrl = defaultSkyContentManifestUrl,
  ): Promise<CatalogSummary> {
    const response = await this.send({ type: 'initialize', manifestUrl, skyContentManifestUrl })
    if (response.type !== 'ready') throw new SkyMapError('WORKER_FAILURE', 'Unexpected worker response')
    return response.catalog
  }

  async calculate(parameters: SkyCalculationParameters): Promise<{
    frame: SkyFrame
    calculationDurationMs: number
  }> {
    const response = await this.send({ type: 'calculate', parameters })
    if (response.type !== 'frame') throw new SkyMapError('WORKER_FAILURE', 'Unexpected worker response')
    return { frame: response.frame, calculationDurationMs: response.calculationDurationMs }
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.handleMessage)
    this.worker.removeEventListener('error', this.handleWorkerError)
    this.worker.terminate()
    this.rejectAll(new SkyMapError('WORKER_FAILURE', 'The sky map worker was disposed'))
  }

  private send(request: SkyWorkerRequestPayload): Promise<SkyWorkerResponse> {
    const requestId = String(++this.sequence)
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ ...request, requestId } as SkyWorkerRequest)
    })
  }

  private readonly handleMessage = (event: MessageEvent<SkyWorkerResponse>): void => {
    const pending = this.pending.get(event.data.requestId)
    if (!pending) return
    this.pending.delete(event.data.requestId)
    if (event.data.type === 'error') {
      pending.reject(new SkyMapError(event.data.code, event.data.message))
    } else {
      pending.resolve(event.data)
    }
  }

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    this.rejectAll(new SkyMapError('WORKER_FAILURE', event.message || 'The sky map worker failed'))
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

export type AstrometrySource = 'GAIA_DR3' | 'HIPPARCOS_2' | 'HIPPARCOS'

export interface CatalogSource {
  catalog: string
  release: string
  url: string
  credit: string
}

export interface CatalogManifest {
  schemaVersion: number
  catalogId: 'naked-eye'
  version: string
  downloadUrl: string
  mediaType: 'application/json'
  contentEncoding: 'identity' | 'br' | 'gzip'
  sha256: string
  contentLength: number
  decodedSha256: string
  decodedContentLength: number
  starCount: number
  constellationCount: number
  sources: CatalogSource[]
  publishedAt: string
}

export interface StarRecord {
  id: string
  hipId: number
  gaiaDr3Id: string | null
  tycho2Id: string | null
  hdId: number | null
  raDeg: number
  decDeg: number
  epochYear: number
  pmRaMasPerYear: number | null
  pmDecMasPerYear: number | null
  parallaxMas: number | null
  visualMagnitude: number
  colorIndex: number | null
  spectralType: string | null
  astrometrySource: AstrometrySource
}

export type EquatorialCoordinate = [raDeg: number, decDeg: number]

export interface ConstellationRecord {
  id: string
  rank: 1 | 2 | 3
  labelPositions: EquatorialCoordinate[]
  lines: EquatorialCoordinate[][]
}

export interface SkyCatalog {
  schemaVersion: 1
  catalogId: 'naked-eye'
  referenceFrame: 'ICRS'
  visualMagnitudeLimit: number
  stars: StarRecord[]
  constellations: ConstellationRecord[]
}

export interface ObserverLocation {
  latitudeDeg: number
  longitudeDeg: number
  elevationMeters: number
}

export interface SkyCalculationParameters {
  observedAt: string
  observer: ObserverLocation
  magnitudeLimit: number
  minimumAltitudeDeg: number
  applyRefraction: boolean
}

export interface HorizontalCoordinate {
  azimuthDeg: number
  altitudeDeg: number
}

export interface ComputedStar extends HorizontalCoordinate {
  id: string
  hipId: number
  gaiaDr3Id: string | null
  tycho2Id: string | null
  hdId: number | null
  visualMagnitude: number
  colorIndex: number | null
  spectralType: string | null
  astrometrySource: AstrometrySource
}

export interface ComputedConstellation {
  id: string
  rank: 1 | 2 | 3
  labelPositions: HorizontalCoordinate[]
  lines: HorizontalCoordinate[][]
}

export const SOLAR_SYSTEM_BODY_IDS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const

export type SolarSystemBodyId = (typeof SOLAR_SYSTEM_BODY_IDS)[number]

export interface ComputedSolarSystemBody extends HorizontalCoordinate {
  id: SolarSystemBodyId
  rightAscensionHours: number
  declinationDeg: number
  visualMagnitude: number
  phaseAngleDeg: number
  phaseFraction: number
  distanceAu: number
  ringTiltDeg: number | null
}

export interface SkyFrame {
  observedAt: string
  observer: ObserverLocation
  stars: ComputedStar[]
  constellations: ComputedConstellation[]
  solarSystemBodies: ComputedSolarSystemBody[]
}

export interface CatalogSummary {
  version: string
  starCount: number
  constellationCount: number
  decodedSha256: string
}

export type SkyWorkerRequest =
  | { type: 'initialize'; requestId: string; manifestUrl: string }
  | { type: 'calculate'; requestId: string; parameters: SkyCalculationParameters }

export type SkyWorkerResponse =
  | { type: 'ready'; requestId: string; catalog: CatalogSummary }
  | { type: 'frame'; requestId: string; frame: SkyFrame; calculationDurationMs: number }
  | { type: 'error'; requestId: string; code: SkyMapErrorCode; message: string }

export type SkyMapErrorCode =
  | 'CATALOG_FETCH_FAILED'
  | 'CATALOG_INVALID'
  | 'CATALOG_INTEGRITY_FAILED'
  | 'CATALOG_NOT_READY'
  | 'INVALID_PARAMETERS'
  | 'WORKER_FAILURE'

export class SkyMapError extends Error {
  constructor(
    public readonly code: SkyMapErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SkyMapError'
  }
}

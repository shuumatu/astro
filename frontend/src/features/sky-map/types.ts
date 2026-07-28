export type AstrometrySource = 'GAIA_DR3' | 'HIPPARCOS_2' | 'HIPPARCOS'

export interface CatalogSource {
  catalog: string
  release: string
  url: string
  credit: string
}

export interface CatalogManifest {
  schemaVersion: 2
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

export interface SkyCatalog {
  schemaVersion: 2
  catalogId: 'naked-eye'
  referenceFrame: 'ICRS'
  visualMagnitudeLimit: number
  stars: StarRecord[]
}

export type SkyNameType =
  | 'native'
  | 'official'
  | 'translation'
  | 'transliteration'
  | 'alias'
  | 'bayer'
  | 'flamsteed'

export interface SkyName {
  language: string
  value: string
  type: SkyNameType
  preferred: boolean
  searchable: boolean
  sourceId: string
}

export interface SkyContentSource {
  id: string
  title: string
  authors: string[]
  url: string
  version: string
  license: string
  attribution: string
}

export type SkyContentAssetType = 'culture' | 'search-index' | 'featured-patterns'

export interface SkyContentAssetDescriptor {
  assetId: string
  assetType: SkyContentAssetType
  cultureId?: string | null
  version: string
  downloadUrl: string
  mediaType: 'application/json'
  contentEncoding: 'gzip'
  sha256: string
  contentLength: number
  decodedSha256: string
  decodedContentLength: number
  recordCounts: Record<string, number>
}

export interface SkyContentManifest {
  schemaVersion: 1
  catalogId: 'sky-content'
  version: string
  defaultCultureId: string
  cultureIds: string[]
  searchIndexAssetId: string
  featuredPatternsAssetId: string
  nameFallbackOrder: string[]
  assets: SkyContentAssetDescriptor[]
  publishedAt: string
}

export interface StarNameRecord {
  objectId: string
  labelPriority: number
  names: SkyName[]
}

export type CultureFigureType = 'constellation' | 'asterism' | 'enclosure-wall' | 'lunar-mansion'

export interface CultureFigureRecord {
  id: string
  type: CultureFigureType
  iauCode?: string
  names: SkyName[]
  paths: string[][]
  labelAnchor: { objectId: string }
  rank: 1 | 2 | 3
  groupIds: string[]
  sourceIds: string[]
}

export interface CultureGroupRecord {
  id: string
  type: 'system' | 'enclosure' | 'lunar-mansions' | 'constellation-set'
  names: SkyName[]
  members: Array<{ type: 'figure' | 'group'; id: string }>
  sourceIds: string[]
}

export interface CultureRegionRecord {
  id: string
  figureId: string
  names: SkyName[]
  referenceFrame: 'ICRS'
  geometry: {
    type: 'MultiPolygon'
    coordinates: EquatorialCoordinate[][][]
  }
  sourceIds: string[]
}

export interface SkyCulturePack {
  schemaVersion: 1
  id: string
  version: string
  names: SkyName[]
  defaultLanguage: string
  descriptions: Array<{ language: string; value: string; sourceId: string }>
  sources: SkyContentSource[]
  starNames: StarNameRecord[]
  artworkAnchorObjectIds?: string[]
  figures: CultureFigureRecord[]
  groups: CultureGroupRecord[]
  regions: CultureRegionRecord[]
}

export interface SkySearchIndexEntry {
  term: string
  normalizedTerm: string
  objectId: string
  cultureId: string
  language: string
  nameType: SkyNameType | 'identifier'
  preferred: boolean
  labelPriority: number
  sourceId: string | null
}

export interface SkySearchIndex {
  schemaVersion: 1
  id: 'sky-search-index'
  version: string
  normalization: string
  entries: SkySearchIndexEntry[]
  collisions: Array<{ normalizedTerm: string; objectIds: string[] }>
}

export type SkySearchMatchType = 'exact' | 'prefix' | 'contains'

export interface SkySearchParameters {
  query: string
  cultureId: string
  interfaceLanguage: string
  limit: number
  solarSystemBodies?: Array<{ id: SolarSystemBodyId; names: string[] }>
}

export interface SkySearchSuggestion {
  targetType: 'star' | 'solarSystemBody' | 'cultureFigure'
  objectId: string
  hipId?: number
  term: string
  cultureId: string
  language: string
  nameType: SkySearchIndexEntry['nameType']
  matchType: SkySearchMatchType
  availableInCatalog: boolean
}

export interface SkySearchResult {
  query: string
  normalizedQuery: string
  suggestions: SkySearchSuggestion[]
}

export interface StarNamePresentationParameters {
  objectId: string
  cultureId: string
  interfaceLanguage: string
}

export interface StarNamePresentation {
  objectId: string
  primaryName: string
  aliases: string[]
}

export interface FeaturedPatternRecord {
  id: string
  names: SkyName[]
  memberObjectIds: string[]
  paths: string[][]
  labelAnchor: { objectId: string }
  cultureIds: string[]
  sourceIds: string[]
}

export interface FeaturedPatternPack {
  schemaVersion: 1
  id: 'featured-patterns'
  version: string
  sources: SkyContentSource[]
  patterns: FeaturedPatternRecord[]
}

export type SkyContentAsset = SkyCulturePack | SkySearchIndex | FeaturedPatternPack

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
  cultureId: string
  interfaceLanguage: string
  enabledFeaturedPatternIds: string[]
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

/**
 * A culture-defined star position retained for figure artwork and geometry.
 * It is intentionally independent from the user's limiting magnitude.
 */
export interface ComputedCultureAnchorStar extends HorizontalCoordinate {
  hipId: number
}

export interface ComputedCultureFigure {
  id: string
  type: CultureFigureType
  name: string
  rank: 1 | 2 | 3
  labelPosition: HorizontalCoordinate | null
  lines: HorizontalCoordinate[][]
}

export interface ComputedCultureRegion {
  id: string
  figureId: string
  name: string
  rings: HorizontalCoordinate[][]
}

export interface ComputedStarLabel extends HorizontalCoordinate {
  objectId: string
  name: string
  labelPriority: number
  visualMagnitude: number
}

export interface ComputedFeaturedPattern {
  id: string
  name: string
  memberObjectIds: string[]
  labelPosition: HorizontalCoordinate | null
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

export type SkyObjectSelection =
  | { kind: 'star'; object: ComputedStar }
  | { kind: 'solarSystemBody'; object: ComputedSolarSystemBody }
  | { kind: 'cultureFigure'; object: ComputedCultureFigure }
  | { kind: 'featuredPattern'; object: ComputedFeaturedPattern }

export interface SkyFrame {
  observedAt: string
  observer: ObserverLocation
  cultureId: string
  interfaceLanguage: string
  stars: ComputedStar[]
  cultureAnchorStars: ComputedCultureAnchorStar[]
  cultureFigures: ComputedCultureFigure[]
  cultureRegions: ComputedCultureRegion[]
  starLabels: ComputedStarLabel[]
  featuredPatterns: ComputedFeaturedPattern[]
  solarSystemBodies: ComputedSolarSystemBody[]
}

export interface CatalogSummary {
  version: string
  starCount: number
  decodedSha256: string
  skyContentVersion: string
  defaultCultureId: string
  cultureIds: string[]
  featuredPatterns: Array<{
    id: string
    names: SkyName[]
  }>
}

export type SkyWorkerRequest =
  | {
    type: 'initialize'
    requestId: string
    manifestUrl: string
    skyContentManifestUrl: string
  }
  | { type: 'calculate'; requestId: string; parameters: SkyCalculationParameters }
  | { type: 'search'; requestId: string; parameters: SkySearchParameters }
  | { type: 'star-names'; requestId: string; parameters: StarNamePresentationParameters }

export type SkyWorkerResponse =
  | { type: 'ready'; requestId: string; catalog: CatalogSummary }
  | { type: 'frame'; requestId: string; frame: SkyFrame; calculationDurationMs: number }
  | { type: 'search-results'; requestId: string; result: SkySearchResult }
  | { type: 'star-names'; requestId: string; result: StarNamePresentation }
  | { type: 'error'; requestId: string; code: SkyMapErrorCode; message: string }

export type SkyMapErrorCode =
  | 'CATALOG_FETCH_FAILED'
  | 'CATALOG_INVALID'
  | 'CATALOG_INTEGRITY_FAILED'
  | 'CATALOG_NOT_READY'
  | 'SKY_CONTENT_FETCH_FAILED'
  | 'SKY_CONTENT_INVALID'
  | 'SKY_CONTENT_INTEGRITY_FAILED'
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

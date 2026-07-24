import type {
  CatalogManifest,
  ConstellationRecord,
  EquatorialCoordinate,
  SkyCatalog,
  StarRecord,
} from './types'
import { SkyMapError } from './types'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const IAU_ID_PATTERN = /^[A-Z][A-Za-z]{2}$/

export async function loadSkyCatalog(
  manifestUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ manifest: CatalogManifest; catalog: SkyCatalog }> {
  const manifestResponse = await fetchResponse(fetcher, manifestUrl)
  const manifest = validateManifest(await readJson(manifestResponse, 'catalog manifest'))
  const downloadUrl = resolveDownloadUrl(manifest.downloadUrl, manifestResponse.url)
  const catalogResponse = await fetchResponse(fetcher, downloadUrl)
  const decodedBytes = new Uint8Array(await catalogResponse.arrayBuffer())

  if (decodedBytes.byteLength !== manifest.decodedContentLength) {
    throw new SkyMapError(
      'CATALOG_INTEGRITY_FAILED',
      `Decoded catalog length ${decodedBytes.byteLength} does not match ${manifest.decodedContentLength}`,
    )
  }
  const checksum = await sha256Hex(decodedBytes)
  if (checksum !== manifest.decodedSha256) {
    throw new SkyMapError('CATALOG_INTEGRITY_FAILED', 'Decoded catalog checksum does not match its manifest')
  }

  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodedBytes))
  } catch (error) {
    throw new SkyMapError('CATALOG_INVALID', `Catalog JSON cannot be decoded: ${errorMessage(error)}`)
  }
  return { manifest, catalog: validateCatalog(value, manifest) }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new SkyMapError('CATALOG_INTEGRITY_FAILED', 'Web Crypto SHA-256 is unavailable')
  }
  const data = new Uint8Array(bytes).buffer
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchResponse(fetcher: typeof fetch, url: string): Promise<Response> {
  let response: Response
  try {
    response = await fetcher(url, { headers: { Accept: 'application/json' } })
  } catch (error) {
    throw new SkyMapError('CATALOG_FETCH_FAILED', `Catalog request failed: ${errorMessage(error)}`)
  }
  if (!response.ok) {
    throw new SkyMapError('CATALOG_FETCH_FAILED', `Catalog request returned HTTP ${response.status}`)
  }
  return response
}

async function readJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new SkyMapError('CATALOG_INVALID', `The ${label} is not valid JSON: ${errorMessage(error)}`)
  }
}

function resolveDownloadUrl(downloadUrl: string, responseUrl: string): string {
  if (/^https?:\/\//.test(downloadUrl)) {
    return downloadUrl
  }
  const baseUrl = responseUrl || globalThis.location?.href
  if (!baseUrl) {
    throw new SkyMapError('CATALOG_INVALID', 'A relative catalog URL has no response base URL')
  }
  return new URL(downloadUrl, baseUrl).toString()
}

function validateManifest(value: unknown): CatalogManifest {
  const manifest = requireRecord(value, 'manifest')
  requireEqual(manifest.schemaVersion, 1, 'manifest.schemaVersion')
  requireEqual(manifest.catalogId, 'naked-eye', 'manifest.catalogId')
  requireString(manifest.version, 'manifest.version', VERSION_PATTERN)
  requireString(manifest.downloadUrl, 'manifest.downloadUrl')
  requireEqual(manifest.mediaType, 'application/json', 'manifest.mediaType')
  if (!['identity', 'br', 'gzip'].includes(manifest.contentEncoding as string)) {
    invalid('manifest.contentEncoding is invalid')
  }
  requireString(manifest.sha256, 'manifest.sha256', SHA256_PATTERN)
  requirePositiveInteger(manifest.contentLength, 'manifest.contentLength')
  requireString(manifest.decodedSha256, 'manifest.decodedSha256', SHA256_PATTERN)
  requirePositiveInteger(manifest.decodedContentLength, 'manifest.decodedContentLength')
  requirePositiveInteger(manifest.starCount, 'manifest.starCount')
  requirePositiveInteger(manifest.constellationCount, 'manifest.constellationCount')
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    invalid('manifest.sources must be a non-empty array')
  }
  requireString(manifest.publishedAt, 'manifest.publishedAt')
  if (Number.isNaN(Date.parse(manifest.publishedAt as string))) {
    invalid('manifest.publishedAt must be an ISO date-time')
  }
  return manifest as unknown as CatalogManifest
}

function validateCatalog(value: unknown, manifest: CatalogManifest): SkyCatalog {
  const catalog = requireRecord(value, 'catalog')
  requireEqual(catalog.schemaVersion, 1, 'catalog.schemaVersion')
  requireEqual(catalog.catalogId, 'naked-eye', 'catalog.catalogId')
  requireEqual(catalog.referenceFrame, 'ICRS', 'catalog.referenceFrame')
  requireFiniteNumber(catalog.visualMagnitudeLimit, 'catalog.visualMagnitudeLimit')
  if (!Array.isArray(catalog.stars) || catalog.stars.length !== manifest.starCount) {
    invalid(`catalog.stars must contain ${manifest.starCount} records`)
  }
  if (!Array.isArray(catalog.constellations) || catalog.constellations.length !== manifest.constellationCount) {
    invalid(`catalog.constellations must contain ${manifest.constellationCount} records`)
  }

  const starIds = new Set<string>()
  for (const [index, starValue] of catalog.stars.entries()) {
    validateStar(starValue, index, catalog.visualMagnitudeLimit as number, starIds)
  }
  const constellationIds = new Set<string>()
  for (const [index, constellationValue] of catalog.constellations.entries()) {
    validateConstellation(constellationValue, index, constellationIds)
  }
  return catalog as unknown as SkyCatalog
}

function validateStar(value: unknown, index: number, magnitudeLimit: number, ids: Set<string>): StarRecord {
  const label = `catalog.stars[${index}]`
  const star = requireRecord(value, label)
  const id = requireString(star.id, `${label}.id`)
  if (ids.has(id)) invalid(`${label}.id is duplicated`)
  ids.add(id)
  requirePositiveInteger(star.hipId, `${label}.hipId`)
  requireNullableString(star.gaiaDr3Id, `${label}.gaiaDr3Id`, /^[0-9]+$/)
  requireNullableString(star.tycho2Id, `${label}.tycho2Id`, /^[0-9]+-[0-9]+-[0-9]+$/)
  requireNullablePositiveInteger(star.hdId, `${label}.hdId`)
  requireRange(star.raDeg, `${label}.raDeg`, 0, 360, false)
  requireRange(star.decDeg, `${label}.decDeg`, -90, 90)
  requireFiniteNumber(star.epochYear, `${label}.epochYear`)
  requireNullableFiniteNumber(star.pmRaMasPerYear, `${label}.pmRaMasPerYear`)
  requireNullableFiniteNumber(star.pmDecMasPerYear, `${label}.pmDecMasPerYear`)
  requireNullableFiniteNumber(star.parallaxMas, `${label}.parallaxMas`)
  requireRange(star.visualMagnitude, `${label}.visualMagnitude`, -10, magnitudeLimit)
  requireNullableFiniteNumber(star.colorIndex, `${label}.colorIndex`)
  requireNullableString(star.spectralType, `${label}.spectralType`)
  if (!['GAIA_DR3', 'HIPPARCOS_2', 'HIPPARCOS'].includes(star.astrometrySource as string)) {
    invalid(`${label}.astrometrySource is invalid`)
  }
  return star as unknown as StarRecord
}

function validateConstellation(
  value: unknown,
  index: number,
  ids: Set<string>,
): ConstellationRecord {
  const label = `catalog.constellations[${index}]`
  const constellation = requireRecord(value, label)
  const id = requireString(constellation.id, `${label}.id`, IAU_ID_PATTERN)
  if (ids.has(id)) invalid(`${label}.id is duplicated`)
  ids.add(id)
  if (![1, 2, 3].includes(constellation.rank as number)) invalid(`${label}.rank is invalid`)
  validateCoordinateList(constellation.labelPositions, `${label}.labelPositions`, 1)
  if (!Array.isArray(constellation.lines) || constellation.lines.length === 0) {
    invalid(`${label}.lines must be a non-empty array`)
  }
  for (const [lineIndex, line] of (constellation.lines as unknown[]).entries()) {
    validateCoordinateList(line, `${label}.lines[${lineIndex}]`, 2)
  }
  return constellation as unknown as ConstellationRecord
}

function validateCoordinateList(value: unknown, label: string, minimumLength: number): void {
  if (!Array.isArray(value) || value.length < minimumLength) {
    invalid(`${label} must contain at least ${minimumLength} coordinates`)
  }
  for (const [index, coordinate] of value.entries()) {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) invalid(`${label}[${index}] is invalid`)
    requireRange(coordinate[0], `${label}[${index}][0]`, 0, 360, false)
    requireRange(coordinate[1], `${label}[${index}][1]`, -90, 90)
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(`${label} must be an object`)
  return value as Record<string, unknown>
}

function requireString(value: unknown, label: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    invalid(`${label} is invalid`)
  }
  return value
}

function requirePositiveInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) invalid(`${label} must be a positive integer`)
}

function requireFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${label} must be a finite number`)
}

function requireNullableFiniteNumber(value: unknown, label: string): void {
  if (value !== null) requireFiniteNumber(value, label)
}

function requireNullableString(value: unknown, label: string, pattern?: RegExp): void {
  if (value !== null) requireString(value, label, pattern)
}

function requireNullablePositiveInteger(value: unknown, label: string): void {
  if (value !== null) requirePositiveInteger(value, label)
}

function requireRange(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  includeMaximum = true,
): void {
  requireFiniteNumber(value, label)
  if (value < minimum || (includeMaximum ? value > maximum : value >= maximum)) invalid(`${label} is out of range`)
}

function requireEqual(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) invalid(`${label} must equal ${String(expected)}`)
}

function invalid(message: string): never {
  throw new SkyMapError('CATALOG_INVALID', message)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
